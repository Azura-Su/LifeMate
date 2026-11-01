# Brief: Thiên Dực Linh Lộc cấp 19–20 – bộ tư thế chuyển động trên Home

**Phạm vi: chỉ dùng cho cấp 19 và cấp 20 (cấp tối đa).** Cấp 1–18 có bộ riêng
(`docs/celestial-stag-lv*-motion-brief.md`). Đây là bộ cuối: khi đủ 10 bộ thì mọi
cấp đều có hình riêng; atlas cũ chỉ còn làm dự phòng khi một bộ chưa xong.

Tài liệu giao cho AI thực hiện. Làm **đúng thứ tự các bước**, không bỏ bước kiểm tra.
Không ghép rối từng bộ phận (không tách đầu/cánh/chân rồi xoay); mọi khung là
**một bức vẽ toàn thân thật**.

---

## 0. Bối cảnh trong code (đọc trước, không sửa lung tung)

- Cấp 19–20 thuộc giai đoạn `ascended` (`stageForLevel` trong
  `src/services/pixelPet/pixelPetGuide.ts`). Bộ này áp dụng **cấp 19–20**, nên phải
  chọn theo `level >= 19`, **không** theo `stage`. Lưu ý `STAGE_LOOK`
  (`src/services/pixelPet/pixelPetRig.ts`) thu nhỏ theo stage; dùng scale `ascended` sẵn có, phải **cùng cỡ với
  bộ lv1718** (cấp 18 → 19 không được nhảy kích thước).
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
- **Ảnh mẫu cấp 19–20 đã được chủ dự án cung cấp:**
  `assets/pixelPet/sourceFrames/celestial_stag_lv1920/reference.webp` (1024×1024).
  Đây là chuẩn duy nhất về mặt, màu, hoa văn và phong cách cho mọi khung.

## 1. Thiết kế hình thể cấp 19–20

Các đặc điểm **phải giữ y hệt ảnh mẫu** ở mọi khung (checklist khi soát):

| Bộ phận | Mô tả theo ảnh mẫu |
|---|---|
| Tỉ lệ | Giống hệt cấp 17–18 (cao lớn, bờm lông công, cánh teal→sapphire viền vàng, đuôi vũ trụ) – **thân hoá giáp vảy và thêm yếm giáp ngọc lục bảo** |
| Mặt | Mắt hổ phách nhỏ; **mão trán vàng chạm trổ gắn ngọc lam** |
| Sừng | Sừng vàng đồng nhiều nhánh, vòng vàng, gắn **sapphire và hồng ngọc (ruby)** xen kẽ |
| Giáp ngực | **Yếm giáp vàng lớn chạm trổ** phủ cổ–ngực, giữa là **viên ngọc lục bảo lớn hình chữ nhật**, viền **chuỗi ngọc trai trắng**, rủ các **mặt đá sapphire/emerald nhỏ** |
| Thân | **Toàn thân phủ vảy vàng kim** (như giáp vảy) lấm tấm ánh kim; **một rune teal lớn phát sáng trên vai**, **một viên đá teal hình thoi trên hông** |
| Bờm | Bờm lông công teal dài rủ hai bên yếm giáp |
| Cánh | Như cấp 17–18: teal → sapphire đậm, khung vàng chạm trổ, đá sapphire, sao vàng |
| Đuôi | Đuôi lửa cam–vàng, gốc teal, **phần dưới xanh vũ trụ có bụi sao và đá nhỏ** |
| Hạt sáng | Sao xanh/vàng và vệt bụi sao quanh thú |
| Móng | Móng đen, **lửa xanh lam bao quanh mỗi móng** |
| Phong cách | Tranh vẽ tay mềm, rất nhiều chi tiết vàng và đá quý, **không phải pixel art** |

Ảnh mẫu gần như **chính diện** (chỉ hơi chếch trái), cánh dang cao, đuôi lửa cuộn sau mông. Bước 1 (thay cho việc tự tạo ảnh mẫu): từ ảnh mẫu (góc nhìn khác hẳn, cần cẩn thận nhất),
tạo **tư thế đứng chuẩn nhìn ngang quay trái** (thấy rõ 4 chân, cánh gần
phía người xem) và dùng nó làm khung 0 cho mọi nhóm. **Dừng cho chủ dự án duyệt
tư thế đứng chuẩn này trước khi làm tiếp.** Mọi lần tạo sau đính kèm cả
`reference.webp` và khung 0.

## 2. Danh sách hoạt động và tư thế

Mỗi nhóm = một atlas 4×4 (16 ô). Ô nào ghi "giữ" thì lặp lại ô trước.
Mỗi ô trong bảng là **một ảnh tạo riêng**.

### A. Đi bộ – `celestial_stag_lv1920_walk.png` (8 tư thế thật)
Dáng đi **thong thả, kiêu hãnh** của hươu trưởng thành: cổ cao, đầu giữ vững, bước dài (không lon ton).
1. Tiếp đất: chân trước trái chạm đất phía trước, chân sau phải đẩy phía sau.
2. Dồn trọng tâm: thân hạ nhẹ, chân trước trái thẳng dưới vai.
3. Qua chân: chân trước phải nhấc gập, đi ngang qua chân trái.
4. Nhón: thân cao nhất, chân sau trái bước lên.
5–8. Lặp 1–4 nhưng **đổi bên** (chân trước phải chạm đất…).
Ô 9–16: lặp 1–8. Cánh khép sát thân, chỉ rung nhẹ.

### B. Chạy – `celestial_stag_lv1920_run.png` (8 tư thế thật)
Phi nước đại dài, mạnh, có pha bay bốn chân rời đất; cánh khép sát, đuôi lửa kéo dài.
1. Duỗi: chân trước vươn tới, chân sau duỗi ra sau.
2. Chạm trước: hai chân trước chạm đất.
3. Gom: bốn chân gom dưới bụng, lưng cong.
4. Bật: chân sau đẩy, thân bay ngắn (cả 4 chân rời đất).
5–8. Biến thể hơi khác của 1–4 (tai, bờm, cánh lệch pha) để vòng lặp không cứng.
Ô 9–16: lặp 1–8.

### C. Bay của cấp 19–20 – `celestial_stag_lv1920_flight.png` (16 tư thế)
Như cấp 17–18 (trôi nhẹ, sải chậm, bụi sao kéo theo). Thêm: **vảy vàng loé ánh kim
theo nhịp vỗ cánh**, **ngọc lục bảo trên yếm sáng lên** ở khung vỗ xuống, mặt đá rủ
dưới yếm đung đưa nhẹ. Yếm giáp là khối cứng – **không biến dạng** khi thân
duỗi/gập; chỉ chuỗi ngọc và mặt đá rủ được lắc.

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

### D. Nằm xuống rồi ngủ – `celestial_stag_lv1920_sleep.png` (16 tư thế)
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

### E. Thức dậy (tuỳ chọn, làm sau cùng) – `celestial_stag_lv1920_wake.png`
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
- Cùng tỉ lệ: thú đứng chuẩn (cánh khép, tính cả sừng) cao ~75% chiều cao ô; **thân và chân cùng cỡ với bộ lv1718**, phần cao thêm chỉ do sừng lớn hơn; khi
  dang cánh hết phải vẫn nằm trong ô (chừa lề). **Không phóng to/thu nhỏ giữa
  các khung.**
- Đường chạm đất (móng) cố định ở **y = 288/320** của ô khi thú đứng trên đất.

## 4. Câu lệnh mẫu cho ChatGPT (tạo ảnh)

Luôn đính kèm: `reference.webp` + khung 0 đã duyệt + khung liền trước (nếu có).
Mỗi lần **chỉ một khung**.

```
Game character sprite, strict side view, facing LEFT, transparent background.
Character: the supreme jeweled Winged Stag from the attached reference image —
same soft hand-painted style, tall regal adult deer, small amber eyes, ornate
gold forehead crown with a turquoise gem, enormous many-tined bronze-gold
antlers with gold rings, sapphires and rubies, a large ornate gold breastplate
with a big rectangular emerald, pearl strands and small sapphire/emerald drops,
body fully covered in shimmering gold scale armor, one large glowing teal rune
on the shoulder and a teal diamond gem on the hip, long teal peacock-feather mane,
wings shading teal to deep sapphire with ornate gold frames, sapphires and gold
stars, a flame tail turning cosmic blue with stardust and tiny gems, floating
stars, black hooves in blue flames.
Do NOT redesign the character. Do NOT change scale or camera.
Pose: <MÔ TẢ TƯ THẾ TỪ MỤC 2, viết bằng tiếng Anh, nói rõ từng chân/cánh>.
Hooves that touch the ground rest on the same ground line as the reference.
Square canvas, character centered horizontally, ~75% of canvas height when
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
5. Giữ ảnh gốc từng khung trong `assets/pixelPet/sourceFrames/celestial_stag_lv1920/`
   và ghi nguồn vào `assets/pixelPet/animations/provenance.json`.

## 6. Kiểm tra chất lượng (bắt buộc trước khi báo xong)

Làm cho **từng nhóm** A–D, ghi kết quả vào báo cáo:

- [ ] Đếm trang sức ở mọi ô: 1 mão trán, vòng/sapphire/ruby trên sừng, yếm giáp với
  1 ngọc lục bảo lớn + chuỗi ngọc trai, 1 rune lớn trên vai, 1 đá thoi trên hông – sai số lượng hay vị trí thì tạo lại khung.
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

- Thêm atlas cấp 19–20 vào `src/screens/PixelPet/petArt.ts`; chọn khi
  `level >= 19` (truyền `level` xuống `PixelPetSprite`; dùng chung tham số với bộ
  lv12…lv1718). Bộ nào chưa xong thì dùng atlas cũ.
- Trong `HomePetRoamer.tsx`, khi cấp 19–20: giữ chuỗi
  `takeoff → flap → glide → landing` với độ cao và thời lượng như bản lớn hiện
  tại. Giữ tổng chu kỳ vừa cửa sổ thức 20s và logic "đi vào vườn rồi mới ngủ".
- Pha `settle` phát nhóm D ô 1–12; `sleep` lặp ô 13–16.
- Cập nhật `SPEC-pixel-pet.md`, chạy `npm run typecheck` và
  `npm test -- --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx
  src/screens/PixelPet/__tests__/PixelPetSprite.test.tsx
  src/services/pixelPet/__tests__/celestialStagAtlas.test.ts`.
- Mở "Xem trên Home" trong Quản lý linh thú, quay một chu kỳ đầy đủ ở Lv 18, Lv 19
  và Lv 20 (Lv 18 dùng bộ lv1718 hoặc cũ) để chủ dự án xem.
- Thêm test: Lv 19 và Lv 20 dùng bộ lv1920; Lv 18 không dùng. Bộ nào chưa có thì rơi về atlas cũ.

## 8. Ngân sách và điểm dừng duyệt

Tổng cộng ~56 khung (A 8, B 8, C 16, D 16, + tạo lại khung hỏng). Dừng xin
duyệt ở: (1) tư thế đứng chuẩn nhìn ngang, (2) từng nhóm sau bước 6, (3) bản chạy trên Home.
