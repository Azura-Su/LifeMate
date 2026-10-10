# Todo: Bảng điểm bài dùng chung

- [x] Use a shared score model with an optional table/game title.
- [x] Keep records encrypted, account-scoped, and migratable from the previous mode-specific shape.
- [x] Add the generic `Ghi điểm bài` drawer action.
- [x] Build the player-by-round matrix and numeric keypad entry flow.
- [x] Expand columns to fill short tables, and highlight non-zero round sums in red.
- [x] Allow multiple active tables, and switch between their scoreboards.
- [x] Add an × close control to the create-table dialog and remove the introductory note card.
- [x] Support editing/deleting rounds, random seating/dealer, finishing, and history.
- [x] Run focused and full automated checks after this UI update.
- [ ] Verify the flow on an iOS simulator; the previous simulator attempt was blocked by CoreSimulatorService.

## UI review follow-up — 2026-10-11

- [x] Move `Thêm người` next to the selected-table summary and keep `Bàn mới` with the table selector.
- [x] Make quick score content scroll vertically on short screens while keeping its save controls visible.
- [x] Increase the round-delete hit area without disrupting the two-player matrix layout.
- [x] Run the full test suite, typecheck, lint, and formatting checks.
- [ ] Verify the updated UI on the iOS simulator.

The Simulator window is still showing the prior bundle. `simctl` reports that CoreSimulatorService is unavailable, so reload-based visual verification remains pending.
