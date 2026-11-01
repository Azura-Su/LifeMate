# Thiên Dực Linh Lộc cấp 19–20

## Hoàn tất trong lượt này

- Tạo và tự duyệt khung đứng toàn thân; lưu tại
  `assets/pixelPet/sourceFrames/celestial_stag_lv1920/standing-frame-00-self-reviewed.png`.
- Tạo riêng tám tư thế đi bộ và tám tư thế chạy; lưu PNG nguồn trong cùng thư
  mục.
- Đóng gói atlas đi bộ và chạy 1280×1280, 4×4, kích thước lần lượt 327,710 và
  342,475 byte. Contact sheet và GIF xem trước ở `tasks/previews/`.
- Tạo đủ 16 tư thế bay toàn thân; thay mới khung 7–8 và thêm khung hạ cánh 14–16.
  Atlas bay 1280×1280, 4×4, 348,164 byte; contact sheet và GIF đã tự duyệt.
- Tạo đủ 16 tư thế ngủ; loại bản nháp khung 3 không có chân dò đất và tạo lại.
  Atlas ngủ 1280×1280, 4×4, 318,406 byte; contact sheet/GIF đã xuất.
- Tự xem contact sheet: các nhóm giữ hướng trái và bộ nhận diện vàng/teal;
  các tư thế bước, chạy và bay phân biệt được.
- Gắn atlas đi/chạy/bay/ngủ cho cấp 19–20. Cấp 18 vẫn dùng bộ đã có.
- Kiểm tra tích hợp: `npm run typecheck` đạt; ba test theo brief đạt 127/127;
  ESLint các file TypeScript liên quan và `git diff --check` đạt.

## Chưa hoàn tất

- Một khung chạy ban đầu bị loại vì có nền cảnh và sai tỷ lệ.
- Chưa xem chu kỳ Home Lv18/19/20 trực tiếp trên thiết bị.

## Tiêu chí tự soát

- Atlas đi/chạy nằm gọn trong ô, nền alpha, móng được căn về y=288 bằng script.
- Contact sheet đi/chạy/bay/ngủ đã kiểm tra trực quan. GIF bay dùng 350 ms cho
  cất/hạ cánh, 180 ms cho vỗ cánh và 825 ms cho lượn. GIF ngủ dùng 200 ms cho
  12 khung nằm xuống và 500 ms cho mỗi khung vòng thở.
- Kích thước atlas dưới 700 KB. Kiểm tra cấp độ được thêm cho Lv18, Lv19 và Lv20;
  các pha bay/ngủ xác nhận dùng atlas cũ.

Tiếp theo mở Home và quay chu kỳ Lv18/19/20 trên thiết bị để kiểm tra thực tế.
