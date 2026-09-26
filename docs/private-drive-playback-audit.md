# Private Drive playback audit — 26 September 2026

## Evidence and root cause

The unchanged checkout passed both `npm run build` and Android `:app:assembleDebug`. This is a runtime investigation, not a reproduced compiler failure. No tablet is connected (`adb devices` is empty), and no device trace was supplied. The exact last successful stage and failing native stage on the user's tablet remain **unobserved**. Compilation does not prove the plugin was invoked or a private MP4 played.

Two concrete React lifecycle defects were found in `VideoPlayerModal.tsx` before editing:

- The notes selector returned `state.videoNotes[activeTopicId] || []`. For a newly imported lecture without notes, identical store reads produce different snapshots. The installed Zustand adapter uses React `useSyncExternalStore`, which requires a stable snapshot. This can cause repeated renders / maximum-update-depth failure, even while the modal is closed.
- `courseModules` was recreated every render. It invalidated `orderedCourseTopics`, `switchToTopic`, `initializePlayback`, and consequently the launch effect. UI/cache/progress updates could cancel asynchronous startup and launch it again; a result from an invalidated run could be ignored. This affected the React-to-native launch boundary, not Drive scanning.

These are confirmed source defects, not proof that they explain every failure in the installed tablet build. The previous iframe removal addressed WebView navigation, but did not address these lifecycle defects.

## Execution-chain audit

| Boundary | Finding |
| --- | --- |
| Import → Dexie | `DriveCourseModal` passes the scanned file's `id` as `driveFileId`; `useCurriculumStore.addResource` persists it. No importer or schema changes required. |
| ResourceLink → modal | Canonical `resource.driveFileId` takes priority over URL extraction. Video type, MIME and extensions identify videos. A separate defect classified any PRIMARY Drive resource as video, and next-resource selection accepted any Drive ID, including PDFs. Both now use the same video classifier. |
| Platform and web fallback | Native Android selects the native branch. ResourceLink's iframe is restricted to web PDFs. The resolver constructs a preview URL, but the Android video path never consumes it. No Android video browser fallback was found. |
| OAuth | Playback uses the same `getCourseLibraryAccessToken` helper as the library, reading `result.accessToken`, not an ID token or authorization code. Token freshness/permissions on the tablet remain unverified. Previously playback continued after token acquisition failed. Streaming now stops there; verified local files skip OAuth. |
| JS bridge | `registerPlugin('LecturePlayer')` matches `@CapacitorPlugin(name = "LecturePlayer")`. `MainActivity` registers it before bridge creation, consistent with the installed Capacitor implementation. Runtime invocation still needs a tablet trace. |
| Intent and manifest | `fileId`, URL, token and offline flag are passed into Intent extras and read by `LecturePlayerActivity`. Manifest activity `.player.LecturePlayerActivity` and package/namespace consistently use `com.degreetrack.quiz`. Package safety check passes. |
| Streaming source | Uses `https://www.googleapis.com/drive/v3/files/{id}?alt=media`. `DefaultHttpDataSource.Factory` receives the Bearer header, remains the upstream factory inside `CacheDataSource`, and feeds `ProgressiveMediaSource`. No preview URL is supplied to Media3. |
| Cache | Process singleton SimpleCache, app-private cache directory, LRU eviction, default URI cache key, default cache write sink, and ignore-cache-on-error flag. No evidence justifies removing it. Cache initialization exceptions previously escaped startup; they now return diagnostics. |
| Local playback | Resolver checks the canonical file's existence and returns its raw file URI. Local Media3 sources use DefaultDataSource, separately from authenticated HTTP/cache. Content URIs are now also recognized as local. |
| Media3 events | BUFFERING, READY and isPlaying now contribute actual native trace entries returned with the activity result. Errors return error code/name, HTTP status and sanitized cause chain. The old JS panel guessed readiness from activity completion and never received most native stages. |

Range requests, redirects, 401/403/404/416 responses, actual cache writes, decoder compatibility and private-file permissions cannot be validated from compilation. No claim is made that these are the tablet's cause. Existing Media3 range/redirect behavior and caching remain in place.

## Implemented fix and diagnostics

- Stable empty-notes snapshot and memoized module ordering.
- Launch effect keyed to open state, lecture identity and explicit retry, with current callback data read from a ref. Cache/progress/diagnostic renders no longer restart it. Cancelled startup is checked before native invocation, including after resolving the next lecture.
- Shared resource classification excludes PDFs regardless of Drive ID or PRIMARY role.
- Missing token blocks cloud playback; local playback does not prompt for OAuth.
- Copyable diagnostics contain stages 01–16, actual Android acknowledgements for 08–16, sanitized error details, and fresh React state snapshots. Unobserved stages remain pending. Native startup exceptions return to DegreeTrack.

Native traces are delivered when the activity returns; while its error dialog is open, Copy Diagnostics copies the native stages and error. This is not a live logcat stream. Process death before an activity result cannot be diagnosed by this in-memory report.

## Risk and acceptance tests

The launch lifecycle intentionally snapshots options per attempt; changing cache/progress metadata should update the UI without reopening the native activity. Verify explicit retry, close/reopen and switching lectures on-device. No scanning, hierarchy, import, backup, privacy, database schema, package identity or cache eviction policy was changed.

Validation completed: production Next.js build (including TypeScript and package safety), Capacitor Android sync, and Android :app:assembleDebug all passed. Five regression tests passed, covering stable no-notes snapshots/launch dependencies, diagnostic snapshots, credential redaction, native HTTP failure reporting, and video/PDF classification. The stability regression was also run against the original modal source and failed as expected. These are unit/build checks, not a real-device playback test. The corrected APK is android/app/build/outputs/apk/debug/app-debug.apk and includes the freshly synchronized web assets.

Required tablet acceptance before declaring playback fixed:

1. Import/open a private MP4 with no notes and no downloaded copy. Confirm exactly one native launch and stages 14 BUFFERING → 15 READY → 16 PLAYING; verify audio and video.
2. Seek forward/backward and resume a lecture; check range handling and no relaunch during UI/cache updates.
3. Download a known-good MP4, disable networking, and verify native local playback without sign-in.
4. Test an expired/revoked token and inaccessible/deleted file. Copy Diagnostics must expose the failure/HTTP status, not credentials, and must not invent READY or PLAYING.
5. Compare cold and warm streaming cache behavior. If only cached streaming fails, diagnose cache separately before considering a temporary bypass.
6. Retry after failure, close/reopen and switch lecture. Confirm no duplicate activity and no browser/iframe navigation.

If playback still fails, the tablet's copied report is required to identify the exact last successful stage and next fix. Do not infer OAuth, cache or codec failure from the earlier WebView symptom alone.
