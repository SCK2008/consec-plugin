import { createExtensionTester } from '@backstage/frontend-test-utils';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { screen } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { consecApiRef } from './api';
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
            {
              getImageSummary: async () => ({
                imageId: 7,
                reference: 'alpine:3.21',
                gate: 'fail' as const,
                status: 'completed',
                critical: 2,
                high: 0,
                medium: 0,
                low: 0,
                fixable: 1,
                kev: 0,
                secrets: 0,
                url: 'https://consec.test/images/7',
              }),
              getImageSummaries: async () => new Map(),
            },
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
