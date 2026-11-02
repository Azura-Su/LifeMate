# Vườn suối nhỏ Lv4–5 — bộ khung đã hoàn thiện

## Kết quả

- Giữ 16 ảnh nguồn mọc đã có; bổ sung tám ảnh héo `decay07.png`–`decay14.png`
  bằng công cụ image_gen tích hợp, tham chiếu khung kề trước. Chuỗi héo đi từ
  tắt đom đóm, vàng/rụng lá, suối cạn, cây xám tới tan thành tro.
- Đủ 16 khung mọc và 16 khung héo. Dùng một tỷ lệ chung cho cả bộ, căn đường
  đất y=296, footprint tối đa 288px trong ô 320×320. Khung bụi cuối không được
  phóng lớn để lấp đầy ô. Héo 0 được sao chép từ mọc 15 để khớp pixel.
- Chủ dự án đã duyệt GIF héo và ảnh ghép Home trong chat, rồi cho phép thay
  atlas trong app. Cặp atlas hiện tại được thay tại
  `assets/pixelPet/animations/home_sleep_garden_lv04.png` và
  `assets/pixelPet/animations/home_sleep_garden_lv04_decay.png`.
- Cảnh Lv4–5 tiếp tục được chọn qua bảng atlas hiện có; không đổi logic Home,
  cấp mở khóa, nhịp ngủ/thức hoặc dữ liệu linh thú.
- Theo yêu cầu tăng nhẹ kích thước, cảnh Home Lv4–5 được tăng 10% từ 168pt lên
  184,8pt, giữ nguyên tâm và đường đất. Khung thức sớm và cảnh héo cùng tỷ lệ.

## Nguồn và tạo lại

- Ảnh nguồn, prompt chính xác và ID ảnh sinh nằm trong
  `assets/pixelPet/sourceFrames/sleep_garden_lv04/`; xem `generation-prompts.json`.
- `node scripts/pack-home-sleep-garden-lv04.cjs` tạo bản xem trước và khung
  `review320/`. Sau khi duyệt, thêm `--install` để cập nhật atlas, `packed320/`
  và contact sheet chính thức. Script tiers chung không còn đóng gói Lv4.
- Tạo GIF bằng
  `swift -module-cache-path /private/tmp/lifemate-lv04-swift-cache scripts/preview-celestial-stag-lv04-garden.swift --install`.
- Contact sheet và GIF hiện tại: `tasks/previews/home_sleep_garden_lv04-growth*`
  và `tasks/previews/home_sleep_garden_lv04-decay*`. Bản duyệt có thêm
  `-authored-` trong tên. Ảnh ghép Home:
  `tasks/previews/celestial-stag-lv04-authored-home-composite.png`.

## Kiểm tra

- Atlas: hai PNG RGBA 1280×1280; mọc 509.364 byte, héo 701.963 byte, đều dưới
  700 KiB. Kiểm tra 32 ô, lề, footprint, đường đất và hai đầu trong suốt.
- GIF: 16 khung mỗi file; mọc 3,80 giây, héo 4,80 giây. Xem contact sheet và
  ghép đúng tỷ lệ/vị trí Home với pose ngủ Lv3–4: linh lộc nằm trước gốc,
  không bị cảnh che. Đây là kiểm tra ảnh ghép; chưa chạy simulator/thiết bị.
- `npm run typecheck`: qua.
- ESLint hai script CJS đóng gói: qua.
- Jest ba suite `HomePetRoamer`, `HomeSleepScene`, `pixelPetGuide`: 72 test qua.
  Dùng `--watchman=false` vì Watchman không có quyền ghi thư mục state trong
  sandbox; giữ nguyên các test và cấu hình kiểm tra của repo.
