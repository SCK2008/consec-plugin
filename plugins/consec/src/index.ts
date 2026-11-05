/**
 * A Backstage plugin that shows ConSec@SK container security.
 *
 * @packageDocumentation
 */

export { CONSEC_IMAGE_REF_ANNOTATION, getImageRef } from './annotations';
export { ConsecClient, consecApiRef } from './api';
export type { ConsecApi, ImageSummary } from './api';
export { EntityConsecCard, ConsecPage } from './extensions';
export { consecPlugin } from './plugin';
