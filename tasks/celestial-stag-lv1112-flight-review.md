# Thiên Dực Linh Lộc Lv 11–12 — nhóm bay C

Ngày: 2026-11-01  
Trạng thái: tự rà contact sheet và thông số; chưa tích hợp

## Tạo và căn khung

- Đã tạo 16 tranh toàn thân riêng, lưu tại `assets/pixelPet/sourceFrames/celestial_stag_lv1112/flight/`.
- Khung 9 đầu bị loại do tạo sai canvas dọc; khung vuông thay thế đã được dùng.
- Khung 7 đầu chạm sát mép khi căn cùng tỷ lệ; đã vẽ lại. Không thu nhỏ riêng khung.
- Tất cả nguồn là ảnh vuông 1254×1254; bản căn ô dùng chung scale 0,2 và cùng điểm neo thân cam tại (160, 219), ô 320×320.
- Đã đo alpha bounds của 16 ô: lề nhỏ nhất 25px (khung 3 theo cạnh dưới); tất cả silhouette còn nằm trong ô.

## Tự rà

- Đã xem contact sheet 4×4: nhận diện, palette cam/teal, sừng, bờm và đôi cánh nhất quán; trình tự cất cánh, vỗ cánh, lượn, hạ cánh có đủ 16 tư thế.
- Atlas ứng viên 1280×1280, 256 màu có dithering, 330,366 byte (dưới 700KB).
- GIF nhóm: cất cánh 4×350ms = 1,4s; vỗ cánh 4×180ms = 0,72s; lượn 4×350ms = 1,4s; hạ cánh 4×350ms = 1,4s. Metadata thời lượng đã kiểm tra. GIF không được phát trực tiếp trong phiên; contact sheet đã được xem.
- Chưa tích hợp atlas vào app.

## Tệp xem

- Contact sheet: `tasks/previews/celestial-stag-lv1112-flight-contact.png`
- Atlas ứng viên: `tasks/previews/celestial-stag-lv1112-flight-atlas-candidate.png`
- GIF: `tasks/previews/celestial-stag-lv1112-flight-{takeoff,flap,glide,landing}.gif`
