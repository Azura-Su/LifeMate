# Thiên Dực Linh Lộc Lv 11–12 — nhóm đi bộ A

Ngày: 2026-11-01  
Trạng thái: tự kiểm tra đạt; đã tiếp tục sang nhóm B theo ủy quyền của chủ dự án

## Tư thế và nguồn

- Khung đứng chuẩn đã duyệt: `assets/pixelPet/sourceFrames/celestial_stag_lv1112/standing-frame-00-approved.png` (mẫu 2).
- Tạo riêng 8 ảnh toàn thân, lần lượt theo 4 pha bước và 4 pha đổi bên. Nguồn gốc giữ tại `assets/pixelPet/sourceFrames/celestial_stag_lv1112/walk/`; bản căn ô có hậu tố `-aligned.png`.
- Khung 4 đầu tiên bị loại vì có dấu hiệu thừa chân; bản vẽ lại được dùng.
- Đã căn kích thước nhân vật 224px trong ô 320×320 và đường móng ở y=288. Tâm vùng thân cam đo được giữa các khung lệch tối đa 4.07px, dưới ngưỡng khoảng 6px.

## Kiểm tra và bản xem

- Contact sheet 4×4 đã xem: cùng mẫu mặt, tông cam/teal và tỷ lệ; không thấy nền hoặc bóng nền. Các khung lặp ô 1–8 ở ô 9–16.
- Atlas ứng viên 1280×1280, 256 màu có dithering, 286,861 byte (dưới giới hạn 700KB). Chưa đặt vào thư mục atlas runtime.
- GIF có 8 khung, 100ms/khung, tổng vòng 800ms. Đã kiểm tra metadata và contact sheet; chưa xem được GIF chạy trong phiên này vì chính sách bảo mật từ chối mở URL `file://` trong browser. Vì vậy chưa đánh dấu phần xem chuyển động là hoàn tất.
- Contact sheet và phép đo căn khung đạt yêu cầu để tiếp tục nhóm B theo chỉ dẫn của chủ dự án. Chủ dự án không cần duyệt từng nhóm.

## Tệp xem

- Contact sheet: `tasks/previews/celestial-stag-lv1112-walk-contact.png`
- GIF: `tasks/previews/celestial-stag-lv1112-walk.gif`
- Atlas ứng viên: `tasks/previews/celestial-stag-lv1112-walk-atlas-candidate.png`
