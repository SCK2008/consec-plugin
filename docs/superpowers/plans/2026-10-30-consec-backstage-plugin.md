# ConSec Backstage Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Update `docs/TRACKER.md` when a task changes state.

**Goal:** Ship `@consec/backstage-plugin-consec`, a frontend Backstage plugin that shows ConSec@SK image security on entity pages and a catalog overview, modelled on the FOSSA community plugin.

**Architecture:** Frontend-only package at `plugins/consec` in a Yarn workspace. `ConsecClient` calls `GET /images/lookup` through the Backstage proxy at `/proxy/consec`. Exposed for the legacy frontend system (`src/index.ts`) and the new frontend system (`src/alpha.tsx`).

**Tech Stack:** TypeScript, React 18, Backstage CLI (`backstage-cli package *`), `@backstage/core-plugin-api`, `@backstage/core-components`, `@backstage/plugin-catalog-react`, `@backstage/frontend-plugin-api`, `@backstage/errors`, Material UI v4, `luxon`, `p-limit@3`, `react-use`; tests with Jest, MSW, `@backstage/test-utils`, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-30-consec-backstage-plugin-design.md`

## Global Constraints

- Package name `@consec/backstage-plugin-consec`; `backstage.role: frontend-plugin`; `pluginId: consec`.
- Annotation key `consec.io/image-ref`; one reference per entity.
- Proxy path `/consec` → ConSec `/api/v1`. Client base: `${await discoveryApi.getBaseUrl('proxy')}/consec`.
- API ref id `plugin.consec.service`. Route ref id `consec-overview`. NFS page path `/consec`.
- Config key `consec.baseUrl` (`@visibility frontend`). Deep link `${baseUrl}/images/${imageId}`; no link when unset.
- Read-only: GET only. No backend plugin.
- Overview lookups: at most 5 concurrent (`p-limit(5)`).
- Dependency versions: whatever `npx @backstage/create-app@latest`-era releases are current at Task 1, aligned with `backstage-cli versions:bump`. Do not mix major lines.
- Commits use the repo owner's identity (git-identity rule). Local `user.name`/`user.email` are not set yet: ask before the first commit.
- Yarn via Corepack (`corepack enable`); Yarn is not installed globally on this machine.

## Review Focus

1. Proxy not configured: `/proxy/consec/...` returns a Backstage 404 HTML page. Expect an error, not "not scanned". Test in Task 2.
2. Go zero time `0001-01-01T00:00:00Z` in `last_checked_at`. Expect "Never checked", not "2025 years ago". Test in Tasks 2 and 3.
3. References with `/`, `:` and `@sha256:` digests. Expect a single correctly encoded `reference` query param. Test in Task 2.
4. One lookup returns 500 on the overview page. Expect that row to show "Error" and others to render. Test in Task 4.
5. Annotation present but whitespace-only. Expect the missing-annotation state. Test in Task 1.

---

### Task 1: Workspace scaffold + annotation helper

**Files:**
- Create: `package.json` (root, private, `workspaces: ["plugins/*"]`, `packageManager` pinned by Corepack), `tsconfig.json` (extends `@backstage/cli/config/tsconfig.json`), `.gitignore` (node_modules, dist, dist-types, coverage), `.yarnrc.yml` (`nodeLinker: node-modules`), `backstage.json` (`version` = current Backstage release)
- Create: `plugins/consec/package.json` (scripts `build|start|test|lint|clean|prepack|postpack` via `backstage-cli package`, `configSchema: config.d.ts`, `files: [dist, config.d.ts]`, `exports` for `.` and `./alpha` with `typesVersions`), `plugins/consec/config.d.ts`, `plugins/consec/src/setupTests.ts` (`import '@testing-library/jest-dom'`), `plugins/consec/.eslintrc.js`
- Create: `plugins/consec/src/annotations.ts`
- Test: `plugins/consec/src/annotations.test.ts`

**Interfaces:**
- Produces: `CONSEC_IMAGE_REF_ANNOTATION: 'consec.io/image-ref'`, `getImageRef(entity: Entity): string | undefined`.

- [ ] **Step 0:** `npx skills add backstage.io@plugin-new-frontend-system-support -g -y` (used in Task 6). `corepack enable`.
- [ ] **Step 1: Write the failing test** — `annotations.test.ts`:
  - returns `'ghcr.io/org/app:1.4'` for that annotation value
  - returns `'alpine:3.21'` for `'  alpine:3.21  '`
  - returns `undefined` for missing annotations, missing key, `''`, and `'   '`
- [ ] **Step 2:** `yarn install` then `yarn --cwd plugins/consec test annotations` → FAIL (module not found).
- [ ] **Step 3:** Implement `getImageRef` in `src/annotations.ts`.
- [ ] **Step 4:** `yarn --cwd plugins/consec test annotations` → PASS. `yarn tsc` → no errors.
- [ ] **Step 5: Commit** `chore: scaffold consec plugin workspace`.

### Task 2: API types and `ConsecClient`

**Files:**
- Create: `plugins/consec/src/api/ConsecApi.ts`, `plugins/consec/src/api/ConsecClient.ts`, `plugins/consec/src/api/index.ts`
- Test: `plugins/consec/src/api/ConsecClient.test.ts`

**Interfaces:**
- Produces: `ImageSummary`, `ConsecApi`, `consecApiRef` exactly as in the spec "`ConsecApi`" section.
- Produces: `new ConsecClient({ discoveryApi: DiscoveryApi; fetchApi: FetchApi; baseUrl?: string })`.

- [ ] **Step 1: Write the failing tests** (MSW on `http://backstage/api/proxy/consec`, `discoveryApi.getBaseUrl` → `http://backstage/api/proxy`):
  - `maps ImageRow to ImageSummary`: 200 body `{ data: { image_id: 7, reference: 'alpine:3.21', gate: 'fail', status: 'completed', critical: 2, high: 5, medium: 1, low: 0, fixable: 4, kev_count: 1, secrets_count: 0, last_checked_at: '2026-10-29T10:00:00Z' }, meta: {} }` → `{ imageId: 7, gate: 'fail', critical: 2, high: 5, medium: 1, low: 0, fixable: 4, kev: 1, secrets: 0, lastCheckedAt: '2026-10-29T10:00:00Z', url: 'https://consec.test/images/7' }` with `baseUrl: 'https://consec.test'`.
  - `gate '' maps to 'none'`.
  - `zero time maps to undefined lastCheckedAt` for `'0001-01-01T00:00:00Z'`.
  - `url undefined when baseUrl unset`.
  - `encodes reference`: request for `'ghcr.io/org/app@sha256:abc'` arrives with `url.searchParams.get('reference') === 'ghcr.io/org/app@sha256:abc'` on path `/images/lookup`.
  - `404 problem+json returns undefined`.
  - `404 text/html throws ResponseError` (proxy not configured).
  - `401 throws ResponseError`.
  - `getImageSummaries` with `['a:1','b:1','c:1']` where `b:1` → 404 returns a Map with keys `a:1`, `c:1`.
  - `getImageSummaries([])` makes no requests and returns an empty Map.
- [ ] **Step 2:** `yarn --cwd plugins/consec test ConsecClient` → FAIL.
- [ ] **Step 3:** Implement. Use `fetchApi.fetch` (adds Backstage identity; proxy overrides `Authorization`). `getImageSummaries` runs `getImageSummary` under `p-limit(5)` with `Promise.allSettled`; 404s and rejected refs are both omitted from the Map. Per-row errors are the page's job (Task 4).
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5: Commit** `feat: add ConSec API client`.

### Task 3: `ConsecCard`

**Files:**
- Create: `plugins/consec/src/components/ConsecCard/ConsecCard.tsx`, `.../ConsecCard/index.ts`
- Test: `plugins/consec/src/components/ConsecCard/ConsecCard.test.tsx`

**Interfaces:**
- Consumes: `consecApiRef`, `ImageSummary`, `getImageRef`, `CONSEC_IMAGE_REF_ANNOTATION`.
- Produces: `ConsecCard(props: { variant?: InfoCardVariants }): JSX.Element`.

- [ ] **Step 1: Write the failing tests** (`renderInTestApp` + `TestApiProvider` + `EntityProvider`, mocked `ConsecApi`):
  - missing annotation → text `consec.io/image-ref` (MissingAnnotationEmptyState).
  - `getImageSummary` resolves `undefined` → `ConSec has not scanned 'alpine:3.21'.`
  - rejects → error panel visible.
  - gate `fail`, critical 2 → `FAIL` and `2` under `Critical`; link `View in ConSec` with href `https://consec.test/images/7`.
  - gate `pass` → `PASS`; gate `none` → `NOT EVALUATED`.
  - status `running` → `Latest scan: running`; status `completed` → no such text.
  - `lastCheckedAt` undefined → `Never checked`.
  - `url` undefined → no `View in ConSec` link.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement following FOSSA's `FossaCard` structure (inner `Card` wrapper with `InfoCard` title `Container Security`, `useAsync`, `makeStyles`). Relative time via `luxon` `DateTime.fromISO(...).toRelative()`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: add ConSec entity card`.

### Task 4: `ConsecPage`

**Files:**
- Create: `plugins/consec/src/components/ConsecPage/ConsecPage.tsx`, `.../ConsecPage/index.ts`, `plugins/consec/src/components/index.ts`
- Test: `plugins/consec/src/components/ConsecPage/ConsecPage.test.tsx`

**Interfaces:**
- Consumes: `catalogApiRef`, `consecApiRef`, `getImageRef`.
- Produces: `ConsecPage(props: ConsecPageProps)`, `type ConsecPageProps = { entitiesFilter?: <same type as FossaPageProps.entitiesFilter> }`.

- [ ] **Step 1: Write the failing tests** (mock `catalogApi.getEntities` returning 3 annotated + 1 unannotated component):
  - unannotated entity not rendered.
  - row with gate `fail` shows `Fail`; `pass` shows `Pass`; lookup `undefined` shows `Not scanned`; gate `none` shows `Not evaluated`.
  - one lookup rejects → that row shows `Error`, the other two rows still render (Review Focus 4).
  - default order: fail row before pass row.
  - `catalogApi.getEntities` called with `filter: { kind: 'Component' }` by default and with a custom `entitiesFilter` when passed.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement following FOSSA's `FossaPage` (catalog fetch with `fields`, `useDeepCompareEffect`, `Table` with `filters` Owner multi-select and Gate select, `pageSize: 20`). For per-row errors call `consecApi.getImageSummary` per ref under `p-limit(5)` with `Promise.allSettled` inside the page and hold `{ summary?, error? }` per ref; `getImageSummaries` remains for API consumers.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: add ConSec overview page`.

### Task 5: Legacy plugin wiring, exports, dev harness

**Files:**
- Create: `plugins/consec/src/routes.ts`, `src/plugin.ts`, `src/extensions.tsx`, `src/index.ts`, `plugins/consec/dev/index.tsx`
- Test: `plugins/consec/src/plugin.test.ts`

**Interfaces:**
- Produces: `consecPlugin`, `EntityConsecCard`, `ConsecPage` (routable, `mountPoint: rootRoute`), `rootRoute = createRouteRef({ id: 'consec-overview' })`; re-exports `consecApiRef`, `ConsecClient`, types, `getImageRef`, `CONSEC_IMAGE_REF_ANNOTATION`.

- [ ] **Step 1: Write the failing test** — `consecPlugin` is defined, `consecPlugin.getId() === 'consec'`, and `consecPlugin.getApis()` contains a factory for `consecApiRef`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement mirroring FOSSA's `plugin.ts` / `extensions.tsx`; API factory deps `discoveryApiRef`, `fetchApiRef`, `configApiRef` (`baseUrl: configApi.getOptionalString('consec.baseUrl')`). Dev harness: `createDevApp().registerPlugin(consecPlugin).registerApi({ api: consecApiRef, ... mock })` with an entity page showing the card and `/consec` showing the page.
- [ ] **Step 4:** Tests PASS; `yarn --cwd plugins/consec build` succeeds; `yarn --cwd plugins/consec start` renders card and page with mock data (manual check).
- [ ] **Step 5: Commit** `feat: wire legacy plugin and dev app`.

### Task 6: New frontend system (`./alpha`)

**Files:**
- Create: `plugins/consec/src/alpha.tsx`
- Modify: `plugins/consec/package.json` (`exports['./alpha']`, `typesVersions`)
- Test: `plugins/consec/src/alpha.test.tsx`

**Interfaces:**
- Consumes: `consecApiRef`, `ConsecClient`, `ConsecCard`, `ConsecPage`, `rootRoute`.
- Produces: default export `createFrontendPlugin({ pluginId: 'consec', ... })` with extensions `api:consec`, `page:consec` (path `/consec`), `entity-card:consec/image` (filter: entities with `consec.io/image-ref`).

- [ ] **Step 1:** Read and follow the installed `backstage.io@plugin-new-frontend-system-support` skill for current blueprint signatures and route-ref conversion.
- [ ] **Step 2: Write the failing test** using `@backstage/frontend-test-utils` (`createExtensionTester`): page extension renders `ConSec Image Overview` with a mocked API; entity card extension renders `Container Security` for an annotated entity.
- [ ] **Step 3:** FAIL → implement `alpha.tsx` → PASS.
- [ ] **Step 4:** `yarn --cwd plugins/consec build` emits `dist/alpha.*`.
- [ ] **Step 5: Commit** `feat: support new frontend system`.

### Task 7: README, lint, API report

**Files:**
- Create: `plugins/consec/README.md` (install for both systems, proxy block, `consec.baseUrl`, annotation, creating a viewer `consec_pat_` token in ConSec)
- Modify: root `README.md` (link to plugin README)

- [ ] **Step 1:** Write README using the spec's "Backstage configuration" block verbatim.
- [ ] **Step 2:** `yarn --cwd plugins/consec lint` → 0 errors; `yarn tsc` → 0 errors; `yarn --cwd plugins/consec test --coverage` → all PASS.
- [ ] **Step 3: Commit** `docs: add consec plugin README`.

### Task 8: Live verification on Kubernetes (blocked: environment pending)

**Files:**
- Create: `docs/verification/2026-xx-xx-k8s.md` (measured results)

- [ ] **Step 1:** From the user: Backstage URL/namespace, ConSec URL, how the plugin gets installed (image build vs. dynamic plugin), and a viewer `consec_pat_` token supplied as a Kubernetes Secret → `CONSEC_TOKEN`.
- [ ] **Step 2:** Install the plugin into that Backstage, add the proxy block and `consec.baseUrl`, annotate one component with a scanned image and one with an unscanned image.
- [ ] **Step 3:** Measure via `curl` through Backstage `/api/proxy/consec/images/lookup?reference=…`: scanned → 200, unscanned → 404, bad token → 401. Record codes.
- [ ] **Step 4:** UI check: card shows gate and counts for the scanned image, "not scanned" for the other, overview page lists both; deep link opens ConSec. Screenshot both.
- [ ] **Step 5: Commit** `test: record k8s verification`.
