# Công việc

## Đặt tên âm thanh — 07/10/2026

- [x] Đặt tên trước khi nhập audio/video; đổi tên audio đã lưu, không thay đổi file gốc.
- [x] Giữ tên mới khi offline/làm mới thư viện; đổi tên bản đã sao lưu chỉ cập nhật metadata.
- [x] Làm rõ sao lưu Firebase và kiểm thử nhập, hủy, đổi tên, tải lại dữ liệu.
- Lịch sử chẩn đoán Xcode: Firestore từng trả `Cloud Firestore API has not been used in project baseapp-dd227 before or it is disabled`. Hiện database Native và rules riêng theo UID đã được cấu hình; vẫn còn kiểm thử đồng bộ bằng tài khoản thật.

## Audio — 07/10/2026

- [x] A1. Types và validation (types/audio, utils/audio, tests): reject bounds, limits, remote paths; verify focused Jest.
- [x] A2. Native engine iOS (module config + Swift): inspect, audio-only export, trim/ordered concat/cancel; verify build + synthetic media.
- [x] A3. Native engine Android (Gradle + Kotlin): cùng contract, AAC output; verify build + synthetic media. Depends A1.
- [x] A4. Local library (file service/store/tests): persistence per UID, no data loss on errors; verify reopen/isolation. Depends A1.
- [x] A5. Cloud library (Firebase service/rules/tests): owner-only, upload audio, retry/download; verify rules/service. Depends A4.
- [x] A6. Import flow (hook/screen/styles/tests): picker cancel, audio unchanged, video export and cleanup, progress/cancel. Depends A2–A5.
- [x] A7. Player + clip editor (component/hook/tests): preview, bounds, title, save new; verify UI/state. Depends A6.
- [x] A8. Ordered merge (editor/logic/tests): 2–10 segments, reorder, save output; verify duration/order. Depends A7.
- [x] A9. Checkpoint: lint/typecheck/Jest/bundle, native builds/runtime, Firebase setup docs, APK preview. Ghi đúng giới hạn cloud thật.

## Kho âm thanh miễn phí — 07/10/2026

- [x] Đã vào Firebase Console, đối chiếu database và bucket; project Spark ($0).
- [x] Chuyển database trống sang Firestore Native theo xác nhận của chủ tài khoản; Console xác nhận database sẵn sàng.
- [x] Chuẩn bị Supabase Edge Function xác minh Firebase JWT, private bucket, giới hạn 50 MB/file; tests bảo vệ UID và token.
- [x] App chuyển upload mới sang Supabase, download theo provider, metadata Firestore; local fallback không mất file/tên.
- [x] Typecheck/lint, 69 Jest tests, 16 server tests, 18 emulator assertions, Hermes Android/iOS; UI Simulator hiển thị đúng local-only và giữ bản đã lưu.
- [x] Firestore rules private theo UID xuất bản thành công lúc 22:48 theo xác nhận của chủ tài khoản.
- [x] Tạo organization/project Supabase Free ở Singapore; Firebase giữ Spark.
- [x] Tạo bucket private 50 MB, audio-only; deploy function xác minh Firebase JWT; cấu hình `.env` local bị Git ignore.
- [x] Smoke test function trên dashboard: token giả nhận 401; Android/iOS bundle build với cấu hình Supabase.
- [ ] Đăng nhập app bằng tài khoản Firebase thật, thử upload/download fixture tổng hợp và phân quyền hai tài khoản. Chưa upload audio cá nhân.
- [x] Push triển khai audio lên GitHub trước đó; ghi chú triển khai lần này sẽ được commit/push riêng.

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
