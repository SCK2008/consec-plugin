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

export type RemediationPackage = {
  name: string;
  currentVersion: string;
  type?: string;
  fixedVersion?: string;
  topSeverity: string;
  kev: boolean;
  vulnCount: number;
  vulnIds: string[];
  command?: string;
};

export type RemediationGroup = {
  packages: RemediationPackage[];
  combinedCommand?: string;
};

export type RemediationPlan = {
  scanId: number;
  summary: {
    osUpdate: number;
    dependencyUpgrade: number;
    noFix: number;
    excepted: number;
  };
  osUpdate: RemediationGroup;
  dependencyUpgrade: RemediationGroup;
  noFix: RemediationGroup;
};

export type ThreatCheck = {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'fail' | 'info' | string;
  detail?: string;
};

export type ThreatModel = {
  scanId: number;
  grade: string;
  score: number;
  summary: string;
  checks: ThreatCheck[];
};

export type ReportKind = 'report' | 'sbom';

export type DownloadFormat = {
  kind: ReportKind;
  format: string;
  label: string;
  description: string;
  extension: string;
};

/** Every format ConSec serves for /report and /sbom. */
export const DOWNLOAD_FORMATS: DownloadFormat[] = [
  { kind: 'report', format: 'html', label: 'Report (HTML)', description: 'Standalone, printable', extension: 'report.html' },
  { kind: 'report', format: 'json', label: 'Report (JSON)', description: 'Machine readable', extension: 'report.json' },
  { kind: 'sbom', format: 'cyclonedx-json', label: 'CycloneDX JSON', description: 'SBOM', extension: 'cdx.json' },
  { kind: 'sbom', format: 'cyclonedx-xml', label: 'CycloneDX XML', description: 'SBOM', extension: 'cdx.xml' },
  { kind: 'sbom', format: 'spdx-json', label: 'SPDX JSON', description: 'SBOM, SPDX 2.3', extension: 'spdx.json' },
  { kind: 'sbom', format: 'spdx-tag-value', label: 'SPDX tag-value', description: 'SBOM, SPDX 2.3', extension: 'spdx' },
  { kind: 'sbom', format: 'spdx-2.2-json', label: 'SPDX 2.2 JSON', description: 'SBOM, legacy tools', extension: 'spdx22.json' },
  { kind: 'sbom', format: 'spdx-2.2-tag-value', label: 'SPDX 2.2 tag-value', description: 'SBOM, legacy tools', extension: 'spdx22.spdx' },
  { kind: 'sbom', format: 'json-full', label: 'Full JSON', description: 'SBOM, every scanner field', extension: 'sbom.json' },
  { kind: 'sbom', format: 'table', label: 'Text table', description: 'SBOM, human readable', extension: 'sbom.txt' },
];

export type FixWorkspace = {
  workspaceId: number;
  created: boolean;
  /** ConSec page where the agent applies the fix. */
  url?: string;
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
  /** Findings grouped by fix: OS package updates, dependency upgrades, no fix. */
  getRemediation(imageId: number): Promise<RemediationPlan>;
  getThreatModel(imageId: number): Promise<ThreatModel>;
  /** One report or SBOM file for the latest scan. */
  download(imageId: number, kind: ReportKind, format: string): Promise<Blob>;
  /** Opens the ConSec agent workspace that patches OS packages. Goes through the consec backend. */
  fixImage(imageId: number): Promise<FixWorkspace>;
};

export const consecApiRef = createApiRef<ConsecApi>({
  id: 'plugin.consec.service',
});
