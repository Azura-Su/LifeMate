# Text-only memory editing and photo delete button — 17/10/2026

User request: only edit the memory text; place delete at the photo's top-right.

- Existing-memory form contains heading, text/counter and Save. No photo preview/retake or sharing picker. Edit payload always keeps the entry's date/photo and the visibility captured on opening; creation keeps its photo and sharing controls. Edit no longer reads image dimensions.
- Delete reuses the existing confirmation handler, displayed above the photo/loading layer in a44pt round button at top/right8. Valid legacy entries without a photo keep a footer delete control.
- Legacy photoless text edits are allowed when nonempty. Empty submissions fail before any unshare/network side effect. Creation still requires a photo.
- Independent reviewer plan/final review completed; fixed findings concerning unverified-email edit availability and early validation before unsharing. Sharing permission controls keep their existing verification gate; private editing remains available when state cannot load.
- Red behavioral tests reproduced editable photo/visibility controls and inability to save legacy photoless text. New editor tests cover private/shared payload retention, background visibility prop changes, creation controls and retry. Real-storage tests verify legacy text persistence and no unshare on empty validation. Screen regression covers editing without verified sharing state.
- Focused44 tests passed; typecheck, affected ESLint and diff whitespace checks passed. Native iOS opened/closed text-only form and verified top-right delete position without saving or deleting real data.
- Screenshots: /tmp/lifemate-memory-delete-on-photo.png and /tmp/lifemate-memory-text-only-editor.png.

No backend/rules/dependencies or deletion semantics changed. Existing queued save/revoke/republish and rollback architecture preserved. No app release, commit or push performed; prior working-tree edits retained.

Final full Jest run:97 suites,576 tests passed (`--watchman=false`).
