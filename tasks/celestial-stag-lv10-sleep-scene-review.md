# Cảnh ngủ Lv10 — Cổ thụ rune

## Kết quả

- Đủ 16 khung mọc và 16 khung héo, lưu ở
  `assets/pixelPet/sourceFrames/sleep_garden_lv10/authored320/`.
- Giữ ảnh nguồn mọc 02–04. Dùng built-in `image_gen` vẽ thêm 26 ảnh riêng:
  mọc 01, 05–15 và héo 01–14. Không dùng mặt nạ hé lộ từ một ảnh cuối.
  Ô mọc 00 và héo 15 trống; ô héo 00 sao chép ô mọc 15.
- Nguồn mới là RGBA 1254×1254. Ảnh hoàn chỉnh cũ `frame15_candidate.png`
  được giữ làm tham chiếu; đích mới `frame15-source.png` nối từ khung 14
  để giữ hình thân, rễ và vị trí cổng của chuỗi mới.
- Prompt đầy đủ được lưu tại
  `assets/pixelPet/sourceFrames/sleep_garden_lv10/generation-prompts.json`.

## Rà soát hình

- Mọc: nền và cột → cổng → rễ → thân → cành → rune tối → tán non →
  rune thân sáng → cột/rễ sáng → tán đầy → đốm sáng → đèn đá.
- Héo: rune tắt từ trên xuống → đốm sáng rơi/tắt → lá bạc dần → thân/rễ
  hóa đá → nứt → tan từ trên xuống thành bụi teal → trống.
- Contact sheet của PNG đã giảm màu cho thấy đường đất ổn định và chỗ nằm
  phía trước còn thoáng. Bản ghép Linh Lộc Lv10 không cắt đầu, gạc hay thân;
  linh thú nằm trước rễ, hai cột và đèn vẫn đọc được.
- Khung cành 06→07 và tán 11→12 là những bước thay đổi rõ nhất, đúng các
  mốc phát triển trong brief; cần xem GIF để duyệt cảm giác chuyển động.
- Các khung nguồn héo 12–13 có xê dịch khi sinh ảnh; script chỉ căn lại
  vị trí đường đất, không đổi tỷ lệ riêng cho từng khung. Bụi cuối không
  bị phóng to hoặc kéo xuống để giả nền đất.

## Đóng gói và kiểm tra đã chạy

- `node scripts/pack-home-sleep-garden-lv10.cjs` — đạt.
- `npx eslint scripts/pack-home-sleep-garden-lv10.cjs` — đạt.
- `swift -module-cache-path /private/tmp/lifemate-lv10-swift-cache scripts/preview-home-sleep-garden-lv10.swift` — tạo GIF đạt.
- Mỗi atlas 1280×1280, 4×4 ô 320px; cùng tỷ lệ; đường đất y=296;
  có lề trong suốt; PNG indexed 256 màu có alpha tRNS, giải mã/CRC hợp lệ.
- Mọc: 421953 byte (412KiB). Héo: 580581 byte (567KiB). Cả hai dưới 700KiB.
- Khung mọc 15 và héo 00 trùng pixel sau khi giải mã PNG đã giảm màu.
  Hai đầu trống hoàn toàn; bụi héo 14 vẫn tồn tại sau khi giảm màu.
- GIF và contact sheet dùng PNG ứng viên đã giảm màu, không dùng bản nguồn
  đẹp hơn để che sai khác. Bản ghép 168px dùng kích thước và phép dịch của
  `HomeSleepGarden`/`CelestialStagAtlas` ở Lv10, làm ảnh rà soát ngoài app.

## Tệp để duyệt

Trong `tasks/previews/`, tiền tố `celestial-stag-lv10-sleep-scene-`:

- `growth-atlas-candidate.png`, `decay-atlas-candidate.png`.
- `growth-contact.png`, `decay-contact.png`.
- `growth.gif`, `decay.gif`, `cycle.gif`.
- `pet-overlay-168.png`, `pet-overlay-large.png`.
- `tier-comparison.png`: ô cuối Lv2→20, thay Lv10 bằng ứng viên mới.

## Điểm còn chờ

Theo `docs/celestial-stag-sleep-garden-tiers-brief.md`, mục 5:
“Gửi chủ dự án duyệt trước khi gắn vào app.” Bộ mới đã sẵn sàng để duyệt.
Hai atlas runtime Lv10 hiện tại vẫn giữ nguyên. Chưa xác nhận cảm giác
chuyển động trên thiết bị hoặc thay atlas vào app; vì vậy không báo đã kiểm
tra runtime hay hoàn tất tích hợp. Không có thay đổi TypeScript trong phần việc này.
