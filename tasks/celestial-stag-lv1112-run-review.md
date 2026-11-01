# Thiên Dực Linh Lộc Lv 11–12 — nhóm chạy B

Ngày: 2026-11-01  
Trạng thái: tự kiểm tra đạt; tiếp tục nhóm C

## Nguồn và chuẩn hóa

- Tạo riêng 8 tư thế gallop, lưu tại `assets/pixelPet/sourceFrames/celestial_stag_lv1112/run/` cùng bản căn ô `*-aligned.png`.
- Chuẩn hóa theo bề rộng vùng thân cam 160px, móng/điểm thấp nhất theo y=288, ô 320×320; cách này giữ tỷ lệ thân qua pha co và duỗi.
- Contact sheet cho thấy mặt, màu teal/cam, sừng, bờm/cánh gập, đuôi lửa và giải phẫu bốn chân nhất quán.

## Kiểm tra và bản xem

- Contact sheet 4×4 lặp 8 pose hai lần; GIF có 8 khung × 60ms = 480ms, xấp xỉ vòng chạy 0,5s.
- Atlas ứng viên 1280×1280, 256 màu có dithering, 237,544 byte (dưới 700KB).
- Tâm màu cam tổng thể giữa khung thay đổi theo dáng chân/vị trí thân (tối đa khoảng 27px theo centroid toàn vùng cam); phép đo không phân biệt thân với chân. Contact sheet cho thấy trục thân được đặt ổn định trong từng ô. GIF không phát trực tiếp được trong phiên; đã rà contact sheet và thông số GIF.

## Tệp

- Contact: `tasks/previews/celestial-stag-lv1112-run-contact.png`
- GIF: `tasks/previews/celestial-stag-lv1112-run.gif`
- Atlas ứng viên: `tasks/previews/celestial-stag-lv1112-run-atlas-candidate.png`
