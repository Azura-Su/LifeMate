# Triển khai Phỏm online — 23/10/2026

Người dùng đã xác nhận “Hoàn tất và deploy Phỏm”.

## Phạm vi và trình tự

1. Đối chiếu production `xbhelntqytleiduzicuj` v9 và9 phiên bản migration;
   sao lưu source,32 RPC, quyền và lịch sử trong thư mục tạm riêng.
2. Kiểm tra bundle game hỗ trợ cả hai engine với định nghĩa database production.
   Giữ các service khác và thông tin xác thực hiện hành.
3. Deploy Edge hỗ trợ cả Tiến lên/Phỏm trước khi có RPC tạo Phỏm. Client cũ
   tiếp tục chơi Tiến lên; lúc này chưa tạo được phòng Phỏm.
4. Xác nhận source/version mới và chờ ít nhất410 giây, bao phủ giới hạn worker
   wall-clock400 giây của Supabase. Kiểm tra log version để phát hiện request
   v9 muộn và kéo dài barrier nếu cần. Không bật mode closed vì worker hiện có
   sẽ coi thành viên thực là hết quyền và dọn ghế.
5. Áp dụng riêng hai migration `20261022185526_shared_score_patch_operations`
   và `20261022194436_phom_online_rooms` cùng bản ghi lịch sử trong transaction
   có guard fingerprint. Không ghi các phiên bản trung gian chưa chạy.
6. Kiểm chứng fixture rollback trên PostgreSQL production: config/kind/title,
   chia bài/chơi/quyết toán, dữ liệu điểm và quyền. Đọc lại source/schema, probe
   auth, kiểm tra advisory và cron. Sau đó client3 có thể tạo phòng Phỏm.

## Phục hồi

Trước khi bật RPC Phỏm có thể trở về source v9. Sau khi đã có phòng Phỏm,
phải giữ worker và engine hỗ trợ Phỏm; nếu cần thì tạm chặn riêng tạo phòng
Phỏm, giữ thao tác và timeout của các phòng đang tồn tại. Không phục hồi snapshot
dữ liệu cũ đè lên các lượt mới.

## Kiểm chứng trước triển khai

-11 ca SQL/API theo schema production + hai migration chính xác đạt, gồm Phỏm,
  kick, recovery, xóa/sửa bảng điểm và patch bảng lớn.
-52 tests UI/protocol liên quan Phỏm đạt.
-230 backend tests, typecheck/lint và76 client tests đã đạt ở lần kiểm tra ngay
  trước đó; source không đổi sau lần kiểm tra đó.
-5 ca Tiến lên/kick/recovery với code mới trước khi có schema Phỏm đạt.
-Fixture rollback đã rehearsal thành công ba ván2/3/4 người với20/31/42 thao
  tác; so sánh đầy đủ số tiền từng người và match ID trong bảng điểm.
-Simulator iOS26.3 đã mở được app hiện tại, vào danh mục Phỏm và form cấu hình;
  cuộn/focus xuống được mức đền và nút tạo phòng. Chưa tạo phòng bằng tài khoản
  thật hoặc thử trọn ván trên nhiều thiết bị.

## Kết quả

- `game-access` **v10 ACTIVE**, `verify_jwt=false`; đọc lại đủ17 file source
  khớp byte với bundle được review. Deploy xong10:38:10UTC; invocation v9 cuối
 10:38:10.350UTC, không có invocation v9 mới trong log trước bật schema sau
 10:45:06UTC. RPC tạo Phỏm chưa tồn tại trong suốt barrier.
- Đã áp dụng riêng hai migration và ghi đúng hai phiên bản trong transaction
  có guard. Không áp dụng/ghi bừa các migration memory hoặc phiên bản game cũ
  được thay thế bởi hai migration này. Không đổi config/mode/cron/secrets.
- PostgreSQL production vượt fixture ba ván2/3/4 người, cấu hình riêng10 mức,
  retry từng thao tác, kết quả/điểm từng người, match ID, sửa điểm và xóa terminal.
  Fixture dùng trạng thái từ engine đã kiểm thử và RPC thật; không coi đây là
  kiểm chứng end-to-end Firebase/Edge trên nhiều thiết bị.
- Transaction fixture đã rollback; không còn ghế/receipt thử. API thiếu token
  vẫn trả401 `invalid-session`; cron active. Security advisor giữ nguyên19 INFO
  về bảng service-only không có policy và1 WARN có sẵn về RPC membership dùng
  cho Realtime; không xuất hiện advisory mới do Phỏm.
- Reviewer chỉ đọc duyệt plan, stage/rollout, barrier và fixture; đã sửa assertion
  điểm từ chỉ kiểm tổng0 thành so sánh đầy đủ từng người và match ID, rerun đạt.
- Native đã xác nhận danh mục/form và truy cập cuối form; chưa thử trọn ván trên
  nhiều điện thoại thật. Không phát hành bản cài hoặc OTA trong lần deploy backend.

Backup/source/diff/log và script rehearsal nằm ở
`/private/tmp/lifemate-phom-deploy-20261023`, không đưa thông tin xác thực vào repo.
