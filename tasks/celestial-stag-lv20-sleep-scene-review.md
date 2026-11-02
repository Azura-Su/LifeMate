# Linh Lộc Lv20 — Thiên giới ngọc lục bảo

## Thay đổi

- Thay cặp atlas Lv20 đang dùng bằng 16 cảnh mọc và 16 cảnh tan được vẽ riêng.
  Bản cũ chỉ hé lộ/làm mờ cùng một ảnh và khoét trong suốt vùng dưới giữa.
- Khoảng nghỉ mới là hồ và đài sen thấp được vẽ liền cảnh. Ảnh ghép dùng đúng
  hình học Home (cảnh 184px, giữ tâm/đường đất của khung 168px ở -24/-44;
  thú 120px, tỷ lệ Lv20 226/223) cho thấy
  linh lộc nằm trên đài sen, phía trước cây và không bị cảnh che.
- Vẽ lại riêng sáu khung đầu để giữ viên ngọc trong quá trình mây/cỏ, đài sen,
  hồ và cung điện xuất hiện. Cây sau đó ôm lấy ngọc, mọc cành và tán; cuối cùng
  thêm thác và cầu vồng. Cảnh tan mất ánh sáng, cung điện, nước, lá rồi thành
  bụi sao. Không dùng mặt nạ cắt ngang ảnh trưởng thành.
- Giữ nguyên cách chọn cấp và phát chuyển động của app. Lv19 tiếp tục dùng
  cảnh Lv18; Lv20 tiếp tục dùng hai đường dẫn atlas Lv20 đã có.
- Có bộ đóng gói riêng; bỏ Lv20 khỏi bộ đóng gói chung để tránh bị ghi đè bằng
  ảnh nháp cũ. Giữ ảnh nguồn/candidate cũ và các thay đổi khác trong working tree.

## Sản phẩm

- `assets/pixelPet/animations/home_sleep_garden_lv20.png`: 471,352 byte.
- `assets/pixelPet/animations/home_sleep_garden_lv20_decay.png`: 577,463 byte.
- Nguồn/prompt và 32 khung: `assets/pixelPet/sourceFrames/sleep_garden_lv20/`.
- Contact sheet và GIF thực tế từ atlas: `tasks/previews/home_sleep_garden_lv20-*`.
- Ảnh ghép thú: `tasks/previews/celestial-stag-lv20-sleep-scene-overlay.png`.
- Dải đối chiếu cảnh đang dùng Lv2→20: `tasks/previews/celestial-stag-lv20-sleep-scene-tiers.png`.
  Thứ tự trái sang phải: Lv2, 4, 6, 8, 10, 12, 14, 16, 18, 20.
- Tái tạo: `node scripts/pack-home-sleep-garden-lv20.cjs`;
  `swift -module-cache-path /private/tmp/lifemate-lv20-swift-cache scripts/review-home-sleep-garden-lv20.swift`.

## Kiểm tra đã chạy

- Hai atlas 1280×1280, lưới 4×4, ô 320px; dưới 700,000 byte mỗi file.
- Lề trong suốt, footprint tối đa 288px, đường đất không vượt y=296.
- Mọc 0 và tan 15 trống; mọc 15 bằng tan 0 từng pixel sau quantize.
- Contact sheet và ảnh ghép thú đã xem; GIF xuất đủ 16 khung, 3.8s và 4.8s.
- `npm run typecheck`: đạt.
- ESLint hai script đóng gói: đạt.
- `npm test -- --watchman=false --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx src/screens/Home/__tests__/HomeSleepScene.test.ts src/services/pixelPet/__tests__/pixelPetGuide.test.ts`:
  3 suites, 72/72 tests đạt. Lệnh mặc định ban đầu bị Watchman chặn quyền;
  chạy lại cùng tests với Watchman tắt, không thay đổi kiểm tra.

## Giới hạn

Chưa xem chu kỳ trực tiếp trên iOS: `simctl` không kết nối được CoreSimulatorService
trong môi trường này. Ảnh ghép là kiểm tra hình học từ atlas, không phải screenshot
của app. Các cảnh trong sheet được vẽ lại nên có biến thiên nét vẽ nhỏ giữa khung;
đã căn cùng tỷ lệ và đường đất, không biến các cảnh tan nhỏ thành cây lớn.
