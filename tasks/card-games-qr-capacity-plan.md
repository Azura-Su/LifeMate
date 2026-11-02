# Plan: QR vào phòng, luật và bàn 5–6 người

Yêu cầu: lập plan rồi triển khai ngay. Giữ nguyên các thay đổi linh thú và các
kế hoạch đang dở trong `tasks/plan.md` / `tasks/todo.md`; dùng tài liệu riêng này.

## Phạm vi và căn cứ

- Sâm: 2–5 người, 10 lá/người, 5 người còn 2 lá không chia. Nguồn luật của
  nhà phát hành: https://m.52labai.com/game/huong_dan/20-sam .
- Tấn: mở 2–6 người, giữ profile Việt Nam 52 lá / 8 lá. Sáu người nhận 48 lá,
  nọc còn 4 lá gồm lá chủ rút cuối. Đây là mở số ghế, không đổi sang Durak 36
  lá/6 lá. Đối chiếu https://rdsic.edu.vn/blog/blog-4/choi-bai-tan-vi-cb.html
  và https://www.pagat.com/beating/podkidnoy_durak.html .
- Tiến lên Bắc/Nam giữ 2–4, 13 lá/người trong bộ 52 lá; không thêm biến thể
  hai bộ bài. Phỏm giữ 2–4 theo profile đã chốt, không thay vòng ăn/bốc/chốt.
- Giữ luật báo Sâm, so bộ, mức điểm và lịch sử theo từng profile hiện có.
  Rà engine và bổ sung kiểm chứng cho vòng lượt / điểm / bảo toàn bài nhiều ghế.
- QR hiện trong popup mã phòng; màn vào phòng có quét QR bằng camera sẵn có.
  Chỉ mã mời LifeMate đúng định dạng được nhận; không nhận URL/tokens tùy ý.
  Scan đi qua cùng luồng join hiện tại, không cấp quyền hay bỏ qua xác thực.
  Camera chỉ gắn khi modal đang mở và app foreground/focused; chặn scan lặp,
  xử lý từ chối quyền/lỗi camera và luôn giữ nhập mã thủ công.

## Module và thứ tự

| Module | Trách nhiệm | Phụ thuộc |
| --- | --- | --- |
| game-capacity | Giới hạn theo game ở engine, Edge, parser, SQL | — |
| room-qr | Mã QR, render SVG, camera, kết nối join | room join hiện có |
| large-table | Bàn chờ/chơi/kết quả dọc-ngang có 5–6 ghế | game-capacity |

## Thiết kế và tương thích

- Giới hạn: `{south:4,north:4,phom:4,sam:5,tan:6}`. Giới hạn 6 chung không
  được làm Tiến lên hoặc Phỏm nhận thêm ghế. Client và server có constants
  tương ứng, được kiểm tra bằng regression.
- Migration tiến tới, không sửa migration cũ hoặc tính lại kết quả. Cập nhật
  CHECK và RPC commit mới nhất, giữ khóa/CAS/receipt/ownership/session/auth.
  Database xác định giới hạn theo kind đã lưu và không tin kind do client đổi.
- Capability v13 cho snapshot/phòng >4 ghế; không gửi snapshot >4 cho client
  cũ. Leave vẫn được phép cho client cũ. Client v13 tiếp tục tương thích phòng
  cũ; giữ actionId/fingerprint/protocol khi retry như hiện có.
- QR dùng `qrcode-generator` (JS thuần, không native dependency), render bằng
  `react-native-svg` đã có; quét dùng `expo-camera ~55.0.23` đã có. Giữ quiet
  zone 4 modules, đen/trắng và kích thước theo viewport.
- Bàn 2–4 giữ bố cục hiện tại. Bàn lớn dùng hàng ghế có wrap/viewport cuộn riêng,
  tên dài có ellipsis, kích thước card giới hạn theo vùng thực, không đặt ghế
  tuyệt đối lên giữa bàn. Kết quả và danh sách Tấn cuộn trong vùng dành riêng;
  bài trên tay và nút thao tác không bị đẩy khỏi màn thấp/ngang.

## Các bước và tiêu chí chấp nhận

- [x] 1. Reviewer rà plan trước thay backend/database; đã nhận bốn finding cần xử lý.
- [x] 2. Regression engine/phòng/parser: Sâm 5, Tấn 5/6, từ chối quá giới hạn
  của từng trò; đủ bài, nọc/chủ đúng, thứ tự lượt đủ UID và điểm zero-sum.
- [x] 3. Implement capacity + migration + capability; SQL regression thực với
  PGlite theo harness hiện có, kiểm tra không bypass quyền/giới hạn/CAS.
- [x] 4. QR helper/renderer/scanner và integration vào màn join/popup phòng.
  Regression dữ liệu sai, scan lặp, background/đóng modal, từ chối quyền,
  camera lỗi và đường join dùng đúng mã; QR giải mã ra payload dự kiến.
- [x] 5. UI bàn chờ/Sâm/Tấn: đủ UID, không tràn ở 320×568, 390×844,
  568×320, 844×390 và font lớn; giữ thứ tự ghế và anchor animation.
- [x] 6. Cập nhật SPEC/luật và mô tả giới hạn; reviewer rà diff cuối; sửa findings.
- [x] 7. Typecheck, ESLint files đổi, Jest card-game suites, `npm run test:functions`,
  export iOS/Android và runtime layout nếu môi trường có thể chạy. Ghi đúng
  checks chưa chạy được, không coi render test là bằng chứng pixel không chồng.

Đã hoàn tất; xem [kết quả và giới hạn kiểm tra](card-games-qr-capacity-result.md).

## Rollout

Migration + Edge phải được phát hành trước bản app mới để nhận ghế thứ 5/6.
Lượt này chuẩn bị và kiểm tra thay đổi local; chưa thực hiện deployment hoặc
ghi dữ liệu người dùng thật. Không đổi luật tính điểm ngoài giới hạn số người.

## Bổ sung sau plan review

- SQL phải cập nhật status/minClientVersion, takeover và set-variant-rules ngoài
  CHECK/commit; kiểm tra capability dưới khóa trước mọi thay đổi, trừ leave.
- Phòng cần v13 nếu **members hoặc game.players đã giữ lại** có hơn 4 UID,
  kể cả khi một người đã rời hoặc bị mời ra. Join tạo ghế thứ 5/6 cũng kiểm tra
  v13 trước commit; không trả lỗi nâng cấp sau khi đã ghi thay đổi.
- App mới dùng v13 bắt buộc cho mọi join bằng mã/QR và tạo Sâm/Tấn, không
  downgrade request join đang chờ. Receipt cũ giữ nguyên fingerprint, kể cả khi
  phòng lớn lên trước retry; thêm regression mất ack → ghế thứ 5 → retry cũ →
  nâng cấp và đọc/rejoin mới. Không đổi protocol của action đã nhận receipt.
- Cần bao phủ SQL rejection không đổi state/receipt/controller; v13 takeover
  và lưu luật phải hoạt động, client cũ vẫn rời phòng được.
