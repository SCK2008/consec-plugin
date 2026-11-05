import React from 'react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { screen, waitFor } from '@testing-library/react';
import { consecApiRef } from '../../api';
import { mockConsecApi, mockSummary } from '../../testUtils';
import { ConsecPage } from './ConsecPage';

const component = (name: string, ref: string): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name, annotations: { 'consec.io/image-ref': ref } },
});

const images = [
  mockSummary({ imageId: 1, reference: 'ghcr.io/org/api:1', gate: 'fail' }),
  mockSummary({ imageId: 2, reference: 'ghcr.io/org/orphan:2', gate: 'pass' }),
];

async function renderPage(listImages = jest.fn()) {
  listImages.mockImplementation(async (query: any) =>
    query?.limit === 1
      ? { items: [], total: 42 }
      : { items: images, total: images.length },
  );
  await renderInTestApp(
    <TestApiProvider
      apis={[
        [
          catalogApiRef,
          {
            getEntities: async () => ({
              items: [component('api-service', 'ghcr.io/org/api:1')],
            }),
          },
        ],
        [consecApiRef, mockConsecApi({ listImages })],
      ]}
    >
      <ConsecPage />
    </TestApiProvider>,
    { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
  );
  return listImages;
}

describe('ConsecPage', () => {
  it('lists every ConSec image, including ones no component declares', async () => {
    const listImages = await renderPage();
    expect(await screen.findByText('orphan:2')).toBeInTheDocument();
    expect(screen.getByText('api:1')).toBeInTheDocument();
    expect(screen.getByText('FAIL')).toBeInTheDocument();
    expect(screen.getByText('PASS')).toBeInTheDocument();
    expect(listImages).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'all', sort: 'risk', limit: 20, offset: 0 }),
    );
  });

  it('links an image to the component that declares it', async () => {
    await renderPage();
    expect(await screen.findByText('api-service')).toBeInTheDocument();
  });

  it('shows totals for each filter', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(5),
    );
    expect(screen.getByText('Failing gate')).toBeInTheDocument();
    expect(screen.getByText('Never scanned')).toBeInTheDocument();
  });
});
