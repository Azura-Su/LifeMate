# Linh Lộc — khung ngủ Lv16, bản v2

## Thay đổi

- Thay 16 khung mọc bị cắt ngang bằng các cảnh được vẽ riêng: thảm cỏ,
  ngân hà, hạt sáng, hai mầm, thân non, vòm cây, tán sao và lông công.
- Thay 16 khung héo để sao, ngân hà và tán đã biến mất không xuất hiện trở lại;
  cây trơ cành rồi tan thành bụi. Giữ thiết kế hai thân cây teal/vàng tạo vòm.
- Home Lv16–17 dùng hai atlas `_v2.png`; nguồn và atlas cũ được giữ lại.
- Theo yêu cầu tăng nhẹ kích thước, khung Lv16–17 tăng từ 168pt lên 188pt
  (khoảng 12%); giữ tâm theo thú và đường đất khi mọc, héo hoặc thức sớm.
- Căn riêng cảnh Lv16–17 với đường đất của Home. Kiểm tra simulator phát hiện
  vị trí cũ để mép cỏ thấp hơn mép thanh tab 14,2pt; vị trí mới giữ toàn bộ cỏ
  phía trên thanh tab, cả lúc mọc lẫn lúc héo.
- Nguồn v2 và prompt: `assets/pixelPet/sourceFrames/sleep_garden_lv16/v2/`.
  32 khung tách ở thư mục con `packed320/`.

## Xem trước

- Mọc: `tasks/previews/home_sleep_garden_lv16-growth-v2.gif`.
- Héo: `tasks/previews/home_sleep_garden_lv16-decay-v2.gif`.
- Contact sheet: `tasks/previews/home_sleep_garden_lv16_v2-contact.png` và
  `tasks/previews/home_sleep_garden_lv16_decay_v2-contact.png`.
- Ghép thú ngủ trên nền sáng/tối:
  `tasks/previews/celestial-stag-lv16-sleep-scene-v2-overlay.png`.
  Bản ghép dùng tỷ lệ và vị trí từ Home, không phải ảnh chụp simulator.

## Kiểm tra

- Hai atlas 1280×1280, 16 ô 320px; footprint 288px, đường đất y=296.
- Dung lượng: mọc 649.631 byte; héo 572.976 byte, đều dưới 700 KB.
- Kiểm tra trực tiếp PNG đã ghi: mọc-0 và héo-15 trong suốt hoàn toàn;
  mọc-15/héo-0 trùng từng pixel; cả 32 ô có lề trong suốt, không lọt ô kế bên.
- Đã xem contact sheet và bản ghép với thú Lv16: không còn mép cắt ngang trắng,
  cây không che thú, vị trí nằm khớp thảm cỏ trên cả nền sáng và tối.
- `npm run typecheck`: đạt.
- ESLint các file TypeScript thay đổi và script đóng gói mới: đạt.
- Jest: 3 suite, 76 bài đạt với `--watchman=false` cho
  `HomePetRoamer.test.tsx`, `HomeSleepScene.test.ts`, `pixelPetGuide.test.ts`.
  Lần chạy mặc định bị sandbox chặn Watchman; tắt theo dõi file cho lần chạy
  kiểm tra, không sửa cấu hình hoặc giảm kiểm tra.
- Bốn ca hồi quy vị trí đường đất (Lv16/17, mọc/héo) thất bại trước khi sửa:
  đường đất 111,4pt thay vì 97,2pt; đạt sau khi căn vị trí cảnh.
- iOS runtime: xem thử Lv16 trên iPhone 17 Pro Max / iOS 26.3. Đã xác nhận
  cây trưởng thành và thú ngủ hiện đầy đủ trên thanh tab; chạm đánh thức tạo
  cảnh héo tại chỗ cũ, sau 5,5 giây cảnh biến mất và thú tiếp tục chuyển động.
  Xem thử chỉ thay đổi tại máy, không thay đổi cấp thú đã lưu.

## Tái tạo

```sh
node scripts/pack-home-sleep-garden-lv16-v2.cjs
swift -module-cache-path /private/tmp/lifemate-swift-module-cache scripts/review-home-sleep-garden-lv16-v2.swift
```

Imagegen tích hợp tạo hai sheet nền trong suốt, tham chiếu cảnh trưởng thành cũ.
Script chỉ tách, căn, nén và đóng gói các cảnh đã vẽ; khung héo đầu tiên sao chép
khung mọc cuối để chuyển tiếp chính xác. GIF xem trước phát các khung rời ở
thời lượng 3,8/4,8 giây và áp dụng nhịp mờ cuối của Home; nội suy giữa các khung
do ứng dụng thực hiện.
