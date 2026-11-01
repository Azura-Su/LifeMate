# Brief: Cảnh ngủ của Thiên Dực Linh Lộc theo cấp (Lv 2 → Lv 20)

Tài liệu giao cho AI thực hiện. Làm **đúng thứ tự**, dừng xin duyệt ở các điểm ghi rõ.
Mọi khung là **một bức vẽ toàn cảnh thật**, không ghép rối từng mảnh.

---

## 0. Cảnh hiện tại (gốc để nâng cấp)

- Atlas mọc: `assets/pixelPet/animations/home_sleep_garden.png`. Atlas héo:
  `home_sleep_garden_decay.png`. Mỗi file 1280×1280 = lưới 4×4, ô 320×320, nền trong suốt.
- Nội dung 16 khung mọc: ô 0 trống → ô 1–3 thảm cỏ, bụi cây và hai hòn đá →
  ô 4–6 nụ hoa nhú → ô 7–10 cây non uốn mọc lên → ô 11–15 **cây cổ thụ tán xanh,
  thân xoắn**, hoa hồng/cam/trắng dưới gốc.
- Atlas héo: lá ngả vàng → khô → cây tan thành tro bụi (16 khung, 4,8 s).
- Code: `src/screens/Home/HomeSleepGarden.tsx`. Cảnh vẽ trong khung `SCENE_SIZE = 168`pt,
  lệch `left -24`, `top -44` so với ô thú 120pt. Đường đất ở **y = 296/320** của ô.
  Thời lượng mọc `CELESTIAL_STAG_GARDEN_GROWTH_MS = 3800`, héo 4800
  (`src/services/pixelPet/celestialStagAtlas.ts`).
- Cảnh mở khoá từ **Lv 2** (`SLEEP_SCENE_LEVEL` trong `HomePetRoamer.tsx`).
- Phong cách cảnh: tranh vẽ tay mềm, màu tươi, viền nhẹ – **giữ nguyên phong cách
  này** cho mọi cấp để hợp với bộ linh lộc mới (painterly).

## 1. Nguyên tắc chung cho mọi cấp

1. **Cùng khung, cùng đường đất**: ô 320×320, đất ở y=296, thảm cỏ rộng tối đa như
   hiện tại (không tràn ra ngoài ô). Cảnh càng cao cấp thì **cao và giàu chi tiết
   hơn**, không rộng ngang hơn (tránh đè lên UI Home).
2. **Chừa chỗ nằm**: vùng giữa–dưới (x 90–230, y 200–296) để trống cho linh lộc nằm
   trước gốc cây. Không đặt vật cao che thú.
3. **16 khung mọc** theo nhịp giống bản gốc: 0 trống → 1–3 nền đất xuất hiện →
   4–6 chi tiết nhỏ nhú lên → 7–10 vật chính mọc → 11–14 hoàn thiện + hiệu ứng →
   15 trạng thái cuối (giữ lâu khi ngủ). Ô 15 phải **đẹp nhất và tĩnh** (không có
   hiệu ứng đang chuyển dở).
4. **16 khung héo/tan** riêng cho mỗi cấp, theo chủ đề của cấp đó (xem từng cấp).
   Ô 0 héo phải **trùng khít ô 15 mọc** (đã kiểm tra bản gốc khớp bbox 16,24,304,296).
5. Màu chủ đạo đi theo tiến hoá của linh lộc: **xanh lá → teal → vàng kim → sao đêm →
   sapphire → lục bảo**. Không dùng màu đỏ chủ đạo.
6. Không có chữ, không khung viền, không bóng đổ ra ngoài thảm cỏ.

## 2. Thiết kế từng cấp – mô tả từng khung

Mỗi cấp dùng cho **cấp đó và cấp lẻ ngay sau** (Lv 2 dùng cho Lv 2–3, Lv 4 cho 4–5…).
Tên cảnh dùng làm mục mở khoá trong hướng dẫn.

Cách đọc: **Mọc** = 16 khung phát trong 3,8 s khi linh lộc đi vào và nằm xuống
(ô 0 → 15, ô 15 giữ nguyên suốt lúc ngủ). **Héo** = 16 khung phát trong 4,8 s khi
chạm đánh thức (ô 0 trùng khít ô 15 Mọc → ô 15 trống hoàn toàn). Mỗi dòng là
**một ảnh riêng**; mỗi khung chỉ thay đổi **một bước nhỏ** so với khung trước.
Mọi chi tiết đã xuất hiện phải **giữ đúng vị trí** ở các khung sau.

---

### Lv 2 – Vườn hoa thiên lộc (bản hiện có – mốc chuẩn)

Ý tưởng: một khoảng cỏ nhỏ tự sinh ra, hoa nở trước rồi một mầm cây vươn lên thành
cổ thụ che chở chỗ ngủ.

**Mọc**
- 0: Trống hoàn toàn (trong suốt).
- 1: Một dải cỏ mỏng ngắn hiện ra giữa đất, hai hòn đá nhỏ ở hai mép.
- 2: Cỏ dày lên, hai bụi cỏ nhỏ mọc ở hai bên.
- 3: Hai bụi cỏ cao hơn, thảm cỏ phủ kín nền; vẫn chưa có hoa.
- 4: Hai nụ hoa xanh nhú trên hai bụi cỏ.
- 5: Nụ to hơn, hé màu hồng.
- 6: Nụ hé thêm; giữa thảm cỏ nhú **một chồi non** hai lá mầm.
- 7: Hoa hồng nở ở bụi trái, hoa cam ở bụi phải; chồi cao lên thành thân non cong.
- 8: Thân non cao ~1/3 cảnh, xoắn nhẹ, có hai cành nhỏ mỗi cành vài lá.
- 9: Thân to và xoắn rõ, cành dài ra, lá nhiều hơn; thêm hoa trắng dưới gốc.
- 10: Thân cao ~1/2 cảnh, các cành toả ra, cụm lá đầu tiên thành tán nhỏ.
- 11: Tán lá lớn gấp đôi, phủ trên ngọn; thân xoắn cổ thụ.
- 12: Tán đầy đặn hai bên, xuất hiện điểm sáng lá non màu vàng chanh.
- 13: Tán đạt kích thước cuối, mép tán bồng bềnh.
- 14: Hoàn thiện chi tiết: vân vỏ cây, bóng tán trên thân, thêm hoa dưới gốc.
- 15: **Cổ thụ trưởng thành** – tán xanh tròn đầy, thân xoắn, hoa hồng/cam/trắng
  dưới gốc, hai đá và hai bụi cỏ ở hai mép. Tĩnh, đẹp nhất.

**Héo** (bản `home_sleep_garden_decay.png` hiện có – giữ nguyên)
- 0: Như ô 15 Mọc.
- 1–3: Lá ngả vàng dần từ mép tán vào trong; hoa cụp cánh.
- 4–6: Lá chuyển nâu cam, vài lá rơi; cỏ úa vàng; hoa khô héo.
- 7–9: Tán thưa trơ cành; thân xám đi; cỏ khô xẹp.
- 10–12: Cây khô trơ trụi bắt đầu vỡ thành tro từ ngọn xuống; cỏ thành rơm.
- 13–14: Thân và nền tan thành một làn bụi tro bay lên.
- 15: Bụi mờ hết – trống.

---

### Lv 4 – Vườn suối nhỏ

Ý tưởng: như Lv 2 nhưng có nước – một dòng suối mát chảy trước chỗ ngủ, đom đóm.

**Mọc**
- 0: Trống.
- 1: Thảm cỏ mỏng và hai hòn đá như Lv 2, thêm một **rãnh đất ẩm** cong phía trước.
- 2: Nước bắt đầu rỉ vào rãnh (vệt xanh nhạt mảnh); bụi cỏ hai bên.
- 3: Rãnh đầy thành **con suối nhỏ** uốn qua trước thảm cỏ, sỏi trắng hai bờ.
- 4: Nụ hoa nhú trên bụi cỏ; một khóm cỏ lau nhỏ bên bờ suối.
- 5: Chồi cây nhú giữa thảm cỏ; nụ hé hồng.
- 6: Hoa nở; chồi thành thân non; mặt suối có gợn sóng sáng.
- 7: Thân non cong lên với hai cành.
- 8: Thân cao ~1/3, lá nhiều; một con đom đóm đầu tiên (chấm xanh lá sáng).
- 9: Thân xoắn to, cành toả; hoa trắng dưới gốc.
- 10: Tán nhỏ đầu tiên; 2 đom đóm.
- 11: Tán lớn; thân cổ thụ.
- 12: Tán dày hơn Lv 2 (đậm, nhiều lớp); **quả nhỏ màu đỏ cam** đầu tiên.
- 13: Thêm quả (5–7 quả rải trong tán); 3–4 đom đóm.
- 14: Chi tiết vân vỏ, bóng tán phản chiếu nhạt trên mặt suối.
- 15: **Hoàn chỉnh** – cổ thụ tán dày có quả, suối uốn trước, sỏi trắng, 5 đom đóm.

**Héo**
- 0: Như ô 15 Mọc.
- 1–2: Đom đóm tắt dần từng con; mặt suối mất ánh sáng.
- 3–4: Lá ngả vàng từ mép; quả rơi xuống bờ suối.
- 5–6: Suối cạn dần, lộ đáy sỏi; hoa héo.
- 7–8: Suối chỉ còn rãnh đất nứt; tán trơ cành.
- 9–11: Cây khô xám, cỏ thành rơm.
- 12–14: Cây và nền vỡ thành tro bay lên.
- 15: Trống.

---

### Lv 6 – Cổ thụ hoa anh linh

Ý tưởng: cây lớn nở hoa trắng hồng như hoa anh đào, nấm phát sáng – đẹp và mơ màng.

**Mọc**
- 0: Trống.
- 1–2: Thảm cỏ + hai đá, rồi hai bụi cỏ như Lv 2 (cỏ xanh đậm hơn).
- 3: Dưới hai bụi cỏ mọc **cụm nấm nhỏ** màu kem.
- 4: Mũ nấm bắt đầu **phát sáng teal** nhạt; chồi cây nhú giữa.
- 5: Chồi thành thân non; nấm sáng rõ hơn.
- 6: Thân non cao ~1/3 với cành.
- 7: Thân cao ~1/2, xoắn mạnh; cành chia nhánh.
- 8: Tán **tầng dưới** thành hình (lá xanh).
- 9: Thân vươn tiếp, tán **tầng trên** thành hình → tán hai tầng.
- 10: Nụ hoa hồng nhạt lấm tấm khắp tán.
- 11: Nụ hé – tán chuyển dần sang trắng hồng.
- 12: Hoa nở rộ một nửa tán.
- 13: Hoa nở kín cả hai tầng tán, lá xanh chỉ còn điểm xuyết.
- 14: Vài cánh hoa tách khỏi tán, bắt đầu rơi.
- 15: **Hoàn chỉnh** – cổ thụ hai tầng hoa trắng hồng, 2–3 cánh hoa lơ lửng, nấm teal
  sáng dưới gốc.

**Héo**
- 0: Như ô 15 Mọc.
- 1–3: **Mưa cánh hoa**: hoa rụng dần, cánh rơi đầy không khí.
- 4–5: Tán chỉ còn lá xanh; cánh hoa phủ thảm cỏ.
- 6–7: Nấm tắt sáng từng cụm; lá ngả vàng.
- 8–9: Lá rụng, tán trơ cành; cánh hoa dưới đất nâu lại.
- 10–11: Nấm teo, thân cây khô xám.
- 12–14: Cây vỡ thành tro, cánh hoa khô thành bụi bay lên.
- 15: Trống.

---

### Lv 8 – Đền đá rêu phong

Ý tưởng: chỗ ngủ nằm trong phế tích đền cổ – cột đá, cổng đá, đèn đá lửa teal.

**Mọc**
- 0: Trống.
- 1: Thảm cỏ + nền **phiến đá lát cổ** lộ ra giữa cỏ.
- 2: Hai **chân cột đá** nhô lên phía sau hai bên.
- 3: Hai cột cao lên tới ~2/3 cảnh, đỉnh vỡ.
- 4: **Thanh đá ngang** nối hai cột thành cổng thấp (thấp hơn tán cây sau này).
- 5: Rêu xanh phủ chân cột; chồi cây nhú giữa nền đá.
- 6: **Đèn đá nhỏ** hiện bên gốc (chưa sáng); thân non cao lên.
- 7: Dây leo bắt đầu quấn chân cột; thân non có cành.
- 8: Dây leo quấn lên nửa cột; thân cây cao ~1/2, xoắn.
- 9: Tán nhỏ thành hình **phía trước cổng**, không che cổng.
- 10: Tán lớn hơn, vượt đỉnh cổng.
- 11: Dây leo phủ tới đỉnh cột, có lá nhỏ.
- 12: Đèn đá **bật lửa teal** nhỏ.
- 13: Lửa đèn sáng rõ, hắt ánh teal lên chân cột; tán đầy đủ.
- 14: Chi tiết rêu, vết nứt cột, vân đá.
- 15: **Hoàn chỉnh** – cổng đá cổ phủ rêu và dây leo phía sau, cổ thụ phía trước,
  đèn đá lửa teal cạnh gốc, nền đá lát giữa cỏ.

**Héo**
- 0: Như ô 15 Mọc.
- 1–2: Lửa đèn chập chờn rồi tắt; khói mảnh bốc lên.
- 3–4: Lá cây và dây leo ngả vàng.
- 5–6: Dây leo khô rụng khỏi cột; rêu chuyển nâu.
- 7–8: Tán trơ cành; **vết nứt lan** trên cột và thanh ngang.
- 9–10: Thanh ngang gãy rơi; đỉnh cột vỡ vụn.
- 11–12: Cột sụp thành đống đá; cây khô vỡ tro.
- 13–14: Đá và tro tan thành bụi.
- 15: Trống.

---

### Lv 10 – Cổ thụ rune

Ý tưởng: đền Lv 8 thức tỉnh – cây và đá khắc rune teal giống rune trên linh lộc Lv 9–10.

**Mọc**
- 0: Trống.
- 1–2: Thảm cỏ, nền đá lát, hai cột đá như Lv 8 hiện ra (nhanh hơn – 2 khung).
- 3: Cổng đá hoàn chỉnh, rêu ở chân.
- 4: **Rễ cây to** trồi lên mặt đất, bò quanh chỗ nằm (không chắn giữa).
- 5: Thân cây mọc từ điểm hội tụ của rễ, đã to ngay từ đầu.
- 6: Thân cao ~1/2, vỏ xù xì.
- 7: Cành lớn toả ra; **ký tự rune đầu tiên** khắc lên thân (chưa sáng).
- 8: Thêm rune dọc thân và trên hai cột.
- 9: Tán lá thành hình.
- 10: Rune trên thân **sáng teal** từ dưới lên.
- 11: Rune trên cột sáng; ánh sáng chạy theo **rễ** như mạch máu.
- 12: Tán đầy; **đốm sáng teal** đầu tiên trong tán.
- 13: Thêm đốm sáng (6–8) lơ lửng quanh tán.
- 14: Đèn đá lửa teal bên gốc như Lv 8; chi tiết vân rune.
- 15: **Hoàn chỉnh** – cổ thụ rễ to, thân và cột khắc rune teal phát sáng, mạch sáng
  trong rễ, đốm sáng lơ lửng.

**Héo**
- 0: Như ô 15 Mọc.
- 1–3: **Rune tắt từng ký tự** từ trên xuống; mạch sáng trong rễ rút về thân.
- 4–5: Đốm sáng trong tán rơi xuống và tắt.
- 6–7: Lá ngả xám bạc (không vàng – cây đang **hoá đá**).
- 8–9: Thân, rễ, tán chuyển hẳn sang **đá xám**.
- 10–11: Cây đá nứt, cột đá nứt.
- 12–14: Tất cả vỡ thành **bụi teal** bay lên xoáy nhẹ.
- 15: Trống.

---

### Lv 12 – Rừng lông vũ

Ý tưởng: cây mang lá như lông vũ (như bờm linh lộc Lv 11–12), có hồ nước phản chiếu.

**Mọc**
- 0: Trống.
- 1: Thảm cỏ mịn, hai đá trắng.
- 2: Một **vũng nước nhỏ** đọng phía trước.
- 3: Vũng lan thành **hồ nhỏ** tròn trước chỗ nằm, mặt nước trong.
- 4: Chồi cây nhú; hai **cây non nhỏ** cùng loài nhú ở hai mép (thấp).
- 5: Thân chính vươn lên, cành đầu tiên.
- 6: Cành mọc **lá dạng lông vũ** xanh lá.
- 7: Thân cao ~1/2; lông vũ chuyển dần teal.
- 8: Tán lông vũ thành hình, mềm và rủ.
- 9: Tán lớn, rủ xuống như bờm; hai cây non cao lên ~1/4 cảnh.
- 10: Mặt hồ **phản chiếu** tán cây.
- 11: Tán đạt kích thước cuối, lông vũ nhiều lớp.
- 12: Một **chiếc lông vũ lớn** tách khỏi cành.
- 13: Lông vũ đó trôi chậm giữa không trung; thêm một chiếc nữa tách ra.
- 14: Gợn sóng nhỏ trên hồ nơi lông vũ sắp chạm.
- 15: **Hoàn chỉnh** – cây lông vũ teal rủ mềm, hai cây non hai bên, hồ phản chiếu,
  2 lông vũ lơ lửng.

**Héo**
- 0: Như ô 15 Mọc.
- 1–3: Lông vũ **bay ngược lên trời** từng chiếc, mờ dần.
- 4–5: Tán thưa, lông còn lại chuyển xám nhạt.
- 6–7: Hồ mất phản chiếu, mực nước hạ.
- 8–9: Hồ cạn còn vết ẩm; hai cây non khô gục.
- 10–11: Cây chính trơ cành khô.
- 12–14: Tan thành tro và vài sợi lông nhỏ bay lên.
- 15: Trống.

---

### Lv 14 – Thánh địa vàng kim

Ý tưởng: lần đầu có kiến trúc vàng – chỗ ngủ thành bệ thiêng, hợp với giáp vàng Lv 13–14.

**Mọc**
- 0: Trống.
- 1: Thảm cỏ; một **vòng tròn ánh vàng** loé trên mặt đất giữa cảnh.
- 2: Vòng sáng hoá thành **bệ đá trắng tròn** viền vàng (chỗ linh lộc nằm).
- 3: Hai **trụ đá trắng** mọc lên phía sau hai bên.
- 4: Trụ cao tới ~2/3; hoa văn vàng chạy dọc thân trụ.
- 5: **Vòm cổng vàng mảnh** vẽ nối hai đỉnh trụ (từ hai đầu vào giữa).
- 6: Vòm khép kín; chồi cây nhú phía sau bệ.
- 7: Thân non vươn lên giữa vòm.
- 8: Thân cao ~1/2, cành toả.
- 9: Tán lá xanh thành hình sau vòm.
- 10: **Viền lá chuyển vàng kim** từ ngoài vào.
- 11: Tán lớn, mọi lá có viền vàng.
- 12: **Hạt sáng vàng** đầu tiên bay quanh tán.
- 13: Thêm hạt sáng vàng và teal; hoa trắng quanh bệ.
- 14: Chi tiết chạm vàng trên trụ và vòm, ánh phản chiếu trên bệ.
- 15: **Hoàn chỉnh** – bệ trắng viền vàng, hai trụ chạm vàng, vòm cổng vàng, cây lá
  viền vàng, hạt sáng vàng/teal bay quanh.

**Héo**
- 0: Như ô 15 Mọc.
- 1–2: Hạt sáng chậm lại và rơi xuống.
- 3–4: Vàng trên lá, trụ, vòm **phai thành màu đồng**.
- 5–6: **Vòm cổng tan thành hạt sáng** từ giữa ra hai đầu.
- 7–8: Lá đồng rụng; trụ đá xám đi.
- 9–10: Trụ nứt và sụp; cây trơ cành.
- 11–12: Bệ đá nứt, cây khô vỡ tro.
- 13–14: Tất cả thành bụi đồng bay lên.
- 15: Trống.

---

### Lv 16 – Cây sao trời

Ý tưởng: cây thuộc về bầu trời đêm – tán trong mờ chứa sao, như cánh linh lộc Lv 15–16.

**Mọc**
- 0: Trống.
- 1: Thảm cỏ màu xanh lam đêm, hai đá có ánh sáng nhạt.
- 2: **Vệt ngân hà mờ** hiện sau cảnh (rất nhạt, mép mờ dần ra trong suốt).
- 3: Ngân hà rõ hơn, vài ngôi sao nhỏ.
- 4: Một **hạt sáng** rơi từ trời xuống giữa thảm cỏ.
- 5: Nơi hạt sáng rơi nhú **chồi trong suốt phát sáng**.
- 6: Chồi thành thân non ngọc lam trong mờ.
- 7: Thân cao ~1/2, ánh sáng chạy bên trong thân.
- 8: Cành toả; lá trong mờ đầu tiên.
- 9: Tán ngọc lam trong mờ thành hình.
- 10: **Sao nhỏ** xuất hiện bên trong tán.
- 11: Tán lớn, sao lấp lánh dày hơn.
- 12: **Dải lông công teal** rủ xuống từ vài cành.
- 13: Thêm lông công rủ; hoa trắng phát sáng dưới gốc.
- 14: Chi tiết: sao trong tán to nhỏ khác nhau, ánh hắt trên cỏ.
- 15: **Hoàn chỉnh** – cây trong mờ ngọc lam chứa sao, lông công rủ, ngân hà mờ phía
  sau, cỏ ánh lam.

**Héo**
- 0: Như ô 15 Mọc.
- 1–3: **Sao rơi khỏi tán như sao băng**, kéo vệt sáng xuống đất rồi tắt.
- 4–5: Tán mất sáng, chuyển xám trong mờ.
- 6–7: Lông công rơi; ngân hà nhạt dần.
- 8–9: Ngân hà biến mất; cây xám trơ cành.
- 10–11: Cỏ mất ánh lam, khô.
- 12–14: Cây tan thành **bụi sao** bay lên rồi tắt.
- 15: Trống.

---

### Lv 18 – Cung điện sapphire

Ý tưởng: bầu trời sao Lv 16 thêm một cung điện vàng–sapphire – hợp trang sức Lv 17–18.

**Mọc**
- 0: Trống.
- 1: Thảm cỏ; **sàn đá lát vàng** hiện giữa cỏ.
- 2: Bệ ngủ tròn viền vàng như Lv 14 trên sàn.
- 3: Phía sau, **đường viền vàng** của cung điện vẽ ra như bản phác.
- 4: Bản phác đầy thành **tường trắng** cung điện nhỏ.
- 5: **Mái vòm sapphire** và **tháp nhọn vàng** hiện trên đỉnh (cao ngang tán sau này).
- 6: Cửa sổ cung điện sáng lên; chồi cây nhú trước bệ.
- 7: Thân cây ánh vàng vươn lên.
- 8: Cành toả; lá ngọc lam.
- 9: Tán thành hình, che một phần cung điện (không che tháp).
- 10: **Quả là đá sapphire** đầu tiên trên cành.
- 11: Thêm quả sapphire phát sáng; **dây chuyền vàng** treo vắt qua cành.
- 12: Sao nhỏ và **vệt bụi sao** uốn quanh tán.
- 13: Ngân hà mờ phía sau cung điện.
- 14: Chi tiết hoa văn vàng trên cung điện, phản chiếu trên sàn.
- 15: **Hoàn chỉnh** – cung điện vàng–sapphire nhỏ phía sau, cây quả sapphire treo
  dây chuyền vàng, sàn vàng, bệ ngủ, vệt bụi sao.

**Héo**
- 0: Như ô 15 Mọc.
- 1–2: Cửa sổ cung điện tắt sáng.
- 3–4: Cung điện **mờ dần như ảo ảnh** (trong suốt dần từ dưới lên).
- 5–6: Cung điện biến mất; quả sapphire tắt sáng, rơi.
- 7–8: Dây chuyền tuột rơi; vệt bụi sao tan.
- 9–10: Lá rụng, sàn vàng xỉn màu.
- 11–12: Cây khô, sàn nứt.
- 13–14: Tất cả tan thành **bụi vàng** bay lên.
- 15: Trống.

---

### Lv 20 – Thiên giới ngọc lục bảo (cảnh xịn nhất)

Ý tưởng: cõi trời hoàn chỉnh – cây thần ôm ngọc lục bảo, cung điện trên mây, thác,
cầu vồng, đài sen; tương xứng linh lộc Lv 19–20 giáp vảy vàng và ngọc lục bảo.

**Mọc**
- 0: Trống.
- 1: Một **viên ngọc lục bảo nhỏ** lơ lửng phát sáng ở giữa.
- 2: Ngọc toả sáng; dưới nó **mây trắng viền vàng** dâng lên thành nền.
- 3: Mây lan thành thảm; trên mây mọc thảm cỏ xanh.
- 4: Giữa cỏ nở **đài hoa sen vàng** viền ngọc trai (bệ ngủ).
- 5: **Hồ nhỏ** quanh đài sen; mặt hồ phản chiếu ánh ngọc.
- 6: Phía sau, **cung điện vàng–sapphire** (như Lv 18) nổi lên trên mây.
- 7: Từ dưới ngọc mọc **thân cây thần** phủ **vảy vàng**, ôm lấy viên ngọc.
- 8: Thân to và cao, cành lớn toả; ngọc nằm giữa các cành.
- 9: Tán ngọc lam thành hình.
- 10: Sao xuất hiện trong tán; ngọc lục bảo sáng mạnh hơn.
- 11: **Thác nước nhỏ** chảy từ mép mây xuống hồ.
- 12: **Cầu vồng teal–vàng** mảnh vắt sau cung điện.
- 13: Hạt sáng, bụi sao, cánh hoa bay quanh (vừa phải).
- 14: Chi tiết: vảy vàng lấp lánh, ngọc trai trên đài sen, bọt thác.
- 15: **Hoàn chỉnh** – cây thần vảy vàng ôm ngọc lục bảo, tán sao, cung điện trên mây,
  thác nước, cầu vồng, đài sen vàng trên hồ. Rực rỡ nhưng gọn, không che thú.

**Héo**
- 0: Như ô 15 Mọc.
- 1–2: Ngọc lục bảo **tắt sáng** – toàn cảnh tối đi một bậc.
- 3–4: Cầu vồng nhạt rồi biến mất; thác ngừng chảy.
- 5–6: Mây **tan dần** từ mép vào; cung điện chìm vào mây rồi mất.
- 7–8: Hồ cạn; đài sen khép cánh, ngọc trai rơi.
- 9–10: Tán sao tắt, lá rụng; vảy vàng trên thân xỉn lại.
- 11–12: Cây thần, đài sen, ngọc vỡ thành **dải bụi sao xoáy** quanh tâm.
- 13–14: Dải xoáy bay lên và mờ dần.
- 15: Trống.

## 3. Quy trình tạo ảnh

1. Với mỗi cấp, **tạo ô 15 (cảnh hoàn chỉnh) trước**, đính kèm ô 15 của cấp ngay
   dưới làm tham chiếu ("same style, same ground line, add …"). **Dừng cho chủ dự án
   duyệt cả 9 ảnh ô 15** (Lv 4–20) trước khi làm khung chuyển động.
2. Sau khi duyệt, tạo các khung mọc 1–14 bằng cách **lùi dần** từ ô 15 (xoá bớt
   chi tiết theo thứ tự ngược mục 1.3), mỗi khung một ảnh, đính kèm khung kề bên.
3. Tạo 16 khung héo từ ô 15.
4. Câu lệnh mẫu (ChatGPT):

```
Hand-painted fantasy game background prop, transparent background, square canvas.
Same soft painterly style, same camera, same ground line and same footprint as
the attached reference scene. Keep the empty resting spot in the lower middle
in front of the tree trunk. Upgrade the scene: <MÔ TẢ CẤP TỪ MỤC 2, tiếng Anh>.
No text, no frame, no characters, no ground shadow outside the grass patch.
```

## 4. Hậu kỳ (AI tự làm bằng script)

- Tách nền, cắt ô 320×320, **căn đường đất y=296** và tâm thảm cỏ cho cả 32 khung
  mỗi cấp; kiểm tra ô 0 héo trùng ô 15 mọc (bbox và pixel).
- Ghép `home_sleep_garden_lvNN.png` và `home_sleep_garden_lvNN_decay.png`
  (NN = 04, 06 … 20), mỗi file ≤ 700KB (quantize ≥256 màu có dithering nếu cần).
- Lưu ảnh gốc ở `assets/pixelPet/sourceFrames/sleep_garden_lvNN/`, ghi nguồn vào
  `assets/pixelPet/animations/provenance.json`.

## 5. Kiểm tra chất lượng (bắt buộc)

- [ ] Contact sheet 4×4 mỗi atlas: cùng phong cách, cùng đường đất, không nhảy vị trí.
- [ ] GIF mọc 3,8 s và héo 4,8 s: lớn dần mượt, không bật đột ngột; héo khớp từ ô 15.
- [ ] Đặt linh lộc đang ngủ (bộ cấp tương ứng) lên ô 15: thú không bị che, bệ/chỗ nằm
  nằm đúng dưới thân, nhìn hài hoà.
- [ ] Xếp ô 15 của Lv 2→20 thành một dải: **cấp sau rõ ràng xịn hơn cấp trước**.
- [ ] Gửi chủ dự án duyệt trước khi gắn vào app.

## 6. Gắn vào app (sau khi duyệt)

- `src/screens/PixelPet/petArt.ts`: thêm bảng atlas mọc/héo theo cấp
  (2, 4, …, 20); hàm chọn theo `level` (lấy mốc chẵn ≤ level).
- `HomeSleepGarden.tsx`: nhận prop `level`, chọn cặp atlas; bản héo khi thức phải
  dùng **đúng cấp lúc đang ngủ** (lưu vào `DepartingGarden`).
- `HomePetRoamer.tsx`: truyền `owned.level` / `preview.level` xuống cả cảnh đang ngủ
  và cảnh héo.
- `src/services/pixelPet/pixelPetGuide.ts`: đổi mục `scene` của Linh Lộc thành một mục
  mở khoá ở mỗi cấp chẵn 2–20 với tên cảnh ở mục 2 (cập nhật test
  `pixelPetGuide.test.ts`).
- Cập nhật `SPEC-pixel-pet.md`; chạy `npm run typecheck` và
  `npm test -- --runTestsByPath src/screens/Home/__tests__/HomePetRoamer.test.tsx
  src/screens/Home/__tests__/HomeSleepScene.test.ts
  src/services/pixelPet/__tests__/pixelPetGuide.test.ts`.
- Xem "Xem trên Home" trong Quản lý linh thú ở Lv 2, 3, 4, 10, 19, 20 (cảnh đúng
  cấp, héo khi đánh thức đúng cấp).

## 7. Ngân sách và điểm dừng duyệt

9 cảnh mới × 32 khung ≈ 288 ảnh (+ tạo lại khung hỏng). Có thể làm theo đợt:
Lv 4–8 → Lv 10–14 → Lv 16–20. Dừng duyệt ở: (1) 9 ảnh ô 15, (2) từng đợt sau
bước 5, (3) bản chạy trên Home.
