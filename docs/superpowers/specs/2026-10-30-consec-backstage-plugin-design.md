# ConSec Backstage Plugin — Design

Date: 2026-10-30
Status: Approved in chat; pending written-spec review
Reference plugin: [backstage/community-plugins fossa](https://github.com/backstage/community-plugins/tree/main/workspaces/fossa/plugins/fossa)
Reference product: `C:\Users\skalal\Documents\ConSec-SK` (Go API, `go/openapi.json`)

## Intent

Give Backstage users the ConSec@SK container-security verdict for a component's image, the way the FOSSA plugin gives them license findings for a project. Same install shape: one npm package, a proxy entry, an annotation, an entity card and an overview page.

Success: a platform team installs the package, adds one proxy block and one annotation, and sees the gate verdict and severity counts on the entity page and on a catalog-wide overview page, in both the legacy and the new Backstage frontend system.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Architecture | Frontend-only plugin. Calls ConSec through the Backstage proxy. No backend plugin. |
| Frontend systems | Legacy (`createPlugin`) from `src/index.ts` and new frontend system from `src/alpha.tsx` (`./alpha` export). |
| Scope v1 | `EntityConsecCard` + `ConsecPage`. Read-only. No scan triggering. No vulnerability tab. |
| Annotation | `consec.io/image-ref`, exactly one image reference per entity. |
| Repo layout | Yarn workspace at repo root; plugin at `plugins/consec`. |
| Live testing | Kubernetes environment supplied by the user later. Unit tests now. |

## ConSec API used

All paths are relative to `/api/v1` and require `x-required-role: viewer`.

| Call | Purpose |
|---|---|
| `GET /images/lookup?reference=<ref>` | Image summary for one reference. 200 → `{ data: ImageRow, meta }`. 404 → never scanned. |

`ImageRow` fields used: `image_id`, `reference`, `gate` (`pass` \| `fail` \| `""`), `status` (`queued`, `running`, `completed`, `failed`, `dead_letter`, `cancelled`), `critical`, `high`, `medium`, `low`, `fixable`, `kev_count`, `secrets_count`, `last_checked_at`, `created_at`.

Lookup normalizes references (`nginx` → `nginx:latest`), so the overview page also uses lookup (one call per annotated entity, at most 5 in flight) instead of listing `/images` and matching strings client-side.

Auth: a ConSec personal access token (`consec_pat_…`, viewer role) injected by the proxy as `Authorization: Bearer <token>`. The token never reaches the browser.

## Backstage configuration (consumer)

```yaml
proxy:
  endpoints:
    '/consec':
      target: https://consec.example.com/api/v1
      allowedMethods: ['GET']
      headers:
        Authorization: Bearer ${CONSEC_TOKEN}

consec:
  baseUrl: https://consec.example.com   # web UI, used for deep links
```

`config.d.ts` declares `consec.baseUrl?: string` with `@visibility frontend`. When unset, links are hidden.

## Package

Name `@consec/backstage-plugin-consec`, `backstage.role: frontend-plugin`, `pluginId: consec`, `configSchema: config.d.ts`, exports `.` and `./alpha`.

### Units

- `src/annotations.ts`: `CONSEC_IMAGE_REF_ANNOTATION = 'consec.io/image-ref'`, `getImageRef(entity): string | undefined` (trimmed; empty → undefined).
- `src/api/ConsecApi.ts`: types and `consecApiRef` (`id: 'plugin.consec.service'`).
- `src/api/ConsecClient.ts`: `ConsecClient implements ConsecApi` using `discoveryApi.getBaseUrl('proxy') + '/consec'` and `fetchApi`.
- `src/components/ConsecCard`: entity card.
- `src/components/ConsecPage`: overview table.
- `src/plugin.ts`, `src/routes.ts`, `src/extensions.tsx`, `src/index.ts`: legacy system.
- `src/alpha.tsx`: new frontend system plugin.
- `dev/index.tsx`: `createDevApp` harness with a mock `ConsecApi`.

### `ConsecApi`

```ts
type ImageSummary = {
  imageId: number;
  reference: string;
  gate: 'pass' | 'fail' | 'none';
  status: string;
  critical: number; high: number; medium: number; low: number;
  fixable: number; kev: number; secrets: number;
  lastCheckedAt?: string;   // ISO
  url?: string;             // `${consec.baseUrl}/images/${imageId}` when baseUrl set
};

type ConsecApi = {
  getImageSummary(ref: string): Promise<ImageSummary | undefined>;      // undefined on 404
  getImageSummaries(refs: string[]): Promise<Map<string, ImageSummary>>; // keyed by input ref; misses omitted
};
```

Non-2xx other than 404 throws `ResponseError` (`@backstage/errors`).

### Entity card (`EntityConsecCard`)

Title "Container Security". States, in order: error (`ResponseErrorPanel`), loading (`Progress`), missing annotation (`MissingAnnotationEmptyState`), not found (`EmptyState`: "ConSec has not scanned '<ref>'."), data.

Data view:
- Gate as a large headline: `PASS` (success colour), `FAIL` (error colour), `NOT EVALUATED` (secondary) when `gate === 'none'`.
- When `status` is not `completed`, a line "Latest scan: <status>".
- Counts row: Critical, High, Medium, Low.
- Secondary row: Fixable, KEV, Secrets.
- "Last checked <relative time>" from `lastCheckedAt`.
- Deep link "View in ConSec" when `url` is set.

Optional prop `variant?: InfoCardVariants`, as FOSSA.

### Overview page (`ConsecPage`)

Props `entitiesFilter?` (default `{ kind: 'Component' }`), same shape as FOSSA. Header "ConSec Image Overview". Table columns: Name, Owner, Image, Gate (StatusOK / StatusError / StatusWarning "Not scanned" / StatusPending "Not evaluated"), Critical, High, Fixable, Last checked, "View in ConSec". Default sort: gate fail first, then critical desc. Filters: Owner (multi-select), Gate (select). Entities without the annotation are excluded.

### New frontend system (`./alpha`)

Default export `createFrontendPlugin({ pluginId: 'consec', extensions: [api, page, entityCard] })`:
- `ApiBlueprint` for `consecApiRef`.
- `PageBlueprint` at `/consec`.
- `EntityCardBlueprint` with filter on the `consec.io/image-ref` annotation.

## Error handling

- 401/403 from ConSec (bad or under-privileged token): card shows `ResponseErrorPanel`; page rows show "Error" status and the table still renders.
- Proxy not configured (Backstage returns 404 HTML for `/proxy/consec`): surfaced as an error, not as "not scanned". The client treats a 404 as "not scanned" only when the body is `application/problem+json` or JSON.
- One failing lookup on the overview page does not fail the page.
- Go zero time (`0001-01-01T00:00:00Z`) or a missing `last_checked_at` maps to `lastCheckedAt: undefined`; the card then shows "Never checked".
- Image references are sent URL-encoded (`ghcr.io/org/app:1.4`, `repo@sha256:…`).

## Testing

- Unit: Jest via `backstage-cli package test`, MSW for HTTP, `@backstage/test-utils` (`renderInTestApp`, `TestApiProvider`).
- Live: on the user's Kubernetes environment (details later). Hit `/images/lookup` through the Backstage proxy with a real `consec_pat_` token; record measured status codes for 200, 404, and 401 (bad token). Untested routes stay "unverified".

## Out of scope (v1)

Backend plugin, permissions, caching, scan triggering, multiple images per entity, vulnerability list tab, SBOM views, publishing to npm.
