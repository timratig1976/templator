# Frontend Tests (Consolidated)

All frontend tests live under this directory after Phase 2 consolidation.

- Place unit/component tests anywhere under this folder.
- Suggested structure:
  - `components/` for component tests
  - `pages/` for Next.js pages
  - `hooks/` for custom hooks
  - `smoke/` for lightweight sanity tests

Naming:
- Use `*.test.tsx` or `*.test.ts` (Jest `testMatch` supports ts/tsx/js/jsx).

Jest config:
- Defined in `frontend/jest.config.js`
- Discovers tests here via `testMatch` and includes this folder in `roots`.
- Coverage is written to `reports/tests/frontend/coverage` at the repo root.
