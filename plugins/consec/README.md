# ConSec Backstage plugin

Shows the ConSec@SK gate and vulnerability counts for a catalog component's container image. Read-only. The ConSec token stays on the Backstage server.

## Install

From the Backstage app root:

```sh
yarn --cwd packages/app add @consec/backstage-plugin-consec
```

In a Yarn workspace, depend on `workspace:^` and keep this package under `plugins/consec`.

## Proxy and link config

```yaml
proxy:
  endpoints:
    '/consec':
      target: ${CONSEC_API_URL}   # ConSec origin plus /api/v1
      allowedMethods: ['GET']
      headers:
        Authorization: Bearer ${CONSEC_TOKEN}

consec:
  baseUrl: ${CONSEC_BASE_URL}     # ConSec web UI, used for deep links
```

`CONSEC_TOKEN` is a ConSec personal access token with the **viewer** role (`consec_pat_…`). Do not use an operator or admin token. Every signed-in Backstage user would inherit it, and rescan requires operator.

Create the token in ConSec under account tokens. Store it in the Backstage secret, not in the catalog and not in the browser.

## Catalog annotation

One image per component:

```yaml
metadata:
  annotations:
    consec.io/image-ref: ghcr.io/org/app:1.4
```

## Legacy frontend

```tsx
import { ConsecPage, EntityConsecCard } from '@consec/backstage-plugin-consec';
```

Add `<EntityConsecCard />` to the entity overview, and `<Route path="/consec" element={<ConsecPage />} />` to the app routes.

## New frontend system

```tsx
import consecPlugin from '@consec/backstage-plugin-consec/alpha';
```

The `/alpha` entry adds the API, the `/consec` page, and an entity card that appears only when `consec.io/image-ref` is set.

## What it does not do

It does not start scans, create exceptions, or delete images. Those stay in ConSec, under the person's own login.
