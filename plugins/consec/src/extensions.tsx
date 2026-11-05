import {
  createComponentExtension,
  createRoutableExtension,
} from '@backstage/core-plugin-api';
import { consecPlugin } from './plugin';
import { rootRoute } from './routes';

/** @public */
export const EntityConsecCard = consecPlugin.provide(
  createComponentExtension({
    name: 'EntityConsecCard',
    component: {
      lazy: () => import('./components/ConsecCard').then(m => m.ConsecCard),
    },
  }),
);

/** @public */
export const EntityConsecContent = consecPlugin.provide(
  createComponentExtension({
    name: 'EntityConsecContent',
    component: {
      lazy: () =>
        import('./components/EntityConsecContent').then(
          m => m.EntityConsecContent,
        ),
    },
  }),
);

/** @public */
export const ConsecPage = consecPlugin.provide(
  createRoutableExtension({
    name: 'ConsecPage',
    component: () => import('./components/ConsecPage').then(m => m.ConsecPage),
    mountPoint: rootRoute,
  }),
);
