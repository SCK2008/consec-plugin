import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ConsecClient } from './ConsecClient';

const lookup = 'http://backstage/api/proxy/consec/images/lookup';
const server = setupServer();
// Built at runtime so lint does not treat the fixture as a script URL.
const SCRIPT_URL = ['javascript', 'alert(1)'].join(':');

const discoveryApi: DiscoveryApi = {
  getBaseUrl: async (pluginId: string) => `http://backstage/api/${pluginId}`,
};
const fetchApi: FetchApi = {
  fetch: (input, init) => fetch(input, init),
};

const client = (baseUrl?: string) =>
  new ConsecClient({ discoveryApi, fetchApi, baseUrl });

const imageRow = (overrides: Record<string, unknown> = {}) => ({
  data: {
    image_id: 7,
    reference: 'alpine:3.21',
    gate: 'fail',
    status: 'completed',
    critical: 2,
    high: 5,
    medium: 1,
    low: 0,
    fixable: 4,
    kev_count: 1,
    secrets_count: 0,
    last_checked_at: '2026-10-29T10:00:00Z',
    ...overrides,
  },
  meta: {},
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ConsecClient', () => {
  it('maps ImageRow to ImageSummary', async () => {
    server.use(http.get(lookup, () => HttpResponse.json(imageRow())));

    await expect(client('https://consec.test').getImageSummary('alpine:3.21')).resolves.toEqual({
      imageId: 7,
      reference: 'alpine:3.21',
      gate: 'fail',
      status: 'completed',
      critical: 2,
      high: 5,
      medium: 1,
      low: 0,
      total: 0,
      negligible: 0,
      unknown: 0,
      fixable: 4,
      kev: 1,
      secrets: 0,
      scanCount: 0,
      latestScanId: undefined,
      lastCheckedAt: '2026-10-29T10:00:00Z',
      url: 'https://consec.test/images/7',
    });
  });

  it("maps an empty gate to 'none'", async () => {
    server.use(
      http.get(lookup, () => HttpResponse.json(imageRow({ gate: '' }))),
    );

    await expect(client().getImageSummary('alpine:3.21')).resolves.toMatchObject({
      gate: 'none',
    });
  });

  it('maps the Go zero time to an undefined lastCheckedAt', async () => {
    server.use(
      http.get(lookup, () =>
        HttpResponse.json(imageRow({ last_checked_at: '0001-01-01T00:00:00Z' })),
      ),
    );

    await expect(client().getImageSummary('alpine:3.21')).resolves.toMatchObject({
      lastCheckedAt: undefined,
    });
  });

  it('omits the deep link when baseUrl is unset', async () => {
    server.use(http.get(lookup, () => HttpResponse.json(imageRow())));

    await expect(client().getImageSummary('alpine:3.21')).resolves.toMatchObject({
      url: undefined,
    });
  });

  it('sends the image reference as a single query parameter', async () => {
    let reference: string | null = null;
    server.use(
      http.get(lookup, ({ request }) => {
        const url = new URL(request.url);
        reference = url.searchParams.get('reference');
        expect(url.pathname).toBe('/api/proxy/consec/images/lookup');
        return HttpResponse.json(imageRow());
      }),
    );

    await client().getImageSummary('ghcr.io/org/app@sha256:abc');
    expect(reference).toBe('ghcr.io/org/app@sha256:abc');
  });

  it('returns undefined when ConSec replies 404 problem+json', async () => {
    server.use(
      http.get(lookup, () =>
        HttpResponse.json(
          { title: 'Not Found', status: 404 },
          {
            status: 404,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    );

    await expect(client().getImageSummary('missing:1')).resolves.toBeUndefined();
  });

  it('throws when a 404 is HTML from the Backstage proxy', async () => {
    server.use(
      http.get(lookup, () =>
        new HttpResponse('<html>Cannot GET</html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    await expect(client().getImageSummary('alpine:3.21')).rejects.toBeInstanceOf(
      ResponseError,
    );
  });

  it('throws ResponseError on 401', async () => {
    server.use(
      http.get(lookup, () =>
        HttpResponse.json({ title: 'Unauthorized' }, { status: 401 }),
      ),
    );

    await expect(client().getImageSummary('alpine:3.21')).rejects.toBeInstanceOf(
      ResponseError,
    );
  });

  it('omits 404s from a batch of summaries', async () => {
    server.use(
      http.get(lookup, ({ request }) => {
        const reference = new URL(request.url).searchParams.get('reference');
        if (reference === 'b:1') {
          return HttpResponse.json(
            { title: 'Not Found', status: 404 },
            {
              status: 404,
              headers: { 'Content-Type': 'application/problem+json' },
            },
          );
        }
        return HttpResponse.json(
          imageRow({
            reference,
            image_id: reference === 'a:1' ? 1 : 3,
          }),
        );
      }),
    );

    const summaries = await client().getImageSummaries(['a:1', 'b:1', 'c:1']);
    expect([...summaries.keys()]).toEqual(['a:1', 'c:1']);
  });

  it('makes no requests for an empty reference list', async () => {
    let calls = 0;
    server.use(
      http.get(lookup, () => {
        calls += 1;
        return HttpResponse.json(imageRow());
      }),
    );

    await expect(client().getImageSummaries([])).resolves.toEqual(new Map());
    expect(calls).toBe(0);
  });

  it('lists images with paging, search, and filters', async () => {
    let params: URLSearchParams | undefined;
    server.use(
      http.get('http://backstage/api/proxy/consec/images', ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({
          data: [imageRow().data, imageRow({ image_id: 8, reference: 'b:1' }).data],
          meta: { page: { limit: 2, offset: 40, total: 123 } },
        });
      }),
    );

    const page = await client().listImages({
      q: 'alpine',
      filter: 'failing',
      sort: 'risk',
      limit: 2,
      offset: 40,
    });
    expect(page.total).toBe(123);
    expect(page.items.map(i => i.imageId)).toEqual([7, 8]);
    expect(Object.fromEntries(params!)).toEqual({
      q: 'alpine',
      filter: 'failing',
      sort: 'risk',
      limit: '2',
      offset: '40',
    });
  });

  it('lists vulnerabilities and drops non-http links from scanner output', async () => {
    let params: URLSearchParams | undefined;
    server.use(
      http.get(
        'http://backstage/api/proxy/consec/images/7/vulnerabilities',
        ({ request }) => {
          params = new URL(request.url).searchParams;
          return HttpResponse.json({
            data: [
              {
                vuln_id: 'CVE-1',
                severity: 'critical',
                priority: 'P0',
                package_name: 'openssl',
                package_version: '3.0.1',
                fix_versions: '3.0.2, 3.1.0',
                kev: true,
                excepted: false,
                data_source: SCRIPT_URL,
                urls: `https://a.test/1, ${SCRIPT_URL}, http://b.test/2`,
              },
            ],
            meta: { page: { total: 1 } },
          });
        },
      ),
    );

    const page = await client().listVulnerabilities(7, {
      severity: 'critical',
      fixable: true,
      kev: true,
      limit: 20,
      offset: 0,
    });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      vulnId: 'CVE-1',
      fixVersions: ['3.0.2', '3.1.0'],
      kev: true,
      dataSource: undefined,
      urls: ['https://a.test/1', 'http://b.test/2'],
    });
    expect(params?.get('severity')).toBe('critical');
    expect(params?.get('fixable')).toBe('true');
    expect(params?.get('kev')).toBe('true');
  });

  it('starts scans through the Pulse backend with only the image', async () => {
    let body: unknown;
    server.use(
      http.post('http://backstage/api/consec/scans', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { scanId: 5, imageId: 9, status: 'queued', existing: false },
          { status: 202 },
        );
      }),
    );

    await expect(client().triggerScan('alpine:3.21')).resolves.toMatchObject({
      scanId: 5,
      imageId: 9,
      status: 'queued',
    });
    expect(body).toEqual({ image: 'alpine:3.21' });
  });

  it('reads scan status through the read-only proxy', async () => {
    server.use(
      http.get('http://backstage/api/proxy/consec/scans/5/status', () =>
        HttpResponse.json({ data: { scan_id: 5, image_id: 9, status: 'running' } }),
      ),
    );

    await expect(client().getScanStatus(5)).resolves.toEqual({
      scanId: 5,
      imageId: 9,
      status: 'running',
    });
  });
});
