import {
  EmptyState,
  InfoCard,
  InfoCardVariants,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  MissingAnnotationEmptyState,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { DateTime } from 'luxon';
import { PropsWithChildren } from 'react';
import useAsync from 'react-use/esm/useAsync';
import { ImageSummary, consecApiRef } from '../../api';
import {
  CONSEC_IMAGE_REF_ANNOTATION,
  getImageRef,
} from '../../annotations';

const useStyles = makeStyles(theme => ({
  pass: {
    color: theme.palette.success.main,
    fontSize: '2.5rem',
    fontWeight: theme.typography.fontWeightMedium as number | undefined,
    textAlign: 'center',
  },
  fail: {
    color: theme.palette.error.main,
    fontSize: '2.5rem',
    fontWeight: theme.typography.fontWeightMedium as number | undefined,
    textAlign: 'center',
  },
  none: {
    color: theme.palette.text.secondary,
    fontSize: '1.5rem',
    fontWeight: theme.typography.fontWeightMedium as number | undefined,
    textAlign: 'center',
  },
  counts: {
    display: 'flex',
    justifyContent: 'space-around',
    marginTop: theme.spacing(2),
  },
  count: {
    textAlign: 'center',
  },
  meta: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(2),
    textAlign: 'center',
  },
}));

const SEVERITY: Array<[string, keyof ImageSummary]> = [
  ['Critical', 'critical'],
  ['High', 'high'],
  ['Medium', 'medium'],
  ['Low', 'low'],
];

const EXTRA: Array<[string, keyof ImageSummary]> = [
  ['Fixable', 'fixable'],
  ['KEV', 'kev'],
  ['Secrets', 'secrets'],
];

const Card = ({
  children,
  url,
  variant = 'gridItem',
}: PropsWithChildren<{ url?: string; variant?: InfoCardVariants }>) => (
  <InfoCard
    title="Container Security"
    variant={variant}
    deepLink={url ? { title: 'View in ConSec', link: url } : undefined}
  >
    {children}
  </InfoCard>
);

const gateLabel = (gate: ImageSummary['gate']) => {
  if (gate === 'pass') return 'PASS';
  if (gate === 'fail') return 'FAIL';
  return 'NOT EVALUATED';
};

export const ConsecCard = (props: { variant?: InfoCardVariants }) => {
  const { variant } = props;
  const classes = useStyles();
  const { entity } = useEntity();
  const consecApi = useApi(consecApiRef);
  const imageRef = getImageRef(entity);
  const { value, loading, error } = useAsync(
    async () => (imageRef ? consecApi.getImageSummary(imageRef) : undefined),
    [consecApi, imageRef],
  );

  if (error) {
    return (
      <Card variant={variant}>
        <ResponseErrorPanel error={error} />
      </Card>
    );
  }
  if (loading) {
    return (
      <Card variant={variant}>
        <Progress />
      </Card>
    );
  }
  if (!imageRef) {
    return (
      <Card variant={variant}>
        <MissingAnnotationEmptyState annotation={CONSEC_IMAGE_REF_ANNOTATION} />
      </Card>
    );
  }
  if (!value) {
    return (
      <Card variant={variant}>
        <EmptyState
          missing="info"
          title="No information to display"
          description={`ConSec has not scanned '${imageRef}'.`}
        />
      </Card>
    );
  }

  const relative = value.lastCheckedAt
    ? DateTime.fromISO(value.lastCheckedAt).toRelative()
    : null;
  const checked = relative ? `Last checked ${relative}` : 'Never checked';

  return (
    <Card url={value.url} variant={variant}>
      <Typography className={classes[value.gate]}>{gateLabel(value.gate)}</Typography>
      {value.status !== 'completed' && (
        <Typography className={classes.meta}>Latest scan: {value.status}</Typography>
      )}
      <div className={classes.counts}>
        {SEVERITY.map(([label, key]) => (
          <div key={label} className={classes.count}>
            <Typography variant="h6">{value[key]}</Typography>
            <Typography variant="caption">{label}</Typography>
          </div>
        ))}
      </div>
      <div className={classes.counts}>
        {EXTRA.map(([label, key]) => (
          <div key={label} className={classes.count}>
            <Typography variant="h6">{value[key]}</Typography>
            <Typography variant="caption">{label}</Typography>
          </div>
        ))}
      </div>
      <Typography className={classes.meta}>{checked}</Typography>
    </Card>
  );
};
