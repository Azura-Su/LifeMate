# Cảnh ngủ Lv 6 — Cổ thụ hoa anh linh

## Đã tạo

- Khung hoàn chỉnh ô 15, dùng làm đích cho chuỗi mọc.
- Các khung mọc 3–8. Ảnh nguồn 1254×1254 RGBA nằm tại
  `assets/pixelPet/sourceFrames/sleep_garden_lv06/`; bản xem trước tương ứng ở
  `tasks/previews/`.
- Đã tự xem các khung: giữ nền cỏ và đá hai mép, hai cụm bụi/nấm, phần giữa
  thoáng cho linh lộc; ô 3–5 là giai đoạn nấm và mầm, ô 6–7 thân/cành, ô 8
  bắt đầu có tán xanh.
- Contact sheet tạm để tự soát: `tasks/previews/celestial-stag-lv06-sleep-scene-current-contact.png`.
- Kiểm tra alpha/bbox: các ảnh là RGBA 1254×1254, nền ngoài cảnh trong suốt;
  khung 3–8 giữ cùng bbox nền ở y≈928–1166, chỉ phần cây tăng lên dần. Ô 15
  bbox là (116,142)–(1173,1159); bố cục hai tầng hoa, nấm teal và chỗ nằm giữa
  nhìn rõ trên contact sheet. Ô 3 phù hợp mô tả, ô 4 có mầm nhỏ và ánh nấm nhẹ.
- Tự duyệt ô 15 làm khung hoàn chỉnh hiện tại; lưu thêm bản `frame15-approved.png`.

## Còn thiếu

- Khung mọc 0–2 và 9–14.
- Đủ 16 khung héo, trong đó ô 0 phải trùng pixel với ô 15 mọc.
- Căn và chuẩn hóa toàn bộ ảnh về ô 320×320, đường đất y=296; ghép atlas mọc/héo,
  contact sheet và GIF; tự soát vị trí, nhịp, nền alpha và dung lượng.
- Tích hợp atlas Lv 6 vào app, cập nhật hướng dẫn/spec/provenance và chạy các kiểm
  tra tương ứng.

## Điểm dừng công cụ

Lượt tạo ảnh tiếp theo bị từ chối bởi giới hạn sử dụng của image generation
(HTTP 429, công cụ báo còn khoảng 16 giờ). Không thay thế bằng API/CLI vì skill
tạo ảnh yêu cầu xác nhận rõ trước khi dùng đường CLI. Tiếp tục từ ô 9 khi công
cụ tạo ảnh dùng lại được; chưa đóng gói atlas hoặc gắn vào app khi còn thiếu ảnh.
