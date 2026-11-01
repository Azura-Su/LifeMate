# Thiên Dực Linh Lộc Lv 9–10 — bộ chuyển động Home

Trạng thái: đi bộ, chạy, bay và ngủ đã tự rà soát, đóng gói và tích hợp cho cấp 9–10. Cấp 8 vẫn dùng bộ Lv7–8. Chu kỳ Home và scale ascended giữ nguyên.

## Atlas đã tích hợp

- Khung đứng chuẩn: `assets/pixelPet/sourceFrames/celestial_stag_lv910/frame0_approved.png`.
- Đi bộ: 8 khung nguồn, lặp hai vòng trong atlas 4×4; preview `tasks/previews/celestial-stag-lv910-walk-contact.png` và `.gif`.
- Chạy: 8 khung nguồn, lặp hai vòng trong atlas 4×4; preview `tasks/previews/celestial-stag-lv910-run-contact.png` và `.gif`.
- Bay: 16 khung; nhóm 1–4 cất cánh, 5–8 vỗ cánh, 9–12 lượn, 13–16 hạ cánh; preview `tasks/previews/celestial-stag-lv910-flight-contact.png` và `.gif`. Thay mới khung 7, 15, 16 để sửa nhịp vỗ xuống và tiếp đất. Dùng transform cố định thay vì scale theo bbox, tránh sải cánh làm thân co giãn.
- Ngủ: 12 khung chuyển từ đứng xuống nằm và 4 khung thở; preview `tasks/previews/celestial-stag-lv910-sleep-contact.png` và `.gif`.
- PNG runtime nằm tại `assets/pixelPet/animations/celestial_stag_lv910_{walk,run,flight,sleep}.png`; tất cả 1280×1280, lưới 4×4, nền alpha và dưới 700 KB.
- Atlas được chọn theo level 9 hoặc 10; scale `STAGE_LOOK.ascended` và chu kỳ Home hiện có được giữ nguyên.

## Kiểm tra

- Contact sheet và GIF của cả bốn nhóm đã tự rà soát.
- `npm run typecheck` — đạt.
- `npm test -- --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx src/screens/PixelPet/__tests__/PixelPetSprite.test.tsx src/services/pixelPet/__tests__/celestialStagAtlas.test.ts` — đạt, 3 suites / 153 tests.
- GIF bay có đủ 16 khung; cất/hạ cánh 1.4 giây mỗi pha, vỗ cánh preview 0.72 giây và lượn khoảng 3.32 giây.
