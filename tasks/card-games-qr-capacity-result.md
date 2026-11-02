# QR phòng và bàn nhiều người — 2026-11-02

Đã triển khai theo [plan](card-games-qr-capacity-plan.md). Thay đổi local;
chưa deploy migration/Edge hoặc phát hành app.

## Luật và số ghế

| Trò | Số người | Kiểm chứng |
| --- | --- | --- |
| Sâm | 2–5 | 10 lá/người, bàn 5 còn 2 lá không chia; vòng lượt và báo Sâm đủ 5 UID |
| Tấn | 2–6 | Profile Việt Nam 52 lá, 8 lá/người; bàn 6 còn nọc 4 lá gồm lá chủ rút cuối |
| Tiến lên Bắc/Nam | 2–4 | 13 lá/người trong bộ 52 lá; giữ giới hạn 4 |
| Phỏm | 2–4 | Giữ profile và các tùy chọn luật hiện có |

Căn cứ: [hướng dẫn Sâm của nhà phát hành 52 Lá Bài](https://m.52labai.com/game/huong_dan/20-sam),
[Tiến lên trên Pagat](https://www.pagat.com/climbing/thirteen.html),
[mô tả Tấn Việt](https://rdsic.edu.vn/blog/blog-4/choi-bai-tan-vi-cb.html).
Các luật tính điểm, tùy chọn và profile lịch sử không bị đổi ngầm. Regression
bao phủ bảo toàn bài, nọc/chủ, giới hạn từng game, settlement Sâm 5 người
zero-sum và parser cho bảng kết quả 5/6 hạng.

## QR và giao diện

- Popup mã phòng hiện QR; màn vào phòng có nút quét và vẫn có nhập mã.
  Payload chỉ là `LIFEMATE:ROOM:1:<code>`, không chứa thông tin xác thực.
- Bộ đọc chỉ nhận QR LifeMate đúng phiên bản/định dạng, chống scan lặp và
  callback muộn, xử lý quyền camera, lỗi/timeout và tháo camera khi background.
  Quét dùng cùng luồng join hiện có. Chưa có deep link từ camera ngoài app.
- Lobby có vùng cuộn/wrap cho 5–6 ghế. Sâm 5 và Tấn 5/6 có vùng cuộn riêng,
  nút thao tác tách khỏi nội dung cuộn. Sâm đo lại anchor animation sau cuộn;
  tên dài, số dư và nút sẵn sàng sau ván được giới hạn trong panel.
- Bàn 2–4 giữ bố cục hiện có. Các viewport 320×568, 568×320, 390×844,
  844×390 với fontScale 1.8 được kiểm tra bằng render regression; đây không
  phải kiểm chứng pixel. Kiểm tra trực quan riêng trên iOS Simulator dùng
  component thật với dữ liệu giả 5/6 người, tên dài và số dư 123.456.789 điểm,
  vùng compact 320×520 / 568×268; đã xem lobby, bàn chơi và trạng thái sau ván.
  Chữ lớn iOS accessibility-medium cũng được xem trên fixture.
- Ký hiệu số/chất là hình lá bài kích thước cố định nên không phóng theo font
  hệ thống; nhãn truy cập đầy đủ của lá và cỡ chữ các nội dung khác vẫn giữ.
- [Ảnh Sâm dọc](previews/card-games-qr/sam-portrait.png),
  [Sâm sau ván ngang](previews/card-games-qr/sam-result-landscape.png),
  [Tấn ngang](previews/card-games-qr/tan-landscape.png),
  [lobby ngang](previews/card-games-qr/lobby-landscape.png),
  [QR native](previews/card-games-qr/qr.png).

## Tương thích và triển khai

Migration mới `20261102120000_card_game_large_tables.sql` cập nhật CHECK,
commit/status/takeover/rules theo capacity từng game. Protocol v13 bắt buộc
nếu members **hoặc game.players giữ lại** có hơn 4 người. Bản cũ vẫn được rời
phòng. RPC commit 10 tham số cũ cũng đi qua guard này; không có lối ghi vòng.

Retry giữ protocol/fingerprint của action đang chờ, không tự nâng phiên bản
action sau lỗi capability. SQL regressions kiểm tra rejection không ghi
state/receipt/controller, mất ACK rồi phòng lớn lên, takeover/rules và rời
phòng bằng cả RPC cũ. Không mở quyền RPC cho anon/authenticated.

Thứ tự phát hành: migration → Edge `game-access` → app mới. QR cần binary native
mới vì bản trước tắt barcode scanning. `app.json` đã bật; prebuild và pod install
đã đồng bộ. iOS đã có `ExpoCameraBarcodeScanning` và `ZXingObjC` trong Pods.
Không có dữ liệu thật nào được tạo/thay đổi trong QA.

## Kiểm tra

- TypeScript: `npm run typecheck` — pass.
- Jest card-game screens/services và hai hooks: 27 suites, 430 tests pass.
  Có cảnh báo `act(...)` từ icon trong harness hiện có, không có test thất bại.
  Sau chỉnh flex cuối, chạy lại suite Sâm: 36 tests pass, gồm bảo vệ chiều rộng
  panel bài ngang khỏi bị flex basis ép về 0.
- Backend: `npm run test:functions` — 417 pass. Sau đó thêm assertion rời phòng
  qua RPC 10 tham số, chạy lại hai SQL cases Sâm/Tấn — 2 pass.
- ESLint các file thay đổi: pass. `git diff --check` phạm vi tính năng: pass.
- QR native SVG được Apple Vision giải mã độc lập thành đúng
  `LIFEMATE:ROOM:1:ABCDEFGH`.
- `npm run bundle`: export iOS và Android thành công sau các chỉnh UI cuối.
- Android: `:app:assembleDebug` — BUILD SUCCESSFUL, barcode dependencies bật.
- iOS: `xcodebuild -workspace ios/LifeMate.xcworkspace -scheme LifeMate
  -configuration Debug -sdk iphonesimulator -destination id=<QA simulator>
  CODE_SIGNING_ALLOWED=NO build` — BUILD SUCCEEDED. Kiểm tra `nm` xác nhận
  `_OBJC_CLASS_$_ExpoCameraZXingProvider` có trong binary đã link.
- Prebuild iOS/Android và pod install: pass. Reviewer rà plan, diff và sửa đổi
  cuối: không còn actionable finding; reviewer không chạy test.

Camera thật không có trên Simulator; cần smoke-test quét giữa hai thiết bị thật
trước phát hành, đồng thời thử vuốt các vùng cuộn trên thiết bị. Lượt này đã
kiểm tra trực quan native và render regression; chưa xác nhận thao tác vuốt
bằng cảm ứng thật hay quét camera thật.

Đã dừng các server fixture và xóa riêng Simulator QA được tạo cho lượt này;
ảnh và báo cáo vẫn được giữ trong repo. Không thay đổi Simulator đang dùng
cho công việc khác.
