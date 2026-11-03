import { Entity } from '@backstage/catalog-model';

export const CONSEC_IMAGE_REF_ANNOTATION = 'consec.io/image-ref';

export const getImageRef = (entity: Entity): string | undefined => {
  const value = entity?.metadata.annotations?.[CONSEC_IMAGE_REF_ANNOTATION];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};
