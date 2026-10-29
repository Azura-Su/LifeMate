# Kéo thả linh thú trên Home — kế hoạch chi tiết

## Mục tiêu
1. Nhấn giữ linh thú rồi kéo đi khắp vùng giữa header và bottom bar của Home.
2. Không được kéo vào header hoặc bottom bar (kẹp tọa độ trong vùng hợp lệ).
3. Thả tay: loài có cánh bay xuống mặt đất; loài không cánh rơi xuống.
4. Mỗi linh thú (15 loài + Thiên Dực Linh Lộc) có bộ khung hình riêng cho
   "bị nhấc / bay xuống" và "rơi".

## Hiện trạng (đã đọc code)
- `src/screens/Home/HomePetRoamer.tsx`: lane `position:absolute`, `bottom: spacing.xs`, cao
  `SIZE=120`. Chuyển động chỉ trên trục X (`x`), trục Y chỉ là `ground`/`airHeight`.
  `Pressable` nhấn = mở màn Linh thú (`onPress`); linh lộc đang có máy trạng thái
  `stagPhase` (runA → … → sleep) và bấm khi ngủ = đánh thức.
- `HomeScreen.tsx:325` render roamer ngoài `Screen`, nên lane phủ toàn màn hình, pointerEvents `box-none`.
- Khung hình: atlas 4×4 × 256px/loài (`idle/move/happy/skill`) + atlas nghỉ `rest_*`;
  linh lộc có atlas riêng (`celestial_stag_takeoff_v2/landing_v2/flight_v2`).
  Mapping ở `services/pixelPet/pixelPetFrames.ts`, `petRestAnimation.ts`.
  `petMovementKind()` cho biết loài nào có cánh (`wings`: alicorn, sphinx, lac_bird,
  phoenix, garuda, celestial_stag).
- Các script đóng gói atlas: `scripts/pack-pet-rest-atlas.py`,
  `pack-celestial-stag-atlas.py`; ảnh sinh bằng image_gen, provenance ở
  `assets/pixelPet/animations/provenance.json`.

## Thiết kế hành vi (máy trạng thái mới)
Thêm lớp "tay người" đè lên các beat roaming hiện có:

| Trạng thái | Vào khi | Hoạt ảnh | Ra khi |
|---|---|---|---|
| `roam` | mặc định | như hiện tại | nhấn giữ ≥ ~250ms |
| `lifted` | long-press bắt đầu | khung "bị nhấc" (người cầm: chân đung đưa/cánh vùng vẫy), nảy nhẹ + scale 1.08, haptic nhẹ | thả tay |
| `descend` (có cánh) | thả tay, đang trên không | khung "bay xuống": dang cánh, lượn chéo về điểm đáp, hạ cánh | chạm đất |
| `fall` (không cánh) | thả tay | khung "rơi": co người/chân quơ, rơi tăng tốc (gravity ease), nảy nhẹ khi chạm đất, `squash` | nằm yên |
| `land` | chạm đất | khung chạm đất/đứng dậy → trả về `roam` | xong |

Quy tắc:
- Nhấn nhanh (< ngưỡng) vẫn = mở màn Linh thú; chỉ long-press mới vào `lifted`.
  Linh lộc đang ngủ: nhấn nhanh vẫn đánh thức; long-press cũng nhấc được.
- Toạ độ kéo kẹp trong `[minY, maxY]` và `[0, range]`:
  `minY` = đáy header (đo bằng `onLayout` của `fixedHeader`, hoặc safe-area top + chiều cao header),
  `maxY` = trên bottom bar (đã có `GROUND_Y`). Không cho tâm sprite vượt, tính cả phần cánh
  (dùng `motionCanvasScale` của linh lộc).
- Điểm đáp: có cánh → đáp tại x hiện tại (chếch nhẹ theo hướng vận tốc kéo cuối); không cánh
  → rơi thẳng. Cả hai về `GROUND_Y`.
- Dừng timer roaming/`setBeat`/`stagPhase` khi `lifted` và đặt lại beat sau `land`
  (tránh `withTiming` của roaming ghi đè `x`). Linh lộc: sau `land` vào phase mặt đất
  (`runB`/`settle`) hoặc `sleep` nếu đang ngủ trước đó — phải chốt với chủ sản phẩm.
- `useReducedMotion`: không kéo animation, thả là đặt thẳng xuống đất (vẫn kéo được).
- Khi `active=false` (rời màn/mở lịch): huỷ gesture, đưa pet về đất ngay.

## Công việc
### A. Logic & gesture (1 dev RN, ~1–1.5 ngày)
1. Tách máy trạng thái ra hook/thuần hàm `homePetDrag.ts`
   (`DragPhase`, `clampDragPosition`, `nextPhase`) để test không cần render.
2. Trong `HomePetRoamer.tsx`: thêm `PanResponder` kích hoạt sau long-press 250ms
   (không có react-native-gesture-handler — xem mục "Điều chỉnh kỹ thuật") bọc quanh
   `Pressable`; thêm shared value `y` (offset dọc), `dragging`.
   Cập nhật `useAnimatedStyle` `flight` để cộng `y`.
3. Đo vùng cho phép: truyền `topInset`/`bottomInset` từ `HomeScreen` (đo header
   `onLayout`) vào roamer; tính `minY`.
4. Thả tay: `withTiming`/`withSpring` về `GROUND_Y` — có cánh dùng easing mềm 700–900ms,
   không cánh dùng `Easing.in(Easing.quad)` ~ theo quãng rơi (v ∝ √h), + nảy 1 lần.
5. Chặn xung đột: roaming beat, `stagPhase` timer, `departingGarden`, `wakeStag`.
6. Haptic (expo-haptics nếu đã có trong deps) khi nhấc/chạm đất — tùy chọn.

### B. Khung hình sprite (1 dev RN, ~1 ngày, làm song song A sau khi chốt API)
1. Thêm clip nội bộ `lifted`, `descend`, `fall`, `land` vào `PixelPetAnyClipId`
   (`types/pixelPet.ts`) hoặc prop `dragPhase` cho `PixelPetSprite`
   (ưu tiên prop riêng như `flightPhase`, tránh phình danh sách clip lưu trữ).
2. `pixelPetFrames.ts`: thêm `FRAME_TRACKS`/hàm sample cho 4 clip mới
   (atlas riêng mỗi loài, 4×4, theo mẫu `PET_REST_ATLASES`); `PixelPetAtlas`
   đã hỗ trợ `columns/rows/frameTrack/loop` nên dùng lại.
3. `petArt.ts`: thêm `PET_DRAG_ATLASES` (key = species, trừ stag nếu dùng atlas stag riêng).
4. Fallback: loài thiếu atlas → dùng khung `happy` cho `lifted`, `move` cho
   `descend`, `idle` + transform squash cho `fall/land` (để app không vỡ khi art chưa xong).

### C. Art — khung hình cho từng linh thú (nặng nhất, 2–3 ngày, có thể chia người)
Mỗi loài 1 sheet 4×4 (16 poses, 1024×1024) theo cùng quy trình `rest_*`
(image_gen từ PNG gốc → `scripts/pack-pet-rest-atlas.py`):
- Hàng 1: `lifted` ×4 (bị xách lên: chân/đuôi/cánh đung đưa, mặt ngạc nhiên).
- Hàng 2: loài có cánh = `descend` ×4 (dang cánh lượn xuống → duỗi chân hạ cánh);
  loài không cánh = `fall` ×4 (xoay/quơ chân rơi → co người sắp chạm đất).
- Hàng 3: `land` ×4 (chạm đất, ép dẹt, bật lên, đứng dậy).
- Hàng 4: dự phòng/biến thể (vd. loài có cánh cũng có `fall` hoàn chỉnh khi bị rơi sát đất).
Chia việc đề xuất: nhóm 1 (6 loài thân thú: nine_tail_fox, qilin, rune_wolf, white_tiger,
centaur, anubis), nhóm 2 (5 loài rắn/cá/rùa: black_tortoise, azure_dragon, koi_dragon,
scylla, sphinx), nhóm 3 (5 loài có cánh: alicorn, lac_bird, phoenix, garuda + celestial_stag —
stag tái sử dụng `celestial_stag_landing_v2` cho `land`, chỉ cần `lifted` và `descend` mới).
Yêu cầu: cùng hướng nhìn/tỉ lệ với atlas hiện có (`petFacesLeft`), nền trong suốt,
mỗi pose cách nhau gutter, cập nhật `provenance.json` + `README.md`.
Ước lượng RAM: +4 MiB/atlas khi đang decode, chỉ mount khi `lifted…land` (không preload).

### D. Test & xác minh (0.5 ngày)
- Jest thuần hàm: `clampDragPosition` (header/bottom bar, biên trái/phải, cánh), `nextPhase`
  (có cánh vs không cánh, reduced motion, huỷ giữa chừng, `active=false`).
- Jest component `HomePetRoamer`: nhấn nhanh vẫn gọi `onPress`; long-press không gọi `onPress`;
  khi `lifted` không còn timer roaming ghi đè `x`.
- Test dữ liệu: mọi species trong `PIXEL_PET_SPECIES` + stag đều có atlas drag (hoặc fallback khai báo rõ);
  mỗi atlas 1024×1024, 16 ô không rỗng.
- `npm run typecheck`, ESLint các file đổi, `npm test -- --runTestsByPath ...`.
- Kiểm tra thủ công trên simulator (cần dev client + mật khẩu máy cho tab Tài chính không liên quan):
  kéo sát header/bottom bar, thả khi đang bay/đi/ngủ (linh lộc), mở lịch đang kéo, xoay màn hình.

## Thứ tự & phụ thuộc
1. Chốt các câu hỏi dưới đây.
2. A và C bắt đầu cùng lúc (C không phụ thuộc code). B bắt đầu khi A có `dragPhase` API.
3. D chạy cuối; review (đọc-chỉ) trước khi commit.

## Quyết định đã chốt
1. **Có cánh bị thả giữa trời:** lượn một vòng rồi đáp. Thêm phase `circle` giữa `lifted` và
   `descend`: bay cung tròn/số 8 nhỏ (~1.2–1.8s, bán kính ≤ 0.3 độ rộng lane, kẹp trong vùng
   hợp lệ) với khung bay lượn, hạ dần độ cao, rồi `descend` → `land`. Linh lộc dùng
   `flight_v2` cho `circle`, `landing_v2` cho `land`.
2. **Rắn/rồng/cá/rùa có kiểu riêng** (tôi thiết kế theo loài, art cần duyệt):
   | Loài | Kiểu rơi | Nét chính |
   |---|---|---|
   | azure_dragon | `coil` — rồng cuộn mình, đuôi quật, hạ xuống như lướt gió | thân uốn S, râu bay ngược |
   | koi_dragon | `flop` — cá chép quẫy đuôi giữa không trung, rơi nhẹ như lá, đáp bật 1 nhịp | vây xòe, đuôi quẫy |
   | scylla | `tentacle` — các xúc tu/đầu chó vung tứ phía, rơi xoay, đáp bằng xúc tu | thân xoay, xúc tu bung |
   | black_tortoise | `shell` — rụt đầu/chân vào mai, rơi xoay chậm, đáp "cộp" rồi thò đầu ra | thân tròn, nảy ít |
   | sphinx, alicorn, lac_bird, phoenix, garuda, celestial_stag | có cánh → `circle`/`descend` | theo mục 1 |
   | nine_tail_fox, qilin, rune_wolf, white_tiger, centaur, anubis | `fall` thú — quơ chân, xoay người như mèo, đáp bằng 4 chân | co người sắp chạm đất |
   Mỗi kiểu quyết định hàng 2 của sheet (xem phần C); phần còn lại chung khung.
3. **Linh lộc đang ngủ bị nhấc** (chưa được trả lời — chọn mặc định, đổi được): thức dậy,
   vào `lifted`, đáp xong vào `runB` rồi tự ngủ lại theo chu kỳ cũ; vườn ngủ hiện tại dùng
   `departingGarden` (héo) như khi bị đánh thức.
4. **Long-press 250ms, hiển thị trạng thái "đã nhấc" bằng nảy + scale 1.08 + bóng đổ.
   Haptic: không dùng ở v1** vì `expo-haptics` chưa có trong `package.json` và thêm vào là
   phụ thuộc native (phải build lại dev client). Để ngỏ như bước tùy chọn sau
   (`impactAsync(Light)` lúc nhấc, `Medium` lúc chạm đất, bọc try/catch).
5. **Art bằng image_gen như các atlas trước; mỗi loài một lượt duyệt thẩm mỹ.** Chấp nhận khung
   tạm: loài chưa duyệt xong dùng fallback (xem B.4) và vẫn ship được; cờ
   `PET_DRAG_ATLAS_READY` theo loài để bật dần. Thứ tự art: linh lộc → có cánh → thú → rồng/cá/rùa.

## Điều chỉnh kỹ thuật phát hiện thêm khi rà `package.json`
- **Không có `react-native-gesture-handler`** (và `node_modules` cũng không có) nên bỏ
  `Gesture.Pan().activateAfterLongPress` ở mục A.2. Dùng `PanResponder` của React Native
  (không thêm native dependency): `onStartShouldSetPanResponder` trả false, tự đếm
  250ms bằng `setTimeout` từ `onPressIn`/`onResponderGrant`, khi hết thời gian mới
  `onMoveShouldSetPanResponderCapture` = true và giữ responder. Cập nhật shared value
  `x`/`y` trực tiếp từ `onPanResponderMove` (gán `.value`, không `setState`) để mượt.
  Cần cô lập với vuốt cuộn của Home: chỉ chiếm responder sau khi long-press kích hoạt,
  và `onPanResponderTerminationRequest` = false trong lúc kéo.
- Nếu sau này thêm RNGH thì chuyển sang `Gesture.Pan` — nằm ngoài phạm vi.

## Công việc cập nhật theo quyết định
- A.4 thêm phase `circle` (có cánh) và biến thể rơi theo bảng ở mục 2: `fall` (thú),
  `coil`, `flop`, `tentacle`, `shell`. Gom thành `DragFallStyle = 'fall'|'coil'|'flop'|'tentacle'|'shell'|'wings'`
  lấy từ `speciesId` trong `petFallStyle(species)` (cạnh `petMovementKind`) để test được.
- B.2 đường cong rơi theo kiểu: `fall` gravity + nảy 1 lần; `coil`/`flop` ease-out chậm
  (700–1100ms, lắc ngang nhẹ); `shell` rơi nhanh + nảy ít + squash; `tentacle` xoay nhẹ khi rơi.
- C.1 đổi hàng 2 từng loài theo bảng; ghi prompt image_gen mẫu cho từng kiểu vào
  `provenance.json`; mỗi loài một vòng duyệt: Asher xem sheet 4×4 thô trước khi pack.
- D bổ sung test: `petFallStyle` phủ mọi species (không loài nào undefined), phase `circle`
  luôn kết thúc ở `land` kể cả bị huỷ (`active=false`, reduced motion bỏ qua `circle`).

## Rủi ro
- Atlas mới ×16 loài tăng dung lượng bundle (~16 MiB + 4 MiB/atlas khi decode) — nên nén PNG.
- Gesture long-press với `Pressable` hiện tại dễ xung đột với `onPress` → phải bọc bằng `GestureDetector` đúng thứ tự.
- Lane phủ toàn màn và `pointerEvents="box-none"`: khi pet ở giữa màn, vùng chạm không được chặn cuộn của Home.
- Tọa độ header khác nhau theo thiết bị (notch); cần đo, không hardcode.
