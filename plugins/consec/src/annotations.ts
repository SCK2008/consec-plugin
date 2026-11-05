import { Entity } from '@backstage/catalog-model';

/** One or more image references, separated by commas or newlines. */
export const CONSEC_IMAGE_REF_ANNOTATION = 'consec.io/image-ref';
export const JFROG_IMAGE_NAME_ANNOTATION = 'jfrog-artifactory/image-name';
export const JFROG_REPO_FILTER_ANNOTATION = 'jfrog-artifactory/repo-filter';
export const KUBERNETES_ID_ANNOTATION = 'backstage.io/kubernetes-id';
export const KUBERNETES_LABEL_SELECTOR_ANNOTATION =
  'backstage.io/kubernetes-label-selector';

export const DEFAULT_JFROG_REGISTRY = 'artifactory.bmc.com';

/** Where an image reference for an entity came from. */
export type ImageSource = 'annotation' | 'jfrog' | 'kubernetes';

export type EntityImage = {
  reference: string;
  sources: ImageSource[];
};

const annotation = (entity: Entity, key: string): string | undefined => {
  const trimmed = entity?.metadata?.annotations?.[key]?.trim();
  return trimmed ? trimmed : undefined;
};

/** References listed in consec.io/image-ref. */
export const getAnnotatedImageRefs = (entity: Entity): string[] =>
  (annotation(entity, CONSEC_IMAGE_REF_ANNOTATION) ?? '')
    .split(/[,\n]/)
    .map(ref => ref.trim())
    .filter(Boolean);

/** First reference in consec.io/image-ref. */
export const getImageRef = (entity: Entity): string | undefined =>
  getAnnotatedImageRefs(entity)[0];

/**
 * The image the JFrog Artifactory tab shows, as a pullable reference:
 * <registry>/<repo-filter>/<image-name>:latest.
 */
export const getJfrogImageRef = (
  entity: Entity,
  registry: string = DEFAULT_JFROG_REGISTRY,
): string | undefined => {
  const name = annotation(entity, JFROG_IMAGE_NAME_ANNOTATION);
  const repo = annotation(entity, JFROG_REPO_FILTER_ANNOTATION);
  if (!name || !repo || /\s/.test(name) || /\s/.test(repo)) {
    return undefined;
  }
  const host = registry.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const hasTag = /[:@][^/]*$/.test(name);
  return `${host}/${repo}/${name}${hasTag ? '' : ':latest'}`;
};

export const hasKubernetesImages = (entity: Entity): boolean =>
  Boolean(
    annotation(entity, KUBERNETES_ID_ANNOTATION) ??
      annotation(entity, KUBERNETES_LABEL_SELECTOR_ANNOTATION),
  );

export const addImage = (
  images: EntityImage[],
  reference: string,
  source: ImageSource,
): void => {
  const ref = reference.trim();
  if (!ref) {
    return;
  }
  const existing = images.find(image => image.reference === ref);
  if (existing) {
    if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }
    return;
  }
  images.push({ reference: ref, sources: [source] });
};

/** Image references known from annotations alone, in display order. */
export const getEntityImages = (
  entity: Entity,
  registry?: string,
): EntityImage[] => {
  const images: EntityImage[] = [];
  getAnnotatedImageRefs(entity).forEach(ref =>
    addImage(images, ref, 'annotation'),
  );
  const jfrog = getJfrogImageRef(entity, registry);
  if (jfrog) {
    addImage(images, jfrog, 'jfrog');
  }
  return images;
};

/** True when the ConSec card or tab has at least one image to look up. */
export const isConsecAvailable = (entity: Entity): boolean =>
  getEntityImages(entity).length > 0 || hasKubernetesImages(entity);
