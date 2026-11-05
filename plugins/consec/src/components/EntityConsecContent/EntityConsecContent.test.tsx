import React from 'react';
import { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { screen } from '@testing-library/react';
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
    expect(screen.getAllByText('Not scanned').length).toBeGreaterThan(0);
  });

  it('lists every annotated image with its gate', async () => {
    await render(
      entity({ 'consec.io/image-ref': 'ghcr.io/org/a:1, ghcr.io/org/b:2' }),
      async () => mockSummary() as any,
    );
    expect(screen.getAllByText('ghcr.io/org/a:1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ghcr.io/org/b:2').length).toBeGreaterThan(0);
  });

  it('explains how to add an image when none is known', async () => {
    await render(entity({}));
    expect(screen.getByText('No container images found')).toBeInTheDocument();
  });
});
