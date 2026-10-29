# Linh thú: animation nghỉ riêng cho 15 loài — 29/10/2026

## Đã làm

- Tạo atlas nghỉ riêng 4×4 cho Cửu Vĩ Hồ, Kỳ Lân, Thiên Mã, Lang Rune, Huyền
  Vũ, Nhân Sư, Nhân Mã, Bạch Hổ, Thanh Long, Koi Long, Scylla, Chim Lạc,
  Phượng Hoàng, Anubis và Garuda. Thiên Dực Linh Lộc giữ nguyên atlas ngủ riêng.
- Mỗi atlas có16 khung toàn thân: hạ người, thu/đặt chân và các bộ phận đặc
  trưng, rồi giữ pose ngủ. Các pose được đóng gói 1024×1024, ô256px, palette
  PNG alpha. Tổng15 atlas mới là3,928,501 byte (~3,9MB).
- Khi ngủ, hoạt hình phát theo thứ tự khung trong1,6 giây; khi thức, phát ngược
  trong1,45 giây về pose đầu. Ngủ giữ khung cuối, thở nhẹ bằng transform rất nhỏ.
  Không còn xoay90°/co cả sprite để giả dáng nằm. Không setState theo từng frame;
  progress chạy qua Reanimated và atlas toàn thân không cross-fade.
- Giữ key playback riêng cho trạng thái để ngủ/thức liên tiếp luôn reset đúng
  đồng hồ và callback cũ không kết thúc nhầm lượt mới. Giữ cùng animated-style
  handle qua trạng thái nhằm tránh lỗi Reanimated trước đó.
- Preview đồng bộ15 loài: `docs/pet-rest-preview.gif`. Prompt/nguồn và tư thế từng
  loài được ghi trong `assets/pixelPet/animations/provenance.json`.

## Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| Jest tập trung cho playback, mapping rest và thao tác ngủ/thức cả15 loài | 3 suite,41 test đạt |
| Kiểm tra15 atlas | Mỗi atlas1024×1024;16 ô không rỗng; alpha nền trong suốt; 15/15 khung khác frame đầu; provenance JSON hợp lệ |
| TypeScript | `npm run typecheck` đạt |
| ESLint file TypeScript thay đổi | Đạt. ESLint bỏ qua script Python vì không có cấu hình cho `.py`. |
| Expo export | iOS và Android đều thành công |
| Toàn bộ Jest | 155/158 suite đạt;1391 test đạt,1 test lỗi. Hai suite lỗi vì test không mock native Worklets (`tabs.integration.test.tsx`, `PetManagementScreen.test.tsx`); một assertion biên trong `pixelPetFrames.test.ts` nhận mix `0.0017556` thay vì `0`. Các suite Worklets đã xác nhận lại bằng lệnh riêng. Không thay đổi các test hoặc logic ngoài phạm vi rest để che lỗi. |
| Xem trên Simulator | Chưa thể mở vì macOS đang khóa; đã kiểm tra sprite sheet và GIF preview trực quan. |

Chưa commit. Workspace vốn có nhiều thay đổi khác đang dở; giữ nguyên và chỉ
thêm các file của animation nghỉ.
