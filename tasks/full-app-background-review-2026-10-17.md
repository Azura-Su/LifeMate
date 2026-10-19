# Whole-app background/resource review — 17/10/2026

Scope: background energy/resource behavior across Home, Agenda, Finance/Loans/Held Money, Notes, Checklists, Card Score, Memories, MP3, Profile, User Management, bootstrap/auth/push, persistence/network services and app-owned native audio engines. This is not a proof of all feature/security correctness.

## Findings

### P2 — Redundant encrypted full-cache writes during unchanged memory sync
- src/services/memories/memoryStorage.ts:599 persists the entire cache for each confirmed item even when current cloud content/revision and local backup proof match; line707 writes it again. writeSyncCache502-504 sorts, serializes and encrypts the full library.
- Reviewer executed a read-only VM harness using TypeScript transpilation of the actual service, mocked imports and no filesystem/cloud mutations. 10 confirmed unchanged items:11 fullCacheWrites,31361 serializedBytes,10 local photo checks,0 remote commits. Canonical returned data unchanged. Necessary persistence for this case:0.
- Work grows quadratically with library size. This is measured write/serialization amplification, not measured native AES time, CPU, battery or temperature.
- Skip unchanged replacements/writes, including unchanged local proof; retain durable per-item checkpoints for real changes, pending intents and transfers/deletions. Add no-op-sync zero-write regression.

### P3 — Library marquee not gated by screen/app activity
- Mp3Library.tsx310 passes activeTitleId to title animation without visibility gating. AudioTrackTitle.tsx31-54 keeps its looping animation enabled while active or hovered; hovering can bypass a false active prop.
- Trigger: activate an overflowing library title, then background app; current queue-screen lifecycle test does not mount this library branch.
- Gate the final running predicate by screen/app visibility. Test activated and hovered title background cleanup.

### P3 — Profile countdown interval remains scheduled needlessly
- ProfileEmailVerification.tsx88-93 creates a one-second interval for the component's entire mounted lifetime, regardless of cooldown/verified/foreground. Its active ref tracks mount/UID, not AppState. ProfileScreen checks navigation focus, which can remain true in background.
- Stop ticking while inactive/background and whenever cooldown is zero/verified; calculate remaining time on foreground.
- MemoryFriendsModal countdown also ignores foreground while visible, but is bounded by its60s cooldown. It belongs in the same timer-policy cleanup, with lower impact than a perpetual interval.

These lifecycle gaps establish scheduled/enabled work; iOS may suspend JS/animations. No direct thermal attribution is established.

## Other inspected paths
- Camera: current local caller/strict hook unmount on inactive, background, editor or tab blur. Installed native Expo Camera additionally stops capture session on background and cleans motion/session on view removal. Latest changes are unshipped.
- MP3 queue: progress subscription/record animation/main title are foreground gated; requested background playback and auto-advance are intentional. keepAudioSessionActive retains the iOS session on pause/stop: profiling candidate, not proven thermal bug. No speculative playback-policy change.
- Bootstrap avatar/recovery polling checks active state, avatar store has TTL/deduplication. Auth/access/push subscriptions have session cleanup; headless push avoids mounting the main app.
- Memories: snapshot listener debounced and detached when inactive; no perpetual feedback loop found because no-op sync commits nothing remotely. In-flight sync/transfers may finish after departure; finite work.
- Finance/Agenda/Notes/Checklists/Card Score: finite loads, queued persistence and user-triggered operations; no background polling/render loop found.
- Home: midnight update and short toast timer are finite; no recurring fast loop.
- Native audio export: starts only by explicit import/edit/merge operations, bounds segments/duration and supports cancellation; no idle engine loop/foreground worker found. Keep-awake scoped to explicit audio job and released in finally.

## Validation and limits
- Ran npm run lint for the entire repository:passed.
- Most recent full application run before this review:98 suites,606 tests passed; no production code was changed in this review. Reviewers did not rerun broad tests.
- Physical iPhones are offline in Instruments inventory; affected TestFlight build source and energy trace unavailable. No CPU/thermal reduction or definitive cause claim.
- Findings were independently reviewed in separate UI and service scopes. No new deployment, account-data mutation, dependency or native-source change.
