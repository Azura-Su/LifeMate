# Compact visibility control and accurate loading status

- Reduced pill vertical padding to 4pt and visible minimum height to 28pt, retaining a 44pt touch target.
- Unknown visibility shows loading only while the state request is pending. Failed reads show an enabled retry control and a visible error on Mine; email verification continues through Friends.
- Successful responses with unreadable JSON now report incomplete responses; body-read aborts retain timeout errors. Invalid successful response objects and malformed shared IDs cannot become private visibility.
- Production investigation: deployed handler aliases match local source. A state-sized invocation returned HTTP 200 and a nonempty JSON body; raw client response was unavailable. Earlier response failure is not conclusively diagnosed. No backend changes or deployment made for this task.
- Native Simulator check: all five cards resolved to Friends and compact pill rendered correctly. Screenshot: /tmp/lifemate-memory-dropdown-small.png.
- Targeted UI/service tests: 26 passed. TypeScript and affected ESLint passed. Full run: 581/582 passed; unrelated HeldMoneyLedger StrictMode delete retry test timed out, then all 7 tests in that suite passed on targeted rerun. Independent final review found no actionable issues. git diff --check passed.
