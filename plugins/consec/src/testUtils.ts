import {
  ConsecApi,
  ImageSummary,
  RemediationPlan,
  ThreatModel,
  Vulnerability,
} from './api';

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

export const mockRemediation = (
  overrides: Partial<RemediationPlan> = {},
): RemediationPlan => ({
  scanId: 30,
  summary: { osUpdate: 1, dependencyUpgrade: 1, noFix: 1, excepted: 0 },
  osUpdate: {
    packages: [
      {
        name: 'openssl',
        currentVersion: '3.0.1',
        type: 'apk',
        fixedVersion: '3.0.2',
        topSeverity: 'critical',
        kev: true,
        vulnCount: 2,
        vulnIds: ['CVE-2024-0001', 'CVE-2024-0002'],
        command: 'apk add --no-cache --upgrade openssl>=3.0.2',
      },
    ],
    combinedCommand: 'apk add --no-cache --upgrade openssl',
  },
  dependencyUpgrade: {
    packages: [
      {
        name: 'lodash',
        currentVersion: '4.17.20',
        type: 'npm',
        fixedVersion: '4.17.21',
        topSeverity: 'high',
        kev: false,
        vulnCount: 1,
        vulnIds: ['CVE-2021-23337'],
      },
    ],
  },
  noFix: {
    packages: [
      {
        name: 'busybox',
        currentVersion: '1.36.1',
        topSeverity: 'medium',
        kev: false,
        vulnCount: 1,
        vulnIds: ['CVE-2023-9999'],
      },
    ],
  },
  ...overrides,
});

export const mockThreatModel = (
  overrides: Partial<ThreatModel> = {},
): ThreatModel => ({
  scanId: 30,
  grade: 'B',
  score: 81,
  summary: '1 critical hardening issue(s) and 1 warning(s) found.',
  checks: [
    { id: 'root_user', title: 'Runs as non-root user', status: 'pass', detail: 'USER = 1000' },
    { id: 'critical', title: 'Critical vulnerabilities present', status: 'fail', detail: '2 critical and 17 high severity findings.' },
    { id: 'ports', title: 'Exposed ports', status: 'warn', detail: 'Exposes: 8090.' },
  ],
  ...overrides,
});

export const mockConsecApi = (impl: Partial<ConsecApi> = {}): ConsecApi => ({
  getImageSummary: async () => undefined,
  getImageSummaries: async () => new Map(),
  listImages: async () => ({ items: [], total: 0 }),
  listVulnerabilities: async () => ({ items: [], total: 0 }),
  triggerScan: async () => ({ scanId: 1, imageId: 1, status: 'queued' }),
  getScanStatus: async () => ({ scanId: 1, imageId: 1, status: 'completed' }),
  getRemediation: async () => mockRemediation(),
  getThreatModel: async () => mockThreatModel(),
  download: async () => new Blob(['{}']),
  fixImage: async () => ({
    workspaceId: 5,
    created: true,
    url: 'https://consec.test/kavach/workspaces/5',
  }),
  ...impl,
});
