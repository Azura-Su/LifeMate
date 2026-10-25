# TODO — Cấu hình phòng miền Bắc, Sâm và Tấn

Kế hoạch chính: [variant-room-configuration-plan-2026-10-25.md](variant-room-configuration-plan-2026-10-25.md)

## Trước khi code

- [x] Người dùng chọn profile đề xuất; config v1 chỉ gồm điểm/lá, không thêm
  lựa chọn biến thể
  luật; chốt nhãn điểm và xác minh giới hạn integer an toàn (đề xuất 1 đến
  1.000.000.000, mặc định 1).
- [x] Reviewer độc lập rà schema, compatibility, migration/capability và thứ tự
  triển khai; đã bổ sung quyền `ownerUid`, ready/config race, settlement forfeit
  của Tấn, và legacy multiplier = 1.
- [x] Cập nhật SPEC miền Bắc/Sâm/Tấn về config phòng.

## Task 1 — Model cấu hình và validate boundary

- [x] Thêm config union/defaults/type-safe validators cho ba game; phòng variant
  cũ mặc định multiplier = 1, không đọc `amountPerCard` legacy.
- [x] Thêm create/action DTO và strict snapshot parser; định nghĩa default cho
  room legacy chưa có config.
- [x] Kiểm thử default, biên số, field lạ, nhầm gameKind và config không hợp lệ.

**File dự kiến:** `src/types/cardGame.ts`, `src/services/cardGames/variantGameProtocol.ts`,
`src/services/cardGames/gameProtocol.ts`, `supabase/functions/game-access/handler.mjs`.

## Task 2 — Tạo phòng có cài đặt

- [x] Thêm cấu hình vào mode tạo cho từng game; mode tham gia chỉ hiện ô mã.
- [x] Submit gửi đúng config và kiểm tra hợp lệ trước khi bật nút.
- [x] Kiểm tra flow tạo/tham gia, không gửi cấu hình từ form tạo khi tham gia.

**File dự kiến:** `VariantGameEntry.tsx`, `CardGamesScreen.tsx`, settings component/style,
`CardGamesScreen.test.tsx` và test riêng cho entry.

## Task 3 — Lưu config authoritative và tính điểm

- [x] Engine start/rematch nhận config đã được server đọc từ room state.
- [x] Settlement dùng multiplier được pin theo ván, giữ zero-sum/idempotency.
- [x] Migration additive xác thực, lưu và khóa config; chỉ `ownerUid` authoritative
  có thể cập nhật; client cũ bị chặn trước khi seat/takeover/ready đối với phòng
  cần capability mới.
- [x] Giữ policy Tấn hiện tại: forfeited players nhận 0 và không tham gia nhóm
  chia điểm; test cả multiplier và draw/cancellation.
- [x] Test Edge/RPC, migration, scoring, CAS/replay, old client và South/Phỏm.

**File dự kiến:** `game-engines.mjs`, ba engine variant, `rooms.mjs`, `handler.mjs`,
migration mới, `game-database.test.mjs`, `game-rooms.test.mjs`, test engine.

## Task 4 — Sửa luật ván tới trong phòng

- [x] Thêm typed setting action và next-config trong snapshot.
- [x] Dialog hiện đúng cấu hình theo game; chỉ chủ phòng có quyền lưu.
- [x] Save dùng CAS, stale draft có thể tải lại; rematch mới promote config.
- [x] Bảo vệ race giữa lần save config đầu tiên và ready cuối; từ chối ready stale
  hoặc rebase có điều kiện, không bắt đầu ván với config cũ.
- [x] Test không đổi ván hiện tại, ready reset, quyền owner và rematch.

**File dự kiến:** `cardGame.ts`, `CardRoomRulesDialog.tsx`, `CardGameRules.tsx`,
`CardGamesScreen.tsx`, `gameSession.ts`, `handler.mjs`, `rooms.mjs`, migration và test.

## Task 5 — Kết quả, reconnect và polish

- [x] Hiển thị điểm theo đơn vị “điểm” cho ba game, gồm số dư, delta, kết quả
  Tấn, và cấu hình hiện tại/ván tới.
- [x] Reconnect/reopen giữ đúng `gameKind` và config; parser mặc định room cũ = 1.
- [x] Rà form dọc/ngang, keyboard number-pad, accessibility label và trạng thái lỗi.

## Checkpoint phát hành

- [x] `npm run typecheck`, ESLint file liên quan, 187 Jest tests, 344 function
  tests, `git diff --check` đều đạt.
- [x] Reviewer final diff không còn finding; migration và capability được kiểm
  chứng bằng DB/Edge integration tests.
- [x] Production backend: ba migration và Edge Function đã triển khai; đối chiếu
  source đang chạy khớp bản local.
- [ ] Phát hành app và smoke test 2–4 người/game trên thiết bị.
