# Cảnh ngủ Linh Lộc Lv 14 — Thánh địa vàng kim

Ngày: 2026-11-02. Trạng thái: đủ 32 ô ứng viên, đã tự rà; chưa thay atlas trong app.

## Kết quả

- Bộ cũ dùng một ảnh hoàn chỉnh với reveal/dissolve thủ tục. Bộ ứng viên dùng ảnh
  toàn cảnh riêng cho từng giai đoạn: vòng sáng → bệ trắng → trụ → vòm → cây non
  → tán xanh → viền vàng → hạt sáng; khi thức: vàng phai đồng → vòm tan → lá rụng
  → trụ sụp → bệ/cây vỡ tro → bụi đồng → trống.
- Giữ ảnh đích `frame15-candidate-source.png` và khung 03 có sẵn. Tạo thêm 13 ảnh
  mọc và 14 ảnh héo bằng **built-in image_gen**, không dùng API/CLI fallback.
  Hai ô trống tạo khi đóng gói; ô héo 00 sao chép từ ô mọc 15.
- Đã tạo lại các khung mọc 04–10 vì chuỗi đầu làm trụ/vòm cao rồi thu thấp ở ô 11.
  Bản chọn là `frame04-v2-source.png` đến `frame10-v2-source.png`, dựng từ ảnh
  đích chung. Các bản đầu và ảnh ghi `rejected` không được chọn để đóng gói.
- Hoa nền xuất hiện từ sớm vì kế thừa bố cục ảnh 03 đã có; hoa quanh mép bệ được
  bổ sung ở ô 13. Đây là khác biệt với nhịp thêm hoa muộn trong brief.

## Tệp xem và nguồn

- `tasks/previews/celestial-stag-lv14-growth-review.gif`: 16 ô, 3,80 giây.
- `tasks/previews/celestial-stag-lv14-decay-review.gif`: 16 ô, 4,80 giây.
- `tasks/previews/celestial-stag-lv14-growth-review-contact.png`.
- `tasks/previews/celestial-stag-lv14-decay-review-contact.png`.
- `tasks/previews/celestial-stag-lv14-pet-overlay-review.png`: bốn tư thế ngủ
  12–15 của Linh Lộc Lv 13–14, ghép bằng kích thước/vị trí hiện dùng trên Home.
- Hai atlas ứng viên: `tasks/previews/celestial-stag-lv14-growth-atlas-candidate.png`
  và `tasks/previews/celestial-stag-lv14-decay-atlas-candidate.png`.
- Ảnh nguồn: `assets/pixelPet/sourceFrames/sleep_garden_lv14/`; danh sách ảnh
  thực sự được chọn và thông số căn tại `review320/review.json`.
- Nguồn/lệnh tạo tóm tắt: `assets/pixelPet/sourceFrames/sleep_garden_lv14/authored-provenance.json`.

## Kiểm tra

- Cả hai atlas RGBA 1280×1280, lưới 4×4, ô 320×320. Mọc 591.585 byte,
  héo 698.453 byte, đều dưới 700×1024 byte.
- Đường đất dưới cùng ở y=296; toàn bộ điểm ảnh hữu hình nằm trong x=16…303.
  Không có ảnh được chọn chạm mép ảnh nguồn theo ngưỡng alpha 24.
- Ô mọc 00 và héo 15 hoàn toàn trong suốt. Ô mọc 15 và héo 00 trùng từng byte
  RGBA; SHA-256 dữ liệu ảnh: `6f931e368f3fb819d393c90d81b022b55b496e40a3d479b0265f9e7d249e8b10`.
  Kiểm tra so sánh byte được script thực hiện lại mỗi lần tái xuất.
- Đã xem contact sheet mọc/héo và ảnh ghép bốn tư thế ngủ. GIF đã xác nhận
  đủ 16 khung và thời lượng; chưa kiểm chứng chuyển động bằng một lượt chạy native.
- `npx --no-install eslint scripts/review-celestial-stag-lv14-garden.cjs`: đạt.
- `npm test -- --watchman=false --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx src/services/pixelPet/__tests__/pixelPetGuide.test.ts`:
  2 bộ, 77 test đạt. Lần mặc định bị quyền ghi state Watchman trong sandbox;
  chạy lại cùng test với bộ quét file của Jest đã đạt, không sửa hoặc bỏ test.

## Tái xuất

```sh
node scripts/review-celestial-stag-lv14-garden.cjs
swift -module-cache-path /private/tmp/lifemate-lv14-swift-cache scripts/preview-celestial-stag-lv14-garden.swift
```

Script căn theo bề rộng/đường đất của nền, không căn theo chiều cao cây non.
Sau ô héo 12, bụi dùng biến đổi của cảnh hoàn chỉnh để không phóng to phần còn lại.
Bảng màu dùng 7 mức mỗi kênh RGB, 4 mức alpha và nén PNG Deflate mức 9.
Script chỉ ghi ảnh ứng viên và preview, không tự cài vào app hay sửa provenance chung.

## Điểm duyệt còn lại

Theo mục 5 của `docs/celestial-stag-sleep-garden-tiers-brief.md`, cần chủ dự án
duyệt hình trước khi thay hai atlas Lv 14 đang dùng. Sau khi duyệt, thay đúng cặp
Lv 14, cập nhật provenance chung và kiểm chứng trên Home ở Lv 14–15, gồm đánh
thức khi mọc xong và khi còn đang mọc. Chưa thay đổi mã hiển thị, hướng dẫn hay
asset của cấp khác trong công việc này.
