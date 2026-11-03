import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import pLimit from 'p-limit';
import { ConsecApi, ImageSummary } from './ConsecApi';

type ImageRow = {
  image_id: number;
  reference: string;
  gate: string;
  status: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  fixable: number;
  kev_count: number;
  secrets_count: number;
  last_checked_at?: string;
};

const ZERO_TIME = '0001-01-01';

export class ConsecClient implements ConsecApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly baseUrl?: string;
  private readonly limit = pLimit(5);

  constructor({
    discoveryApi,
    fetchApi,
    baseUrl,
  }: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
    baseUrl?: string;
  }) {
    this.discoveryApi = discoveryApi;
    this.fetchApi = fetchApi;
    this.baseUrl = baseUrl?.replace(/\/$/, '');
  }

  async getImageSummary(ref: string): Promise<ImageSummary | undefined> {
    const proxy = await this.discoveryApi.getBaseUrl('proxy');
    const url = new URL(`${proxy}/consec/images/lookup`);
    url.searchParams.set('reference', ref);

    const response = await this.fetchApi.fetch(url.toString());
    if (response.status === 404 && isJson(response)) {
      return undefined;
    }
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }

    const body = (await response.json()) as { data: ImageRow };
    return this.toSummary(body.data);
  }

  async getImageSummaries(
    refs: string[],
  ): Promise<Map<string, ImageSummary>> {
    const summaries = new Map<string, ImageSummary>();
    if (refs.length === 0) {
      return summaries;
    }

    const settled = await Promise.allSettled(
      refs.map(ref => this.limit(() => this.getImageSummary(ref))),
    );
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        summaries.set(refs[index], result.value);
      }
    });
    return summaries;
  }

  private toSummary(row: ImageRow): ImageSummary {
    const lastCheckedAt = row.last_checked_at?.startsWith(ZERO_TIME)
      ? undefined
      : row.last_checked_at || undefined;
    return {
      imageId: row.image_id,
      reference: row.reference,
      gate: row.gate === 'pass' || row.gate === 'fail' ? row.gate : 'none',
      status: row.status,
      critical: row.critical,
      high: row.high,
      medium: row.medium,
      low: row.low,
      fixable: row.fixable,
      kev: row.kev_count,
      secrets: row.secrets_count,
      lastCheckedAt,
      url: this.baseUrl ? `${this.baseUrl}/images/${row.image_id}` : undefined,
    };
  }
}

function isJson(response: Response): boolean {
  const type = response.headers.get('content-type') ?? '';
  return type.includes('application/json') || type.includes('+json');
}
