import React from 'react';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Box from '@material-ui/core/Box';
import LinearProgress from '@material-ui/core/LinearProgress';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import CancelIcon from '@material-ui/icons/Cancel';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import InfoIcon from '@material-ui/icons/Info';
import WarningIcon from '@material-ui/icons/Warning';
import useAsync from 'react-use/esm/useAsync';
import { consecApiRef, ThreatCheck } from '../../api';
import { SEVERITY_COLORS } from '../common';

const GRADE_COLORS: Record<string, string> = {
  A: '#2E7D32',
  B: '#689F38',
  C: SEVERITY_COLORS.medium,
  D: SEVERITY_COLORS.high,
  F: SEVERITY_COLORS.critical,
};

const STATUS_ORDER: Record<string, number> = { fail: 0, warn: 1, info: 2, pass: 3 };

const STATUS_ICON: Record<string, { icon: React.ReactElement; label: string }> = {
  fail: { icon: <CancelIcon style={{ color: SEVERITY_COLORS.critical }} />, label: 'Failed' },
  warn: { icon: <WarningIcon style={{ color: SEVERITY_COLORS.high }} />, label: 'Warning' },
  pass: { icon: <CheckCircleIcon style={{ color: '#2E7D32' }} />, label: 'Passed' },
  info: { icon: <InfoIcon color="action" />, label: 'Info' },
};

const useStyles = makeStyles(theme => ({
  score: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
  },
  grade: {
    width: 56,
    height: 56,
    borderRadius: theme.shape.borderRadius * 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.common.white,
    fontSize: 28,
    fontWeight: 700,
    flexShrink: 0,
  },
  bar: { height: 6, borderRadius: 3, marginTop: theme.spacing(1), maxWidth: 320 },
  checks: { marginTop: theme.spacing(2) },
}));

const sortChecks = (checks: ThreatCheck[]) =>
  [...checks].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2),
  );

/** Attack-surface scorecard of the latest scan: grade, score, and every check. */
export const ThreatModelPanel = ({ imageId }: { imageId: number }) => {
  const classes = useStyles();
  const consec = useApi(consecApiRef);
  const { value, loading, error } = useAsync(
    () => consec.getThreatModel(imageId),
    [consec, imageId],
  );

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (!value) return null;

  const failing = value.checks.filter(check => check.status === 'fail').length;
  const warnings = value.checks.filter(check => check.status === 'warn').length;

  return (
    <Box>
      <Paper variant="outlined" className={classes.score}>
        <Box
          className={classes.grade}
          style={{ backgroundColor: GRADE_COLORS[value.grade] ?? SEVERITY_COLORS.unknown }}
          aria-label={`Threat grade ${value.grade}`}
        >
          {value.grade}
        </Box>
        <Box flexGrow={1} minWidth={0}>
          <Typography variant="h6">
            {value.score}
            <Typography component="span" variant="body2" color="textSecondary">
              {' '}
              / 100 attack-surface score
            </Typography>
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {value.summary}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, value.score))}
            className={classes.bar}
          />
        </Box>
        <Box textAlign="right">
          <Typography variant="body2">
            <b>{failing}</b> failed · <b>{warnings}</b> warnings
          </Typography>
          <Typography variant="caption" color="textSecondary">
            of {value.checks.length} checks
          </Typography>
        </Box>
      </Paper>
      <Paper variant="outlined" className={classes.checks}>
        <List dense disablePadding aria-label="Threat checks">
          {sortChecks(value.checks).map((check, index) => {
            const status = STATUS_ICON[check.status] ?? STATUS_ICON.info;
            return (
              <ListItem key={check.id} divider={index < value.checks.length - 1}>
                <ListItemIcon aria-label={status.label}>{status.icon}</ListItemIcon>
                <ListItemText primary={check.title} secondary={check.detail} />
              </ListItem>
            );
          })}
        </List>
      </Paper>
    </Box>
  );
};
