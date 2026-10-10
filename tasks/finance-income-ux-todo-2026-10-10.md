# Checklist: Finance form and company income reporting

## Slice 1: Finance data and preferences

- [x] Add default expense categories “Điện nước” and “Xăng xe”.
- [x] Treat legacy income records as company income and preserve source on writes.
- [x] Add migration/storage regression tests.

## Slice 2: Transaction form

- [x] Add plus-triggered category and template creation controls.
- [x] Show only templates for the selected transaction type.
- [x] Remove footer Cancel and gate save on valid amount, date, and category.
- [x] Cover expense and income form behavior in tests.

## Slice 3: Income reporting

- [x] Add company/other source selection for income.
- [x] Add company income totals and category breakdown to reports.
- [x] Verify filtering and existing totals across periods.

## Final checks

- [x] Focused and full test suites pass (59 suites, 283 tests).
- [x] Typecheck, lint, formatting check, bundle export, and diff check pass.
- [x] Review task-related changes; unrelated uncommitted work remains untouched.
