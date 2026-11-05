import React from 'react';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { ConsecApi, consecApiRef } from '../../api';
import {
  mockConsecApi,
  mockSummary,
  mockVulnerability,
} from '../../testUtils';
import { ImagePanel } from './ImagePanel';

const REF = 'artifactory.bmc.com/team/ami-agent-runtime:latest';

const render = (api: ConsecApi) =>
  renderInTestApp(
    <TestApiProvider apis={[[consecApiRef, api]]}>
      <ImagePanel reference={REF} sources={['jfrog']} />
    </TestApiProvider>,
  );

describe('ImagePanel', () => {
  afterEach(() => jest.useRealTimers());

  it('offers a scan for an image ConSec has never seen', async () => {
    await render(mockConsecApi());
    expect(screen.getByText('Not scanned yet')).toBeInTheDocument();
    expect(screen.getByText('JFrog Artifactory')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Scan ${REF}` })).toBeEnabled();
  });

  it('starts a scan, polls it, and shows the result when it completes', async () => {
    jest.useFakeTimers();
    const getImageSummary = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(mockSummary({ reference: REF }));
    const triggerScan = jest
      .fn()
      .mockResolvedValue({ scanId: 5, imageId: 9, status: 'queued' });
    const getScanStatus = jest
      .fn()
      .mockResolvedValue({ scanId: 5, imageId: 9, status: 'completed' });
    await render(
      mockConsecApi({ getImageSummary, triggerScan, getScanStatus }),
    );

    fireEvent.click(screen.getByRole('button', { name: `Scan ${REF}` }));
    expect(
      await screen.findByText('Scan queued. This page updates when it finishes.'),
    ).toBeInTheDocument();
    expect(triggerScan).toHaveBeenCalledWith(REF);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await waitFor(() => expect(getScanStatus).toHaveBeenCalledWith(5));
    expect(await screen.findByText('FAIL')).toBeInTheDocument();
  });

  it('shows why a scan could not start', async () => {
    const error = Object.assign(new Error('Request failed'), {
      body: { error: { message: 'Too many scans started.' } },
    });
    await render(
      mockConsecApi({ triggerScan: jest.fn().mockRejectedValue(error) }),
    );
    fireEvent.click(screen.getByRole('button', { name: `Scan ${REF}` }));
    expect(await screen.findByText('Too many scans started.')).toBeInTheDocument();
  });

  it('shows counts and every vulnerability for a scanned image', async () => {
    const listVulnerabilities = jest.fn().mockResolvedValue({
      items: [mockVulnerability()],
      total: 1,
    });
    await render(
      mockConsecApi({
        getImageSummary: async () => mockSummary({ reference: REF }),
        listVulnerabilities,
      }),
    );
    expect(screen.getByText('FAIL')).toBeInTheDocument();
    expect(screen.getByText('Critical 2')).toBeInTheDocument();
    expect(await screen.findByText('CVE-2024-0001')).toBeInTheDocument();
    expect(screen.getByText('3.0.2')).toBeInTheDocument();
    expect(listVulnerabilities).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ sort: 'priority', limit: 20, offset: 0 }),
    );
    expect(screen.getByRole('button', { name: `Scan ${REF} again` })).toBeEnabled();
  });
});
