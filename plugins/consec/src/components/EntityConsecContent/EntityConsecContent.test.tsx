import React from 'react';
import { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { consecApiRef } from '../../api';
import { mockConsecApi, mockSummary } from '../../testUtils';
import { EntityConsecContent } from './EntityConsecContent';

const AMI_REF =
  'artifactory.bmc.com/lp231-bmcamiplatform-docker-qa-local/ami-agent-runtime:latest';

const entity = (annotations: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'ami-agent-runtime', annotations },
});

const render = (e: Entity, getImageSummary = async () => undefined) =>
  renderInTestApp(
    <TestApiProvider
      apis={[[consecApiRef, mockConsecApi({ getImageSummary } as any)]]}
    >
      <EntityProvider entity={e}>
        <EntityConsecContent />
      </EntityProvider>
    </TestApiProvider>,
  );

describe('EntityConsecContent', () => {
  it('derives the image from the JFrog annotations and offers a scan', async () => {
    await render(
      entity({
        'jfrog-artifactory/image-name': 'ami-agent-runtime',
        'jfrog-artifactory/repo-filter': 'lp231-bmcamiplatform-docker-qa-local',
      }),
    );
    expect(screen.getAllByText(AMI_REF).length).toBeGreaterThan(0);
    expect(await screen.findByText('Not scanned yet')).toBeInTheDocument();
    expect(screen.queryByText('Not scanned')).not.toBeInTheDocument();
  });

  it('shows header chips only while an image is collapsed', async () => {
    await render(
      entity({ 'consec.io/image-ref': 'ghcr.io/org/a:1, ghcr.io/org/b:2' }),
      async () => mockSummary() as any,
    );
    expect(screen.getAllByText('ghcr.io/org/a:1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ghcr.io/org/b:2').length).toBeGreaterThan(0);
    // Both panels stay mounted. Only the collapsed second image adds header chips.
    await waitFor(() => expect(screen.getAllByText('FAIL')).toHaveLength(3));
    expect(screen.getAllByText('Critical 2')).toHaveLength(3);

    fireEvent.click(screen.getByText('ghcr.io/org/a:1'));
    await waitFor(() => expect(screen.getAllByText('FAIL')).toHaveLength(4));
  });

  it('explains how to add an image when none is known', async () => {
    await render(entity({}));
    expect(screen.getByText('No container images found')).toBeInTheDocument();
  });
});
