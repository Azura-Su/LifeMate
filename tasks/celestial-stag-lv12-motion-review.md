# Thiên Dực Linh Lộc cấp 1–2: kiểm tra chuyển động

## Kết quả

- Giữ ảnh đứng cấp 1 đã duyệt làm mốc nhận diện. Tư thế mỗi khung được chuẩn
  hóa cùng kích thước và trục chân; atlas nền trong suốt, 4×4 ô, 320 px/ô.
- **Đi bộ:** 8 tư thế chân luân phiên, dùng để bước trên mặt đất.
- **Chạy:** 8 tư thế có nhấc chân và đổi trọng tâm rõ hơn đi bộ.
- **Nhảy:** 16 khung cho nhịp nhảy thấp, lên ngắn rồi đáp; không chạy chuỗi bay
  dài như linh lộc cấp cao.
- **Ngủ:** 12 khung hạ thấp thân, nằm xuống và nhắm mắt; bốn khung cuối lặp
  nhịp hít vào/thở ra. Không có ký hiệu Z.
- Contact sheet và GIF được lưu ở `tasks/previews/celestial-stag-lv12-*`.

## Tự duyệt

Đã xem từng contact sheet và GIF theo thứ tự khung. Đi/chạy thay đổi vị trí
chân thay vì rung nguyên sprite; nhảy trở về tư thế đứng; phần ngủ hạ thân
liên tục trước khi vào vòng thở. Vòng thở mới giữ cùng khung camera và kích
thước linh thú giữa các pose. Mọi atlas dưới 700 KB.

## Tích hợp

Chỉ cấp 1–2 dùng atlas mới. Home chọn nhảy thấp và tiếp đất rồi chạy/đi tới
điểm ngủ; lịch thức vẫn 20 giây. Cấp 3–4 tiếp tục dùng atlas riêng đã có, các
cấp khác không bị đổi. File cấu hình nguồn và atlas được liệt kê trong
`assets/pixelPet/animations/provenance.json`; quy tắc nằm trong
`SPEC-pixel-pet.md`.

## Kiểm tra

- `npm test -- --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx src/screens/PixelPet/__tests__/PixelPetSprite.test.tsx src/services/pixelPet/__tests__/celestialStagAtlas.test.ts`
- `npm run typecheck`
- ESLint trên các file TypeScript bị ảnh hưởng.
