import { createApiRef } from '@backstage/core-plugin-api';

export type ImageSummary = {
  imageId: number;
  reference: string;
  gate: 'pass' | 'fail' | 'none';
  status: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  fixable: number;
  kev: number;
  secrets: number;
  lastCheckedAt?: string;
  url?: string;
};

export type ConsecApi = {
  getImageSummary(ref: string): Promise<ImageSummary | undefined>;
  getImageSummaries(refs: string[]): Promise<Map<string, ImageSummary>>;
};

export const consecApiRef = createApiRef<ConsecApi>({
  id: 'plugin.consec.service',
});
