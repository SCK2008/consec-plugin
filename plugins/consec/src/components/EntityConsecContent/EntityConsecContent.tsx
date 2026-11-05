import React, { useCallback, useState } from 'react';
import {
  CodeSnippet,
  Content,
  ContentHeader,
  EmptyState,
  SupportButton,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import Accordion from '@material-ui/core/Accordion';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Alert from '@material-ui/lab/Alert';
import { ImageSummary } from '../../api';
import { CONSEC_IMAGE_REF_ANNOTATION } from '../../annotations';
import { useEntityImages } from '../../hooks/useEntityImages';
import { GateChip, ImageRef, SeverityChip } from '../common';
import { ImagePanel } from '../ImagePanel';

const useStyles = makeStyles(theme => ({
  summary: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    width: '100%',
  },
  ref: { flexGrow: 1, minWidth: 0 },
  details: { display: 'block' },
}));

const ANNOTATION_EXAMPLE = `metadata:
  annotations:
    ${CONSEC_IMAGE_REF_ANNOTATION}: registry.example.com/team/app:1.2.3`;

const HeaderStatus = ({ summary }: { summary?: ImageSummary | null }) => {
  if (summary === undefined) return null;
  if (summary === null) {
    return <Chip size="small" variant="outlined" label="Not scanned" />;
  }
  return (
    <>
      <GateChip gate={summary.gate} status={summary.status} />
      <SeverityChip severity="critical" count={summary.critical} />
      <SeverityChip severity="high" count={summary.high} />
    </>
  );
};

/** Entity tab: every image of the component, its scan, and all findings. */
export const EntityConsecContent = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const { images, loadingKubernetes, kubernetesError } =
    useEntityImages(entity);
  const [summaries, setSummaries] = useState<
    Record<string, ImageSummary | null>
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const onSummary = useCallback(
    (reference: string) => (summary: ImageSummary | undefined) =>
      setSummaries(current =>
        current[reference] === (summary ?? null)
          ? current
          : { ...current, [reference]: summary ?? null },
      ),
    [],
  );

  const isExpanded = (reference: string, index: number) =>
    expanded[reference] ?? index === 0;

  return (
    <Content noPadding>
      <ContentHeader title="Container images">
        <SupportButton>
          Images come from the {CONSEC_IMAGE_REF_ANNOTATION} annotation, the
          JFrog Artifactory annotations, and the pods running in Kubernetes.
        </SupportButton>
      </ContentHeader>
      {loadingKubernetes && (
        <Box mb={2}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Reading images from running pods
          </Typography>
          <LinearProgress />
        </Box>
      )}
      {kubernetesError && (
        <Box mb={2}>
          <Alert severity="info">
            Running pods could not be read, so only annotated images are shown.
          </Alert>
        </Box>
      )}
      {images.length === 0 && !loadingKubernetes && (
        <EmptyState
          missing="field"
          title="No container images found"
          description="Add the ConSec image annotation to this entity, or deploy it to Kubernetes, to see its scan results here."
          action={
            <CodeSnippet language="yaml" text={ANNOTATION_EXAMPLE} />
          }
        />
      )}
      {images.map((image, index) => (
        <Accordion
          key={image.reference}
          expanded={isExpanded(image.reference, index)}
          onChange={(_e, open) =>
            setExpanded(current => ({ ...current, [image.reference]: open }))
          }
          TransitionProps={{ unmountOnExit: false }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box className={classes.summary}>
              <Box className={classes.ref}>
                <ImageRef reference={image.reference} />
              </Box>
              <HeaderStatus summary={summaries[image.reference]} />
            </Box>
          </AccordionSummary>
          <AccordionDetails className={classes.details}>
            <ImagePanel
              reference={image.reference}
              sources={image.sources}
              hideReference
              onSummary={onSummary(image.reference)}
            />
          </AccordionDetails>
        </Accordion>
      ))}
    </Content>
  );
};
