import React from 'react';
import { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { screen } from '@testing-library/react';
import { ConsecApi, consecApiRef } from '../../api';
import { mockConsecApi, mockSummary } from '../../testUtils';
import { ConsecCard } from './ConsecCard';

const entity = (ref?: string): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'app',
    annotations: ref ? { 'consec.io/image-ref': ref } : {},
  },
});

const summary = mockSummary;

const api = mockConsecApi;

async function renderCard(consec: ConsecApi, ref?: string) {
  return renderInTestApp(
    <TestApiProvider apis={[[consecApiRef, consec]]}>
      <EntityProvider entity={entity(ref)}>
        <ConsecCard />
      </EntityProvider>
    </TestApiProvider>,
  );
}

describe('ConsecCard', () => {
  it('asks for the annotation when it is missing', async () => {
    await renderCard(api({}));
    expect(screen.getByText('consec.io/image-ref')).toBeInTheDocument();
  });

  it('says the image has not been scanned', async () => {
    await renderCard(api({ getImageSummary: async () => undefined }), 'alpine:3.21');
    expect(
      screen.getByText("ConSec has not scanned 'alpine:3.21'."),
    ).toBeInTheDocument();
  });

  it('shows the error panel when lookup fails', async () => {
    await renderCard(
      api({
        getImageSummary: async () => {
          throw new Error('token rejected');
        },
      }),
      'alpine:3.21',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('token rejected');
  });

  it('shows a failing gate, the critical count, and the ConSec link', async () => {
    await renderCard(
      api({ getImageSummary: async () => summary() }),
      'alpine:3.21',
    );
    expect(screen.getByText('FAIL')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View in ConSec/ })).toHaveAttribute(
      'href',
      'https://consec.test/images/7',
    );
  });

  it('shows PASS and NOT EVALUATED', async () => {
    const { unmount } = await renderCard(
      api({ getImageSummary: async () => summary({ gate: 'pass' }) }),
      'alpine:3.21',
    );
    expect(screen.getByText('PASS')).toBeInTheDocument();
    unmount();

    await renderCard(
      api({ getImageSummary: async () => summary({ gate: 'none' }) }),
      'alpine:3.21',
    );
    expect(screen.getByText('NOT EVALUATED')).toBeInTheDocument();
  });

  it('names a scan that is not completed and hides that line when it is', async () => {
    const { unmount } = await renderCard(
      api({ getImageSummary: async () => summary({ status: 'running' }) }),
      'alpine:3.21',
    );
    expect(screen.getByText('Latest scan: running')).toBeInTheDocument();
    unmount();

    await renderCard(
      api({ getImageSummary: async () => summary({ status: 'completed' }) }),
      'alpine:3.21',
    );
    expect(screen.queryByText(/Latest scan:/)).not.toBeInTheDocument();
  });

  it('says Never checked when ConSec has no check time', async () => {
    await renderCard(
      api({
        getImageSummary: async () => summary({ lastCheckedAt: undefined }),
      }),
      'alpine:3.21',
    );
    expect(screen.getByText('Never checked')).toBeInTheDocument();
  });

  it('hides the ConSec link when there is no url', async () => {
    await renderCard(
      api({ getImageSummary: async () => summary({ url: undefined }) }),
      'alpine:3.21',
    );
    expect(screen.queryByRole('link', { name: /View in ConSec/ })).not.toBeInTheDocument();
  });
});
