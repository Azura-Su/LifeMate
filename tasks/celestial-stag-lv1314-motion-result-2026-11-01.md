# Thiên Dực Linh Lộc Lv13–14 — kết quả chuyển động Home

Ngày: 2026-11-01

## Tư thế đứng chuẩn

- Chọn candidate thứ 2 do chủ dự án chỉ định; lưu tại
  `assets/pixelPet/sourceFrames/celestial_stag_lv1314/standing-frame-00-approved.png`.
- Góc nhìn ngang quay trái, cánh khép, bốn chân phân biệt, nền trong suốt.

## Nhóm đi bộ — tự duyệt

- Có 8 hình vẽ toàn thân riêng; lặp các tư thế để tạo atlas 4×4.
- Contact sheet: `tasks/previews/celestial-stag-lv1314-walk-contact.png`.
- GIF 0,8 giây: `tasks/previews/celestial-stag-lv1314-walk.gif`.
- Atlas 1280×1280 RGBA, 320px/ô, 256 màu có dithering; 597,617 byte.
- Soát contact sheet: cùng hướng, gương mặt và palette; mỗi khung có bốn chân;
  cánh khép, đuôi và sừng nằm trong ô. Không thấy cắt hình hoặc đổi tỷ lệ rõ rệt.
- Nhịp chân luân phiên hai bên. Một số chuyển trọng tâm nhẹ; tổng độ dịch thân
  trong vòng lặp chưa được đo tự động.

## Nhóm bay — đã tích hợp, cần cải thiện độ nhất quán

- 16 khung toàn thân trong atlas 4×4, chia takeoff (0–3), flap (4–7), glide
  (8–11), landing (12–15); thời lượng lấy theo pha Home đang có.
- Contact sheet: `tasks/previews/celestial-stag-lv1314-flight-contact.png`.
- GIF duyệt chu kỳ bay: `tasks/previews/celestial-stag-lv1314-flight.gif`.
- Atlas 1280×1280, 256 màu có dithering; 693,326 byte.
- Tự duyệt: các pose đọc được theo pha, nhưng một số khung thay đổi kích thước
  biểu kiến và hình dáng cánh. Cần chuẩn hóa lại nếu tiếp tục hoàn thiện mỹ thuật.

## Ngủ — đã tích hợp

- 16 khung trong atlas 4×4: đứng/ngáp/hạ người ở khung 0–7, cuộn đuôi và khép
  mắt ở khung 8–11, vòng thở nhẹ ở khung 12–15.
- Contact sheet và GIF: `tasks/previews/celestial-stag-lv1314-sleep-contact.png`
  và `tasks/previews/celestial-stag-lv1314-sleep.gif`.
- Atlas 1280×1280, 256 màu có dithering; 559,712 byte. Home dùng 12 khung đầu
  cho settle và 4 khung cuối lặp khi ngủ.
- Tự duyệt: tư thế cuộn và mắt nhắm đọc rõ; kích thước biểu kiến giữa tư thế
  đứng và nằm chưa đồng nhất hoàn toàn.

## Chạy — fallback

- Chạy tiếp tục dùng atlas hiện có. Candidate chạy chưa đủ vòng lặp và không
  được tích hợp.

## Tích hợp

- Home truyền level của thú đang sở hữu; Home preview dùng level preview.
- Level 13 và 14 chọn atlas đi bộ, bay và ngủ mới; chạy chọn atlas hiện có.
- Level 12 và 15 tiếp tục dùng atlas trước đó.
- Thời lượng và trình tự Home hiện tại giữ nguyên: bay, đáp, đi vào vườn rồi ngủ.

## Kiểm tra

- `npm test -- --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx src/screens/PixelPet/__tests__/PixelPetSprite.test.tsx src/services/pixelPet/__tests__/celestialStagAtlas.test.ts` — đạt, 125 test.
- `npm run typecheck` — đạt.
- ESLint cho các tệp TypeScript đã sửa — đạt.
- `npx expo export --platform ios --output-dir /tmp/lifemate-lv1314-ios-export` — đạt.

## Preview trên Home

Unit tests xác nhận truyền level 13/14 và lựa chọn atlas/fallback ở sprite; iOS
bundle cũng export thành công. Chưa quan sát chu kỳ trong màn Xem trên Home:
Xcode run hiện có kết nối dev server tới `192.168.0.154:8081`, báo lỗi cú pháp
từ bản trung gian cũ rồi kết thúc bằng code 9 trước khi render màn hình. Mã hiện
tại export thành công, nhưng xem trực tiếp bốn cấp 12/13/14/15 vẫn cần runtime
được kết nối lại.
