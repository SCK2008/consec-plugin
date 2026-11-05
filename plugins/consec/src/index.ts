/**
 * A Backstage plugin that shows ConSec@SK container security.
 *
 * @packageDocumentation
 */

export {
  CONSEC_IMAGE_REF_ANNOTATION,
  getEntityImages,
  getImageRef,
  isConsecAvailable,
} from './annotations';
export type { EntityImage, ImageSource } from './annotations';
export { ConsecClient, consecApiRef } from './api';
export type {
  ConsecApi,
  ImageSummary,
  Page,
  ScanStatus,
  Vulnerability,
} from './api';
export {
  EntityConsecCard,
  EntityConsecContent,
  ConsecPage,
} from './extensions';
export { consecPlugin } from './plugin';
