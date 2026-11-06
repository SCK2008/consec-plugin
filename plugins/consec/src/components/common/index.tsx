import React from 'react';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { DateTime } from 'luxon';
import { Gate, ImageSummary } from '../../api';

/** Chip fill per severity: critical red, high orange, medium yellow. */
export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#C62828',
  high: '#EF6C00',
  medium: '#FBC02D',
  low: '#1976D2',
  negligible: '#78909C',
  unknown: '#78909C',
};

/** Text on the chip fill; white fails contrast on yellow. */
const SEVERITY_ON_COLORS: Record<string, string> = {
  medium: '#3E2C00',
};

/** Plain-text count colours, darker so yellow stays readable on white. */
export const SEVERITY_TEXT_COLORS: Record<string, string> = {
  critical: '#C62828',
  high: '#E65100',
  medium: '#A67C00',
  low: '#1565C0',
};

export const severityChipStyle = (severity: string): React.CSSProperties => {
  const key = severity.toLowerCase();
  return {
    backgroundColor: SEVERITY_COLORS[key] ?? SEVERITY_COLORS.unknown,
    color: SEVERITY_ON_COLORS[key] ?? '#FFFFFF',
  };
};

const useStyles = makeStyles((theme: Theme) => ({
  chip: {
    fontWeight: 600,
    color: theme.palette.common.white,
    marginRight: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  outlined: {
    fontWeight: 600,
    marginRight: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  zero: {
    opacity: 0.45,
  },
  mono: {
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
}));

/** Message from a Backstage ResponseError or a ConSec problem body. */
export const errorMessage = (
  error: unknown,
  fallback = 'The scan could not be started',
): string => {
  const anyError = error as { body?: any; message?: string };
  const detail =
    anyError?.body?.error?.message ??
    anyError?.body?.detail ??
    anyError?.body?.error;
  if (typeof detail === 'string' && detail) return detail;
  return anyError?.message ?? fallback;
};

const RUNNING = new Set(['queued', 'running']);

export const isScanInProgress = (status?: string): boolean =>
  RUNNING.has(status ?? '');

export const GateChip = ({
  gate,
  status,
}: {
  gate: Gate;
  status?: string;
}) => {
  const classes = useStyles();
  if (isScanInProgress(status)) {
    return (
      <Chip
        size="small"
        label="Scanning"
        className={classes.chip}
        style={{ backgroundColor: '#5E35B1' }}
      />
    );
  }
  if (gate === 'fail') {
    return (
      <Tooltip title="The ConSec policy gate fails for the latest scan">
        <Chip
          size="small"
          label="FAIL"
          className={classes.chip}
          style={{ backgroundColor: SEVERITY_COLORS.critical }}
        />
      </Tooltip>
    );
  }
  if (gate === 'pass') {
    return (
      <Tooltip title="The ConSec policy gate passes for the latest scan">
        <Chip
          size="small"
          label="PASS"
          className={classes.chip}
          style={{ backgroundColor: '#2E7D32' }}
        />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="ConSec has not evaluated the policy gate for this image">
      <Chip size="small" variant="outlined" label="NOT EVALUATED" className={classes.outlined} />
    </Tooltip>
  );
};

export const SeverityChip = ({
  severity,
  count,
}: {
  severity: string;
  count?: number;
}) => {
  const classes = useStyles();
  const key = severity.toLowerCase();
  const label =
    count === undefined
      ? key.toUpperCase()
      : `${key.charAt(0).toUpperCase()}${key.slice(1)} ${count}`;
  return (
    <Chip
      size="small"
      label={label}
      className={`${classes.chip} ${count === 0 ? classes.zero : ''}`}
      style={severityChipStyle(key)}
    />
  );
};

export const SeverityCounts = ({ summary }: { summary: ImageSummary }) => {
  const classes = useStyles();
  return (
    <Box display="flex" flexWrap="wrap" alignItems="center">
      <SeverityChip severity="critical" count={summary.critical} />
      <SeverityChip severity="high" count={summary.high} />
      <SeverityChip severity="medium" count={summary.medium} />
      <SeverityChip severity="low" count={summary.low} />
      <Tooltip title="Findings with a fixed version available">
        <Chip
          size="small"
          variant="outlined"
          label={`Fixable ${summary.fixable}`}
          className={classes.outlined}
        />
      </Tooltip>
      <Tooltip title="On the CISA Known Exploited Vulnerabilities list">
        <Chip
          size="small"
          variant={summary.kev > 0 ? 'default' : 'outlined'}
          color={summary.kev > 0 ? 'secondary' : 'default'}
          label={`KEV ${summary.kev}`}
          className={classes.outlined}
        />
      </Tooltip>
      <Tooltip title="Secrets found in the image layers">
        <Chip
          size="small"
          variant="outlined"
          label={`Secrets ${summary.secrets}`}
          className={classes.outlined}
        />
      </Tooltip>
    </Box>
  );
};

export const ImageRef = ({
  reference,
  variant = 'body2',
}: {
  reference: string;
  variant?: 'body1' | 'body2' | 'subtitle1' | 'h6';
}) => {
  const classes = useStyles();
  return (
    <Typography variant={variant} className={classes.mono} component="span">
      {reference}
    </Typography>
  );
};

/** Image name and tag on top, registry path below, for narrow table cells. */
export const ImageName = ({ reference }: { reference: string }) => {
  const classes = useStyles();
  const slash = reference.lastIndexOf('/');
  const name = slash >= 0 ? reference.slice(slash + 1) : reference;
  const path = slash >= 0 ? reference.slice(0, slash) : '';
  return (
    <Tooltip title={reference}>
      <span>
        <Typography variant="body2" className={classes.mono} style={{ fontWeight: 600 }}>
          {name}
        </Typography>
        {path && (
          <Typography
            variant="caption"
            color="textSecondary"
            className={classes.mono}
            style={{ display: 'block' }}
          >
            {path}
          </Typography>
        )}
      </span>
    </Tooltip>
  );
};

export const lastChecked = (iso?: string): string => {
  if (!iso) return 'Never checked';
  const time = DateTime.fromISO(iso);
  return time.isValid ? time.toRelative() ?? iso : 'Never checked';
};

export const statusLabel = (status?: string): string => {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Scanning';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'dead_letter':
      return 'Failed (gave up)';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || 'Unknown';
  }
};
