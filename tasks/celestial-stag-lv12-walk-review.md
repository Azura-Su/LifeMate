# Thiên Dực Linh Lộc cấp 1–2: nhóm đi bộ (ứng viên duyệt)

## Phạm vi

Đã tạo khung đứng chuẩn (khung 0) và 8 tư thế đi bộ riêng theo ảnh mẫu. Chưa tạo nhóm chạy, hop, ngủ; chưa thay asset hoặc logic trong app. Cấp 3 trở lên chưa bị tác động.

## Tư thế

1. Chân trước gần tiếp đất phía trước; chân sau đối diện đẩy ra sau.
2. Chuyển trọng tâm và hạ thân nhẹ.
3. Chân trước gần gập, bước qua; chân sau đối diện đung đưa.
4. Thân nhón nhẹ, chân sau gần nhấc bước.
5–8. Lặp chu kỳ với chân đối diện.

Atlas 4×4 lặp 8 tư thế hai lần. GIF xem trước dùng 8 tư thế ở 100 ms/frame (0,8 giây/vòng).

## Kiểm tra

- Tất cả ảnh là toàn thân, nền alpha trong suốt, hướng trái.
- Đã chuẩn hóa mỗi dáng về khoảng 60% chiều cao ô và đường đáy khoảng 90% ô.
- Contact sheet cho thấy chân trước/sau thay đổi qua chu kỳ; không chỉ di chuyển toàn ảnh.
- Đã kiểm tra 8 frame và delay GIF bằng ImageIO.
- Có một số sai khác nhỏ giữa các frame ở họa tiết pha lê và chi tiết lông/cánh do mỗi khung được tạo riêng; cần chủ dự án duyệt tính nhất quán trước khi tích hợp.
- Atlas ứng viên được giảm màu có dithering để còn dưới 700 KB; bản contact sheet đã xem lại sau xử lý.

## Tệp

- Khung đứng chuẩn: `assets/pixelPet/sourceFrames/celestial_stag_lv12/frame-00-candidate.png`
- Ảnh gốc và khung đã căn: `assets/pixelPet/sourceFrames/celestial_stag_lv12/walk-01..08-{source,candidate}.png`
- Atlas ứng viên: `assets/pixelPet/sourceFrames/celestial_stag_lv12/walk-atlas-candidate.png`
- Contact sheet: `tasks/previews/celestial-stag-lv12-walk-contact.png`
- GIF: `tasks/previews/celestial-stag-lv12-walk.gif`

**Trạng thái:** chờ chủ dự án duyệt nhóm đi bộ trước khi chuyển sang nhóm tiếp theo hoặc gắn vào app.
