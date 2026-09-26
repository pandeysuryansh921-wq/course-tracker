const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React }
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, console: { log() {}, warn() {}, error() {} }, Date, Set });
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
  const videoState = { cachedVideos: {}, videoNotes: {} };
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
