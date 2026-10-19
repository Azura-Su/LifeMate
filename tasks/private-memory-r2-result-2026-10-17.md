# Của tôi lưu ảnh trên R2 — 17/10/2026

## Kết quả

- Ảnh mới Của tôi upload R2 private/{uid}/{id}/{filename}, giữ nguyên định dạng gốc tới 15 MiB. Firestore vẫn lưu metadata/CAS/tombstone; cache mã hóa theo UID giữ nguyên.
- memory-access xác minh Firebase token/account gate; private actions không yêu cầu email xác nhận hay tạo social profile. UID không nhận từ body. Signed PUT 120 giây ràng buộc MIME/cỡ/If-None-Match; HEAD xác nhận cỡ/MIME. HTTP 412 kiểm tra lại HEAD, không ghi đè.
- Cached originals và lost-commit acknowledgement cũng sao lưu R2. Thiết bị thiếu ảnh đọc R2 trước, chỉ fallback Firebase khi R2 xác nhận không có object; ảnh Firebase cũ được sao lưu R2 trước khi hoàn tất restore. Lỗi R2 không bị coi là thiếu ảnh. Giữ Firebase originals.
- Xóa tài khoản dọn cả shared/{uid}/ và private/{uid}/ với phân trang/retry, cùng Firebase originals như trước.
- Sửa cấu hình presigner AWS SDK 3.1149.0 requestChecksumCalculation=WHEN_REQUIRED: đã tái hiện URL bị ràng buộc CRC32 của body rỗng trước fix, kiểm thử bộ ký thật đạt sau fix.
- Không thêm dependency hay sửa lockfile. Giữ nguyên các thay đổi đã có trong workspace. Chưa commit/push.

## Kiểm chứng

- Jest toàn app: 92 suites / 509 tests đạt (watchman=false vì sandbox không ghi được thư mục trạng thái Watchman).
- Backend: 83 tests đạt. Thêm ownership, invalid paths/size, private unverified, explicit absence, immutable confirmation, revocation, cleanup private pagination.
- Offline real AWS presigner: 2 tests đạt, cùng versions trong memory-access/deno.json. Test đã fail trước fix checksum. SDK chỉ được cài trong /tmp/lifemate-r2-sdk-check.
  `R2_SDK_TEST_MODULES=/tmp/lifemate-r2-sdk-check/node_modules node --test supabase/functions/tests/r2-presigner.integration.mjs`
- Sau final adjustments: targeted memoryCloud/memoryPrivatePhotos/memorySync 24 tests đạt; TypeScript/ESLint đạt; git diff --check đạt.
- Expo export Android/iOS đạt. Final client session assertion chỉ thêm kiểm tra trước đổi tên partial file; targeted test/typecheck đạt sau điều chỉnh đó.
- Independent reviewer duyệt plan và final changes; finding checksum đã được tái hiện/sửa/kiểm thử và reviewer xác nhận không còn finding.
- npm audit hiện báo 52 high / 12 moderate / 0 critical trong dependency graph hiện hữu, gồm Expo/Jest transitive packages; không có dependency changes trong task này. Chưa xử lý phần audit ngoài phạm vi.

## Triển khai

- User xác nhận triển khai hai function qua câu hỏi trong chat.
- Supabase xbhelntqytleiduzicuj: memory-access deployment 11, user-admin deployment 9; dashboard cập nhật thành công.
- Chỉ thay handler.mjs/r2.mjs của memory-access và objects.mjs của user-admin. Đã đối chiếu bản server cũ với source và kiểm tra editor khớp byte với file local trước deploy. Không đổi secrets, IAM, schema hoặc rules.
- Probe không token: memory-access/private-head -> 401 unauthenticated, user-admin/list -> 401 invalid-session.
- Screenshot: /tmp/lifemate-r2-deployed.png. Server source trước deploy lưu /tmp/lifemate-r2-old-handler.mjs, /tmp/lifemate-r2-old-adapter.mjs, /tmp/lifemate-r2-old-objects.mjs để có thể redeploy thủ công nếu cần; không xóa object trong task.

## Giới hạn và cách dùng

- Điện thoại phải chạy JS mới rồi mở Ký ức để upload bản trên máy sang R2. Không có expo-updates/EAS OTA trong cấu hình hiện tại; export bundle không tự phát hành tới TestFlight/App Store. Metro local đang chạy cổng 8081.
- Client Firebase-only cũ không đọc được ảnh mới chỉ có trên R2. Mọi thiết bị cần JS mới. Không dual-write vì Firebase quota đang chặn và user yêu cầu ảnh riêng cũng dùng R2.
- Chưa xác minh upload/download ảnh thật trên điện thoại; Simulator đang ở màn đăng nhập, không dùng hay yêu cầu credential để thử. Không khẳng định ảnh của user đã chuyển xong.
- Nếu ảnh chỉ còn trên Firebase và Firebase đang chặn đọc, cần khôi phục quyền đọc để chuyển bản đó. Ảnh vẫn còn trên máy không cần Firebase để sao lưu R2.
