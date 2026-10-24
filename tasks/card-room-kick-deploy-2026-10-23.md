# Sửa kích người khỏi phòng — 23/10/2026

## Nguyên nhân xác nhận

- Production `xbhelntqytleiduzicuj` đang chạy `game-access` v8, chưa nhận lệnh
  `kick`. Chạy request hợp lệ qua source v8 tải lại trả 400 `invalid-input`,
  chưa gọi database.
- RPC `lifemate_game_commit` chưa có nhánh kick; `lifemate_game_read` chưa trả
  thông báo bị kích; chưa có RPC recovery/trigger xóa notice. Lịch sử migration
  đã đối chiếu đến shared scores `20261021130001`.
- Người dùng đã cho phép deploy nếu cần trong yêu cầu này.

## Kế hoạch triển khai

1. Sao lưu source Edge v8 và định nghĩa RPC/lịch sử vào thư mục tạm cục bộ.
2. Bổ sung validation version/match cho kick và regression input không hợp lệ.
3. Chuẩn bị bundle riêng từ v8, thêm phần kick/notice/recovery/giới hạn ghế;
   giữ tương thích chức năng hiện có trên cloud. Phỏm và các migration khác
   đang chuẩn bị trong workspace không nằm trong bản deploy này.
4. Reviewer chỉ đọc duyệt plan và diff; kiểm thử bundle riêng với định nghĩa
   database đang chạy, rehearsal migration và luồng kick/retry/rejoin/quyền.
5. Áp dụng riêng migration `20261022110124_card_room_member_management.sql`
   cùng bản ghi lịch sử trong một transaction, sau đó deploy bundle game.
   Các signature hiện có được giữ nguyên, không sửa dữ liệu phòng đang có.
6. Đọc lại source/schema và metadata, giữ `verify_jwt=false` vì Edge tự xác
   minh Firebase JWT. Kiểm tra bằng fixture SQL chỉ tồn tại trong transaction
   rollback; probe API không token. Không kích người dùng thật để thử.

## Phục hồi

Giữ source v8 và định nghĩa RPC trước deploy ở
`/private/tmp/lifemate-kick-repair-20261023`. Nếu Edge lỗi, triển khai lại source
v8; schema bổ sung tương thích v8 nên không cần xóa notice hay sửa điểm/phòng.
Không phục hồi snapshot dữ liệu đè lên thao tác mới của người chơi.

## Kết quả

- Đã áp dụng migration duy nhất và ghi lịch sử cùng transaction có guard đối
  chiếu fingerprint read/commit trước khi thay thế. Đã deploy `game-access`
  **v9 ACTIVE**, giữ `verify_jwt=false`. Đọc lại đủ 13 file source cloud khớp
  byte với bundle được reviewer duyệt. Cron game vẫn active.
- Kiểm chứng database production bằng fixture service-role, giữ mọi guard hiện
  hành: người thường/thiết bị khác/version cũ bị từ chối; kick xóa đúng ghế và
  trả notice đúng phiên; retry không kích hai lần; recovery response cũ không
  tự thêm ghế; vào lại chủ động xóa notice; người thứ5 bị từ chối. Transaction
  đã rollback; số ghế và receipt fixture còn lại đều0. API không token trả401
  `invalid-session`.
- Regression mới chứng minh trước sửa kick thiếu validation CAS và trả503 cho
  input version0; sau sửa trả400 trước khi truy cập database.
- 230/230 backend tests, 76/76 client tests liên quan, typecheck và lint đạt.
  Bundle riêng vượt9 ca SQL/API với định nghĩa cloud; rehearsal toàn bộ rollout
  có lịch sử migration và fixture rollback vượt6 ca bổ sung.
- Reviewer chỉ đọc duyệt plan, bundle/diff, rollout và fixture production.
  Không phát hành client/OTA trong tác vụ này. Hành vi xác nhận native và luồng
  kích trên nhiều điện thoại thật chưa được kiểm chứng; nguyên nhân backend
  chưa deploy đã được xác nhận và xử lý.
