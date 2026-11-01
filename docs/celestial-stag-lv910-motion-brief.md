# Brief: Thiên Dực Linh Lộc cấp 9–10 – bộ tư thế chuyển động trên Home

**Phạm vi: chỉ dùng cho cấp 9 và cấp 10.** Cấp 1–2, 3–4, 5–6, 7–8 có
bộ riêng (`docs/celestial-stag-lv12/34/56/78-motion-brief.md`). Atlas hiện có chỉ
còn là dự phòng khi bộ của cấp đó chưa làm xong.

Tài liệu giao cho AI thực hiện. Làm **đúng thứ tự các bước**, không bỏ bước kiểm tra.
Không ghép rối từng bộ phận (không tách đầu/cánh/chân rồi xoay); mọi khung là
**một bức vẽ toàn thân thật**.

---

## 0. Bối cảnh trong code (đọc trước, không sửa lung tung)

- Cấp 9–10 thuộc giai đoạn `ascended` (`stageForLevel` trong
  `src/services/pixelPet/pixelPetGuide.ts`). Bộ này áp dụng **cấp 9–10**, nên phải
  chọn theo `level >= 9`, **không** theo `stage`. Lưu ý `STAGE_LOOK`
  (`src/services/pixelPet/pixelPetRig.ts`) thu nhỏ theo stage; cấp 9–10 cùng stage nên
  dùng scale `ascended` sẵn có, và phải **cùng cỡ với bộ lv910** (cấp 8 → 9 không
  được nhảy kích thước).
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
- **Ảnh mẫu cấp 9–10 đã được chủ dự án cung cấp:**
  `assets/pixelPet/sourceFrames/celestial_stag_lv910/reference.webp` (1024×1024).
  Đây là chuẩn duy nhất về mặt, màu, hoa văn và phong cách cho mọi khung.

## 1. Thiết kế hình thể cấp 9–10

Các đặc điểm **phải giữ y hệt ảnh mẫu** ở mọi khung (checklist khi soát):

| Bộ phận | Mô tả theo ảnh mẫu |
|---|---|
| Tỉ lệ | Giống hệt cấp 7–8 (dáng trưởng thành, đầu nhỏ, cổ dài, chân dài) – chỉ thêm bờm lông vũ và cổ ngữ |
| Mặt | Mắt hổ phách hạnh nhân (nhỏ hơn hẳn cấp trước), lông mi đen, mũi đen, nét mặt điềm tĩnh |
| Trán | Không còn viên đá xanh nổi bật; chỉ vài vệt sáng teal nhỏ |
| Sừng | Sừng nâu **rất lớn, nhiều nhánh (4–5 nhánh mỗi bên)**, xoè rộng |
| Tai | Tai vừa, trong tai hồng nhạt |
| Thân | Lông cam, ngực và bụng kem; **hoa văn xoáy teal phát sáng** ở ngực, cổ, vai; **ký tự cổ ngữ (rune) teal phát sáng** trên vai, hông và dọc 4 chân; vệt sáng teal nối các rune |
| Cổ, vai | **Bờm lông vũ hai màu teal + vàng kim** quấn quanh cổ, phủ ngực và vai như chiếc khăn choàng, dày và xếp lớp |
| Cánh | **Đôi cánh teal rất lớn**, dang hết cao hơn đỉnh sừng, lông vũ dài nhiều lớp |
| Đuôi | Đuôi lửa dài như cấp 5–6: gốc lửa teal, thân cam–vàng, chóp cuộn ngả nâu khói |
| Móng | Móng đen, **lửa xanh lam bao quanh mỗi móng** |
| Phong cách | Tranh vẽ tay mềm, viền nâu đậm, **không phải pixel art** |

Ảnh mẫu là góc 3/4 quay trái, cánh dang cao, đuôi lửa cuộn sau mông. Bước 1 (thay cho việc tự tạo ảnh mẫu): từ ảnh mẫu,
tạo **tư thế đứng chuẩn nhìn ngang quay trái** (thấy rõ 4 chân, cánh gần
phía người xem) và dùng nó làm khung 0 cho mọi nhóm. **Dừng cho chủ dự án duyệt
tư thế đứng chuẩn này trước khi làm tiếp.** Mọi lần tạo sau đính kèm cả
`reference.webp` và khung 0.

## 2. Danh sách hoạt động và tư thế

Mỗi nhóm = một atlas 4×4 (16 ô). Ô nào ghi "giữ" thì lặp lại ô trước.
Mỗi ô trong bảng là **một ảnh tạo riêng**.

### A. Đi bộ – `celestial_stag_lv910_walk.png` (8 tư thế thật)
Dáng đi **thong thả, kiêu hãnh** của hươu trưởng thành: cổ cao, đầu giữ vững, bước dài (không lon ton).
1. Tiếp đất: chân trước trái chạm đất phía trước, chân sau phải đẩy phía sau.
2. Dồn trọng tâm: thân hạ nhẹ, chân trước trái thẳng dưới vai.
3. Qua chân: chân trước phải nhấc gập, đi ngang qua chân trái.
4. Nhón: thân cao nhất, chân sau trái bước lên.
5–8. Lặp 1–4 nhưng **đổi bên** (chân trước phải chạm đất…).
Ô 9–16: lặp 1–8. Cánh khép sát thân, chỉ rung nhẹ.

### B. Chạy – `celestial_stag_lv910_run.png` (8 tư thế thật)
Phi nước đại dài, mạnh, có pha bay bốn chân rời đất; cánh khép sát, đuôi lửa kéo dài.
1. Duỗi: chân trước vươn tới, chân sau duỗi ra sau.
2. Chạm trước: hai chân trước chạm đất.
3. Gom: bốn chân gom dưới bụng, lưng cong.
4. Bật: chân sau đẩy, thân bay ngắn (cả 4 chân rời đất).
5–8. Biến thể hơi khác của 1–4 (tai, bờm, cánh lệch pha) để vòng lặp không cứng.
Ô 9–16: lặp 1–8.

### C. Bay của cấp 9–10 – `celestial_stag_lv910_flight.png` (16 tư thế)
Dáng **thần thú hoàn chỉnh**: như cấp 7–8 nhưng mạnh mẽ và uy nghi nhất. Bờm lông
vũ dựng lên theo gió khi bay, rune sáng hơn ở các khung vỗ cánh (độ sáng thay đổi
nhẹ, không nhấp nháy gắt). Đuôi lửa bay theo chuyển động. Dùng cho chuỗi
takeoff/flap/glide/landing hiện có.

Cất cánh (ô 1–4):
1. Hạ thấp người, cánh mở rộng, chân sau gập lấy đà.
2. Bật mạnh: chân sau duỗi, cánh vỗ xuống hết cỡ.
3. Rời đất: bốn chân co dưới bụng, cánh vung lên.
4. Ngóc đầu lên, thân nghiêng lên ~15°, cánh vỗ xuống.

Vỗ cánh (ô 5–8, **vòng lặp**):
5. Cánh giơ cao nhất (đầu cánh trên lưng).
6. Cánh ngang thân, đang vỗ xuống.
7. Cánh thấp nhất, lông xoè ra.
8. Cánh thu về, đang nâng lên – nối lại ô 5.

Lượn (ô 9–12):
9. Cánh dang phẳng, thân nằm ngang, chân thu gọn.
10. Đầu cánh hơi cong lên, đuôi lửa duỗi dài ra sau thành vệt lửa.
11. Hơi chúi xuống, cánh vẫn dang.
12. Chân trước bắt đầu duỗi ra chuẩn bị đáp.

Hạ cánh (ô 13–16):
13. Cánh vỗ hãm (giơ cao, xoè), thân dựng lên, chân trước duỗi tới đất.
14. Chân trước chạm đất, cánh vẫn mở.
15. Chân sau chạm, gối khuỵu nhẹ, cánh hạ dần.
16. Đứng chuẩn, cánh khép lại – nối được vào đi bộ.

**Độ cao bay do code điều khiển**, ảnh chỉ vẽ tư thế; giữ đường chạm đất cố định
(mục 3) cho mọi ô, kể cả ô đang bay.

**Đuôi lửa ở nhóm A/B**: đung đưa theo nhịp bước (lệch pha nửa nhịp so với
thân), không đứng cứng.

### D. Nằm xuống rồi ngủ – `celestial_stag_lv910_sleep.png` (16 tư thế)
Phải **từ từ**, không bật một cái là nằm.
1. Đứng chuẩn, ngáp nhẹ (miệng hé).
2. Ngáp to, mắt lim dim.
3. Quay đầu nhìn chỗ nằm, chân trước dò đất.
4. Gập hai chân trước, ngực hạ xuống.
5. Ngực chạm đất, mông còn cao.
6. Chân sau gập, mông hạ.
7. Nằm sấp, đầu còn ngẩng.
8. Cánh khép lại phủ lưng.
9. Đuôi lửa vòng ra trước, cuộn quanh thân như chiếc chăn; chân thu gọn.
10. Đầu cúi dần, mắt nửa nhắm.
11. Cằm tựa lên chân trước.
12. Mắt nhắm hẳn.
13–16. **Vòng thở khi ngủ**: thân phồng lên/xẹp xuống rất nhẹ (13 hít vào,
14 giữ, 15 thở ra, 16 giữ). Có thể thêm ký hiệu "z" nhỏ ở 14 và 16 – không bắt buộc.
Ô 13–16 phải lặp vô hạn mà không giật.

### E. Thức dậy (tuỳ chọn, làm sau cùng) – `celestial_stag_lv910_wake.png`
Đảo ngược D (12→1) nhưng thêm vươn vai ở giữa (chân trước duỗi dài, mông
chổng). Nếu hết ngân sách thì code phát ngược D.

## 3. Quy cách ảnh (bắt buộc cho từng khung)

- Nhìn ngang, **quay mặt sang trái**, camera ngang tầm thân, không phối cảnh.
- Nền **trong suốt** (hoặc nền một màu phẳng dễ tách, ví dụ #00FF00).
- Phong cách **giống hệt ảnh mẫu**: tranh vẽ tay mềm, viền nâu đậm, đổ bóng mềm
  trên thân. **Không** có bóng đổ dưới đất, không nền, không lấp lánh nền (ảnh mẫu
  có dấu sao ở góc – bỏ đi).
- Lửa ở móng và đuôi được phép lay nhẹ giữa các khung nhưng giữ cùng màu và cỡ;
  đuôi lửa dài phải nằm gọn trong ô (chừa lề), không bị cắt.
- Toàn bộ thú nằm gọn trong khung, chừa lề ≥ 8% mỗi cạnh.
- Cùng tỉ lệ: thú đứng chuẩn (cánh khép, tính cả sừng) cao ~70% chiều cao ô; khi
  dang cánh hết phải vẫn nằm trong ô (chừa lề). **Không phóng to/thu nhỏ giữa
  các khung.**
- Đường chạm đất (móng) cố định ở **y = 288/320** của ô khi thú đứng trên đất.

## 4. Câu lệnh mẫu cho ChatGPT (tạo ảnh)

Luôn đính kèm: `reference.webp` + khung 0 đã duyệt + khung liền trước (nếu có).
Mỗi lần **chỉ một khung**.

```
Game character sprite, strict side view, facing LEFT, transparent background.
Character: the ascended Celestial Winged Stag from the attached reference image —
same soft hand-painted style and dark brown outline, slender adult deer
proportions (small head, long neck, long legs), almond amber eyes,
huge many-tined brown antlers, orange fur with cream chest, glowing teal swirl
markings on chest/neck and teal lines down the legs, a thick teal-and-gold feather collar
around the neck and shoulders, glowing teal rune glyphs on the body and legs, VERY LARGE multi-layered teal feathered wings,
a long flowing flame tail (teal flame at the base turning orange-gold, curling at the tip), black hooves wrapped in blue flames.
Do NOT redesign the character. Do NOT change scale or camera.
Pose: <MÔ TẢ TƯ THẾ TỪ MỤC 2, viết bằng tiếng Anh, nói rõ từng chân/cánh>.
Hooves that touch the ground rest on the same ground line as the reference.
Square canvas, character centered horizontally, ~70% of canvas height when
standing (wings folded; antlers included), no ground shadow, no scenery, no text.
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
5. Giữ ảnh gốc từng khung trong `assets/pixelPet/sourceFrames/celestial_stag_lv910/`
   và ghi nguồn vào `assets/pixelPet/animations/provenance.json`.

## 6. Kiểm tra chất lượng (bắt buộc trước khi báo xong)

Làm cho **từng nhóm** A–D, ghi kết quả vào báo cáo:

- [ ] Ghép contact sheet 4×4 và xem: cùng mặt, cùng màu, cùng kích thước, cùng
  số chân/sừng/cánh ở mọi ô. Khung nào sai giải phẫu (5 chân, cánh mọc sai chỗ,
  mặt khác) → **tạo lại khung đó**, không giữ.
- [ ] Xuất GIF xem trước từng nhóm ở đúng tốc độ (đi: vòng 8 tư thế ~0.8s; chạy
  ~0.5s; bay: vỗ cánh 4 ô ~0.72s, cất/hạ cánh 4 ô ~1.4s; nằm xuống 12 khung trong ~2.4s; thở 4 khung ~2s) và tự xem:
  không giật, không trượt chân, không nhảy vị trí, chân bước luân phiên đúng.
- [ ] Chồng ô đầu và ô cuối của vòng lặp (đi, chạy, thở): phải nối liền.
- [ ] Độ chênh vị trí thân giữa hai khung liền nhau không quá ~6px (trừ pha cất/hạ cánh).
- [ ] Gửi contact sheet + GIF cho chủ dự án duyệt. **Chưa duyệt thì không gắn vào app.**

## 7. Gắn vào app (sau khi duyệt)

- Thêm atlas cấp 9–10 vào `src/screens/PixelPet/petArt.ts`; chọn khi
  `level >= 9` (truyền `level` xuống `PixelPetSprite`; dùng chung tham số với bộ
  lv12/lv34/lv56/lv78). Bộ nào chưa xong thì dùng atlas cũ.
- Trong `HomePetRoamer.tsx`, khi cấp 9–10: giữ chuỗi
  `takeoff → flap → glide → landing` với độ cao và thời lượng như bản lớn hiện
  tại. Giữ tổng chu kỳ vừa cửa sổ thức 20s và logic "đi vào vườn rồi mới ngủ".
- Pha `settle` phát nhóm D ô 1–12; `sleep` lặp ô 13–16.
- Cập nhật `SPEC-pixel-pet.md`, chạy `npm run typecheck` và
  `npm test -- --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx
  src/screens/PixelPet/__tests__/PixelPetSprite.test.tsx
  src/services/pixelPet/__tests__/celestialStagAtlas.test.ts`.
- Mở "Xem trên Home" trong Quản lý linh thú, quay một chu kỳ đầy đủ ở Lv 8, Lv 9
  và Lv 10 (Lv 8 dùng bộ lv78 hoặc cũ) để chủ dự án xem.
- Thêm test: Lv 9 và Lv 10 dùng bộ lv910; Lv 8 không dùng. Bộ nào chưa có thì rơi về atlas cũ.

## 8. Ngân sách và điểm dừng duyệt

Tổng cộng ~56 khung (A 8, B 8, C 16, D 16, + tạo lại khung hỏng). Dừng xin
duyệt ở: (1) tư thế đứng chuẩn nhìn ngang, (2) từng nhóm sau bước 6, (3) bản chạy trên Home.
