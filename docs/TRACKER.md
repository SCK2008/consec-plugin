# ConSec Backstage Plugin — Tracker

Spec: [design](superpowers/specs/2026-10-30-consec-backstage-plugin-design.md) · Plan: [plan](superpowers/plans/2026-10-30-consec-backstage-plugin.md)

Status values: `todo` · `in-progress` · `blocked` · `review` · `done`

## Phases

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 0.1 | Study FOSSA plugin | done | agent | Legacy system only; no `/alpha` |
| 0.2 | Map ConSec API (`/images/lookup`, PAT auth) | done | agent | |
| 0.3 | Design approved in chat | done | Saurav | Proxy-only, both systems, card + page, one image ref |
| 0.4 | Written spec review | done | Saurav | Approved 2026-11-03 |
| 0.5 | Plan review + execution method | done | Saurav | Native, this session |
| 0.6 | Git identity for commits | done | Saurav | SCK2008, GitHub noreply. No Cursor co-author |
| 1 | Workspace scaffold + `getImageRef` | done | agent | Tests 3/3. Pinned to Pulse 1.54.3 |
| 2 | `ConsecClient` + types | done | agent | 10 client tests. MSW 2, fetch called at request time |
| 3 | `ConsecCard` | todo | | |
| 4 | `ConsecPage` | todo | | |
| 5 | Legacy wiring + dev harness | todo | | |
| 6 | New frontend system `./alpha` | todo | | Uses `backstage.io@plugin-new-frontend-system-support` skill |
| 7 | README, lint, API report | todo | | |
| 8 | Live verification on Kubernetes | blocked | Saurav | Waiting for K8s environment details |

## Review Focus checklist

| Risk | Covered in | Status |
|------|-----------|--------|
| Proxy not configured (404 HTML) → error, not "not scanned" | Task 2 | done |
| Go zero time `last_checked_at` → "Never checked" | Tasks 2, 3 | done in client; card copy in Task 3 |
| References with `/`, `:`, `@sha256:` encoded once | Task 2 | done |
| One failing lookup doesn't break overview page | Task 4 | todo |
| Whitespace-only annotation → missing-annotation state | Task 1 | done |

## Open questions

| Question | Asked | Answer |
|----------|-------|--------|
| K8s env: Backstage URL/namespace, ConSec URL, plugin install method, token Secret | 2026-10-30 | pending |
| Git author name/email for this repo | 2026-10-30 | SCK2008 <55826372+SCK2008@users.noreply.github.com> |

## Log

- 2026-10-30: Brainstorming complete; spec, plan and tracker written.
- 2026-11-03: Spec and plan approved. Execution is native on branch feat/consec-backstage-plugin.
- 2026-11-03: Task 1 done. `getImageRef` trims and rejects blank annotations. Yarn needed a local lockfile because `C:\Users\skalal\package.json` exists.
- 2026-11-03: Task 2 done. Client maps lookup rows, treats JSON 404 as not scanned, and throws on HTML 404 and 401.
