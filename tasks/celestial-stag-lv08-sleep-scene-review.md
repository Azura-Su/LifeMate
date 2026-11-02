# Cảnh ngủ Lv8–9 — Đền đá rêu phong

Hoàn tất ngày 2026-11-02.

## Kết quả

- Đủ **16 khung mọc + 16 khung héo**, mỗi khung là một tranh toàn cảnh. 28 ảnh
  chuyển động được tạo riêng bằng công cụ tích hợp `image_gen`; khung hoàn chỉnh
  cũ được giữ làm chuẩn, hai đầu trống được tạo trong suốt và khung héo 0 sao chép
  chính xác khung mọc 15.
- Bộ đầu chỉ có năm ảnh nguồn và cổng thẳng khác dáng cổng trong ảnh cuối. Các
  khung 02–05 mới được lưu thành `frame02-v2.png` đến `frame05-v2.png`, thống nhất
  cột trang trí và cổng cong với ảnh cuối. Năm ảnh nguồn cũ vẫn khớp hash trong Git.
- Mọc: nền cỏ/đá lát → chân cột → cột cao → cổng → chồi cây → đèn chưa sáng →
  dây leo/thân cây → tán nhỏ → tán vượt cổng → dây leo lên đỉnh → lửa teal nhỏ →
  lửa sáng/tán đầy → chi tiết hoàn chỉnh.
- Héo: lửa yếu rồi tắt → lá vàng → dây leo/rêu khô → cây trơ cành/cột nứt →
  thanh ngang gãy/đỉnh cột vỡ → cột sụp/cây tan tro → bụi đá → trống.
- Home chọn cặp `_v2.png` qua hai hằng atlas Lv8 hiện có trong
  `src/screens/PixelPet/petArt.ts`, dùng cho Lv8–9.

## Tệp bàn giao

- Nguồn và prompt/tham chiếu từng khung:
  `assets/pixelPet/sourceFrames/sleep_garden_lv08/` và `generation.json`.
- 32 ô 320px sau đóng gói và báo cáo kiểm tra:
  `assets/pixelPet/sourceFrames/sleep_garden_lv08/review320/`.
- Atlas mọc: `assets/pixelPet/animations/home_sleep_garden_lv08_v2.png`
  (**496328 bytes**).
- Atlas héo: `assets/pixelPet/animations/home_sleep_garden_lv08_decay_v2.png`
  (**530511 bytes**).
- Contact sheet: [mọc](previews/celestial-stag-lv08-growth-review-contact.png),
  [héo](previews/celestial-stag-lv08-decay-review-contact.png).
- GIF: [mọc 3,8 giây](previews/celestial-stag-lv08-growth-review.gif),
  [héo 4,8 giây](previews/celestial-stag-lv08-decay-review.gif).
- [Ảnh ghép Home trên nền sáng/tối](previews/celestial-stag-lv08-sleep-scene-home-composite.png):
  hàng trên Lv8, hàng dưới Lv9; hiển thị ở 2×, theo khung cảnh 168pt, thú 120pt,
  offset (-24, -44), tỷ lệ thú theo cấp và phép căn đất của Home. Thú nằm phía
  trước cây, vẫn thấy rõ đèn teal.

## Đóng gói và tự soát

`scripts/review-celestial-stag-lv08-garden.cjs` dựng bản xem nguồn theo mặc định.
Thêm `--pack` cùng đường dẫn module Sharp có sẵn (lấy từ
`load_workspace_dependencies`) để tạo atlas và bản xem đúng màu runtime:

```sh
node scripts/review-celestial-stag-lv08-garden.cjs --pack /path/to/sharp
swift -module-cache-path /private/tmp/lifemate-lv08-swift-cache scripts/review-celestial-stag-lv08-garden.swift
```

Script từ chối đóng gói khi thiếu ảnh. Điểm nối và đầu trống được kiểm tra trước
khi mã hóa và trước khi ghi atlas. Các điểm màu matte có alpha thấp được xóa trước
khi thu nhỏ; thảm cỏ được căn giữa, giới hạn x=16–303 và đất y=296. Bụi cuối chuỗi
héo giữ phép biến đổi của cảnh hoàn chỉnh khi nền đất biến mất.

Hai clip dùng **chung bảng màu 256 màu, không dithering theo vị trí**, để điểm nối
khớp màu và mỗi atlas nhỏ hơn 700 KB. Contact sheet, ảnh ghép và các ô `review320`
được dựng lại từ chính atlas sau mã hóa. Công cụ Swift đọc lại GIF và kiểm tra
đủ 16 khung cùng tổng thời lượng 3,8/4,8 giây.

Đã tự soát toàn bộ hai contact sheet và ảnh ghép Lv8/Lv9. Kiểm tra trực tiếp PNG
runtime xác nhận 1280×1280, 16 ô/atlas, lề trong suốt/đường đất, hai đầu trống và
mọc-15/héo-0 trùng pixel. Có 30 pose khác nhau trong 32 ô; hai cặp trùng là điểm
nối và hai ô trống theo yêu cầu. Kết quả lưu ở `review320/validation.json`.

## Kiểm thử

- `npm run typecheck`: đạt.
- ESLint `src/screens/PixelPet/petArt.ts` và script CJS Lv8: đạt.
- Jest: **101 test, 4 suite đạt**, gồm `HomePetRoamer`, `HomeSleepScene`,
  `pixelPetGuide` và `celestialStagAtlas`. Chạy với `--watchman=false` vì sandbox
  chặn thư mục trạng thái Watchman; nội dung kiểm thử giữ nguyên.
- Chưa kiểm tra trực tiếp trên thiết bị: sandbox chặn CoreSimulator và không cho
  ADB mở cổng dịch vụ. Đã kiểm tra ảnh ghép theo phép bố trí Home, atlas và GIF.
