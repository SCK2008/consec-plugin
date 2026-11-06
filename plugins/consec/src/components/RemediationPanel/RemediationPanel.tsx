import React from 'react';
import { CodeSnippet } from '@backstage/core-components';
import Accordion from '@material-ui/core/Accordion';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { RemediationGroup, RemediationPackage, RemediationPlan } from '../../api';
import { SeverityChip } from '../common';
import { FixOsButton } from './FixOsButton';

const useStyles = makeStyles(theme => ({
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  stat: { padding: theme.spacing(1.5) },
  statValue: { fontSize: 26, fontWeight: 700, lineHeight: 1.2 },
  section: { marginBottom: theme.spacing(2) },
  sectionHead: {
    display: 'flex',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
  },
  grow: { flexGrow: 1, minWidth: 220 },
  command: { padding: theme.spacing(0, 2, 1) },
  mono: { fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' },
  fixed: { backgroundColor: '#E8F5E9', color: '#1B5E20', fontWeight: 600 },
  empty: { padding: theme.spacing(2) },
}));

/**
 * A package can list fixes for several release lines, e.g. python
 * "3.11.15, 3.12.13, 3.13.10". Prefer the one on the installed line.
 */
export const bestFix = (pkg: RemediationPackage): string | undefined => {
  const options = (pkg.fixedVersion ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (options.length === 0) return undefined;
  const line = pkg.currentVersion.split('.').slice(0, 2).join('.');
  return options.find(option => option.startsWith(`${line}.`)) ?? options[0];
};

const VulnIds = ({ ids }: { ids: string[] }) => {
  const shown = ids.slice(0, 3);
  const hidden = ids.length - shown.length;
  return (
    <Typography variant="caption" color="textSecondary">
      {shown.join(', ')}
      {hidden > 0 && (
        <Tooltip title={ids.slice(3).join(', ')}>
          <span> +{hidden} more</span>
        </Tooltip>
      )}
    </Typography>
  );
};

const PackageTable = ({ group }: { group: RemediationGroup }) => {
  const classes = useStyles();
  if (group.packages.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary" className={classes.empty}>
        Nothing in this group.
      </Typography>
    );
  }
  return (
    <Box overflow="auto">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Package</TableCell>
            <TableCell>Installed</TableCell>
            <TableCell>Upgrade to</TableCell>
            <TableCell>Worst</TableCell>
            <TableCell align="right">Findings</TableCell>
            <TableCell>Vulnerabilities</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {group.packages.map(pkg => {
            const fix = bestFix(pkg);
            return (
              <TableRow key={`${pkg.name}@${pkg.currentVersion}`}>
                <TableCell>
                  <Typography variant="body2" style={{ fontWeight: 600 }}>
                    {pkg.name}
                  </Typography>
                  {pkg.type && (
                    <Typography variant="caption" color="textSecondary">
                      {pkg.type}
                    </Typography>
                  )}
                </TableCell>
                <TableCell className={classes.mono}>{pkg.currentVersion}</TableCell>
                <TableCell>
                  {fix ? (
                    <Tooltip title={pkg.fixedVersion ?? fix}>
                      <Chip size="small" label={fix} className={classes.fixed} />
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="textSecondary">
                      No fix published
                    </Typography>
                  )}
                </TableCell>
                <TableCell style={{ whiteSpace: 'nowrap' }}>
                  <SeverityChip severity={pkg.topSeverity} />
                  {pkg.kev && <Chip size="small" color="secondary" label="KEV" />}
                </TableCell>
                <TableCell align="right">{pkg.vulnCount}</TableCell>
                <TableCell>
                  <VulnIds ids={pkg.vulnIds} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};

const Stat = ({ label, value, hint }: { label: string; value: number; hint: string }) => {
  const classes = useStyles();
  return (
    <Paper variant="outlined" className={classes.stat}>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography className={classes.statValue}>{value}</Typography>
      <Typography variant="caption" color="textSecondary">
        {hint}
      </Typography>
    </Paper>
  );
};

export type RemediationPanelProps = {
  imageId: number;
  reference: string;
  plan: RemediationPlan;
};

/** Findings grouped by the fix that clears them, with the one-click OS fix. */
export const RemediationPanel = ({ imageId, reference, plan }: RemediationPanelProps) => {
  const classes = useStyles();
  const { summary } = plan;
  return (
    <Box>
      <Box className={classes.stats}>
        <Stat label="OS package updates" value={summary.osUpdate} hint="Cleared by patching the base" />
        <Stat label="Dependency upgrades" value={summary.dependencyUpgrade} hint="App libraries you control" />
        <Stat label="No upstream fix" value={summary.noFix} hint="Remove, replace, or accept" />
        <Stat label="Risk accepted" value={summary.excepted} hint="Excluded from the gate" />
      </Box>

      <Paper variant="outlined" className={classes.section}>
        <Box className={classes.sectionHead}>
          <Box className={classes.grow}>
            <Typography variant="h6">OS package updates</Typography>
            <Typography variant="body2" color="textSecondary">
              Patched by the distro. The ConSec agent rebuilds the image with
              these updates in one click.
            </Typography>
          </Box>
          <FixOsButton
            imageId={imageId}
            reference={reference}
            osUpdates={summary.osUpdate}
            size="medium"
          />
        </Box>
        {plan.osUpdate.combinedCommand && (
          <Box className={classes.command}>
            <Typography variant="caption" color="textSecondary">
              Or add this to the Dockerfile yourself
            </Typography>
            <CodeSnippet
              language="bash"
              text={plan.osUpdate.combinedCommand}
              showCopyCodeButton
            />
          </Box>
        )}
        <PackageTable group={plan.osUpdate} />
      </Paper>

      <Paper variant="outlined" className={classes.section}>
        <Box className={classes.sectionHead}>
          <Box className={classes.grow}>
            <Typography variant="h6">Dependency upgrades</Typography>
            <Typography variant="body2" color="textSecondary">
              Bump these in the application's manifest and rebuild.
            </Typography>
          </Box>
        </Box>
        {plan.dependencyUpgrade.combinedCommand && (
          <Box className={classes.command}>
            <CodeSnippet
              language="bash"
              text={plan.dependencyUpgrade.combinedCommand}
              showCopyCodeButton
            />
          </Box>
        )}
        <PackageTable group={plan.dependencyUpgrade} />
      </Paper>

      <Accordion variant="outlined" TransitionProps={{ unmountOnExit: true }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography variant="h6">No upstream fix ({plan.noFix.packages.length} packages)</Typography>
            <Typography variant="body2" color="textSecondary">
              No patched version exists yet. Remove the package, replace it, or
              record a risk exception in ConSec.
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails style={{ display: 'block', padding: 0 }}>
          <PackageTable group={plan.noFix} />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
