# Linh Lộc Lv18–19 — Cung điện sapphire, ứng viên v2

Đã tạo lại bộ mọc/tan bằng image_gen từ thiết kế hoàn chỉnh hiện có. Nguồn là
hai sheet vẽ toàn cảnh; khung mọc 4 (tường chưa có mái) và 7 (thân cây non thấp)
được chỉnh riêng. Bản v2 không dùng mặt nạ hé lộ ngẫu nhiên của script cũ.

## Kết quả để duyệt

- Mọc: [GIF 3,8 giây](previews/celestial-stag-lv18-growth-v2.gif),
  [contact sheet](previews/celestial-stag-lv18-growth-v2-contact.png).
- Tan: [GIF 4,8 giây](previews/celestial-stag-lv18-decay-v2.gif),
  [contact sheet](previews/celestial-stag-lv18-decay-v2-contact.png).
- Ghép theo tỷ lệ và vị trí renderer Home: [Lv18](previews/celestial-stag-lv18-v2-pet-lv18.png)
  và [Lv19](previews/celestial-stag-lv18-v2-pet-lv19.png). Đây là ảnh ghép kiểm tra,
  chưa phải ảnh chụp trên thiết bị.
- Theo chỉnh sửa mới, khung cảnh trong ảnh ghép được phóng thêm **8%**:
  tương đương 168 → 181,44pt. Phóng quanh tâm đường đất để giữ vị trí và kích
  thước Linh Lộc. Thông số bố cục ứng viên đã lưu trong provenance; layout
  runtime chưa thay đổi ở bước duyệt ảnh này.
- [Dải so sánh](previews/celestial-stag-lv18-v2-tier-comparison.png): trái sang phải
  Lv2, 4, 6, 8, 10, 12, 14, 16, **18 v2**, 20; các cấp còn lại lấy atlas runtime hiện có.
- Ảnh nguồn, 32 khung tách và hai atlas ứng viên nằm trong
  `assets/pixelPet/sourceFrames/sleep_garden_lv18/v2/`.
- Nguồn và toàn bộ prompt: [provenance.json](../assets/pixelPet/sourceFrames/sleep_garden_lv18/v2/provenance.json).

## Kiểm tra đã chạy

- `node scripts/pack-home-sleep-garden-lv18-v2.cjs`: hai atlas 1280×1280, mỗi atlas
  16 ô 320px; đường đất y=296; lề an toàn ít nhất 8px; đúng hai đầu trong suốt;
  các khung còn lại có hình; ô mọc 15 trùng pixel với ô tan 0 sau khi giảm màu.
- Bảng màu RGBA dùng chung, tối đa 256 mục và giữ alpha bán trong suốt.
  Atlas mọc **449.197 bytes**, atlas tan **444.439 bytes**, đều dưới 700.000 bytes.
- `swift -module-cache-path /tmp/lv18-swift-module-cache scripts/review-celestial-stag-lv18-sleep-scene-v2.swift`:
  kiểm tra lại 16 khung/GIF và thời lượng đúng 3,8 / 4,8 giây.
- `npx eslint scripts/pack-home-sleep-garden-lv18-v2.cjs`: đạt.
- `npm run typecheck`: đạt.
- `npm test -- --watchman=false --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx src/screens/Home/__tests__/HomeSleepScene.test.ts src/services/pixelPet/__tests__/pixelPetGuide.test.ts`:
  **3 suite, 72 test đạt**. Lần chạy mặc định trước đó bị sandbox chặn thư mục
  trạng thái Watchman; chạy lại bằng bộ quét Node của Jest đã đạt.

## Trạng thái

Ứng viên đã được kiểm tra kỹ thuật và ghép với hai bộ thú tương ứng. Một số chi
tiết cành, lá và kiến trúc biến đổi nhẹ giữa các tranh nguồn; cần duyệt cảm giác
chuyển động qua GIF. Chưa kiểm tra chu kỳ Home trực tiếp trên iOS/Android.

Chưa thay hai atlas runtime Lv18–19. [Brief, mục 5](../docs/celestial-stag-sleep-garden-tiers-brief.md)
yêu cầu: **“Gửi chủ dự án duyệt trước khi gắn vào app.”** Sau khi chủ dự án duyệt
mỹ thuật, thay đúng cặp atlas cấp 18, cập nhật provenance/spec và kiểm tra trên Home.
