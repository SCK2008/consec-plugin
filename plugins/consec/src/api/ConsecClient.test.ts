import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ConsecClient } from './ConsecClient';

const lookup = 'http://backstage/api/proxy/consec/images/lookup';
const server = setupServer();

const discoveryApi: DiscoveryApi = {
  getBaseUrl: async () => 'http://backstage/api/proxy',
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
      fixable: 4,
      kev: 1,
      secrets: 0,
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
});
