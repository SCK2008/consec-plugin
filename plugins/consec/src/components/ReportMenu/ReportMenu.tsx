import React, { useState } from 'react';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import GetAppIcon from '@material-ui/icons/GetApp';
import { consecApiRef, DOWNLOAD_FORMATS, DownloadFormat } from '../../api';

/** "registry/team/app:1.2" becomes "app-1.2". */
export const fileStem = (reference: string): string => {
  const name = reference.slice(reference.lastIndexOf('/') + 1).split('@')[0];
  return name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const GROUPS: Array<{ kind: DownloadFormat['kind']; title: string }> = [
  { kind: 'report', title: 'Scan report' },
  { kind: 'sbom', title: 'SBOM' },
];

export type ReportMenuProps = {
  imageId: number;
  reference: string;
};

/** Downloads the latest scan's report or SBOM in any format ConSec serves. */
export const ReportMenu = ({ imageId, reference }: ReportMenuProps) => {
  const consec = useApi(consecApiRef);
  const alertApi = useApi(alertApiRef);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState<string>();

  const download = async (option: DownloadFormat) => {
    setAnchor(null);
    setBusy(option.format);
    try {
      const blob = await consec.download(imageId, option.kind, option.format);
      saveBlob(blob, `${fileStem(reference)}.${option.extension}`);
    } catch (error) {
      alertApi.post({
        message: `Could not download ${option.label}: ${(error as Error).message}`,
        severity: 'error',
      });
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={busy ? <CircularProgress size={14} /> : <GetAppIcon />}
        endIcon={<ArrowDropDownIcon />}
        onClick={event => setAnchor(event.currentTarget)}
        disabled={busy !== undefined}
        aria-haspopup="menu"
        aria-label={`Download report or SBOM for ${reference}`}
      >
        {busy ? 'Downloading' : 'Report'}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {GROUPS.flatMap(group => [
          <ListSubheader key={group.kind} disableSticky>
            {group.title}
          </ListSubheader>,
          ...DOWNLOAD_FORMATS.filter(option => option.kind === group.kind).map(
            option => (
              <MenuItem
                key={`${option.kind}-${option.format}`}
                onClick={() => download(option)}
                dense
              >
                <ListItemText
                  primary={option.label}
                  secondary={option.description}
                />
              </MenuItem>
            ),
          ),
        ])}
      </Menu>
    </>
  );
};
