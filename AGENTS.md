# LifeMate

Follow the global coding workflow; use this file for repository-specific context.
This is an Expo / React Native TypeScript application. Inspect the relevant feature
under `src/`, its tests, and the matching `SPEC-*.md` section before changing behavior.
Use `package.json` and the lockfile as the source of dependency versions. Inspect
Firebase, Supabase, server, or native code only when the task affects those paths.

Reuse existing state, navigation, service, and UI patterns. Preserve platform
behavior and existing data contracts. Do not hand-edit generated builds, vendored
dependencies, or lockfiles unless required by an intentional dependency change.
Never expose `.env` contents or credentials.

Verification depends on the changed paths:
- TypeScript: `npm run typecheck`; lint affected files with the existing ESLint setup.
- App behavior: targeted Jest tests with `npm test -- --runTestsByPath <test-path>`.
- Supabase functions: `npm run test:functions`.
- Firestore rules: `npm run test:rules` (requires the emulator prerequisites).
- Native/runtime changes: validate the affected platform when available.

Consult the read-only reviewer before finalizing high-risk changes, including
authentication, access rules, financial calculations, persisted data, and migrations;
request plan review before implementation and final diff review for those changes.
Report unavailable checks and existing failures without weakening validation.
