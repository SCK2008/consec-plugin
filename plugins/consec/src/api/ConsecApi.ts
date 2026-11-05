import { createApiRef } from '@backstage/core-plugin-api';

export type Gate = 'pass' | 'fail' | 'none';

export type ImageSummary = {
  imageId: number;
  reference: string;
  gate: Gate;
  status: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  negligible: number;
  unknown: number;
  fixable: number;
  kev: number;
  secrets: number;
  scanCount: number;
  latestScanId?: number;
  lastCheckedAt?: string;
  url?: string;
};

export type ImageFilter = 'all' | 'failing' | 'kev' | 'stale' | 'unscanned';
export type ImageSort = 'name' | 'risk' | 'last_scan';

export type ListImagesQuery = {
  q?: string;
  filter?: ImageFilter;
  gate?: 'pass' | 'fail';
  sort?: ImageSort;
  limit?: number;
  offset?: number;
};

export type Severity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'negligible'
  | 'unknown';

export type Vulnerability = {
  vulnId: string;
  severity: string;
  priority?: string;
  priorityWhy?: string;
  packageName: string;
  packageVersion: string;
  packageType?: string;
  locationPath?: string;
  fixState?: string;
  fixVersions: string[];
  kev: boolean;
  epssScore?: number;
  provenance?: string;
  remediationClass?: string;
  excepted: boolean;
  description?: string;
  /** Advisory page for the finding, e.g. NVD or GHSA. */
  dataSource?: string;
  urls: string[];
};

export type ListVulnerabilitiesQuery = {
  severity?: Severity;
  fixable?: boolean;
  kev?: boolean;
  q?: string;
  sort?: 'priority' | 'severity' | 'package';
  limit?: number;
  offset?: number;
};

export type Page<T> = {
  items: T[];
  total: number;
};

export type ScanStatus = {
  scanId: number;
  imageId: number;
  status: string;
};

export type ConsecApi = {
  /** Latest scan rollup for one reference. undefined when ConSec never saw it. */
  getImageSummary(ref: string): Promise<ImageSummary | undefined>;
  getImageSummaries(refs: string[]): Promise<Map<string, ImageSummary>>;
  /** Every image ConSec has scanned, filtered and paged by ConSec. */
  listImages(query?: ListImagesQuery): Promise<Page<ImageSummary>>;
  /** Findings from the latest completed scan of an image. */
  listVulnerabilities(
    imageId: number,
    query?: ListVulnerabilitiesQuery,
  ): Promise<Page<Vulnerability>>;
  /** Queue a scan. Goes to the Backstage consec backend, never straight to ConSec. */
  triggerScan(image: string): Promise<ScanStatus>;
  getScanStatus(scanId: number): Promise<ScanStatus>;
};

export const consecApiRef = createApiRef<ConsecApi>({
  id: 'plugin.consec.service',
});
