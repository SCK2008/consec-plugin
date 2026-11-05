import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import LinearProgress from '@material-ui/core/LinearProgress';
import Paper from '@material-ui/core/Paper';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import RefreshIcon from '@material-ui/icons/Refresh';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import Alert from '@material-ui/lab/Alert';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import { ImageSource } from '../../annotations';
import { consecApiRef, ImageSummary } from '../../api';
import {
  GateChip,
  ImageRef,
  isScanInProgress,
  lastChecked,
  SeverityCounts,
  statusLabel,
} from '../common';
import { VulnerabilityTable } from '../VulnerabilityTable';

const POLL_MS = 5000;

const SOURCE_LABELS: Record<ImageSource, string> = {
  annotation: 'consec.io/image-ref',
  jfrog: 'JFrog Artifactory',
  kubernetes: 'Running in Kubernetes',
};

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  grow: { flexGrow: 1, minWidth: 0 },
  meta: { marginTop: theme.spacing(0.5), marginBottom: theme.spacing(1.5) },
  actions: { display: 'flex', gap: theme.spacing(1) },
  empty: {
    padding: theme.spacing(4),
    textAlign: 'center',
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  source: { height: 22 },
}));

export const errorMessage = (error: unknown): string => {
  const anyError = error as { body?: any; message?: string };
  const detail =
    anyError?.body?.error?.message ??
    anyError?.body?.detail ??
    anyError?.body?.error;
  if (typeof detail === 'string' && detail) return detail;
  return anyError?.message ?? 'The scan could not be started';
};

export type ImagePanelProps = {
  reference: string;
  sources?: ImageSource[];
  /** Hide the findings table, e.g. inside a compact list. */
  hideVulnerabilities?: boolean;
  /** Hide the reference when a surrounding header already shows it. */
  hideReference?: boolean;
  onSummary?: (summary: ImageSummary | undefined) => void;
};

/**
 * One image: gate, counts, every finding, and a scan button. An image ConSec
 * has never seen gets a "Scan image" call to action instead.
 */
export const ImagePanel = ({
  reference,
  sources = [],
  hideVulnerabilities,
  hideReference,
  onSummary,
}: ImagePanelProps) => {
  const classes = useStyles();
  const consec = useApi(consecApiRef);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string>();
  const [queuedScanId, setQueuedScanId] = useState<number>();

  const lookup = useAsyncRetry(
    () => consec.getImageSummary(reference),
    [consec, reference],
  );
  const summary = lookup.value;
  const refresh = useRef(lookup.retry);
  refresh.current = lookup.retry;
  const inProgress =
    queuedScanId !== undefined || isScanInProgress(summary?.status);

  useEffect(() => {
    if (!lookup.loading && !lookup.error) onSummary?.(summary);
  }, [summary, lookup.loading, lookup.error, onSummary]);

  useEffect(() => {
    if (!inProgress) return undefined;
    const timer = setInterval(async () => {
      if (queuedScanId !== undefined) {
        try {
          const status = await consec.getScanStatus(queuedScanId);
          if (isScanInProgress(status.status)) return;
          setQueuedScanId(undefined);
        } catch {
          return;
        }
      }
      refresh.current();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [inProgress, queuedScanId, consec]);

  const startScan = useCallback(async () => {
    setScanning(true);
    setScanError(undefined);
    try {
      const status = await consec.triggerScan(reference);
      setQueuedScanId(status.scanId);
      refresh.current();
    } catch (error) {
      setScanError(errorMessage(error));
    } finally {
      setScanning(false);
    }
  }, [consec, reference]);

  const sourceChips = sources.map(source => (
    <Tooltip key={source} title={`Found via ${SOURCE_LABELS[source]}`}>
      <Chip
        size="small"
        variant="outlined"
        label={SOURCE_LABELS[source]}
        className={classes.source}
      />
    </Tooltip>
  ));

  if (lookup.loading && !summary) {
    return <Progress />;
  }
  if (lookup.error) {
    return <ResponseErrorPanel error={lookup.error} />;
  }

  const firstScanPending = Boolean(summary) && inProgress && !summary?.lastCheckedAt;

  if (!summary || firstScanPending) {
    return (
      <Box className={classes.empty}>
        <Box className={classes.header} justifyContent="center" mb={1}>
          {!hideReference && (
            <ImageRef reference={reference} variant="subtitle1" />
          )}
          {sourceChips}
        </Box>
        <Typography variant="h6" gutterBottom>
          {firstScanPending ? 'Scan in progress' : 'Not scanned yet'}
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          {firstScanPending
            ? `ConSec is ${statusLabel(summary?.status).toLowerCase()} the first scan of this image.`
            : 'ConSec has no scan for this image. Start one to see its gate verdict and every vulnerability here.'}
        </Typography>
        {scanError && (
          <Box mb={2}>
            <Alert severity="error">{scanError}</Alert>
          </Box>
        )}
        {inProgress ? (
          <Box maxWidth={360} mx="auto">
            <Typography variant="body2" gutterBottom>
              Scan {statusLabel(summary?.status ?? 'queued').toLowerCase()}. This
              page updates when it finishes.
            </Typography>
            <LinearProgress />
          </Box>
        ) : (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={startScan}
            disabled={scanning}
            aria-label={`Scan ${reference}`}
          >
            {scanning ? 'Starting scan' : 'Scan image'}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Box className={classes.header}>
        <GateChip gate={summary.gate} status={summary.status} />
        <Box className={classes.grow}>
          {hideReference ? (
            sourceChips
          ) : (
            <ImageRef reference={summary.reference} variant="subtitle1" />
          )}
        </Box>
        <Box className={classes.actions}>
          <Tooltip title="Pull the image again and run a fresh scan">
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={startScan}
                disabled={scanning || inProgress}
                aria-label={`Scan ${summary.reference} again`}
              >
                {inProgress ? 'Scanning' : 'Scan again'}
              </Button>
            </span>
          </Tooltip>
          {summary.url && (
            <Button
              size="small"
              variant="outlined"
              href={summary.url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon />}
            >
              View in ConSec
            </Button>
          )}
        </Box>
      </Box>
      {!hideReference && sourceChips.length > 0 && (
        <Box className={classes.header} mt={0.5}>
          {sourceChips}
        </Box>
      )}
      <Typography variant="body2" color="textSecondary" className={classes.meta}>
        Latest scan: {statusLabel(summary.status)} · Last checked{' '}
        {lastChecked(summary.lastCheckedAt)} · {summary.scanCount}{' '}
        {summary.scanCount === 1 ? 'scan' : 'scans'} ·{' '}
        {summary.total} findings
      </Typography>
      {inProgress && (
        <Box mb={1}>
          <LinearProgress />
        </Box>
      )}
      {scanError && (
        <Box mb={1}>
          <Alert severity="error">{scanError}</Alert>
        </Box>
      )}
      {summary.status === 'failed' && (
        <Box mb={1}>
          <Alert severity="warning">
            The latest scan failed. Counts below are from the last completed
            scan.
          </Alert>
        </Box>
      )}
      <SeverityCounts summary={summary} />
      {!hideVulnerabilities && (
        <Box mt={2}>
          <Paper variant="outlined">
            <VulnerabilityTable imageId={summary.imageId} />
          </Paper>
        </Box>
      )}
    </Box>
  );
};
