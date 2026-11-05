import { createDevApp } from '@backstage/dev-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { consecApiRef, ImageSummary } from '../src/api';
import { EntityConsecCard, ConsecPage, consecPlugin } from '../src';

const example: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'example',
    annotations: { 'consec.io/image-ref': 'alpine:3.21' },
  },
};

const summary: ImageSummary = {
  imageId: 7,
  reference: 'alpine:3.21',
  gate: 'fail',
  status: 'completed',
  critical: 2,
  high: 5,
  medium: 1,
  low: 0,
  fixable: 4,
  kev: 1,
  secrets: 0,
  lastCheckedAt: new Date().toISOString(),
  url: 'https://consec.example.com/images/7',
};

createDevApp()
  .registerPlugin(consecPlugin)
  .registerApi({
    api: consecApiRef,
    deps: {},
    factory: () => ({
      getImageSummary: async () => summary,
      getImageSummaries: async () => new Map([['alpine:3.21', summary]]),
    }),
  })
  .addPage({
    element: (
      <EntityProvider entity={example}>
        <EntityConsecCard />
      </EntityProvider>
    ),
    title: 'Card',
    path: '/card',
  })
  .addPage({
    element: <ConsecPage />,
    title: 'ConSec',
    path: '/consec',
  })
  .render();
