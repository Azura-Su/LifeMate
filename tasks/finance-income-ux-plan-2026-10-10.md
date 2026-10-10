# Plan: Finance form and company income reporting

## Goal

Make transaction entry compact and clear, keep expense and income templates separate, and distinguish company income from other income. Existing income records are interpreted as company income because the user confirmed every saved income item is salary/bonus from the company.

## Decisions

- Keep templates in the current typed collection (`type: income | expense`) and show only templates matching the selected form type.
- Add `incomeSource: company | other` to income transactions. When reading older income without this field, normalize it to `company`; expenses remain unchanged.
- Preserve the existing report totals while adding an explicit company-income breakdown for the selected period.
- Keep category and template creation hidden until their `+` controls are pressed. The dialog header remains the dismiss action after removing the footer Cancel button.

## Tasks

### Slice 1: Finance data and preferences

- [x] Add default expense categories “Điện nước” and “Xăng xe”.
- [x] Treat old income without a source as company income; persist source on newly created/edited transactions.
- [x] Add regression tests for legacy parsing and source persistence.

### Slice 2: Transaction form

- [x] Reveal category and template inputs from compact `+` controls.
- [x] Filter templates by selected income/expense type and scope duplicate names by type.
- [x] Remove the footer Cancel button and disable save until amount, date, and category are valid.
- [x] Add form behavior tests for both transaction types.

### Slice 3: Income reporting

- [x] Add company/other income source selection in the income form.
- [x] Show company income totals and category breakdown separately in income reports.
- [x] Verify legacy company classification, other-income separation, and period calculations.

## Verification

- Focused finance preference, storage, utility, and screen tests pass; full suite passes (59 suites, 283 tests).
- Typecheck, lint, Prettier check, `git diff --check`, and iOS/Android bundle export pass.
- Review the final diff to ensure unrelated existing workspace edits are untouched.

## Risks

- Older Firestore rows do not have a source field. Read normalization must treat only missing income sources as company income, while allowing explicitly marked outside income to remain separate.
- Existing finance files already contain unrelated uncommitted work; changes must remain additive and limited to this feature.
