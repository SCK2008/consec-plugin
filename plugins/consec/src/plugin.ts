import {
  configApiRef,
  createApiFactory,
  createPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { ConsecClient, consecApiRef } from './api';
import { rootRoute } from './routes';

/** @public */
export const consecPlugin = createPlugin({
  id: 'consec',
  apis: [
    createApiFactory({
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
  ],
  routes: {
    consecOverview: rootRoute,
  },
});
