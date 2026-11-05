import { ConsecApi, ImageSummary, Vulnerability } from './api';

export const mockSummary = (
  overrides: Partial<ImageSummary> = {},
): ImageSummary => ({
  imageId: 7,
  reference: 'alpine:3.21',
  gate: 'fail',
  status: 'completed',
  total: 8,
  critical: 2,
  high: 5,
  medium: 1,
  low: 0,
  negligible: 0,
  unknown: 0,
  fixable: 4,
  kev: 1,
  secrets: 0,
  scanCount: 3,
  latestScanId: 30,
  lastCheckedAt: '2026-10-29T10:00:00Z',
  url: 'https://consec.test/images/7',
  ...overrides,
});

export const mockVulnerability = (
  overrides: Partial<Vulnerability> = {},
): Vulnerability => ({
  vulnId: 'CVE-2024-0001',
  severity: 'critical',
  priority: 'P0',
  priorityWhy: 'Known exploited and reachable',
  packageName: 'openssl',
  packageVersion: '3.0.1',
  packageType: 'apk',
  fixVersions: ['3.0.2'],
  kev: true,
  excepted: false,
  description: 'Buffer overflow in openssl',
  dataSource: 'https://nvd.nist.gov/vuln/detail/CVE-2024-0001',
  urls: [],
  ...overrides,
});

export const mockConsecApi = (impl: Partial<ConsecApi> = {}): ConsecApi => ({
  getImageSummary: async () => undefined,
  getImageSummaries: async () => new Map(),
  listImages: async () => ({ items: [], total: 0 }),
  listVulnerabilities: async () => ({ items: [], total: 0 }),
  triggerScan: async () => ({ scanId: 1, imageId: 1, status: 'queued' }),
  getScanStatus: async () => ({ scanId: 1, imageId: 1, status: 'completed' }),
  ...impl,
});
