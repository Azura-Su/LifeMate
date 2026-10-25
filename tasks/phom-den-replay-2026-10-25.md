# Phỏm: đền cấp 3 cây và đền do tái — 25/10/2026

## Yêu cầu và hợp đồng

Theo yêu cầu người dùng, cấp đủ 3 lá cho người ù luôn phải đền; không có công
tắc để tắt luật này. Tùy chọn `options.uDen` hiện có chỉ còn điều khiển đền do
tái: A ăn chốt của B làm B được thêm lượt, B ù trong chính lượt thêm đó thì A
đền. Chỉ hiện công tắc “Ù đền do tái” khi `options.tai` bật. Đền cấp 3 cây ưu
tiên hơn đền tái. Người đã bỏ cuộc không bị quy đền về sau.

Giữ nguyên hình dạng config `{tai,send,uDen}`, mức `den`, parser và hợp đồng
HTTP/SQL. `uDen` giữ lựa chọn khi Tái tắt nhưng không có tác dụng trong trạng
thái đó. Mức điểm 0 vẫn hợp lệ; không làm mất trách nhiệm đền trong kết quả.
Sửa thuật toán cho các ván chưa chốt kết quả; không tính lại kết quả đã lưu.
Config của ván vẫn bất biến; chủ phòng sửa lựa chọn/mức điểm cho ván tiếp theo.
State cũ thiếu nguồn tái không suy đoán trách nhiệm từ `chotEater` toàn ván.

## Thứ tự triển khai

1. Engine (phom.mjs, phom-scoring.mjs và test liên quan): RED trước, gán nguồn
   ăn chốt cho đúng lượt được mở lại. Giữ nguồn qua bốc/ăn/hạ/gửi; tính ù trước
   khi kết thúc lượt; xóa nguồn sau khi đánh xong mà chưa ù hoặc bỏ cuộc. Luật
   cấp 3 cây luôn chọn người đền bất kể `uDen`; quyết toán không chặn lại bằng
   tùy chọn. Không thay snapshot công khai hoặc dữ liệu kết quả cũ.
2. UI (phomConfig, PhomGameSettings, CardGameRules và test): ghi rõ đền cấp
   3 cây bắt buộc; điều kiện hiện công tắc tái; tạo/sửa phòng dùng cùng form;
   luật hiện tại/ván tới phải hiện đúng lựa chọn có hiệu lực.
3. Tích hợp: kiểm thử room/worker/timeout, snapshot không lộ state mới, full
   functions, Jest liên quan, TypeScript, ESLint, bundle iOS/Android. Review
   chỉ đọc kế hoạch trước sửa engine và final diff trước bàn giao.

Mỗi phần phải qua test trước khi chuyển tiếp. Checklist thực hiện nằm trong
`tasks/todo.md`. Giữ các thay đổi CardScore và chuyển chủ phòng có sẵn.

## Kiểm chứng bắt buộc

- Cấp 3 cây với Tái/Ù đền bật hoặc tắt, ưu tiên hơn nguồn tái; tổng điểm 0.
- Ăn chốt → đúng người được tái ù bằng bốc/ăn/hạ/gửi/đánh/timeout → đúng người
  ăn chốt chịu đền. Người khác ù không gây đền chỉ vì có ăn chốt trước đó.
- Nguồn tái hết hiệu lực sau lượt, thay bằng nguồn mới khi ăn chốt nối tiếp;
  người bỏ cuộc/mất lease không bị tính đền ù phát sinh sau.
- Dữ liệu JSON qua request/worker giữ nguồn; snapshot hiện tại và kết quả
  không trả private provenance. State cũ không có nguồn vẫn đọc/chơi được.
- Tái tắt ẩn công tắc; Tái bật hiện lựa chọn; tắt/bật giữ draft; reset mặc định;
  create/edit/current/pending rules thống nhất, không có công tắc cấp 3 cây.

## Giới hạn rollout

Đổi engine cần cập nhật backend `game-access`; đổi UI cần client mới. Không
tự coi source local là backend đã chạy. Chỉ triển khai production khi có ủy
quyền phù hợp; kiểm chứng tại chỗ không tạo/sửa phòng tài khoản thật.

## Kết quả kiểm chứng

- Reviewer chỉ đọc duyệt kế hoạch và final diff; không còn phát hiện chặn.
- RED engine: 5 lỗi thể hiện việc tắt sai cấp3 cây, nhầm người ù không liên
  quan và mất nguồn khi ăn chốt nối tiếp; GREEN cùng regression mở rộng đạt.
  20 ca mới bao phủ JSON, room actions, worker, các đường ù, ưu tiên và vòng đời.
- UI RED 19 ca; GREEN 156 test tạo/sửa/view luật hiện tại/ván tới đạt. Toàn bộ
  Jest sau tích hợp: 136 suites, 1.229 tests đạt, không skip. Còn cảnh báo act
  ở các test cũ; không hạ assertion hoặc suppress cảnh báo.
- Backend toàn bộ: 289/289 đạt, bao gồm PostgreSQL chức năng/quyền/CAS. Lần
  đầu thiếu jose ở môi trường test; đã chạy npm ci riêng functions đúng
  lockfile (jose6.2.12), không thay package.json hoặc lockfile.
- TypeScript, ESLint các file thay đổi, Prettier/diff đạt. Expo export
  iOS/Android đạt tại /private/tmp/lifemate-phom-den-replay-export.
- Không xác minh tương tác native: Computer Use không nhận tên Simulator,
  Device Hub bị timeout. Không suy ra đã smoke test từ bundle/Jest.

## Triển khai backend — 25/10/2026

Đọc production xác nhận LifeMate xbhelntqytleiduzicuj, game-access v16 ACTIVE,
18 file, verify_jwt=false như cũ. So với source local còn một khác biệt có sẵn
ở rooms.mjs (fallback tên người đã rời phòng), ngoài phạm vi thay đổi lần này.
Gói đề xuất lấy đúng 18 file production làm nền và chỉ thay phom.mjs cùng
phom-scoring.mjs; không đẩy rooms.mjs hoặc các thay đổi khác trong working tree.
Không đổi migration/config/secrets hoặc tạo/sửa phòng người dùng.

Người dùng đã xác nhận “Triển khai backend” trong chat. Đã đối chiếu lại v16
trước ghi; baseline không đổi. Deploy riêng game-access hoàn tất
2026-10-25T09:44:13Z, v17 ACTIVE, verify_jwt=false giữ nguyên. Đọc lại 18/18
file khớp byte với gói đã review, chỉ phom.mjs/phom-scoring.mjs khác production
v16. rooms.mjs giữ đúng bản production, không kèm fallback tên chưa triển khai.

Kiểm chứng trực tiếp source read-back: 41/41 test Phỏm đạt (20 ca mới, engine,
options và scoring). Probe POST thiếu token trả401 invalid-session. Không tạo
phòng hoặc thay đổi dữ liệu người dùng để kiểm thử. Bản sao v16, payload và
source đọc lại ở /private/tmp/lifemate-phom-den-deploy.zIuKkq.

Đã chờ426 giây sau deploy; kiểm tra cuối tại 2026-10-25T09:51:19.737Z. Log
09:43:00UTC đến hết cửa sổ xác nhận chỉ có v17 cho game-access: Boot,
request401 kiểm chứng và Shutdown thông thường; không có event v16 hoặc
level error trong kết quả truy vấn. Đọc lại lần cuối vẫn v17 ACTIVE và18/18
file khớp. Probe cuối tiếp tục401 invalid-session. Dịch vụ mode open và cron
lifemate-game-deadlines active; chỉ đọc metadata, không đổi mode hoặc cron.
Rollout backend hoàn tất. Chưa phát hành app/OTA; reload Metro hoặc cập nhật
bản cài để thấy form mới.

### Phục hồi và giới hạn xác nhận

Nếu source read-back lệch gói duyệt, worker lỗi khởi động hoặc có lỗi tính điểm
tái hiện được do bản sửa, có thể deploy lại rollback-v16-payload.json đã đối
chiếu đủ18 file. Không phục hồi snapshot database đè các lượt/điểm mới. File
nguồn tái additive vẫn là JSON hợp lệ khi đọc bằng engine trước sửa.

Cửa sổ410 giây dựa trên [giới hạn Edge Functions](https://supabase.com/docs/guides/functions/limits)
(worker paid tối đa400 giây), tính từ sau khi tool báo deploy xong. Kiểm tra log
chỉ lấy version/status/level tổng hợp, không đọc mã phòng, bài, token hoặc định
danh người dùng. Health401 và test source read-back không thay thế thử trọn
ván trên nhiều thiết bị thật.
