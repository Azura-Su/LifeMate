# Migration versions and existing databases

`202610140001` belongs only to `memory_r2.sql`. `preserve_memory_invites.sql` is now `202610140003`; its SQL is unchanged. The order is sharing130001 → R2140001 → cleanup140002 → invites140003 → later16000x migrations. `npm run test:functions` checks unique versions and R2 dependency order.

## Existing deployments

Before `db push`, inspect migration history and actual schema, with a database backup. Do not assume a recorded version identifies both old files.

```sql
select to_regclass('supabase_migrations.schema_migrations') as migration_history;
-- Only when that relation exists:
select version, name, statements
from supabase_migrations.schema_migrations
order by version;
```

If history records140001 for memory_r2 and the invitation fix already exists, verify its function definition against140003, then record140003 as applied. If history records140001 for invitations, first inspect columns/RPCs to establish whether memory_r2 was actually applied; correct the history mapping before recording either version. Do not mark unapplied SQL as applied. Use the installed CLI's `migration repair <version> --status applied|reverted` only for the verified mapping; repair changes history rather than executing the migration. Keep a copy of the prior history and recheck `migration list`/`db push --dry-run` before push.

On17/10/2026, read-only SQL Editor check of production project `xbhelntqytleiduzicuj` returned NULL for that relation, consistent with earlier manual SQL deployments. There was no conflicting history row to repair. No production history or schema was changed for this audit. Before adopting CLI push on this manually managed database, compare **every** migration with its actual schema/functions/policies and establish an accurate baseline; do not replay all historical SQL or mark everything applied blindly.

Ngày 19/10/2026, ba migration game `202610190003_card_game_rooms.sql`, `202610190004_card_game_deadlines.sql` và `202610190005_card_game_closed_cleanup.sql` được áp dụng riêng lên production. Migration 005 và schedule cập nhật giữ worker cleanup hoạt động khi mode closed. Chưa tạo hay sửa bảng `supabase_migrations.schema_migrations`; đây vẫn là deployment thủ công cần đối chiếu trước khi dùng `db push`.

Ngày 22/10/2026, kiểm tra production thấy bảng lịch sử đã tồn tại và có phiên bản `20261019155814` (card_game_closed_cleanup). Định nghĩa các RPC game khớp source đến money-score `202610200001`, dù lịch sử các migration thủ công trước đó chưa đầy đủ. Đã áp dụng riêng và ghi đúng bảy phiên bản game: `20261020092913`, `20261020120000`, `20261020234500`, `20261021083000`, `20261021100000`, `20261021130000`, `20261021130001`. Không ghi nhận bừa các phiên bản trước đó hoặc chạy `db push` toàn repo. Xem [báo cáo rollout](../tasks/card-room-cloud-repair-2026-10-22.md).

Ngày 23/10/2026 đã đối chiếu định nghĩa RPC thực tế, áp dụng riêng
`20261022110124_card_room_member_management.sql` và ghi đúng phiên bản đó trong
cùng transaction. `game-access` v9 bổ sung kick/notice/recovery; không áp dụng các
migration bảng điểm, memory hoặc Phỏm đang chờ. Kiểm chứng SQL production dùng
fixture rollback, không còn ghế/receipt thử nghiệm. Xem
[báo cáo kích người](../tasks/card-room-kick-deploy-2026-10-23.md).

Sau đó cùng ngày đã deploy `game-access` v10 hỗ trợ hai engine, chờ worker v9
kết thúc rồi áp dụng riêng và ghi đúng `20261022185526` (score patch) và
`20261022194436` (Phỏm) trong một transaction. Migration patch chứa luôn hành vi
xóa bảng điểm terminal; migration Phỏm chứa luôn status owner-first cho phòng
rỗng. Không đánh dấu hai migration trung gian bị thay thế là đã chạy. Xem
[báo cáo Phỏm](../tasks/phom-cloud-deploy-2026-10-23.md).

Tiếp theo đã deploy Edge v11 hỗ trợ South cấu hình và chờ hơn410 giây trước khi
bật RPC. CLI vừa cập nhật nhưng không còn token, nên dùng connector Supabase
đang xác thực để apply migration đã review. Connector ghi phiên bản thực
`20261023112114`; đã đổi tên file local sang phiên bản đó, giữ nguyên SQL body và
cập nhật đường dẫn test. Phiên bản tạo nháp bằng CLI `20261023105700` không được
ghi nhận là đã chạy. Sáu ván fixture PostgreSQL đã rollback, điểm từng người và
retry đạt; không đổi các phòng/điểm thật.

Fresh local reset also needs a working Supabase local configuration and Docker. These prerequisites are unavailable in the current shell, so this change validates filename uniqueness/order, not a full fresh PostgreSQL reset.

## Prepared game status fix — 22/10/2026

`20261022040203_card_game_empty_room_rejoin_status.sql` replaces only the status RPC,
aligning `canRejoin` with the existing owner-first rule for empty live rooms. It retains
the same signature, account checks and service-only grants; no stored room data changes.
It was validated with the full game migration chain in PGlite. Its behavior was
subsequently included in the Phỏm status replacement applied on23/10/2026;
this intermediate version was not applied or recorded separately. Do not replay
it over the newer Phỏm-aware status function. See
[fix verification](../tasks/card-games-score-review-fixes-2026-10-22.md).

### Sửa luật trong phòng — 23/10/2026

- Remote apply bằng connector: `20261023122005_inroom_south_rules.sql`; file
  local đổi tên theo phiên bản thật (draft CLI `20261023114222` chưa apply).
- Edge game-access v12 triển khai 12:13:00UTC, migration bật sau 12:20:01UTC
  (>410s). Guard fingerprint bốn RPC/trigger và lịch sử12 migration trước DDL.
- 18 file source đọc lại khớp bundle. 6 fixture2/3/4 người ×2 chế độ chạy bằng
  RPC PostgreSQL thật và rollback; kiểm tra tiền ván cũ, phí chặt, pending
  promotion, trở về mặc định, receipt retry và session fence. Không đụng
  dữ liệu tài khoản thật. Backup tại `/private/tmp/lifemate-inroom-deploy-20261023`.

### Sửa luật Phỏm trong phòng — 23/10/2026

- `20261023151401_game_takeover_capability.sql`: chỉ thêm overload5tham số,
  giữ4tham số đang chạy. Localdraft20261023150817 đổi tên theo timestamp thật.
- Edgegame-accessv13 triển khai15:14:07UTC,18file đọc lại khớp; đợi414s, không
  thấy phiênv12mới tronglog rồi bật `20261023152105_inroom_phom_rules.sql` lúc
 15:21:05UTC. Localdraft20261023150905 đổi tên theo versionthật, SQLbody giữ nguyên.
- Guard40functionschema trướcprerequisite,14migration/fingerprint5function trước
  final. Không dùng dbpush toàn bộ migration lịch sử chưa đồng nhất.
- Phỏm RPC rollback fixture3bàn/46bước/6kết quả đạt trênPostgreSQLthật; không
  còn dữliệu thử. ACL service-only, modeopen/cronactive vàauth vẫn401. Backup
  `/private/tmp/lifemate-inroom-phom-deploy-20261023`.

## Phỏm optional rules — 23/10/2026

- `20261023154433_phom_options_capability`: additive takeover accepts1..7, requires7 for config options; old strict config validator remains in place.
- Edge `game-access` v14 deployed at15:44:43UTC. All18 files read back equal to deployment payload; four engine/handler/snapshot files changed from v13.
- `20261023155152_phom_optional_rules`: config validator accepts exact optional three booleans and status advertises minimum7. Activated after421seconds of execution drain.
- CLI-created drafts were renamed to actual connector timestamps; no unapplied draft history was inserted. Rollback fixture checked3 rooms,46 steps,6 results; all rolled back.

## Phỏm rule-edit capability guard — 23/10/2026

- `20261023163323_phom_rules_capability_guard`: mandatory-version overload checks current, pending and incoming options under the room lock; the old signature uses a conservative compatibility wrapper. Both signatures remain service-only.
- Migration applied before `game-access` v15 (16:33:30UTC). All18 deployed files read back equal to payload; only handler changed from v14. JWT mode preserved because Firebase verification remains in the function body.
- PostgreSQL rollback probe passed current/pending/incoming denial without mutation, both signatures, legacy/v7 edits, receipt recovery and ACL. No probe rooms, seats or receipts remain; mode open and deadline cron active.
- CLI draft `20261023162857` renamed to the actual connector timestamp; SQL unchanged. Backup and verification fixture: `/private/tmp/lifemate-phom-capability-fix-20261023`.

## Game/pet release audit — 30/10/2026 (UTC+7)

- Production `game-access` v19 lacked the local capability-12 implementation.
  Deployed v20 and read back all22 source files; they match the deployment payload.
  Existing Firebase verification and JWT mode are unchanged. `pet-access` v3 and
  `user-admin` v14 already match local source and were not redeployed.
- Waited more than459 seconds for the old game worker execution window before
  applying the two reviewed migrations separately, with function fingerprint and
  service-only ACL guards. No full-repository `db push` was used.
- Connector-recorded versions are `20261029191125_south_instant_win_penalty.sql`
  and `20261029191148_preserve_explicit_ownerless_rooms.sql`. Local draft versions
  `20261027220000` and `20261029022648` were renamed to those actual versions;
  their SQL bodies are unchanged and test paths were updated. Draft versions were
  not marked as applied.
- Rechecked function definitions, existing security-definer settings, empty
  search paths, service-only grants and active deadline cron. The four-argument
  takeover compatibility wrapper remains unchanged. Backups and private deploy
  logs are under `/tmp/lifemate-release-20261030` on the deployment machine.
- See [release verification](../tasks/review-pets-games-2026-10-30.md) for checks,
  review findings and the native-app distribution limitation.
