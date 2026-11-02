# Linh Lộc Lv12–13 — Rừng lông vũ, bản v2

## Rà soát bản đang dùng

- Script cũ cắt viền 4–5% của từng ô trong sheet: tán cây ở các khung mọc 12–14 và nền héo bị cắt ngang.
- Các khung mọc trước ô 15 có hồ giữa chỗ nằm; ô 15 dùng một ảnh khác với cỏ giữa và nước hai bên, nên bố cục bật đổi ở cuối.
- Căn từng silhouette theo bbox riêng làm tỷ lệ cây thay đổi theo khung.

## Hướng sửa

- Giữ `frame15-approved.png` làm mẫu cuối. Tạo từng ảnh toàn cảnh riêng bằng built-in Imagegen, chừa cỏ giữa và giữ nước hai bên.
- Ảnh v2 cùng canvas 1254×1254, nằm ở `assets/pixelPet/sourceFrames/sleep_garden_lv12/v2/`; prompt nằm trong `prompts.json` cùng thư mục.
- `scripts/pack-home-sleep-garden-lv12-v2.cjs` dùng một tỷ lệ chung từ mẫu cuối, giữ toàn canvas, chừa 2px để mọi footprint ≤288px, căn đất y=296, loại RGB gần như vô hình trước khi thu nhỏ. Mặc định ghi bản xem trong `tasks/previews/`; `--install` thay atlas sau khi duyệt.
- `scripts/review-celestial-stag-lv12-sleep-scene-v2.swift` xuất GIF mọc 3,8s và héo 4,8s, kiểm tra lại số khung và thời lượng sau khi ghi.

## Tiến độ

- Đã tạo đủ ảnh mọc 01–14, dùng ảnh đã chọn cho 15; ô 00 sẽ trong suốt.
- Đã đủ 16 khung mọc và 16 khung héo, bao gồm hai đầu trong suốt. Đã sửa các khung sinh ảnh không đúng nhịp: lá xanh trở lại ở héo 07, nước xuất hiện lại ở héo 10–13 và khung cuối, thân mọc 06–07 quá lớn.
- Hai atlas: mọc **298.398 byte**, héo **349.101 byte**; 1280×1280, ô 320px, palette RGBA thích nghi có alpha mềm (quantizer tối đa 256 màu, 98 màu thực dùng). Quantize hai chuỗi cùng lúc để ô mọc 15 và héo 00 trùng pixel. Bộ mã hóa PNG indexed theo mẫu có sẵn trong `scripts/build-pet-drag-atlases.cjs`.
- Đã xem contact sheet: tán không còn bị cắt; bố cục cỏ giữa/nước hai bên không đổi đột ngột ở ô 15. Chuỗi héo chuyển bạc lá, cạn nước, trơ cành và tan thành bụi.
- Ảnh ghép thú dùng đúng atlas Lv11–12 và Lv13–14, tỷ lệ cấp 12/13 và phép đặt trên Home. Cả hai thú nằm trên vùng cỏ, rõ mặt/thân, không bị cây hay cây non che. Hàng trên nền sáng, hàng dưới nền tối; cột trái Lv12, cột phải Lv13.
- Chủ dự án đã chọn “Duyệt, dùng bản v2 này” trong chat. Đã chạy script với `--install`, thay `home_sleep_garden_lv12.png` và `home_sleep_garden_lv12_decay.png` trong app.

## Kiểm tra đã chạy

- `npm run typecheck`: qua.
- Lần kiểm tra cuối: Jest liên quan HomePetRoamer, HomeSleepScene, celestialStagAtlas và pixelPetGuide có 4 suite, **101 test qua** với `--watchman=false`; typecheck và ESLint script qua. Lần đầu Jest bị chặn bởi quyền thư mục trạng thái Watchman.
- Kiểm tra trực tiếp hai PNG đã cài: khớp byte với bản xem, footprint tối đa 288px, đất không vượt y=296, hai đầu trong suốt, ô mọc 15/héo 00 trùng pixel, palette và provenance hợp lệ.
- Chưa kiểm tra trên Home trực tiếp: CoreSimulatorService không truy cập được trong môi trường hiện tại.
- Swift đã typecheck; GIF đã kiểm tra lại đủ 16 khung, tổng thời lượng 3,8s / 4,8s. Contact sheet đã xem; chưa phát GIF bằng trình xem chuyển động trong phiên.

## Tệp xem

- `tasks/previews/celestial-stag-lv12-sleep-scene-growth-v2-contact.png`
- `tasks/previews/celestial-stag-lv12-sleep-scene-decay-v2-contact.png`
- `tasks/previews/celestial-stag-lv12-sleep-scene-growth-v2.gif`
- `tasks/previews/celestial-stag-lv12-sleep-scene-decay-v2.gif`
- `tasks/previews/celestial-stag-lv12-sleep-scene-pet-overlay-v2.png`
- Atlas tương ứng có hậu tố `growth-v2-atlas.png` / `decay-v2-atlas.png` trong cùng thư mục.

## Điểm duyệt

Đã gửi đủ contact sheet, GIF và ảnh đặt thú theo đúng tỷ lệ Home; đã nhận duyệt theo mục 5 của `docs/celestial-stag-sleep-garden-tiers-brief.md` trước khi thay atlas.
