import { Entity } from '@backstage/catalog-model';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { screen } from '@testing-library/react';
import { ConsecApi, ImageSummary, consecApiRef } from '../../api';
import { ConsecPage } from './ConsecPage';

const component = (name: string, ref?: string): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name,
    annotations: ref ? { 'consec.io/image-ref': ref } : {},
  },
  relations: [],
});

const summary = (gate: ImageSummary['gate'], critical = 0): ImageSummary => ({
  imageId: 1,
  reference: 'image',
  gate,
  status: 'completed',
  critical,
  high: 0,
  medium: 0,
  low: 0,
  fixable: 0,
  kev: 0,
  secrets: 0,
});

const entities = [
  component('pass-app', 'pass:1'),
  component('fail-app', 'fail:1'),
  component('plain-app'),
  component('missing-app', 'missing:1'),
  component('none-app', 'none:1'),
  component('bad-app', 'bad:1'),
];

function consecApi(): ConsecApi {
  return {
    getImageSummaries: async () => new Map(),
    getImageSummary: async ref => {
      if (ref === 'fail:1') return summary('fail', 4);
      if (ref === 'pass:1') return summary('pass', 0);
      if (ref === 'none:1') return summary('none');
      if (ref === 'missing:1') return undefined;
      throw new Error('lookup failed');
    },
  };
}

async function renderPage(
  filter?: { kind: string },
  getEntities = jest.fn(async () => ({ items: entities })),
) {
  const catalogApi = { getEntities };
  await renderInTestApp(
    <TestApiProvider
      apis={[
        [catalogApiRef, catalogApi],
        [consecApiRef, consecApi()],
      ]}
    >
      <ConsecPage entitiesFilter={filter} />
    </TestApiProvider>,
    {
      mountedRoutes: {
        '/catalog/:namespace/:kind/:name': entityRouteRef,
      },
    },
  );
  return getEntities;
}

describe('ConsecPage', () => {
  it('lists annotated images and skips entities with no image', async () => {
    const getEntities = await renderPage();
    expect(getEntities).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { kind: 'Component' } }),
    );
    expect(screen.getByText('fail-app')).toBeInTheDocument();
    expect(screen.getByText('pass-app')).toBeInTheDocument();
    expect(screen.queryByText('plain-app')).not.toBeInTheDocument();
    expect(screen.getByText('Fail')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('Not scanned')).toBeInTheDocument();
    expect(screen.getByText('Not evaluated')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    const body = document.body.textContent ?? '';
    expect(body.indexOf('fail-app')).toBeLessThan(body.indexOf('pass-app'));
  });

  it('passes a custom catalog filter through', async () => {
    const getEntities = await renderPage({ kind: 'Resource' });
    expect(getEntities).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { kind: 'Resource' } }),
    );
  });
});
