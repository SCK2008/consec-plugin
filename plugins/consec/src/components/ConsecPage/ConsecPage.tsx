import React, { useMemo, useState } from 'react';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import {
  Content,
  ContentHeader,
  Header,
  Link,
  Page,
  SupportButton,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  EntityRefLink,
} from '@backstage/plugin-catalog-react';
import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import CardActionArea from '@material-ui/core/CardActionArea';
import CardContent from '@material-ui/core/CardContent';
import FormControl from '@material-ui/core/FormControl';
import Grid from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { Route, Routes, useSearchParams } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import { getEntityImages } from '../../annotations';
import {
  consecApiRef,
  ImageFilter,
  ImageSort,
  ImageSummary,
} from '../../api';
import {
  GateChip,
  ImageName,
  lastChecked,
  SEVERITY_TEXT_COLORS,
} from '../common';
import { ConsecLogo } from '../ConsecLogo';
import { ImagePanel } from '../ImagePanel';

const useStyles = makeStyles(theme => ({
  stat: { height: '100%' },
  statActive: {
    height: '100%',
    outline: `2px solid ${theme.palette.primary.main}`,
  },
  statValue: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    margin: theme.spacing(2, 0, 1),
  },
  select: { minWidth: 180 },
  count: { fontWeight: 600 },
  mono: { fontFamily: 'monospace', wordBreak: 'break-all' },
}));

type ComponentIndex = Map<string, Entity[]>;

const normalize = (reference: string) => reference.trim().toLowerCase();

/** Catalog components keyed by the images they declare. */
const useComponentIndex = (): ComponentIndex | undefined => {
  const catalogApi = useApi(catalogApiRef);
  const { value } = useAsync(async () => {
    const response = await catalogApi.getEntities({
      filter: { kind: 'Component' },
      fields: ['kind', 'metadata.namespace', 'metadata.name', 'metadata.title', 'metadata.annotations'],
    });
    const index: ComponentIndex = new Map();
    for (const entity of response.items) {
      for (const image of getEntityImages(entity)) {
        const key = normalize(image.reference);
        index.set(key, [...(index.get(key) ?? []), entity]);
      }
    }
    return index;
  }, [catalogApi]);
  return value;
};

const ComponentLinks = ({ entities }: { entities?: Entity[] }) => {
  if (!entities?.length) {
    return (
      <Typography variant="body2" color="textSecondary">
        —
      </Typography>
    );
  }
  return (
    <>
      {entities.map(entity => (
        <Box key={stringifyEntityRef(entity)}>
          <EntityRefLink entityRef={entity} defaultKind="Component" />
        </Box>
      ))}
    </>
  );
};

const Count = ({ value, severity }: { value: number; severity?: string }) => {
  const classes = useStyles();
  return (
    <Typography
      variant="body2"
      className={classes.count}
      style={{
        color: value > 0 && severity ? SEVERITY_TEXT_COLORS[severity] : undefined,
        opacity: value === 0 ? 0.45 : 1,
      }}
    >
      {value}
    </Typography>
  );
};

const STATS: Array<{ filter: ImageFilter; label: string; hint: string }> = [
  { filter: 'all', label: 'Images', hint: 'Every image ConSec knows' },
  { filter: 'failing', label: 'Failing gate', hint: 'Policy gate fails' },
  { filter: 'kev', label: 'Known exploited', hint: 'Has a CISA KEV finding' },
  { filter: 'stale', label: 'Stale', hint: 'Not scanned recently' },
  { filter: 'unscanned', label: 'Never scanned', hint: 'Registered, no scan yet' },
];

const StatCards = ({
  active,
  onSelect,
}: {
  active: ImageFilter;
  onSelect: (filter: ImageFilter) => void;
}) => {
  const classes = useStyles();
  const consec = useApi(consecApiRef);
  const { value } = useAsync(async () => {
    const totals = await Promise.all(
      STATS.map(s =>
        consec
          .listImages({ filter: s.filter, limit: 1 })
          .then(page => page.total)
          .catch(() => undefined),
      ),
    );
    return totals;
  }, [consec]);

  return (
    <Grid container spacing={2}>
      {STATS.map((stat, index) => (
        <Grid item xs={6} sm={4} md key={stat.filter}>
          <Card
            variant="outlined"
            className={active === stat.filter ? classes.statActive : classes.stat}
          >
            <CardActionArea
              onClick={() => onSelect(stat.filter)}
              aria-pressed={active === stat.filter}
            >
              <CardContent>
                <Typography className={classes.statValue}>
                  {value?.[index] ?? '–'}
                </Typography>
                <Typography variant="subtitle2">{stat.label}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {stat.hint}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

const ImageList = () => {
  const classes = useStyles();
  const consec = useApi(consecApiRef);
  const components = useComponentIndex();
  const [filter, setFilter] = useState<ImageFilter>('all');
  const [sort, setSort] = useState<ImageSort>('risk');

  const columns: TableColumn<ImageSummary>[] = useMemo(
    () => [
      {
        title: 'Gate',
        width: '130px',
        render: row => <GateChip gate={row.gate} status={row.status} />,
      },
      {
        title: 'Image',
        field: 'reference',
        width: '34%',
        render: row => (
          <Link to={`image?ref=${encodeURIComponent(row.reference)}`}>
            <ImageName reference={row.reference} />
          </Link>
        ),
      },
      {
        title: 'Component',
        render: row => (
          <ComponentLinks entities={components?.get(normalize(row.reference))} />
        ),
      },
      {
        title: 'Critical',
        width: '80px',
        render: row => <Count value={row.critical} severity="critical" />,
      },
      {
        title: 'High',
        width: '70px',
        render: row => <Count value={row.high} severity="high" />,
      },
      {
        title: 'Medium',
        width: '80px',
        render: row => <Count value={row.medium} severity="medium" />,
      },
      {
        title: 'Low',
        width: '70px',
        render: row => <Count value={row.low} severity="low" />,
      },
      {
        title: 'Fixable',
        width: '80px',
        render: row => <Count value={row.fixable} />,
      },
      {
        title: 'KEV',
        width: '60px',
        render: row => <Count value={row.kev} severity="critical" />,
      },
      {
        title: 'Last checked',
        render: row => lastChecked(row.lastCheckedAt),
      },
    ],
    [components],
  );

  return (
    <>
      <StatCards active={filter} onSelect={setFilter} />
      <Box className={classes.controls}>
        <FormControl variant="outlined" size="small" className={classes.select}>
          <InputLabel id="consec-filter">Show</InputLabel>
          <Select
            labelId="consec-filter"
            label="Show"
            value={filter}
            onChange={e => setFilter(e.target.value as ImageFilter)}
          >
            {STATS.map(s => (
              <MenuItem key={s.filter} value={s.filter}>
                {s.filter === 'all' ? 'All images' : s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" className={classes.select}>
          <InputLabel id="consec-sort">Sort by</InputLabel>
          <Select
            labelId="consec-sort"
            label="Sort by"
            value={sort}
            onChange={e => setSort(e.target.value as ImageSort)}
          >
            <MenuItem value="risk">Highest risk</MenuItem>
            <MenuItem value="last_scan">Most recently scanned</MenuItem>
            <MenuItem value="name">Name</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Table<ImageSummary>
        key={`${filter}-${sort}`}
        title="Scanned images"
        columns={columns}
        options={{
          paging: true,
          pageSize: 20,
          pageSizeOptions: [20, 50, 100],
          search: true,
          sorting: false,
          padding: 'dense',
          debounceInterval: 400,
          emptyRowsWhenPaging: false,
        }}
        localization={{
          toolbar: { searchPlaceholder: 'Search images' },
          body: { emptyDataSourceMessage: 'No images match' },
        }}
        data={async query => {
          const pageSize = query?.pageSize ?? 20;
          const page = await consec.listImages({
            q: query?.search || undefined,
            filter,
            sort,
            limit: pageSize,
            offset: (query?.page ?? 0) * pageSize,
          });
          return {
            data: page.items,
            page: query?.page ?? 0,
            totalCount: page.total,
          };
        }}
      />
    </>
  );
};

const ImageDetail = () => {
  const [params] = useSearchParams();
  const reference = params.get('ref') ?? '';
  const components = useComponentIndex();
  const owners = components?.get(normalize(reference));

  return (
    <>
      <Box mb={2}>
        <Link to="..">
          <Box display="flex" alignItems="center">
            <ArrowBackIcon fontSize="small" />
            <Box ml={0.5}>All images</Box>
          </Box>
        </Link>
      </Box>
      {owners && owners.length > 0 && (
        <Box mb={2} display="flex" alignItems="center" flexWrap="wrap">
          <Typography variant="body2" color="textSecondary">
            Used by&nbsp;
          </Typography>
          {owners.map((entity, index) => (
            <React.Fragment key={stringifyEntityRef(entity)}>
              {index > 0 && <span>,&nbsp;</span>}
              <EntityRefLink entityRef={entity} defaultKind="Component" />
            </React.Fragment>
          ))}
        </Box>
      )}
      {reference ? (
        <ImagePanel reference={reference} />
      ) : (
        <Typography>No image selected.</Typography>
      )}
    </>
  );
};

/** @public */
export const ConsecPage = () => (
  <Page themeId="tool">
    <Header
      title={
        <Box display="inline-flex" alignItems="center">
          <ConsecLogo fontSize="large" />
          <Box component="span" ml={1}>
            ConSec
          </Box>
        </Box>
      }
      subtitle="Every container image scanned by ConSec@SK, with its gate verdict and vulnerabilities"
    />
    <Content>
      <ContentHeader title="Container security">
        <SupportButton>
          Counts come from each image's latest completed ConSec scan. Open an
          image to see every vulnerability.
        </SupportButton>
      </ContentHeader>
      <Routes>
        <Route path="/" element={<ImageList />} />
        <Route path="/image" element={<ImageDetail />} />
      </Routes>
    </Content>
  </Page>
);
