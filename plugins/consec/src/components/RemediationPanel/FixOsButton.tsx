import React, { useState } from 'react';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Tooltip from '@material-ui/core/Tooltip';
import BuildIcon from '@material-ui/icons/Build';
import { consecApiRef } from '../../api';
import { errorMessage } from '../common';

export type FixOsButtonProps = {
  imageId: number;
  reference: string;
  /** OS packages with a published fix. 0 disables the button. */
  osUpdates?: number;
  size?: 'small' | 'medium';
};

/**
 * Opens the ConSec agent workspace that patches the image's OS packages, in a
 * new tab. The tab is opened before the request so popup blockers allow it.
 */
export const FixOsButton = ({
  imageId,
  reference,
  osUpdates,
  size = 'small',
}: FixOsButtonProps) => {
  const consec = useApi(consecApiRef);
  const alertApi = useApi(alertApiRef);
  const [busy, setBusy] = useState(false);
  const nothingToFix = osUpdates === 0;

  const fix = async () => {
    setBusy(true);
    const tab = window.open('about:blank', '_blank');
    try {
      const workspace = await consec.fixImage(imageId);
      if (tab && workspace.url) {
        tab.opener = null;
        tab.location.href = workspace.url;
      } else {
        tab?.close();
      }
      alertApi.post({
        message: workspace.created
          ? 'ConSec opened a fix workspace. The agent patches the OS packages there.'
          : 'Reopened the existing ConSec fix workspace for this image.',
        severity: 'success',
        display: 'transient',
      });
    } catch (error) {
      tab?.close();
      alertApi.post({
        message: `Could not start the fix: ${errorMessage(error, 'ConSec could not open the fix')}`,
        severity: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const title = nothingToFix
    ? 'No OS package in this image has a published fix'
    : 'The ConSec agent rebuilds the image with patched OS packages. Dependency upgrades need a source workspace.';

  return (
    <Tooltip title={title}>
      <span>
        <Button
          size={size}
          variant="contained"
          color="primary"
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <BuildIcon />}
          onClick={fix}
          disabled={busy || nothingToFix}
          aria-label={`Fix OS issues in ${reference}`}
        >
          {busy
            ? 'Opening fix'
            : `Fix OS issues${osUpdates ? ` (${osUpdates})` : ''}`}
        </Button>
      </span>
    </Tooltip>
  );
};
