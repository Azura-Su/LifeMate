# Thiên Dực Linh Lộc Lv 11–12 — nhóm ngủ D

Ngày: 2026-11-01  
Trạng thái: tự rà contact sheet và thông số; chưa tích hợp

## Tạo và căn khung

- Đã tạo 16 ảnh toàn thân riêng, giữ ảnh nguồn trong `assets/pixelPet/sourceFrames/celestial_stag_lv1112/sleep/`.
- Khung 3 đầu vượt lề khi căn ở scale 0,2; đã tạo lại khung 3 với khổ và dáng gọn hơn.
- Các tư thế nằm xòe ngang hơn dáng đi/bay; để không cắt cánh, sừng và đuôi, cả nhóm dùng chung scale 0,16 (không thu nhỏ riêng khung). Điểm neo thân cam giữ ở (160, 220), ô 320×320.
- Atlas ứng viên 1280×1280, 256 màu có dithering, 199,206 byte (dưới 700KB). Tất cả khung qua kiểm tra lề tối thiểu 25px.

## Tự rà

- Đã xem contact sheet 4×4: trình tự từ đứng/yawn, hạ thân, cuộn nằm, tựa cằm lên chân tới nhịp thở; giữ nhận diện hươu, bờm/cánh teal, rune và đuôi lửa. Các khung thở 13–16 gần như cùng một tư thế để tạo vòng lặp chậm.
- GIF settle 12×200ms = 2,4s; GIF breathe 4×500ms = 2s. Đã xác nhận metadata và tổng thời lượng. GIF chưa được phát trực tiếp trong phiên; contact sheet đã được xem.
- Bản căn dùng neo tâm thân để ổn định dáng cuộn; đây không phải đường móng cố định vì clip là tư thế nằm.
- Chưa tích hợp atlas vào app.

## Tệp xem

- Contact sheet: `tasks/previews/celestial-stag-lv1112-sleep-contact.png`
- Atlas ứng viên: `tasks/previews/celestial-stag-lv1112-sleep-atlas-candidate.png`
- GIF settle: `tasks/previews/celestial-stag-lv1112-sleep-settle.gif`
- GIF thở: `tasks/previews/celestial-stag-lv1112-sleep-breathe.gif`
