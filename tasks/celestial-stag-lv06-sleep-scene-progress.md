# Cảnh ngủ Lv 6 — Cổ thụ hoa anh linh

## Trạng thái mới: đã duyệt và tích hợp ngày 02/11/2026

- Chủ dự án chọn **“Duyệt, gắn vào app”** sau khi xem bộ 32 khung và ảnh ghép.
- Đã thay cặp atlas Lv6 trong `assets/pixelPet/animations/`, sao chép 32 khung đã duyệt vào `packed320/`, cập nhật provenance và SPEC. Hai file app trùng byte với bản được duyệt.
- Đã bỏ Lv6 khỏi script đóng gói tier cũ để bộ ảnh không bị ghi đè bằng mặt nạ hé lộ.
- Kiểm tra trực tiếp Simulator ở Lv6 và Lv7, đồng thời chạm đánh thức Lv6 để xem cảnh héo và tự gỡ. Phát hiện nền cỏ bị thanh tab che 14,2pt; đã căn riêng cảnh Lv6–7 lên mặt đất của sprite, cho cả lúc mọc, héo và thức sớm.
- Bốn test mới về đường đất Lv6–7 tái hiện sai lệch trước khi sửa. Sau sửa: **85 test / 5 suite đạt**, TypeScript và ESLint các file thay đổi đạt.
- Ảnh runtime: `tasks/previews/celestial-stag-lv06-home-installed.png`. Simulator được để lại ở chế độ xem thử Lv6.

- Giữ ảnh hoàn chỉnh `frame15-approved.png` và ảnh mọc 3–8 từ lượt trước; vẽ thêm ảnh mọc 1–2, 9–14 bằng image_gen tích hợp. Khung 0 trống.
- Vẽ đủ ảnh héo 1–14. Khung héo 0 sao chép chính xác khung mọc 15 đã căn; khung héo 15 trống.
- Vẽ lại khung mọc 9–10 để giữ đúng hai tầng tán; vẽ lại khung héo 8 để hoa không xuất hiện lại sau khi đã rụng. Vẽ lại khung héo 11–14 từ cây khô để giữ dáng thân, không kéo cao cành hoặc thêm khói đặc.
- Nếu có, bản được chọn dùng hậu tố `-v2-source.png`; bản thử trước giữ để đối chiếu. Prompt và nguồn nằm trong `assets/pixelPet/sourceFrames/sleep_garden_lv06/authored-v2-provenance.json`.

### Bản xem trước

- `tasks/previews/celestial-stag-lv06-growth-review-contact.png`
- `tasks/previews/celestial-stag-lv06-decay-review-contact.png`
- `tasks/previews/celestial-stag-lv06-growth-review.gif` — 16 khung, 3,8 giây.
- `tasks/previews/celestial-stag-lv06-decay-review.gif` — 16 khung, 4,8 giây.
- `tasks/previews/celestial-stag-lv06-sleep-scene-pet-overlay-review.png` — ghép tư thế ngủ Lv5–6 theo tỷ lệ pet/cảnh của Home; kiểm tra bố cục, chưa phải ảnh chụp runtime.
- Atlas ứng viên: `tasks/previews/celestial-stag-lv06-growth-atlas-candidate.png` và `celestial-stag-lv06-decay-atlas-candidate.png`.

### Kiểm tra

- Mỗi atlas 1280×1280, lưới 4×4, ô 320×320, có alpha trong suốt.
- Khung mọc có nội dung cùng đường đất y=296. Dùng chung tỷ lệ cảnh, không phóng cây non theo chiều cao từng ảnh.
- Hai đầu trống đúng; khung mọc 15 và héo 0 trùng toàn bộ pixel; không có pixel nội dung chạm biên ô hoặc tràn qua đường đất. Báo cáo: `assets/pixelPet/sourceFrames/sleep_garden_lv06/review320/checks.json`.
- Mọc: 307.807 byte (~301 KiB); héo: 444.688 byte (~434 KiB), đều dưới 700 KiB. Hai clip dùng chung bảng màu 256 màu để giữ màu ở điểm nối; không dùng mặt nạ hé lộ từ ảnh cuối.
- Đã xem hai contact sheet và ảnh ghép thú sau đóng gói. GIF kiểm tra đủ 16 khung và tổng thời lượng bằng ImageIO; cảnh tích hợp đã xem trên Simulator.
- Script đóng gói qua ESLint; script GIF chạy bằng Swift/ImageIO trên macOS.

### Tái tạo bản xem

Lấy đường dẫn Sharp từ runtime qua `load_workspace_dependencies`; đây là công cụ đóng gói ảnh, không thêm dependency cho app.

```sh
node scripts/review-celestial-stag-lv06-garden.cjs /absolute/path/to/node_modules/sharp
swift -module-cache-path /private/tmp/lifemate-lv06-swift-cache scripts/preview-celestial-stag-lv06-garden.swift
```

Mặc định script tạo `review320/` và `tasks/previews/`. Thêm `--install` để chép bộ đã kiểm tra vào atlas app và `packed320/` sau khi duyệt.

### Các bước tích hợp đã hoàn tất

Brief `docs/celestial-stag-sleep-garden-tiers-brief.md`, mục 5 yêu cầu: **“Gửi chủ dự án duyệt trước khi gắn vào app.”**

1. Đã thay atlas, cập nhật provenance chung và SPEC.
2. Đã loại Lv6 khỏi script tier cũ.
3. Đã xem Home Lv6–7, kiểm tra ngủ/đánh thức và sửa clipping nền cỏ ở thanh tab.
4. Đã chạy kiểm tra app liên quan sau tích hợp.

## Nhật ký lượt trước (giữ để đối chiếu)

### Đã tạo ở lượt trước

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

### Còn thiếu tại thời điểm dừng trước

- Khung mọc 0–2 và 9–14.
- Đủ 16 khung héo, trong đó ô 0 phải trùng pixel với ô 15 mọc.
- Căn và chuẩn hóa toàn bộ ảnh về ô 320×320, đường đất y=296; ghép atlas mọc/héo,
  contact sheet và GIF; tự soát vị trí, nhịp, nền alpha và dung lượng.
- Tích hợp atlas Lv 6 vào app, cập nhật hướng dẫn/spec/provenance và chạy các kiểm
  tra tương ứng.

### Điểm dừng công cụ trước

Lượt tạo ảnh tiếp theo bị từ chối bởi giới hạn sử dụng của image generation
(HTTP 429, công cụ báo còn khoảng 16 giờ). Không thay thế bằng API/CLI vì skill
tạo ảnh yêu cầu xác nhận rõ trước khi dùng đường CLI. Tiếp tục từ ô 9 khi công
cụ tạo ảnh dùng lại được; chưa đóng gói atlas hoặc gắn vào app khi còn thiếu ảnh.
