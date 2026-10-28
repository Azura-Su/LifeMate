# Spec: Pixel Pet — 15 linh thú

Module viết mới (`src/services/pixelPet`, `src/screens/PixelPet`,
`supabase/functions/pet-access`). Không dùng lại code thú cưng đã xoá ở 53271d8.

## 1. Danh mục 15 linh thú

Mỗi loài là **một cá thể duy nhất** trên toàn hệ thống. ID ổn định (không đổi
khi đổi tên hiển thị); thứ tự và ID được seed ở migration và `pixelPetCatalog.ts`.

| ID | Tên | Rig | Kỹ năng độc quyền | Tính cách |
|---|---|---|---|---|
| `nine_tail_fox` | Cửu Vĩ Hồ | quadruped | Hồ Hỏa Mê Ảnh | tinh nghịch |
| `qilin` | Kỳ Lân Hỏa | quadruped | Lân Hỏa Bộ | nhiệt huyết |
| `alicorn` | Thiên Mã Kỳ Lân | quadruped | Tinh Vân Dực | mơ mộng |
| `rune_wolf` | Lang Linh | quadruped | Phù Văn Hú | trung thành |
| `black_tortoise` | Huyền Vũ | quadruped | Quy Giáp Thủ | điềm tĩnh |
| `sphinx` | Nhân Sư | quadruped | Câu Đố Sa Mạc | thông thái |
| `centaur` | Nhân Mã | quadruped | Lục Mộc Tiễn | phóng khoáng |
| `white_tiger` | Bạch Hổ | quadruped | Hổ Khiếu Phong | dũng cảm |
| `azure_dragon` | Thanh Long | serpentine | Long Châu Vũ | cao quý |
| `koi_dragon` | Lý Ngư Hóa Long | serpentine | Vượt Vũ Môn | kiên trì |
| `scylla` | Scylla | serpentine | Lục Khuyển Hỏa | nóng nảy |
| `lac_bird` | Chim Lạc | avian | Đồng Cổ Vũ | hiền hoà |
| `phoenix` | Phượng Hoàng | avian | Niết Bàn Hỏa | lạc quan |
| `anubis` | Anubis | biped | Cán Cân Linh Hồn | nghiêm túc |
| `garuda` | Garuda | biped | Kim Sí Phong | chính trực |

Thay đổi so với bộ ảnh tham khảo: chú chim hồng thường (trùng vai trò với
Phượng Hoàng/Chim Lạc, không phải linh thú) được thay bằng **Bạch Hổ**. Ảnh do
người dùng gửi được tách nền, cắt vuông 384px và đóng gói tại `assets/pixelPet/`
(14 loài, map trong `src/screens/PixelPet/petArt.ts`). Ảnh di chuyển như một
khối theo track `body` của clip; Bạch Hổ chưa có ảnh nên vẫn dùng rig pixel.

## 2. Hình thái và animation — dùng chung rig

Mục tiêu: giữ đủ 15 loài nhưng giảm asset làm riêng. Nguồn: `pixelPetRig.ts`,
`pixelPetCatalog.ts`, renderer `PixelPetSprite.tsx`. Canvas 32×32 pixel.

- **4 rig** (`quadruped` 8 loài, `serpentine` 3, `avian` 2, `biped` 2). Mỗi rig có
  một lưới thân, một lưới đầu (9×8; avian dùng đầu có mỏ) và các *điểm neo*
  cố định cho đầu, mào và lớp đặc trưng.
- **6 clip dùng chung cho mọi rig và mọi giai đoạn**: `idle` (lặp), `eat`,
  `move`, `heal`, `happy`, `skill`. Clip là keyframe transform (dịch, xoay, co
  giãn) cho 3 phần `body`/`head`/`feature`, nội suy trên UI thread (Reanimated),
  không phải khung hình vẽ tay. Rig chỉ thêm biên độ lắc của lớp đặc trưng.
- **Phần riêng từng loài**: bảng màu 4 ô (`1` nền, `2` bóng, `3` điểm nhấn,
  `4` viền/mắt), một lưới mào 8×4 và một lưới đặc trưng 8×8. Một số lưới dùng
  lại giữa các loài (đôi cánh cho Thiên Mã, Nhân Sư, Garuda).
- **Giai đoạn**: `hatchling` (Lv 1–3, scale 0.72, đã có lớp đặc trưng),
  `juvenile` (Lv 4–7, 0.88), `ascended` (Lv 8+, 1.0, thêm hào
  quang). Không vẽ lại thân cho từng giai đoạn.
- **Viền & bóng tự động** (`polishGrid`, lúc render): mỗi lưới được đệm 1 ô,
  viền 1px màu `4` quanh hình và ô nền `1` ở mép trên được làm sáng.
- **Kỹ năng**: clip `skill` + 6 motif 8×8 dùng chung (`flame`, `water`, `wind`,
  `light`, `earth`, `arcane`) tô bằng bảng màu loài.
- **Hiệu ứng chăm sóc** từ sổ thu chi dùng lại clip: `eat`→eat, `move`→move,
  `heal`→heal, `mood`/`wardrobe`→happy, `neutral`→idle.

Số lưới làm riêng: 4 thân + 2 đầu + ≤15 mào + ≤15 đặc trưng + 6 motif ≈ 40,
so với ~15 loài × 3 giai đoạn × 6 clip × 6 khung ≈ 1.600 khung nếu vẽ riêng.
Pixel render (chỉ cho loài chưa có ảnh) bằng `react-native-svg` (gộp ô liền màu theo hàng), không tải ảnh
mạng. Reduced Motion và màn hình mất focus dừng clip.
- **Bay trên Home**: `HomePetRoamer` cho linh thú đã nhận nuôi bay qua lại ngay trên
  tab bar (lật hướng ở hai đầu, nhấp nhô), chạm để mở màn Linh thú. Dữ liệu lấy từ
  phản hồi server gần nhất (`readOwnedPixelPet`), không gọi thêm API; dừng khi Home
  mất focus, mở lịch hoặc bật Reduced Motion.

## 3. Quyền sở hữu, giữ chỗ, random

Backend Supabase Postgres là nguồn chuẩn; client không ghi trực tiếp.

Trạng thái loài: `AVAILABLE` (không chủ, không giữ chỗ còn hạn), `RESERVED`
(`reserved_by` + `reserved_until > now()`), `OWNED` (`owner_uid`).

- Ràng buộc DB: `owner_uid` unique, `reserved_by` unique → mỗi tài khoản ≤ 1
  linh thú và ≤ 1 giữ chỗ; mỗi loài ≤ 1 chủ, ≤ 1 giữ chỗ. Không có hàng thứ 16.
- Giữ chỗ 5 phút theo đồng hồ DB. Client chỉ hiển thị thời gian còn lại.
- 3 lượt random/tài khoản, lưu ở `lifemate_pet_accounts.rolls_used`, không reset.
  Random lại: giải phóng giữ chỗ cũ và cấp mới trong cùng transaction.
- Không trừ lượt khi không cấp được. Phân biệt `all-adopted` (15 đã có chủ) và
  `all-reserved` (còn loài nhưng đang được người khác giữ).
- **Khôi phục khi hết lượt**: hết lượt và giữ chỗ đã hết hạn → `restore` giữ lại
  loài cuối nếu còn trống, nếu không thì cấp một loài trống bất kỳ; không tăng
  `rolls_used`. Tối đa 3 lần khôi phục để không chiếm giữ loài vô hạn.
- Xác nhận khi giữ chỗ đã hết hạn trả `reservation-expired` (theo `now()` của DB).
- Mọi lệnh thay đổi mang `actionId` (UUID). Receipt `(uid, action_id)` lưu kết
  quả: gửi lại cùng `actionId` trả về đúng kết quả cũ. Xác nhận khi đã sở hữu
  trả về linh thú hiện tại. Đã sở hữu mà gọi random → trả về trạng thái sở hữu.
- Receipt lưu fingerprint lệnh; dùng lại `actionId` cho lệnh khác →
  `idempotency-conflict`.
- Hàng tài khoản bị khoá `for update` → hai thiết bị cùng tài khoản được tuần
  tự hoá. Loài được giữ bằng `update … where owner_uid is null and reserved_by
  is null`; nếu tài khoản khác thắng thì chọn lại (tối đa 6 lần, sau đó
  `pet-busy`), unique constraint là chốt chặn cuối.
- Tài khoản không `active` trong `lifemate_account_access` bị từ chối (đọc với
  `for share` để không chen giữa lúc chuyển sang `deleting`).

## 4. Thu hồi khi xoá tài khoản

`lifemate_pet_erase_account(uid)` được `user-admin` gọi trong `purgeData`
(dependency `clearPets`), ngay sau `clearGames` và trước khi quét Firestore, chỉ
sau khi trạng thái đã là `deleting`. Mọi RPC pet giữ khoá `for share` trên
`lifemate_account_access` tới khi commit, nên lệnh nhận nuôi đang chạy được sắp
xếp trước việc đổi trạng thái; sweep chạy lại erase tới khi hoàn tất. Idempotent:
xoá adoption, ledger, grants, receipts, tài khoản; xoá `owner_uid`/giữ chỗ trên
loài → `AVAILABLE`. Người nhận nuôi tiếp theo có `adoption_id` mới nên bắt đầu
Level 1, EXP 0. Đăng xuất hoặc gỡ app không thu hồi.

## 5. EXP

Cấu hình tập trung (`supabase/functions/pet-access/expConfig.mjs`):

| Nguồn (`sourceType`) | EXP | Giới hạn / `periodKey` |
|---|---:|---|
| `record_day` | 10 | 1 lần/ngày (`YYYY-MM-DD`) |
| `care_day` | 5 | 1 lần/ngày |
| `streak_3` | 15 | 1 lần/chuỗi (khoá theo ngày bắt đầu chuỗi) |
| `streak_7` | 30 | 1 lần/chuỗi |
| `weekly_record` | 20 | tuần ISO có ≥ 4 ngày ghi chép (`YYYY-Www`) |

Số tiền **không** ảnh hưởng EXP. Không chi tiêu vẫn nhận `care_day`.

- Ngày tính theo `Asia/Ho_Chi_Minh` từ `createdAt` (ms) của giao dịch — trường
  ngày duy nhất có trong `FinanceTransaction`. Chỉ tính ngày trong
  `[ngày nhận nuôi, hôm nay]`; ngày tương lai bị bỏ qua.
- **Chống ghi lùi ngày**: `createdAt` do client đặt, nên một ngày chỉ đủ điều
  kiện nếu được server nhìn thấy lần đầu khi còn trong 2 ngày gần nhất
  (`lifemate_pet_day_claims`). Ngày đã ghi nhận có thể bị thu hồi khi giao dịch
  bị xoá và được cấp lại nếu thêm lại. Home gọi `sync` nền khi được focus
  (throttle 10 phút) để ngày ghi chép được ghi nhận kịp thời.
- Mỗi `sync` ghi `last_read_ms`; ảnh chụp Firestore cũ hơn bị từ chối
  (`stale-snapshot`). `sync` bị giới hạn 20 lần/phút.
- **Đồng bộ** (`sync`): Edge Function đọc
  `financeAccounts/{uid}/transactions` bằng service account (client không gửi
  EXP), tính *mục tiêu* cho các nguồn tài chính, RPC
  `lifemate_pet_reconcile` so với `lifemate_pet_exp_grants` và ghi
  `delta = mục tiêu − đã cấp` vào `lifemate_pet_exp_ledger` (append-only, cả âm
  lẫn dương). Sửa/xoá/đổi ngày giao dịch tự động được tính lại cho cả ngày cũ và
  ngày mới vì mục tiêu được tính lại trên toàn khoảng; chuỗi bị cắt sẽ đổi khoá
  → thu hồi mốc cũ, cấp mốc mới. Gọi lại / nhiều thiết bị: delta = 0.
- `care_day` do server cấp theo ngày của đồng hồ DB; không bị thu hồi khi giao
  dịch thay đổi.
- Ledger có `idempotency_key` unique `(adoption, source, period, revision)`;
  revision tăng dưới khoá hàng tài khoản. Grant không bao giờ âm nên
  `total_exp = sum(ledger) = sum(grants) ≥ 0`, được đối soát trong test.
- Level từ tổng EXP: ngưỡng tích luỹ `[0, 30, 80, 150, 240, 350, 480, 630, 800,
  1000]` (Lv 1–10). Level có thể giảm khi EXP bị thu hồi; giai đoạn và cấp kỹ
  năng (`0` <Lv5, `1` Lv5–7, `2` Lv8+) luôn theo Level hiện tại. Không xoá
  lịch sử.

## 6. Ánh xạ tài chính (adapter, không sửa Finance)

`financeAdapter.mjs` phân loại từng giao dịch:

| Giao dịch | Ghi chép ngày | Tác động chăm sóc |
|---|---|---|
| Chi thường, danh mục hệ thống | có | theo bảng dưới |
| Chi `loan_lending` (cho vay) | không | không |
| Thu `loan_repayment` (trả nợ) | không | không |
| Thu `expense_reimbursement` (hoàn tiền) | không | không |
| Thu thường | có | `mood` |
| Danh mục tự tạo / lạ | có | `neutral` |
| Đóng hộ (`sharedExpense`) | có (1 giao dịch) | theo danh mục, không nhân theo người |

Danh mục hệ thống → hiệu ứng: Ăn uống → `eat`, Mua sắm → `wardrobe`, Di
chuyển/Xăng xe → `move`, Sức khỏe → `heal`, Vui chơi → `mood`, Điện nước/Khác →
`neutral`. LifeMate không có danh mục Giáo dục hay chuyển khoản giữa tài khoản;
không tạo field mới cho chúng. Hiệu ứng trong ngày bị giới hạn 3 lần/loại.
Bảng ánh xạ nằm ở adapter, thêm danh mục không cần sửa engine.

## 7. Schema & migration

Migration `20261027181510_pixel_pet.sql` (chỉ thêm mới, không chạm bảng cũ):
`lifemate_pet_species` (15 hàng seed), `lifemate_pet_accounts`,
`lifemate_pet_adoptions`, `lifemate_pet_exp_grants`, `lifemate_pet_exp_ledger`,
`lifemate_pet_receipts`; RLS bật, revoke mọi quyền client; RPC
`security definer` chỉ cấp cho `service_role`. Rollback: drop các bảng/RPC
`lifemate_pet_*` (không ảnh hưởng dữ liệu khác). Không thêm collection/rule
Firestore. Triển khai migration theo lịch sử đã kiểm chứng, rồi deploy
`pet-access` và `user-admin`.

Production LifeMate đã áp dụng riêng migration `20261027181510_pixel_pet.sql`.
Migration `20261027181952_pixel_pet_fix_search_path.sql` cố định `search_path`
cho hai hàm Pet còn thiếu và cũng đã được áp dụng.
Migration game `20261027220000_south_instant_win_penalty.sql` vẫn đang chờ; kiểm tra
lịch sử và danh sách dry-run trước khi dùng `supabase db push` lần tiếp theo.
`pet-access` và bản `user-admin` có dọn Pet đã được triển khai trên Supabase.
Firebase tiếp tục cung cấp Auth và giao dịch Firestore hiện có; Pixel Pet không
thêm rules hoặc Cloud Function Firebase.

## 8. Ngoài phạm vi phiên bản này

Budget & Saving Goals; phụ kiện/tùy chỉnh trang phục (repo chưa có hệ thống
này — `wardrobe` chỉ là hiệu ứng hiển thị); asset pixel art hoàn thiện bởi họa sĩ
(bản đầu dùng lưới pixel tự vẽ theo rig ở trên).

## 9. Kiểm chứng

`npm run test:functions` (PGlite: 15/16 tài khoản, đồng thời, hết hạn, idempotency,
thu hồi + Level 1, ledger đối soát; engine EXP; adapter), Jest cho client
(catalog/rig khớp seed migration, renderer, màn hình), `npm run typecheck`,
ESLint các file đổi. PGlite chạy một kết nối nên đồng thời được kiểm tra qua
ràng buộc unique/khoá và replay tuần tự; cần smoke test trên Supabase thật sau
khi deploy.
