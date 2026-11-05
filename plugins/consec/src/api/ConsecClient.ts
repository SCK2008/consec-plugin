import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import pLimit from 'p-limit';
import {
  ConsecApi,
  ImageSummary,
  ListImagesQuery,
  ListVulnerabilitiesQuery,
  Page,
  ScanStatus,
  Vulnerability,
} from './ConsecApi';

type ImageRow = {
  image_id: number;
  reference: string;
  gate: string;
  status?: string;
  total?: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  negligible?: number;
  unknown?: number;
  fixable: number;
  kev_count: number;
  secrets_count: number;
  scan_count?: number;
  latest_scan_id?: number;
  last_checked_at?: string;
};

type FindingRow = {
  vuln_id: string;
  severity: string;
  priority?: string | null;
  priority_why?: string;
  package_name: string;
  package_version: string;
  package_type?: string | null;
  location_path?: string | null;
  fix_state?: string | null;
  fix_versions?: string | null;
  kev: boolean;
  epss_score?: number | null;
  provenance?: string;
  remediation_class?: string | null;
  excepted: boolean;
  description?: string | null;
  data_source?: string | null;
  urls?: string | null;
};

type ScanRow = {
  scan_id: number;
  image_id: number;
  status: string;
};

type Envelope<T> = {
  data: T;
  meta?: { page?: { total?: number } };
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
    const response = await this.get('/images/lookup', { reference: ref });
    if (response.status === 404 && isJson(response)) {
      return undefined;
    }
    const body = await this.json<Envelope<ImageRow>>(response);
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

  async listImages(query: ListImagesQuery = {}): Promise<Page<ImageSummary>> {
    const response = await this.get('/images', {
      q: query.q,
      filter: query.filter,
      gate: query.gate,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
    });
    const body = await this.json<Envelope<ImageRow[]>>(response);
    const rows = body.data ?? [];
    return {
      items: rows.map(row => this.toSummary(row)),
      total: body.meta?.page?.total ?? rows.length,
    };
  }

  async listVulnerabilities(
    imageId: number,
    query: ListVulnerabilitiesQuery = {},
  ): Promise<Page<Vulnerability>> {
    const response = await this.get(
      `/images/${encodeURIComponent(String(imageId))}/vulnerabilities`,
      {
        severity: query.severity,
        fixable: query.fixable === undefined ? undefined : String(query.fixable),
        kev: query.kev ? 'true' : undefined,
        q: query.q,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      },
    );
    const body = await this.json<Envelope<FindingRow[]>>(response);
    const rows = body.data ?? [];
    return {
      items: rows.map(toVulnerability),
      total: body.meta?.page?.total ?? rows.length,
    };
  }

  async triggerScan(image: string): Promise<ScanStatus> {
    const base = await this.discoveryApi.getBaseUrl('consec');
    const response = await this.fetchApi.fetch(`${base}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    return this.json<ScanStatus>(response);
  }

  async getScanStatus(scanId: number): Promise<ScanStatus> {
    const response = await this.get(
      `/scans/${encodeURIComponent(String(scanId))}/status`,
    );
    const body = await this.json<Envelope<ScanRow>>(response);
    return toScanStatus(body.data);
  }

  private async get(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<Response> {
    const proxy = await this.discoveryApi.getBaseUrl('proxy');
    const url = new URL(`${proxy}/consec${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    return this.fetchApi.fetch(url.toString());
  }

  private async json<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as T;
  }

  private toSummary(row: ImageRow): ImageSummary {
    const lastCheckedAt = row.last_checked_at?.startsWith(ZERO_TIME)
      ? undefined
      : row.last_checked_at || undefined;
    return {
      imageId: row.image_id,
      reference: row.reference,
      gate: row.gate === 'pass' || row.gate === 'fail' ? row.gate : 'none',
      status: row.status ?? '',
      total: row.total ?? 0,
      critical: row.critical,
      high: row.high,
      medium: row.medium,
      low: row.low,
      negligible: row.negligible ?? 0,
      unknown: row.unknown ?? 0,
      fixable: row.fixable,
      kev: row.kev_count,
      secrets: row.secrets_count,
      scanCount: row.scan_count ?? 0,
      latestScanId: row.latest_scan_id || undefined,
      lastCheckedAt,
      url: this.baseUrl ? `${this.baseUrl}/images/${row.image_id}` : undefined,
    };
  }
}

function toVulnerability(row: FindingRow): Vulnerability {
  return {
    vulnId: row.vuln_id,
    severity: row.severity,
    priority: row.priority ?? undefined,
    priorityWhy: row.priority_why || undefined,
    packageName: row.package_name,
    packageVersion: row.package_version,
    packageType: row.package_type ?? undefined,
    locationPath: row.location_path ?? undefined,
    fixState: row.fix_state ?? undefined,
    fixVersions: splitList(row.fix_versions),
    kev: row.kev,
    epssScore: row.epss_score ?? undefined,
    provenance: row.provenance || undefined,
    remediationClass: row.remediation_class ?? undefined,
    excepted: row.excepted,
    description: row.description ?? undefined,
    dataSource: safeUrl(row.data_source),
    urls: splitList(row.urls).filter(url => safeUrl(url)),
  };
}

function toScanStatus(row: ScanRow): ScanStatus {
  return { scanId: row.scan_id, imageId: row.image_id, status: row.status };
}

function splitList(value?: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

/** Scanner output is untrusted: only http(s) links are rendered. */
function safeUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

function isJson(response: Response): boolean {
  const type = response.headers.get('content-type') ?? '';
  return type.includes('application/json') || type.includes('+json');
}
