# Brief: Thiên Dực Linh Lộc cấp 1–2 – bộ tư thế chuyển động trên Home

**Phạm vi: chỉ dùng cho cấp 1 và cấp 2.** Cấp 3–4 có bộ riêng
(`docs/celestial-stag-lv34-motion-brief.md`); cấp 5–6 có bộ
`docs/celestial-stag-lv56-motion-brief.md`; cấp 7–8 có bộ `docs/celestial-stag-lv78-motion-brief.md`;
cấp 9–10 có bộ `docs/celestial-stag-lv910-motion-brief.md`.
Atlas hiện có chỉ còn là dự phòng khi bộ của cấp đó chưa làm xong.

Tài liệu giao cho AI thực hiện. Làm **đúng thứ tự các bước**, không bỏ bước kiểm tra.
Không ghép rối từng bộ phận (không tách đầu/cánh/chân rồi xoay); mọi khung là
**một bức vẽ toàn thân thật**.

---

## 0. Bối cảnh trong code (đọc trước, không sửa lung tung)

- Cấp 1–3 đều là giai đoạn `hatchling` (`stageForLevel` trong
  `src/services/pixelPet/pixelPetGuide.ts`), nhưng bộ mới **chỉ áp dụng cấp 1–2**,
  nên phải chọn theo `level <= 2`, **không** theo `stage`. Trên Home thú được thu
  nhỏ `scale 0.72` (`STAGE_LOOK` trong `src/services/pixelPet/pixelPetRig.ts`).
- `HomePetRoamer` hiện chỉ nhận `stage`; cần truyền thêm `level` (thú thật lấy
  `owned.level`, xem thử của admin lấy `preview.level`).
- Chu kỳ Home của Linh Lộc nằm ở `src/screens/Home/HomePetRoamer.tsx`
  (`STAG_NEXT_PHASE`, thời lượng ở `CELESTIAL_STAG_HOME_PHASE_DURATION` trong
  `src/services/pixelPet/celestialStagAtlas.ts`):
  `runA 3400 → walkToFlight 1500 → takeoff 1400 → flap 2880 → glide 3300 →
  landing 1400 → walkAfterLanding 1400 → runB 2300 → settle 2420 → sleep`.
- Atlas hiện tại (dùng cho mọi cấp): `assets/pixelPet/animations/celestial_stag_*.png`,
  mỗi file **1280×1280 = lưới 4×4, ô 320×320**, nền trong suốt, thú quay trái.
- Bảng màu đã chốt: **thân cam, cánh xanh ngọc (teal)**. Không đổi màu.
- **Ảnh mẫu cấp 1–2 đã được chủ dự án cung cấp:**
  `assets/pixelPet/sourceFrames/celestial_stag_lv12/reference.webp` (1024×1024).
  Đây là chuẩn duy nhất về mặt, màu, hoa văn và phong cách cho mọi khung.

## 1. Thiết kế hình thể cấp 1–2

Các đặc điểm **phải giữ y hệt ảnh mẫu** ở mọi khung (checklist khi soát):

| Bộ phận | Mô tả theo ảnh mẫu |
|---|---|
| Tỉ lệ | Chibi: đầu rất to (~45% chiều cao), thân nhỏ, chân thon dài vừa |
| Mặt | Mắt nâu hổ phách rất to, lông mi đen, mũi đen nhỏ, miệng cười nhẹ |
| Trán | **Viên đá xanh lam hình thoi** giữa trán, quanh có các vảy hổ phách nhỏ |
| Sừng | Hai sừng nâu ngắn, mỗi bên **một nhánh phụ** nhỏ |
| Tai | Tai to, trong tai hồng nhạt, viền nâu |
| Thân | Lông cam, ngực và bụng kem; **vảy pha lê hổ phách** rải trên lưng, vai, đùi |
| Cánh | **Một đôi cánh nhỏ màu teal** mọc sau vai, lông vũ 2–3 lớp; khép lại chỉ bằng chiều dài lưng |
| Đuôi | Đuôi ngắn bông, **chóp là ngọn lửa cam** |
| Móng | Móng đen, **lửa xanh lam bao quanh mỗi móng** |
| Phong cách | Tranh vẽ tay mềm (painterly chibi), viền nâu đậm, **không phải pixel art** |

Ảnh mẫu là góc 3/4 quay trái. Bước 1 (thay cho việc tự tạo ảnh mẫu): từ ảnh mẫu,
tạo **tư thế đứng chuẩn nhìn ngang quay trái** (thấy rõ 4 chân, cánh gần
phía người xem) và dùng nó làm khung 0 cho mọi nhóm. **Dừng cho chủ dự án duyệt
tư thế đứng chuẩn này trước khi làm tiếp.** Mọi lần tạo sau đính kèm cả
`reference.webp` và khung 0.

## 2. Danh sách hoạt động và tư thế

Mỗi nhóm = một atlas 4×4 (16 ô). Ô nào ghi "giữ" thì lặp lại ô trước.
Mỗi ô trong bảng là **một ảnh tạo riêng**.

### A. Đi bộ – `celestial_stag_lv12_walk.png` (8 tư thế thật)
Dáng đi lon ton của con non, đầu nhún nhẹ theo nhịp.
1. Tiếp đất: chân trước trái chạm đất phía trước, chân sau phải đẩy phía sau.
2. Dồn trọng tâm: thân hạ nhẹ, chân trước trái thẳng dưới vai.
3. Qua chân: chân trước phải nhấc gập, đi ngang qua chân trái.
4. Nhón: thân cao nhất, chân sau trái bước lên.
5–8. Lặp 1–4 nhưng **đổi bên** (chân trước phải chạm đất…).
Ô 9–16: lặp 1–8. Cánh khép sát thân, chỉ rung nhẹ.

### B. Chạy – `celestial_stag_lv12_run.png` (8 tư thế thật)
Phi nước kiệu nhỏ, có pha bay hai chân rời đất.
1. Duỗi: chân trước vươn tới, chân sau duỗi ra sau.
2. Chạm trước: hai chân trước chạm đất.
3. Gom: bốn chân gom dưới bụng, lưng cong.
4. Bật: chân sau đẩy, thân bay ngắn (cả 4 chân rời đất).
5–8. Biến thể hơi khác của 1–4 (tai, bờm, cánh lệch pha) để vòng lặp không cứng.
Ô 9–16: lặp 1–8.

### C. Bay thử của cấp 1–2 – `celestial_stag_lv12_hop.png` (16 tư thế)
**Cánh bé nên không bay cao được**: bật lên một đoạn ngắn, vỗ cánh cố gắng,
rồi rơi xuống, đáp loạng choạng. Thay cho cả nhóm takeoff/flap/glide/landing.
1. Cúi người lấy đà, cánh hé.
2. Ngồi sụp chân sau, cánh mở hết (nhỏ).
3. Bật lên: chân duỗi, cánh vỗ xuống.
4. Lên cao nhất (chỉ ~nửa chiều cao thân): cánh giơ cao, mặt hớn hở.
5. Vỗ cánh xuống nhanh, chân co.
6. Vỗ cánh lên, thân bắt đầu chúi.
7. Vỗ loạn: cánh lệch nhau, mắt mở to (hơi hoảng).
8. Bắt đầu rơi: thân nghiêng đầu xuống, chân trước duỗi chờ đất.
9. Rơi: cánh dang ra như dù, tai bay ngược.
10. Chạm đất chân trước, thân dồn tới.
11. Chân sau chạm, gối khuỵu sâu (nén).
12. Loạng choạng: thân lệch sang một bên, một chân lùi.
13. Lấy lại thăng bằng, cánh xoè ra giữ.
14. Lắc mình rũ lông, cánh rung.
15. Đứng thẳng, cánh khép dần.
16. Đứng chuẩn (giống ảnh mẫu) – nối được vào đi bộ.
**Độ cao bay do code điều khiển**, ảnh chỉ vẽ tư thế; giữ đường chạm đất cố định
(mục 3) cho mọi ô, kể cả ô đang bay.

### D. Nằm xuống rồi ngủ – `celestial_stag_lv12_sleep.png` (16 tư thế)
Phải **từ từ**, không bật một cái là nằm.
1. Đứng chuẩn, ngáp nhẹ (miệng hé).
2. Ngáp to, mắt lim dim.
3. Quay đầu nhìn chỗ nằm, chân trước dò đất.
4. Gập hai chân trước, ngực hạ xuống.
5. Ngực chạm đất, mông còn cao.
6. Chân sau gập, mông hạ.
7. Nằm sấp, đầu còn ngẩng.
8. Cánh khép lại phủ lưng.
9. Cuộn đuôi, chân thu gọn dưới thân.
10. Đầu cúi dần, mắt nửa nhắm.
11. Cằm tựa lên chân trước.
12. Mắt nhắm hẳn.
13–16. **Vòng thở khi ngủ**: thân phồng lên/xẹp xuống rất nhẹ (13 hít vào,
14 giữ, 15 thở ra, 16 giữ). Có thể thêm ký hiệu "z" nhỏ ở 14 và 16 – không bắt buộc.
Ô 13–16 phải lặp vô hạn mà không giật.

### E. Thức dậy (tuỳ chọn, làm sau cùng) – `celestial_stag_lv12_wake.png`
Đảo ngược D (12→1) nhưng thêm vươn vai ở giữa (chân trước duỗi dài, mông
chổng). Nếu hết ngân sách thì code phát ngược D.

## 3. Quy cách ảnh (bắt buộc cho từng khung)

- Nhìn ngang, **quay mặt sang trái**, camera ngang tầm thân, không phối cảnh.
- Nền **trong suốt** (hoặc nền một màu phẳng dễ tách, ví dụ #00FF00).
- Phong cách **giống hệt ảnh mẫu**: tranh vẽ tay mềm, viền nâu đậm, đổ bóng mềm
  trên thân. **Không** có bóng đổ dưới đất, không nền, không lấp lánh nền (ảnh mẫu
  có dấu sao ở góc – bỏ đi).
- Lửa ở móng và đuôi được phép lay nhẹ giữa các khung nhưng giữ cùng màu và cỡ.
- Toàn bộ thú nằm gọn trong khung, chừa lề ≥ 8% mỗi cạnh.
- Cùng tỉ lệ: thú đứng chuẩn cao ~60% chiều cao ô. **Không phóng to/thu nhỏ giữa
  các khung.**
- Đường chạm đất (móng) cố định ở **y = 288/320** của ô khi thú đứng trên đất.

## 4. Câu lệnh mẫu cho ChatGPT (tạo ảnh)

Luôn đính kèm: `reference.webp` + khung 0 đã duyệt + khung liền trước (nếu có).
Mỗi lần **chỉ một khung**.

```
Game character sprite, strict side view, facing LEFT, transparent background.
Character: the baby Celestial Winged Stag from the attached reference image —
same soft hand-painted chibi style and dark brown outline, huge amber eyes,
blue diamond gem on the forehead, short two-tine brown antlers, big ears,
orange fur with cream chest, amber crystal flecks, small teal feathered wings,
short tail with an orange flame tip, black hooves wrapped in blue flames.
Do NOT redesign the character. Do NOT change scale or camera.
Pose: <MÔ TẢ TƯ THẾ TỪ MỤC 2, viết bằng tiếng Anh, nói rõ từng chân/cánh>.
Hooves that touch the ground rest on the same ground line as the reference.
Square canvas, character centered horizontally, ~60% of canvas height when
standing, no ground shadow, no scenery, no text.
```
Với khung chuyển tiếp: "Create the in-between frame exactly halfway between
the two attached frames."

## 5. Hậu kỳ (AI tự làm bằng script, không làm tay)

1. Tách nền, cắt về ô 320×320.
2. **Căn khung**: căn theo đường chạm đất y=288 và tâm thân (không theo bbox
   vì cánh/chân thay đổi). Có thể dùng lại cách của
   `scripts/pack-celestial-stag-ground-v3.py`.
3. So màu với ảnh mẫu: chỉnh nhẹ độ sáng/sắc (khớp histogram theo vùng thân cam
   và cánh teal) để không lệch sắc giữa các khung. **Không** ép palette cứng vì
   tranh vẽ mềm sẽ bị vỡ dải màu.
4. Ghép 16 ô thành atlas 1280×1280, nén PNG (mỗi file ≤ 700KB như test hiện có;
   nếu vượt thì quantize ≥ 256 màu có dithering và soát lại cho khỏi vỡ màu).
5. Giữ ảnh gốc từng khung trong `assets/pixelPet/sourceFrames/celestial_stag_lv12/`
   và ghi nguồn vào `assets/pixelPet/animations/provenance.json`.

## 6. Kiểm tra chất lượng (bắt buộc trước khi báo xong)

Làm cho **từng nhóm** A–D, ghi kết quả vào báo cáo:

- [ ] Ghép contact sheet 4×4 và xem: cùng mặt, cùng màu, cùng kích thước, cùng
  số chân/sừng/cánh ở mọi ô. Khung nào sai giải phẫu (5 chân, cánh mọc sai chỗ,
  mặt khác) → **tạo lại khung đó**, không giữ.
- [ ] Xuất GIF xem trước từng nhóm ở đúng tốc độ (đi: vòng 8 tư thế ~0.8s; chạy
  ~0.5s; hop 1.6s; nằm xuống 12 khung trong ~2.4s; thở 4 khung ~2s) và tự xem:
  không giật, không trượt chân, không nhảy vị trí, chân bước luân phiên đúng.
- [ ] Chồng ô đầu và ô cuối của vòng lặp (đi, chạy, thở): phải nối liền.
- [ ] Độ chênh vị trí thân giữa hai khung liền nhau không quá ~6px (trừ pha bật/rơi).
- [ ] Gửi contact sheet + GIF cho chủ dự án duyệt. **Chưa duyệt thì không gắn vào app.**

## 7. Gắn vào app (sau khi duyệt)

- Thêm atlas cấp 1–2 vào `src/screens/PixelPet/petArt.ts`; chọn atlas khi
  `level <= 2` (truyền `level` xuống `PixelPetSprite`). Cấp 3–4 dùng bộ lv34, cấp 5–6 dùng bộ lv56, cấp 7–8 dùng bộ lv78, cấp 9–10 dùng bộ lv910 (bộ nào chưa xong thì dùng atlas cũ).
- Trong `HomePetRoamer.tsx`, chỉ khi `level <= 2`: thay chuỗi
  `takeoff/flap/glide/landing` bằng một pha `hop` (~1600ms), độ bay cao
  `STAG_FLIGHT_HEIGHT` nhỏ (~25% bản lớn), quãng bay ngắn; thời lượng pha lấy
  từ bảng trong `celestialStagAtlas.ts`. Giữ tổng chu kỳ vừa cửa sổ thức 20s
  (giảm bớt pha chạy nếu cần) và giữ logic "đi vào vườn rồi mới ngủ".
- Pha `settle` phát nhóm D ô 1–12; `sleep` lặp ô 13–16.
- Cập nhật `SPEC-pixel-pet.md`, chạy `npm run typecheck` và
  `npm test -- --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx
  src/screens/PixelPet/__tests__/PixelPetSprite.test.tsx
  src/services/pixelPet/__tests__/celestialStagAtlas.test.ts`.
- Mở "Xem trên Home" trong Quản lý linh thú, quay một chu kỳ đầy đủ ở Lv 1, Lv 2
  và Lv 3 (Lv 3 phải dùng bộ lv34 hoặc atlas cũ nếu lv34 chưa xong) để chủ dự án xem.
- Thêm test: Lv 2 dùng bộ mới và pha `hop`; Lv 3 không dùng bộ lv12.

## 8. Ngân sách và điểm dừng duyệt

Tổng cộng ~56 khung (A 8, B 8, C 16, D 16, + tạo lại khung hỏng). Dừng xin
duyệt ở: (1) tư thế đứng chuẩn nhìn ngang, (2) từng nhóm sau bước 6, (3) bản chạy trên Home.
