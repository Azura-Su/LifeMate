# Công việc

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
