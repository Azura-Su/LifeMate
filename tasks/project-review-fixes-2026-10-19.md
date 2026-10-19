# Sửa năm finding review toàn project — 19/10/2026

Phạm vi: năm finding trong `full-project-code-review-2026-10-19.md`.
Giữ các thay đổi working tree có sẵn, không commit/deploy hoặc ghi dữ liệu cloud.

## Thay đổi

1. **Migration ảnh legacy:** thêm migration nối tiếp `202610190002`, lease5 phút
   dùng cùng khóa owner với gỡ/xóa. Giữ row active/Supabase trong lúc copy, chặn
   gỡ/xóa bằng409 và giữ con trỏ khi request lỗi mơ hồ. PUT R2 có atomic
   If-None-Match cùng proof reservation ổn định. Retry có proof đúng dùng lại bản
   copy; bản trước rollout chưa có proof chỉ được nhận nếu bytes giống nguồn qua
   GET có If-Match ETag. CAS cuối cần reservation/token/lease còn hạn. Không xóa
   destination để giải quyết collision và không ghi đè ảnh của lần chia sẻ mới.
2. **Lần nhận lại chi chung:** modal truyền snapshot lúc mở form hoặc hộp xác nhận
   xóa đến hook/store/service. Refresh không đổi expected của mutation; xung đột
   giữ draft và báo lỗi. Thêm mới cùng requestId đã lưu và nội dung khớp được xác
   nhận mà không ghi thêm, chỉ dùng store mới nhất cho bước dedupe, không làm CAS
   baseline cho draft cũ.
3. **Cho vay:** sessionEpoch chỉ thay khi UID đổi/đăng xuất, không thay theo tên/
   email. Load cùng UID sau sửa hồ sơ vẫn nhận dữ liệu và nhả loading; phiên cũ
   logout→login cùng UID bị loại bỏ. Finally chỉ dọn request mình đang sở hữu.
4. **Cảnh báo chia sẻ ký ức mới:** tách publishWarning khỏi lỗi đọc danh sách.
   Chuyển capture→timeline và auto-refresh không xóa cảnh báo lưu riêng/chia sẻ
   lỗi. Xóa khi đổi UID hoặc bắt đầu thao tác chụp/lưu/đổi quyền mới; kiểm tra UID
   sau các await trước khi đưa phản hồi lên màn hình.
5. **Avatar:** race toàn bộ token/fetch/text với deadline20 giây và đổi phiên,
   đồng thời abort transport. Dọn timer/auth listener trong finally, không để
   response body treo giữ promise dedupe/account cleanup vô hạn. Metadata cùng
   UID không hủy request đang hợp lệ.

## Kiểm chứng

- Regression đã tái hiện đỏ trước sửa: loading Cho vay, avatar timeout/logout,
  snapshot receipt sửa/xóa, cảnh báo ký ức mới và migration concurrent/retry.
  Kiểm thử bổ sung receipt retry giống request cũ cũng chạy đỏ trước khi sửa.
- Reviewer backend duyệt plan và mã cuối của lease/conditional copy/SQL; reviewer
  UI duyệt snapshot, phiên, cảnh báo, avatar và delta dedupe. Không còn finding
  actionable trong phạm vi sửa. Reviewer đọc mã/tests; main thực thi các lệnh.
- Typecheck, ESLint toàn repository và `git diff --check`: qua.
- Jest:100 suites /638 tests qua. Backend functions:98 tests qua.
- SDK R2 đúng phiên bản ghim, chạy offline với Web Fetch giả lập:7 tests qua,
  gồm conditional PUT, proof retry và so bytes bản copy trước rollout.
- Export bundle iOS và Android trên mã cuối: qua. Đây không phải native archive
  hoặc xác nhận chạy thực tế trên thiết bị.

## Triển khai và giới hạn

- Migration mới và function chỉ ở mã nguồn. Chạy SQL regression trong transaction
  rollback trên database thử nghiệm trước, rồi migration theo thứ tự, deploy
  `memory-access`, sau đó phát hành client. Chưa phát hành TestFlight.
- PostgreSQL/psql/Docker không có sẵn, chưa thực thi migration/SQL regression trên
  database thật. Bộ test adapter không thay cho SQL validation. Chưa gọi R2 thật.
- Firestore emulator chưa có sẵn; lần trước tải công cụ bị ENOTFOUND. Đợt sửa này
  không đổi rules. Chưa thử thủ công bản mới trên iPhone hoặc đo CPU/nhiệt.
- Lease thất bại có thể giữ trạng thái busy tới5 phút để chờ request chưa rõ kết
  quả kết thúc. Không rollback function về bản copy vô điều kiện trong khi còn
  migration đang chạy; cần kết thúc các request phiên bản cũ trước rollout.
