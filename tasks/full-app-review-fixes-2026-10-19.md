# Sửa các lỗi review toàn ứng dụng — 19/10/2026

## Kết quả

Đã sửa bốn finding trong `full-app-logic-ui-review-2026-10-19.md` ở mã nguồn.
Không triển khai backend/migration, không phát hành TestFlight, không thay dữ liệu
production hoặc secrets. Giữ các thay đổi working tree có sẵn.

### Gỡ chia sẻ không bị xác nhận đồng thời đảo ngược

- Migration mới `202610190001_memory_revocation_lease.sql` thêm trạng thái
  revoking, token/lease cleanup5 phút và reservation token UUID; không sửa lịch
  sử migration cũ.
- RPC claim dùng cùng khóa owner với reserve/delete-own; unshare ẩn metadata ngay.
  Chỉ một cleanup worker giữ lease, kiểm tra lease còn ít nhất30 giây sau mỗi
  await kiểm tra trước khi xóa object và xóa row theo đúng token.
- Confirm chỉ nhận đúng pending reservation, chặn ABA kể cả timestamp giống nhau.
  Supabase legacy có overload RPC ba tham số với token; giữ overload cũ cho rollout.
- Publish bị chặn khi revoking. Lỗi/timeout cleanup giữ lease và con trỏ vì kết quả
  xóa object có thể chưa chắc chắn; unshare có thể retry sau hết lease.
- Pending publish retry không DELETE object theo GET cũ; signed R2 PUT thay bản
  pending cùng đường dẫn. RPC giữ cờ cleanup Supabase dưới khóa và chặn chuyển
  pending photo sang text-only trước khi gỡ. Quota vẫn tính các row chưa dọn xong.
- Giữ đường dẫn fixed-path và request client hiện có, không đổi R2 key policy.

### Giữ bản gốc của form sửa

- Form giao dịch Finance, Notes, ghi chú ngày lịch và Agenda truyền snapshot lúc
  mở qua store đến service; tạo mới truyền null. Kiểm tra cache drift trong hàng
  đợi UID trước ghi cache/cloud. Từ chối lưu khi bản đã đổi và giữ draft hiển thị.
- Hoàn thành Agenda và mutation shared receipt chuyển snapshot hiện có xuống
  service. Không thay phép tính tài chính hoặc dữ liệu schema đã lưu.
- Giữ pending-base ban đầu cho chuỗi sửa offline và cơ chế conflict cloud hiện có.
- Tham số snapshot của các storage service là optional để giữ compatibility với
  caller cũ; các store/UI ứng dụng bắt buộc truyền snapshot và đã cập nhật mọi caller.

### Trở lại Hồ sơ khi hết cooldown

Khởi tạo interval trước tick đầu, giữ foreground/countdown gating. Regression
đưa app background61 giây rồi active, kiểm tra gửi lại khả dụng và interval bị dọn.

### Giải phóng yêu cầu ảnh riêng bị treo

Race cả fetch và JSON body với promise reject khi timeout20 giây/đổi tài khoản,
đồng thời abort transport. Dọn timer và auth subscription trong finally. Regression
JSON decoder không settle xác nhận request vẫn kết thúc và không upload tiếp.

## Kiểm chứng

- Các regression mới đã được chạy đỏ trước khi sửa cho lỗi timer, stalled JSON,
  stale editor và unshare/confirm.
- Typecheck và ESLint toàn repository: qua.
- Jest:99 suites /628 tests qua, gồm test UI giữ draft sau refresh.
- Backend:94 tests qua. Bao gồm confirm/publish/unshare đồng thời, retry sau lỗi,
  stale cleanup token, expired/delayed lease không xóa object, confirm cũ không
  kích hoạt reservation mới, publish GET cũ không xóa ảnh mới, text-only GET cũ
  không làm mất con trỏ pending photo, bảo toàn cleanup Supabase.
- Expo export offline iOS+Android: qua (`/tmp/lifemate-fix4-export`). Không phải
  native archive hoặc kiểm chứng trên iPhone thật.
- Independent reviewer đã review kế hoạch trước sửa và code sau sửa. Các finding
  bổ sung về cleanup retry, guard trong SQL và fixture đã được xử lý và re-review;
  lượt cuối không còn finding cần sửa.
- `git diff --check`: qua.

## Giới hạn và triển khai

Chưa thực thi migration/SQL regression trên PostgreSQL: môi trường không có
PostgreSQL/psql hoặc Docker. SQL regression được bổ sung trong
`supabase/tests/private-memory-deletions.sql` để chạy trong transaction rollback
trên database thử nghiệm. Test backend dùng adapter DB trong bộ nhớ, không thay
thế việc này. Không thay Firestore rules; emulator trước đó không tải được công cụ
vì lỗi mạng nên không khẳng định rules tests đã chạy lại.

Thứ tự: SQL regression trên database thử nghiệm → migration mới → deploy
memory-access → phát hành client. Giữ schema mở rộng nếu rollback client; không
thu hẹp status khi vẫn còn revoking. Sau cleanup lỗi, có thể chờ tối đa5 phút để
retry unshare an toàn; chưa có background worker tự dọn lease lỗi. Các signed URL
đã cấp giữ giới hạn hết hạn hiện có.
