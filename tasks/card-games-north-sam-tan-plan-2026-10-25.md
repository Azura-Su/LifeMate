# Kế hoạch: Tiến lên miền Bắc, Sâm và Tấn

Ngày: 25/10/2026. Trạng thái: người dùng chọn profile đề xuất cho cả ba game;
cả ba vertical slice đã được tích hợp vào source và có test engine, room/SQL,
protocol, API, UI. Migration chưa deploy; phát hành cần rollout migration → Edge
→ app để capability v9 được áp dụng trước khi catalog mới tới người chơi.

## Mục tiêu

Thêm ba game online 2–4 người vào hệ thống phòng hiện tại, với engine luật riêng,
điểm nội bộ có quyết toán server, luật được công bố trong phòng và tương thích
ngược với Tiến lên miền Nam/Phỏm. Một game chỉ bật để tạo/tham gia phòng sau khi
engine, protocol, SQL, tính điểm, giao diện, reconnect và test đã hoàn thành.

Luật đề xuất chi tiết nằm ở [Miền Bắc](../SPEC-rules-tien-len-north.md),
[Sâm](../SPEC-rules-sam.md), [Tấn](../SPEC-rules-tan.md). Các trang luật công khai
là mô tả cộng đồng/phiên bản game, không có một tổ chức chuẩn hoá chung. Vì vậy
không lấy mức cược/phạt của cổng game và không biến đề xuất còn tranh cãi thành
luật đã chốt.

## Ràng buộc kiến trúc đã phát hiện

- Client và Edge chỉ nhận `south`/`phom`; game không hợp lệ bị từ chối. Client
  strict-parses snapshot game theo kind/version.
- `game-engines.mjs` dispatch engine theo `gameKind`; dữ liệu cũ thiếu kind
  fallback miền Nam. Không được thay đổi fallback đó.
- `rooms.mjs` hiện quyết toán mọi game không phải Phỏm theo công thức mỗi lá còn
  lại miền Nam. Phải chuyển sang adapter quyết toán theo kind trước khi thêm
  game, tránh vô tình cho Sâm/Tấn công thức miền Nam.
- SQL RPC / trigger có allowlist riêng cho kind, create/config và protocol
  capability. Cần migration additive, migration test và cập nhật Edge cùng client.
- Catalog, room create, luật, table render và actions đang hardcode miền Nam /
  Phỏm. Tấn có phase/action khác nên không ép vào API play/pass/card combination
  hiện hữu nếu làm mất ý nghĩa luật.

## Architecture decisions

1. Mỗi game là module engine độc lập; dùng chung deck primitives và room shell,
   nhưng không dùng chung luật bộ bài hay điểm.
2. `gameKind` và `rulesVersion` là discriminant bắt buộc ở dữ liệu mới; giữ
   fallback `undefined => south` chỉ cho record cũ. Từng match giữ cấu hình bất
   biến, snapshot parser strict theo kind.
3. Tách kết quả luật khỏi tiền/điểm hiển thị. Engine trả ranking/event breakdown;
   adapter server quyết toán zero-sum idempotently bằng `matchId` và lưu delta
   cùng kết quả. Không làm thay đổi số dư do người dùng sửa bảng điểm.
4. Thêm SQL migration mới; không sửa migration đã chạy, không ghi trực tiếp DB
   production trong công việc này.
5. Feature gate/capability chỉ tăng khi server, client và migration cùng sẵn
   sàng. Không cho client cũ ngồi vào room có protocol/game mới.
6. Không triển khai auto/bot/spectator, cược, tiền thật hoặc giải đấu trong phạm
   vi này.

## Luồng phụ thuộc

```text
Profile luật + event/result/score contract
                 ↓
        Engine thuần + test
                 ↓
       Adapter room + score
                 ↓
 Types/protocol + Edge validation
                 ↓
 Migration/RPC/trigger/capability
                 ↓
 Lobby, luật, bàn và action UI
                 ↓
 Reconnect/timeout, end-to-end, feature gate
```

Làm tuần tự theo game để mỗi checkpoint còn deployable, không mở đồng thời ba
contract backend. Miền Bắc là vertical slice đầu tiên vì gần engine miền Nam;
Sâm kế tiếp để tái sử dụng test/contract đã chứng minh; Tấn sau cùng vì state
machine attack/defend và điểm khác căn bản.

## Task list

Task checklist chi tiết và verification được ghi ở
[todo riêng cho feature](card-games-north-sam-tan-todo-2026-10-25.md). Không ghi
đè `tasks/plan.md` hoặc `tasks/todo.md` đang chứa công việc khác.

### Phase 0 — chốt profile và contracts

- [x] Rà North/Sâm/Tấn: bộ bài, deal, combo, opening, thứ tự chất, chặn, bỏ lượt,
  đặc biệt, kết thúc, timeout/rời phòng, điểm; đánh dấu evidence và variant.
- [x] Người dùng chọn profile luật nền đề xuất cho cả ba game ngày 25/10/2026;
  điểm v1 không dùng cược.
- [x] Chốt action schemas, result/event DTO và protocol capability riêng theo
  game, giữ backward compatibility.
- [x] Chỉ cho phép tạo/vào variant room với protocol 9; client cũ bị từ chối
  trước khi thay đổi seat, lease hoặc controller.

### Checkpoint 0

- [x] Reviewer đồng ý không có việc ghi đè contract cũ / scoring South / client
  capability; các quyết định còn mở được ghi rõ trong spec.
- [x] Làm rõ ngoại lệ so chất cho hai lá 2 và chuyển lượt mở khi người đánh
  cuối hết bài/bỏ ván; giữ comparator unresolved ngoài các trường hợp này gated.

### Phase 1 — Tiến lên miền Bắc

- [x] Classifier/comparator và test thuần `north-v1`, bao gồm cùng màu/chất,
  sảnh, 3♠ mở, 2/tứ quý, bỏ lượt, hết bài và bất biến không mutate.
- [x] Pure engine deal/play/pass/timeout/forfeit/result với state server authoritative.
- [x] Nối engine vào room dispatch và settlement riêng; test rematch/leave/room lifecycle.
- [x] Adapter ranking/score zero-sum; không import `settleConfiguredSouth`.
- [x] Client types, strict snapshot parser, action validation và server validator.
- [x] Migration additive cho create/config/trigger/capability; migration/RPC test.
- [x] Catalog, create/join, rules modal, bàn, lịch sử/kết quả, xoay dọc/ngang.
- [x] Reconnect, stale version, multiple action/receipt, timeout và room lifecycle.

### Checkpoint 1 — North playable

- [x] Regression rules+functions, SQL/RLS, TypeScript, lint; test client room/lobby
  và protocol. Không bật UI trước khi toàn bộ pass.

### Phase 2 — Sâm

- [x] Engine riêng với 10 lá, không so chất, báo Sâm/success/fail và luật báo một
  theo profile đã chọn.
- [x] Score adapter riêng, config/version, protocol/SQL/capability, UI và e2e.
- [ ] Không áp phí/thối/đền từ các nguồn cược; điểm zero-sum theo config LifeMate.

### Checkpoint 2 — Sâm playable

- [x] Test regular, called Sâm win/fail, multiple call ordering, one-card warning,
  timeout/forfeit, settlement idempotency và backward compatibility.

### Phase 3 — Tấn

- [x] Chốt profile Việt Nam: attack participants, hand refill/order, transfer,
  stock/trump, final loser/winner/ranking và scoring.
- [x] State machine riêng cho attack/defend/take/finish-attack/refill/stock-empty;
  mỗi transition có test và không rò hidden cards.
- [x] Score contract, protocol/action DTO, SQL migration, capability, UI board có
  khu vực trump/stock/table, reconnect và e2e.

### Checkpoint 3 — Tấn playable

- [x] Test luật attack/defend/throw-in/transfer theo profile, hết nọc, người hết
  bài, timeout/forfeit, settlement và room lifecycle.

### Phase 4 — phát hành nội bộ

- [x] Chạy full regression sau sửa cuối: `npm run test:functions`, Jest game-related,
  `npm run typecheck`, affected ESLint, SQL migration tests, `git diff --check`.
- [x] Rà final diff bằng reviewer, không còn finding cần xử lý.
- [ ] Rollout production theo thứ tự migration → Edge → app; chờ lệnh deploy
  riêng. Không bật feature trước khi server và client capability khớp.

## Rủi ro và cách giảm

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Luật địa phương khác profile mặc định | Người chơi bị xử thua oan | Công khai rules version, test luật table-driven, không bật game khi lựa chọn trọng yếu chưa chốt |
| generic room score xử lý sai North/Sâm/Tấn | Sai balance/history | Scoring adapter exhaustive theo gameKind; unknown kind từ chối, record cũ chỉ fallback South |
| client cũ ghi/parse sai state mới | Corrupt state hoặc lộ bài | capability/version gate tại Edge và SQL; parser strict; test client cũ |
| Tấn dùng nhầm Durak | State machine sai trải nghiệm | Coi Durak là họ luật tham khảo; chốt profile Việt Nam từng phase, action và giới hạn |
| ba feature cùng đổi SQL/protocol | migration khó rollback | rollout từng game, migration additive và capability tăng theo checkpoint |
| AI tính điểm dựa vào luật cược | biến điểm nội bộ thành mô hình cược | không dùng đơn vị cược; điểm đơn giản, zero-sum, config có thể đọc trong phòng |

## Quyết định product đã nhận

Ngày 25/10/2026, người dùng chọn dùng profile đề xuất trong cả ba SPEC. Vì vậy:

- North dùng profile North v1, gồm cùng chất cho lá lẻ thường, ngoại lệ 2 theo
  chất, tứ quý chặt 2/tứ quý thấp hơn, không cược và 1 điểm mỗi lá còn.
- Sâm dùng 10 lá, không so chất, có giai đoạn báo Sâm trước nước đầu; báo một
  chỉ là thông tin. Không có điểm thưởng/phạt riêng cho báo Sâm, báo một hoặc
  thối 2; điểm theo số lá còn.
- Tấn dùng profile 8 lá/chất chủ; tất cả người ngoài người đỡ có thể tấn thêm
  theo hạng, không chuyển tấn, người cuối còn bài thua. Nếu người thua còn `R`
  lá trong bàn `N` người, người đó trừ `R × (N-1)` điểm và mỗi người đã thoát
  cộng `R` điểm.

Contracts và implementation đã hoàn thành trong source. Việc còn lại trong task
là full regression cuối và final review. Production migration, Edge, native app
và smoke test thiết bị chưa được deploy/chạy trong thay đổi này.

## Plan review

Reviewer xác nhận có thể tiến hành classifier/opening core. Hai finding đã xử
lý trong spec: so 2 theo chất (các hạng thường vẫn theo luật cùng chất) và
chuyển lượt mở vòng sang ghế hoạt động tiếp theo sau người đánh cuối nếu họ đã
hết bài/bỏ ván. Diff review sau implementation xác nhận module độc lập, không có
production caller và không đổi South/room; finding về tứ quý cao hơn đã giải
quyết bằng cách ghi rõ profile đề xuất bật chặt tứ quý thấp hơn. Finding rematch
khi người thắng cũ rời phòng được giải quyết bằng fallback về lá mở thấp nhất.
