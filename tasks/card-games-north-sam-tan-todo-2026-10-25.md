# TODO — Tiến lên miền Bắc, Sâm và Tấn

Phạm vi luật và kiến trúc được ghi trong
[plan](card-games-north-sam-tan-plan-2026-10-25.md) và ba SPEC riêng.

## Phase 0 — luật và contract

- [x] Đối chiếu luật công khai, ghi rõ các khác biệt theo vùng và chốt profile
  đề xuất cùng người dùng cho `north-v1`, `sam-v1`, `tan-v1`.
- [x] Rà kiến trúc engine, scoring, Edge, SQL, protocol, catalog, UI và migration.
- [x] Reviewer rà plan trước implementation; chốt comparator lá 2, ghế mở vòng
  tiếp và response snapshot cho action đã commit.
- [x] Định nghĩa view/action DTO, result, protocol v9 và khả năng tương thích.

## Phase 1 — Tiến lên miền Bắc

- [x] Engine riêng: chia, tổ hợp, chặn, mở ván, bỏ lượt, timeout, bỏ cuộc và
  view riêng tư; kiểm tra bất biến bộ bài.
- [x] Tích hợp room, rematch và tính điểm zero-sum theo số lá còn.
- [x] Tích hợp strict parser, hành động UI, luật, tạo/vào phòng và bàn hiện có.
- [x] Từ chối client cũ trước thao tác ghế/lease; pin game kind và rules version.
- [x] Kiểm tra engine, room lifecycle, timeout, điểm và parser.

## Phase 2 — Sâm

- [x] Engine 10 lá, báo Sâm theo thứ tự, báo Sâm thành công/thất bại, báo một,
  chặn theo hạng, timeout và bỏ cuộc.
- [x] Tính điểm server zero-sum theo số lá còn, không thêm phạt riêng.
- [x] Tích hợp action protocol v9, strict parser, lobby, luật và bàn chơi.
- [x] Kiểm tra call/pass, người báo rời phòng, thắng/thua khi báo, kết quả và
  quyền riêng tư snapshot.

## Phase 3 — Tấn

- [x] State machine 8 lá, chất chủ, tấn thêm, đỡ/nhận, rút nọc, timeout,
  bỏ cuộc và người giữ bài cuối thua.
- [x] Tính điểm zero-sum theo profile Tấn v1; kiểm tra hết nọc và nhiều người.
- [x] Tích hợp action protocol v9, strict parser, bàn riêng và bố cục ngang/dọc.
- [x] Kiểm tra giới hạn tấn, thứ tự rút, lá chủ cuối nọc, chặn và bảo toàn 52 lá.

## Phase 4 — hoàn tất code và phát hành

- [x] Chạy full regression sau các sửa đổi cuối, `git diff --check` và final
  reviewer diff review.
- [x] Thêm migration additive và SQL/Edge tests cho create, join, takeover,
  reopen, rules version, CAS, deadline, idempotency và old-client fence.
- [x] Thêm client API/protocol/session/UI tests; TypeScript và affected ESLint
  đã chạy.
- [x] Backend production: đã áp dụng ba migration và deploy `game-access`;
  source production khớp đủ 22 file của bản được review.
- [ ] Phát hành client iOS/Android; dự án chưa có EAS/Expo OTA.
- [ ] Native smoke test trên iOS/Android với 2–4 thiết bị sau rollout.

## Verification đã chạy

- `npm run typecheck`
- Jest game/protocol/API/session/UI suites và CardScore room-entry suite.
- `npm run test:functions`: 337 passed, 0 failed.
- Jest game, protocol, API, session, cache, UI và CardScore room-entry suites:
  chạy lại sau các sửa cuối; toàn bộ pass.
- `npm run typecheck`, ESLint trên các file TypeScript thay đổi và
  `git diff --check`: pass.
- Reviewer final diff review: không còn finding cần xử lý.
