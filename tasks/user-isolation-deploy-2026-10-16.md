# Cách ly dữ liệu và deploy — 16/10/2026

## Phạm vi

Theo yêu cầu review dữ liệu user không lẫn nhau và triển khai Firebase/Supabase. Rà UID trên cache/file, store/hook, logout/đổi tài khoản, async hoàn tất muộn, Firebase rules, Edge JWT/account gate, admin, quyền bảng/RPC và bucket. Main xử lý audit/fix/deploy; explorer trace client, reviewer độc lập duyệt plan và diff backend.

## Kết quả review

- Chưa xác định lỗi ghi/hiển thị dữ liệu A sang B trong các luồng đã trace. Finance/agenda/notes/profile có UID/request-generation guards; bootstrap reset khi đổi UID. Audio/playlist/memory dùng key và thư mục riêng theo UID; mạng/avatar kiểm tra phiên trước và sau tác vụ. Chia sẻ Ký ức cho bạn bè là quyền đã được chủ tài khoản chọn, không coi là rò dữ liệu.
- **P2 đã sửa:** audio-access và memory-access chỉ xác minh quyền trước khi đọc streamed body. Request khởi đầu lúc active có thể kết thúc sau khi tài khoản bị khóa/xóa/thu hồi phiên mà vẫn lấy URL hoặc truy cập dữ liệu chia sẻ. Hai handler nay xác minh lại cùng bearer/UID sau khi đọc input, trước business effects. Memory dùng identity mới và kiểm tra lại email verified. Profile đã có cùng lớp kiểm tra này; user-admin kiểm tra quyền sau input.
- 10 regression ban đầu thất bại trước sửa; sau sửa 11 tests mới qua (blocked/deleting/deleted, newer valid_since, identity change, email verification refresh). Reviewer không còn finding cần sửa trong diff.

## Kiểm chứng

- Full Jest: **86 suites / 466 tests qua**. Sau đó thêm **2 tests mã hóa qua**: ciphertext chép A→B hoặc sang namespace khác bị từ chối, dữ liệu gốc vẫn đọc đúng. Crypto trong Jest được mock; đây là kiểm chứng ràng buộc UID/AAD, không phải audit thuật toán native.
- Backend: **66 tests qua** sau sửa.
- Firestore + Storage emulator chạy bằng JDK21 trên project demo: qua. Firestore có owner-positive control và từ chối user khác/chưa đăng nhập ở cả 11 namespace. Storage từ chối user khác/chưa đăng nhập đọc/create/update/delete file A; phiên khóa/xóa và stale auth_time bị chặn.
- Typecheck, full lint trước sửa handler, lint lại tất cả file sửa, Prettier và diff-check: qua.
- Không khóa/xóa tài khoản thật, không chạy sweep production để thử.

## Cấu hình Supabase thật đã kiểm tra (metadata)

- Cả 8 bảng `lifemate_*` bật RLS; anon/authenticated không có SELECT.
- Cả 8 RPC LifeMate chỉ service_role có EXECUTE; anon/authenticated không có.
- `lifemate-audio`, `lifemate-memories`, `lifemate-avatars` đều private. Không có policy trực tiếp cho client trên storage.objects.
- Một cleanup cron active; Vault có secret tương ứng (chỉ kiểm tra tồn tại, không xuất giá trị).
- Các bảng/RPC mới đã tồn tại đúng trên server; không chạy lại migration tạo bảng đã áp dụng.

## Deploy và xác nhận

Firebase project `baseapp-dd227`: Firestore và Storage rules compile/release thành công. CLI xác nhận nội dung rules trước đó đã up to date; lần này đã kiểm thử và release lại.

Supabase project `xbhelntqytleiduzicuj`: deploy đủ 4 functions từ source hiện tại, xác nhận lại ACTIVE:

| Function       | Version |
| -------------- | ------- |
| audio-access   | 9       |
| memory-access  | 9       |
| profile-access | 2       |
| user-admin     | 5       |

Probe HTTP không token sau deploy: cả 4 endpoint trả 401. Không tạo credential hay mở rộng IAM/quyền truy cập. R2 không có thay đổi hạ tầng cần deploy; Edge Functions sử dụng cấu hình R2 hiện hữu.

## Giới hạn

Đây là kiểm chứng mã/tests/emulator và metadata/live unauthenticated probes; chưa thử mọi race trên nhiều thiết bị thật. URL riêng đã ký có thời hạn vẫn là bearer capability đến khi hết hạn hoặc object bị xóa. Dữ liệu riêng trên thiết bị và giới hạn thu hồi bản offline theo SPEC-user-management vẫn áp dụng.

Deployment này cập nhật backend/rules; không phát hành bản cài iOS/Android hay OTA giao diện. Dependency audit theo lockfile không thay đổi vẫn còn các cảnh báo tooling đã ghi tại project-review-2026-10-16.md; không ép nâng/downgrade Expo/RN ngoài phạm vi.
