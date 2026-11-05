import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { consecApiRef } from '../src/api';
import { mockConsecApi, mockSummary, mockVulnerability } from '../src/testUtils';
import {
  EntityConsecCard,
  EntityConsecContent,
  ConsecPage,
  consecPlugin,
} from '../src';

const example: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'example',
    annotations: { 'consec.io/image-ref': 'alpine:3.21, unscanned:1.0' },
  },
};

const summary = mockSummary({ lastCheckedAt: new Date().toISOString() });

createDevApp()
  .registerPlugin(consecPlugin)
  .registerApi({
    api: consecApiRef,
    deps: {},
    factory: () =>
      mockConsecApi({
        getImageSummary: async ref => (ref === 'alpine:3.21' ? summary : undefined),
        listImages: async () => ({ items: [summary], total: 1 }),
        listVulnerabilities: async () => ({
          items: [mockVulnerability(), mockVulnerability({ vulnId: 'CVE-2024-0002', severity: 'high', priority: 'P2', kev: false })],
          total: 2,
        }),
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
    element: (
      <EntityProvider entity={example}>
        <EntityConsecContent />
      </EntityProvider>
    ),
    title: 'Entity tab',
    path: '/entity',
  })
  .addPage({
    element: <ConsecPage />,
    title: 'ConSec',
    path: '/consec',
  })
  .render();
