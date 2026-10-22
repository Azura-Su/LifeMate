# Card game reliability and create-room UX checklist

- [x] Create pending and successful lobby use the same table-first UI; fix narrow-width ready footer clipping.
- [x] Update stale CardScore saves by merging latest online rounds and deletion tombstones inside the UID queue.
- [x] Freeze finished online score tables; create one new active table when the room match ID changes, with explicit history resume.
- [x] Normalize bad server names/deltas at sync boundary and preserve locally managed names.
- [x] Allow managing more than eight players on online tables; preserve removal tombstones.
- [x] Reconcile uncertain game actions from newer version/match snapshots and compare same-room versions before server time.
- [x] Unlock orientation on screen exit while preserving portrait lobby lock.
- [x] Extend room TTL on valid renewal and cover expiration/stale-session boundaries.
- [x] Ensure closing the room after final departure does not skip one-time result settlement.
- [x] Keep six-pairs rule as six distinct ranks per `SPEC-rules-tien-len-south.md`; fixture confirms four-of-a-kind is one rank.
- [x] Run focused Jest (67 tests), `npm run test:functions` (150 tests), typecheck, ESLint, Prettier, diff check, and final reviewer.
