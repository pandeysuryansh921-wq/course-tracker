const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, extraContext = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React }
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, console: { log() {}, warn() {}, error() {} }, Date, Set, ...extraContext });
  return exports;
}

function diagnostics() {
  return load('src/lib/player/playbackDiagnostics.ts').playbackDiagnostics;
}

test('diagnostic subscribers receive new snapshots and complete numbered stages', () => {
  const manager = diagnostics();
  const snapshots = [];
  const unsubscribe = manager.subscribe(state => snapshots.push(state));
  manager.recordStep('14', 'success', 'buffering');
  assert.notEqual(snapshots[0], snapshots[1]);
  assert.equal(snapshots[1].steps.length, 16);
  assert.equal(snapshots[1].steps.find(s => s.step === '14').status, 'success');
  unsubscribe();
});

test('errors and copied reports redact bearer credentials', () => {
  const manager = diagnostics();
  const token = 'ya29.sensitive-token.part_two';
  manager.recordError(`Failed Bearer ${token}`, `Cause: ${token}`);
  assert.ok(!manager.getCopyableReport().includes(token));
  assert.ok(!manager.getState().errorMessage.includes('sensitive'));
});

test('native HTTP failure preserves confirmed stages without inventing READY', async () => {
  const manager = diagnostics();
  const bridge = load('src/lib/player/lecturePlayerBridge.ts', {
    '@capacitor/core': {
      registerPlugin: () => ({ playLecture: async () => ({
        hasError: true, errorMessage: 'Source error', errorCodeName: 'ERROR_CODE_IO_BAD_HTTP_STATUS',
        httpStatus: 403, errorDetails: 'Forbidden', nativeTrace: ['08','09','10','11','12','13','14']
      }) }), Capacitor: {}
    },
    './playbackDiagnostics': { playbackDiagnostics: manager }
  });
  await bridge.playNativeLecture({ fileId: 'private-file', videoUrl: 'https://www.googleapis.com/drive/v3/files/private-file?alt=media' });
  const state = manager.getState();
  assert.equal(state.steps.find(s => s.step === '08').status, 'success');
  assert.equal(state.steps.find(s => s.step === '14').status, 'success');
  assert.equal(state.steps.find(s => s.step === '15').status, 'pending');
  assert.equal(state.steps.find(s => s.step === '16').status, 'pending');
  assert.match(state.errorDetails, /403/);
});

test('video classification does not mistake a primary Drive PDF for a lecture', () => {
  const { isVideoResource, extractDriveFileId } = load('src/lib/player/videoResource.ts');
  assert.equal(isVideoResource({ type: 'pdf', mimeType: 'application/pdf', role: 'PRIMARY', driveFileId: 'private-notes' }), false);
  assert.equal(isVideoResource({ type: 'link', mimeType: 'video/mp4', driveFileId: 'private-video' }), true);
  assert.equal(isVideoResource({ title: 'Lecture.MP4' }), true);
  assert.equal(extractDriveFileId('https://drive.google.com/file/d/private-video/view'), 'private-video');
});

test('a lecture without notes has stable store snapshots and launch dependencies across renders', () => {
  const effects = [];
  const React = {
    useState: initial => [initial, () => {}],
    useRef: initial => ({ current: initial }),
    useEffect: (callback, deps) => effects.push(deps),
    useCallback: callback => callback,
    useMemo: callback => callback()
  };
  const videoState = { cachedVideos: {}, videoNotes: {}, settings: { playbackSpeed: 1.0 } };
  const curriculumState = { topics: [], modules: [], courses: [], resources: [] };
  const useStore = state => selector => {
    const first = selector(state);
    assert.equal(first, selector(state), 'identical store reads must return the same snapshot');
    return first;
  };
  const { default: Modal } = load('src/components/study/VideoPlayerModal.tsx', {
    react: { default: React, ...React }, 'lucide-react': {},
    '@/stores/useVideoCacheStore': { useVideoCacheStore: useStore(videoState) },
    '@/stores/useCurriculumStore': { useCurriculumStore: useStore(curriculumState) },
    '@/lib/drive/cacheManager': {}, '@/lib/driveSync': {},
    '@/lib/curriculum/ordering': load('src/lib/curriculum/ordering.ts'),
    '@/lib/player/lecturePlayerBridge': {},
    '@/lib/player/playbackDiagnostics': { playbackDiagnostics: diagnostics() },
    './PlaybackDiagnosticOverlay': {}, '@capacitor/core': {},
    '@/lib/player/videoResource': load('src/lib/player/videoResource.ts')
  });
  const props = { isOpen: false, fileId: 'private-video', topicId: 'topic', courseId: 'course', lectureTitle: 'Lecture', onClose() {} };
  Modal(props);
  const firstDeps = effects.at(-1);
  effects.length = 0;
  Modal({ ...props, onClose() {} });
  const nextDeps = effects.at(-1);
  assert.equal(firstDeps.length, nextDeps.length);
  firstDeps.forEach((value, index) => assert.equal(value, nextDeps[index], 'ordinary renders must not restart the launch effect'));
});

test('Issue 1: downloading file is NEVER classified as locally playable media', async () => {
  const cacheManager = load('src/lib/drive/cacheManager.ts', {
    '@capacitor/filesystem': { Filesystem: {}, Directory: {} },
    '@capacitor/core': { Capacitor: { isNativePlatform: () => false, convertFileSrc: (u) => u } }
  });

  // A. Downloading cache item must resolve to cloud direct stream, NOT local
  const downloadingItem = {
    status: 'DOWNLOADING',
    downloadProgress: 45,
    fileId: 'file-123'
  };

  const resolved = await cacheManager.resolveVideoSource(
    'file-123',
    undefined,
    'mock-token',
    downloadingItem
  );

  assert.equal(resolved.isOffline, false, 'Downloading item must NOT be marked isOffline: true');
  assert.equal(resolved.isIncomplete, true, 'Downloading item must be flagged isIncomplete: true');
  assert.ok(resolved.directStreamUrl, 'Must return direct stream URL for cloud playback');
  assert.ok(!resolved.rawNativeUri, 'Must NOT return rawNativeUri for downloading item');

  // B. isVideoCachedLocally returns false for DOWNLOADING items
  const isCached = await cacheManager.isVideoCachedLocally('file-123', undefined, downloadingItem);
  assert.equal(isCached, false, 'isVideoCachedLocally must return false while downloading');

  // C. DOWNLOAD_FAILED also returns false
  const failedItem = { status: 'DOWNLOAD_FAILED', fileId: 'file-123' };
  assert.equal(await cacheManager.isVideoCachedLocally('file-123', undefined, failedItem), false);
});

test('Issue 2: natural sorting sorts numbered files naturally without alphanumeric distortion', () => {
  const { naturalCompare } = load('src/lib/drive/scanner.ts', {
    '@/lib/ai/client': {}
  });
  const files = ['10 Muscles.mp4', '01 Intro.mp4', '2 Bones.mp4', '11 Joints.mp4'];
  files.sort(naturalCompare);
  assert.deepEqual(files, ['01 Intro.mp4', '2 Bones.mp4', '10 Muscles.mp4', '11 Joints.mp4']);
});

test('Issue 2: ORDER ≠ PREREQUISITE in course progression modes', () => {
  const { getCourseProgressionMode } = load('src/lib/curriculum/ordering.ts');

  // Authored course without Drive folder defaults to STRUCTURED
  const authoredCourse = { id: 'c1', name: 'Robotics Degree' };
  assert.equal(getCourseProgressionMode(authoredCourse), 'STRUCTURED');

  // Drive course with driveFolderId defaults to ORDERED_LIBRARY
  const driveCourse = { id: 'c2', name: 'Drive Anatomy', driveFolderId: 'folder-123' };
  assert.equal(getCourseProgressionMode(driveCourse), 'ORDERED_LIBRARY');

  // Explicit progressionMode takes precedence
  const explicitOpen = { id: 'c3', name: 'Ref Library', driveFolderId: 'folder-123', progressionMode: 'OPEN_LIBRARY' };
  assert.equal(getCourseProgressionMode(explicitOpen), 'OPEN_LIBRARY');
});

test('Issue 2: canonical topic sequence is consistent for UI, navigation, and prefetch', () => {
  const { getCanonicalOrderedTopics, getCanonicalNextTopic, getCanonicalPreviousTopic } = load('src/lib/curriculum/ordering.ts');

  const topics = [
    { id: 't2', courseId: 'c1', moduleId: 'm1', name: 'Joints', order: 2, sequenceIndex: 2 },
    { id: 't1', courseId: 'c1', moduleId: 'm1', name: 'Bones', order: 1, sequenceIndex: 1 },
    { id: 't3', courseId: 'c1', moduleId: 'm2', name: 'Muscles', order: 1, sequenceIndex: 3 }
  ];
  const modules = [
    { id: 'm1', courseId: 'c1', name: 'Module 1', order: 1 },
    { id: 'm2', courseId: 'c1', name: 'Module 2', order: 2 }
  ];

  const ordered = getCanonicalOrderedTopics('c1', topics, modules);
  assert.equal(ordered.length, 3);
  assert.equal(ordered[0].id, 't1');
  assert.equal(ordered[1].id, 't2');
  assert.equal(ordered[2].id, 't3');

  const next = getCanonicalNextTopic('t1', 'c1', topics, modules);
  assert.equal(next?.id, 't2');

  const prev = getCanonicalPreviousTopic('t3', 'c1', topics, modules);
  assert.equal(prev?.id, 't2');
});

test('Issue 3: OAuth Course Library token memory cache & expiration lifecycle', () => {
  const mockStorage = new Map();
  const localStorageShim = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k)
  };

  const driveSyncModule = load('src/lib/driveSync.ts', {
    '@capawesome/capacitor-google-sign-in': { GoogleSignIn: {} },
    '@capacitor/core': { Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } },
    '@/lib/player/lecturePlayerBridge': { NativeLecturePlayer: {} },
    '@/lib/db': { db: {} },
    'dexie-export-import': {}
  }, {
    window: {},
    localStorage: localStorageShim
  });

  const { saveCourseLibraryUser, getCachedCourseLibraryToken, clearCourseLibraryToken } = driveSyncModule;

  // 1. Initially no token
  clearCourseLibraryToken();
  assert.equal(getCachedCourseLibraryToken(), null);

  // 2. Save active user session valid for 1 hour (3600s)
  saveCourseLibraryUser({ email: 'student@example.com' }, 'ya29.test_active_token', 3600);

  // 3. Immediately retrieved without prompt
  assert.equal(getCachedCourseLibraryToken(), 'ya29.test_active_token');

  // 4. Token near expiry (< 5 min remaining = 300s) is evicted to prevent mid-stream failure
  saveCourseLibraryUser({ email: 'student@example.com' }, 'ya29.expiring_soon_token', 60);
  assert.equal(getCachedCourseLibraryToken(), null, 'Near-expiry token must be evicted');

  // 5. Explicit clear wipes cache
  saveCourseLibraryUser({ email: 'student@example.com' }, 'ya29.valid_token_2', 3600);
  assert.equal(getCachedCourseLibraryToken(), 'ya29.valid_token_2');
  clearCourseLibraryToken();
  assert.equal(getCachedCourseLibraryToken(), null);
});

test('Issue 3: Native Android silently refreshes expired token with 0 account chooser prompts', async () => {
  let silentCalls = 0;
  let interactiveSignInCalls = 0;

  const mockStorage = new Map();
  const localStorageShim = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k)
  };

  const mockNativePlayer = {
    getSilentAccessToken: async (opts) => {
      silentCalls++;
      assert.equal(opts.email, 'student@example.com');
      return {
        accessToken: 'ya29.silent_refreshed_token',
        expiresAt: Date.now() + 3600 * 1000
      };
    }
  };

  const mockGoogleSignIn = {
    initialize: async () => {},
    signIn: async () => {
      interactiveSignInCalls++;
      return {
        accessToken: 'ya29.interactive_token',
        user: { email: 'student@example.com' }
      };
    }
  };

  const driveSyncModule = load('src/lib/driveSync.ts', {
    '@capawesome/capacitor-google-sign-in': { GoogleSignIn: mockGoogleSignIn },
    '@capacitor/core': { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } },
    '@/lib/player/lecturePlayerBridge': { NativeLecturePlayer: mockNativePlayer },
    '@/lib/db': { db: {} },
    'dexie-export-import': {}
  }, {
    window: {},
    localStorage: localStorageShim
  });

  const { saveCourseLibraryUser, getCourseLibraryAccessToken, clearCourseLibraryToken } = driveSyncModule;
  clearCourseLibraryToken();

  // Seed user with expired token (-10s)
  saveCourseLibraryUser({ email: 'student@example.com' }, 'ya29.expired_token', -10);

  // Call getCourseLibraryAccessToken()
  const authResult = await getCourseLibraryAccessToken();

  assert.equal(authResult.token, 'ya29.silent_refreshed_token');
  assert.equal(silentCalls, 1, 'Silent native token refresh must be invoked');
  assert.equal(interactiveSignInCalls, 0, 'Interactive GoogleSignIn.signIn must NEVER be called when silent refresh succeeds');
});

test('Issue 4: Playback speed preference persists across sessions and passes to native player', async () => {
  let launchedSpeed = null;

  const bridge = load('src/lib/player/lecturePlayerBridge.ts', {
    '@capacitor/core': {
      registerPlugin: () => ({
        playLecture: async (opts) => {
          launchedSpeed = opts.playbackSpeed;
          return {
            hasError: false,
            playbackSpeed: 1.75 // User changed speed to 1.75x during playback
          };
        }
      }),
      Capacitor: {}
    },
    './playbackDiagnostics': { playbackDiagnostics: diagnostics() }
  });

  const result = await bridge.playNativeLecture({
    fileId: 'video-123',
    videoUrl: 'https://example.com/stream',
    playbackSpeed: 2.0 // Stored speed 2.0x
  });

  assert.equal(launchedSpeed, 2.0, 'playNativeLecture must pass stored playbackSpeed to native activity');
  assert.equal(result.playbackSpeed, 1.75, 'Result must pass back updated speed to be synced with store');
});

