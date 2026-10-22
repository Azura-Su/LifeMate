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

Fresh local reset also needs a working Supabase local configuration and Docker. These prerequisites are unavailable in the current shell, so this change validates filename uniqueness/order, not a full fresh PostgreSQL reset.

## Prepared game status fix — 22/10/2026

`20261022040203_card_game_empty_room_rejoin_status.sql` replaces only the status RPC,
aligning `canRejoin` with the existing owner-first rule for empty live rooms. It retains
the same signature, account checks and service-only grants; no stored room data changes.
It is validated with the full game migration chain in PGlite and is **not yet applied to production**.
Before rollout, verify the installed status definition and migration history as above;
apply this one migration without replaying unrelated pending files. See
[fix verification](../tasks/card-games-score-review-fixes-2026-10-22.md).
