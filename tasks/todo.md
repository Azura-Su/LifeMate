# Công việc

## Audio — 07/10/2026

- [ ] A1. Types và validation (types/audio, utils/audio, tests): reject bounds, limits, remote paths; verify focused Jest.
- [ ] A2. Native engine iOS (module config + Swift): inspect, audio-only export, trim/ordered concat/cancel; verify build + synthetic media.
- [ ] A3. Native engine Android (Gradle + Kotlin): cùng contract, AAC output; verify build + synthetic media. Depends A1.
- [ ] A4. Local library (file service/store/tests): persistence per UID, no data loss on errors; verify reopen/isolation. Depends A1.
- [ ] A5. Cloud library (Firebase service/rules/tests): owner-only, upload audio, retry/download; verify rules/service. Depends A4.
- [ ] A6. Import flow (hook/screen/styles/tests): picker cancel, audio unchanged, video export and cleanup, progress/cancel. Depends A2–A5.
- [ ] A7. Player + clip editor (component/hook/tests): preview, bounds, title, save new; verify UI/state. Depends A6.
- [ ] A8. Ordered merge (editor/logic/tests): 2–10 segments, reorder, save output; verify duration/order. Depends A7.
- [ ] A9. Checkpoint: lint/typecheck/Jest/bundle, native builds/runtime, Firebase setup docs, APK preview. Ghi đúng giới hạn cloud thật.

## Nền tảng đã hoàn tất

- [x] 1. Nền tảng: package/config/assets, strict TypeScript. Verify: install + Expo config.
- [x] 2. Logic users: types/defaults/parser/tests. Verify: malformed JSON, email normalization, fallback.
- [x] 3. Auth: service/store/login hook. Verify: validation + auth transition tests.
- [x] 4. Remote Config: service/store/lifecycle. Verify: fetch fail/cache/malformed payload tests.
- [x] 5. Notification: service/store/lifecycle/entrypoint. Verify: permission/token/error tests.
- [x] 6. UI dùng chung: theme/button/screen/avatar. Verify: typecheck/accessibility review.
- [x] 7. Login + auth gate. Verify: component tests.
- [x] 8. Home + MP3. Verify: name location/empty state/navigation.
- [x] 9. Setting + bottom tabs. Verify: logout and session reset.
- [x] 10. Server push tool + setup docs. Verify: syntax/no client Admin credentials.
- [x] 11. Checkpoint: lint/test/typecheck/bundle/doctor/prebuild; native build/runtime nếu khả dụng. Ghi rõ giới hạn chưa kiểm chứng.

## Giới hạn kiểm chứng

Native builds Android/iOS đã pass. Chưa có tài khoản Auth thử nghiệm hoặc APNs credentials để xác minh login thành công/push thật. Chi tiết trong `docs/verification.md`.
