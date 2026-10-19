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

Fresh local reset also needs a working Supabase local configuration and Docker. These prerequisites are unavailable in the current shell, so this change validates filename uniqueness/order, not a full fresh PostgreSQL reset.
