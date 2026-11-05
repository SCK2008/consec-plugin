import {
  ApiBlueprint,
  configApiRef,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { ConsecClient, consecApiRef } from './api';
import { CONSEC_IMAGE_REF_ANNOTATION, getImageRef } from './annotations';

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
    filter: entity => Boolean(getImageRef(entity)),
    loader: () => import('./components/ConsecCard').then(m => <m.ConsecCard />),
  },
});

/** @public */
export default createFrontendPlugin({
  pluginId: 'consec',
  extensions: [consecApi, consecPage, consecEntityCard],
  info: { packageJson: () => import('../package.json') },
});

export { CONSEC_IMAGE_REF_ANNOTATION };
