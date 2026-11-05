import React from 'react';
import { createExtensionTester } from '@backstage/frontend-test-utils';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { screen } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { consecApiRef } from './api';
import { mockConsecApi, mockSummary } from './testUtils';
import { consecEntityCard } from './alpha';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'app',
    annotations: { 'consec.io/image-ref': 'alpine:3.21' },
  },
};

describe('new frontend system', () => {
  it('renders the entity card for an annotated entity', async () => {
    const element = createExtensionTester(consecEntityCard).reactElement();
    await renderInTestApp(
      <TestApiProvider
        apis={[
          [
            consecApiRef,
            mockConsecApi({ getImageSummary: async () => mockSummary() }),
          ],
        ]}
      >
        <EntityProvider entity={entity}>{element}</EntityProvider>
      </TestApiProvider>,
    );
    expect(await screen.findByText('Container Security')).toBeInTheDocument();
    expect(screen.getByText('FAIL')).toBeInTheDocument();
  });
});
