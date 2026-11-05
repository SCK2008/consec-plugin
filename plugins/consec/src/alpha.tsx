import React from 'react';
import {
  ApiBlueprint,
  configApiRef,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import { ConsecClient, consecApiRef } from './api';
import {
  CONSEC_IMAGE_REF_ANNOTATION,
  getEntityImages,
  isConsecAvailable,
} from './annotations';

const consecApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: consecApiRef,
      deps: {
        configApi: configApiRef,
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ configApi, discoveryApi, fetchApi }) =>
        new ConsecClient({
          discoveryApi,
          fetchApi,
          baseUrl: configApi.getOptionalString('consec.baseUrl'),
        }),
    }),
});

const consecPage = PageBlueprint.make({
  params: {
    path: '/consec',
    title: 'ConSec',
    loader: () =>
      import('./components/ConsecPage').then(m => <m.ConsecPage />),
  },
});

/** @public */
export const consecEntityCard = EntityCardBlueprint.make({
  name: 'image',
  params: {
    filter: entity => getEntityImages(entity).length > 0,
    loader: () => import('./components/ConsecCard').then(m => <m.ConsecCard />),
  },
});

/** @public */
export const consecEntityContent = EntityContentBlueprint.make({
  name: 'images',
  params: {
    path: '/consec',
    title: 'ConSec',
    filter: isConsecAvailable,
    loader: () =>
      import('./components/EntityConsecContent').then(m => (
        <m.EntityConsecContent />
      )),
  },
});

/** @public */
export default createFrontendPlugin({
  pluginId: 'consec',
  extensions: [consecApi, consecPage, consecEntityCard, consecEntityContent],
  info: { packageJson: () => import('../package.json') },
});

export { CONSEC_IMAGE_REF_ANNOTATION };
