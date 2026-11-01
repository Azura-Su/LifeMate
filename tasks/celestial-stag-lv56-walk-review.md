# Thiên Dực Linh Lộc cấp 5–6 — chuyển động Home

## Trạng thái

Khung đứng chuẩn `standing-frame-00-approved.png` do chủ dự án chọn. Đi bộ, chạy, bay và ngủ đã có atlas ứng viên và được tự rà. Bộ lv5–6 chưa gắn vào app.

## Đầu ra

- 8 ảnh nguồn riêng trong `assets/pixelPet/sourceFrames/celestial_stag_lv56/walk/`.
- 8 khung đã căn về 320×320, chiều cao nhân vật 192 px và đường đáy y=288.
- Atlas xem trước `assets/pixelPet/animations/celestial_stag_lv56_walk_candidate.png` (1280×1280, 256 màu, 241,251 bytes).
- Contact sheet: `tasks/previews/celestial-stag-lv56-walk-contact.png`.
- GIF: `tasks/previews/celestial-stag-lv56-walk.gif` (8 khung × 100 ms = 0.8 giây/vòng).
- 8 tư thế chạy trong `assets/pixelPet/sourceFrames/celestial_stag_lv56/run/`.
- Atlas chạy ứng viên `assets/pixelPet/animations/celestial_stag_lv56_run_candidate.png` (1280×1280, 256 màu, dưới 300 KB).
- Contact sheet và GIF chạy: `tasks/previews/celestial-stag-lv56-run-contact.png` và `tasks/previews/celestial-stag-lv56-run.gif` (8 khung, khoảng 0,52 giây/vòng).
- 16 ảnh nguồn ngủ trong `assets/pixelPet/sourceFrames/celestial_stag_lv56/sleep/` và 16 khung đã căn trong cùng thư mục.
- Atlas ngủ ứng viên `assets/pixelPet/animations/celestial_stag_lv56_sleep_candidate.png` (1280×1280, 248,335 bytes).
- Contact sheet và GIF ngủ: `tasks/previews/celestial-stag-lv56-sleep-contact.png` / `tasks/previews/celestial-stag-lv56-sleep.gif` (12 tư thế hạ xuống × 200 ms, 4 nhịp thở × 500 ms; vòng xem trước 4,4 giây).
- 16 ảnh nguồn bay và khung đã căn trong `assets/pixelPet/sourceFrames/celestial_stag_lv56/flight/`.
- Atlas bay ứng viên `assets/pixelPet/animations/celestial_stag_lv56_flight_candidate.png` (1280×1280, 4×4, 256 màu).
- Contact sheet và GIF bay: `tasks/previews/celestial-stag-lv56-flight-contact.png` và `tasks/previews/celestial-stag-lv56-flight.gif`.

## Soát hình

- Cả 8 khung giữ góc nhìn trái, bảng màu cam/kem/teal và dấu hiệu nhận diện của ảnh tham chiếu.
- Khung đã được căn cùng chiều cao và đường đáy bằng script; atlas giữ alpha và dưới ngưỡng 700 KB.
- Contact sheet cho thấy nhịp chân luân phiên; chưa thấy phần nào bị cắt khỏi ô hoặc đổi thiết kế nhân vật.
- Atlas đi bộ và chạy giữ nền trong suốt, cùng kích thước/đường đáy; các khung bật chạy được nâng nhẹ để bốn móng rời đường đất.
- GIF chạy kiểm tra được pha duỗi, chạm đất, gom chân, bật và biến thể lặp; bộ lv5–6 chưa nối vào ứng dụng do nhóm bay còn thiếu.
- Contact sheet ngủ giữ cùng nhân vật/góc trái, thân cam, cánh teal, sừng và đuôi lửa; tiến trình đi từ đứng/ngáp, hạ thân, nằm xuống tới nhắm mắt.
- Đã sửa khung 7 để nằm sấp thay vì ngồi. Khung 13 là hít vào; 14 giữ; 15–16 trở về tư thế thở ra/giữ để vòng lặp nối liền.
- Atlas ngủ có alpha trong suốt, 1280×1280, 16 ô và dưới ngưỡng 700 KB. Xem contact sheet và GIF để soát chuyển động.
- Contact sheet bay có đủ bốn nhóm: cất cánh (1–4), vòng vỗ cánh (5–8), lượn (9–12), hạ cánh (13–16); GIF dùng 350 ms/cất cánh, 180 ms/vỗ cánh, 825 ms/lượn, 350 ms/hạ cánh.
- Các dáng có cánh/đuôi ngang rộng được thu về chiều cao 154 px để nằm trọn trong ô, giữ cùng đường neo y=288. Atlas có alpha trong suốt và dưới ngưỡng 700 KB.

## Điểm còn thiếu

- Ngủ: đã tạo và đóng gói đủ 16 khung thành ứng viên; chưa tích hợp riêng lẻ vì hoạt ảnh lv5–6 còn thiếu nhóm bay.
- Bộ đi bộ, chạy, bay và ngủ cấp 5–6 hiện là atlas ứng viên; chưa tích hợp vào app.
