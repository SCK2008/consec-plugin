import React from 'react';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { ConsecApi, consecApiRef } from '../../api';
import {
  mockConsecApi,
  mockRemediation,
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

  it('shows the remediation plan and fixes OS issues in one click', async () => {
    const fixImage = jest.fn().mockResolvedValue({
      workspaceId: 5,
      created: true,
      url: 'https://consec.test/kavach/workspaces/5',
    });
    const tab = { opener: {}, location: { href: '' }, close: jest.fn() };
    const open = jest.spyOn(window, 'open').mockReturnValue(tab as any);
    await render(
      mockConsecApi({
        getImageSummary: async () => mockSummary({ reference: REF }),
        fixImage,
      }),
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Remediation (4 fixable)' }));
    expect(await screen.findByText('OS package updates', { selector: 'h6' })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.body.textContent).toContain('apk add --no-cache --upgrade openssl'),
    );
    expect(screen.getByText('lodash')).toBeInTheDocument();

    const [headerFix] = screen.getAllByRole('button', { name: `Fix OS issues in ${REF}` });
    await waitFor(() => expect(headerFix).toBeEnabled());
    fireEvent.click(headerFix);
    await waitFor(() => expect(fixImage).toHaveBeenCalledWith(7));
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    await waitFor(() =>
      expect(tab.location.href).toBe('https://consec.test/kavach/workspaces/5'),
    );
    expect(tab.opener).toBeNull();
    open.mockRestore();
  });

  it('disables the OS fix when no OS package has a fix', async () => {
    await render(
      mockConsecApi({
        getImageSummary: async () => mockSummary({ reference: REF }),
        getRemediation: async () =>
          mockRemediation({
            summary: { osUpdate: 0, dependencyUpgrade: 1, noFix: 0, excepted: 0 },
          }),
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: `Fix OS issues in ${REF}` }),
      ).toBeDisabled(),
    );
  });

  it('shows the threat model', async () => {
    await render(
      mockConsecApi({ getImageSummary: async () => mockSummary({ reference: REF }) }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Threat model' }));
    expect(await screen.findByLabelText('Threat grade B')).toBeInTheDocument();
    const checks = screen.getAllByRole('listitem').map(item => item.textContent);
    expect(checks[0]).toContain('Critical vulnerabilities present');
    expect(checks[2]).toContain('Runs as non-root user');
  });

  it('downloads a report or SBOM in the chosen format', async () => {
    const download = jest.fn().mockResolvedValue(new Blob(['<bom/>']));
    const createObjectURL = jest.fn().mockReturnValue('blob:x');
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('ami-agent-runtime-latest.cdx.xml');
      });
    await render(
      mockConsecApi({
        getImageSummary: async () => mockSummary({ reference: REF }),
        download,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: `Download report or SBOM for ${REF}` }),
    );
    expect(screen.getByText('Report (HTML)')).toBeInTheDocument();
    expect(screen.getByText('SPDX JSON')).toBeInTheDocument();
    fireEvent.click(screen.getByText('CycloneDX XML'));
    await waitFor(() => expect(download).toHaveBeenCalledWith(7, 'sbom', 'cyclonedx-xml'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });
});
