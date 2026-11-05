import {
  CompoundEntityRef,
  Entity,
  RELATION_OWNED_BY,
} from '@backstage/catalog-model';
import {
  Content,
  Header,
  Link,
  Page,
  StatusError,
  StatusOK,
  StatusPending,
  StatusWarning,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  EntityRefLink,
  EntityRefLinks,
  catalogApiRef,
  getEntityRelations,
  humanizeEntityRef,
} from '@backstage/plugin-catalog-react';
import { DateTime } from 'luxon';
import { ReactNode, useMemo, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import useDeepCompareEffect from 'react-use/esm/useDeepCompareEffect';
import pLimit from 'p-limit';
import { ImageSummary, consecApiRef } from '../../api';
import { getImageRef } from '../../annotations';

type EntityFilter =
  | Record<string, string | symbol | (string | symbol)[]>
  | Record<string, string | symbol | (string | symbol)[]>[];

/** @public */
export type ConsecPageProps = {
  entitiesFilter?: EntityFilter;
};

type Lookup = {
  summary?: ImageSummary;
  error?: boolean;
};

type ConsecRow = {
  entity: Entity;
  name: string;
  ownerTitle: string;
  owners: CompoundEntityRef[];
  imageRef: string;
  loading: boolean;
  lookup?: Lookup;
  gate: string;
};

const limit = pLimit(5);

const gateText = (lookup?: Lookup) => {
  if (lookup?.error) return 'Error';
  if (lookup?.summary?.gate === 'fail') return 'Fail';
  if (lookup?.summary?.gate === 'pass') return 'Pass';
  if (lookup?.summary) return 'Not evaluated';
  return 'Not scanned';
};

const gateRank = (row: ConsecRow) => {
  if (row.lookup?.error) return 1;
  if (row.lookup?.summary?.gate === 'fail') return 0;
  if (row.lookup?.summary?.gate === 'none') return 2;
  if (!row.lookup?.summary) return 3;
  return 4;
};

const GateCell = ({ row }: { row: ConsecRow }) => {
  if (row.loading) return null;
  if (row.lookup?.error) return <StatusError>Error</StatusError>;
  if (!row.lookup?.summary) return <StatusWarning>Not scanned</StatusWarning>;
  if (row.lookup.summary.gate === 'fail') return <StatusError>Fail</StatusError>;
  if (row.lookup.summary.gate === 'pass') return <StatusOK>Pass</StatusOK>;
  return <StatusPending>Not evaluated</StatusPending>;
};

const columns: TableColumn<ConsecRow>[] = [
  {
    title: 'Name',
    field: 'name',
    highlight: true,
    render: ({ entity }) => (
      <EntityRefLink entityRef={entity} defaultKind="Component" />
    ),
  },
  {
    title: 'Owner',
    field: 'ownerTitle',
    render: ({ owners }) => (
      <EntityRefLinks entityRefs={owners} defaultKind="group" />
    ),
  },
  { title: 'Image', field: 'imageRef' },
  {
    title: 'Gate',
    field: 'gate',
    customSort: (a, b) => gateRank(a) - gateRank(b),
    render: row => <GateCell row={row} />,
  },
  {
    title: 'Critical',
    field: 'lookup.summary.critical',
    render: row => count(row, summary => summary.critical),
  },
  {
    title: 'High',
    field: 'lookup.summary.high',
    render: row => count(row, summary => summary.high),
  },
  {
    title: 'Fixable',
    field: 'lookup.summary.fixable',
    render: row => count(row, summary => summary.fixable),
  },
  {
    title: 'Last checked',
    render: row => {
      const at = row.lookup?.summary?.lastCheckedAt;
      if (row.loading || !at) return null;
      return DateTime.fromISO(at).toRelative() ?? 'Never checked';
    },
  },
  {
    title: 'ConSec',
    sorting: false,
    render: row => {
      const url = row.lookup?.summary?.url;
      return url ? <Link to={url}>View in ConSec</Link> : null;
    },
  },
];

function count(
  row: ConsecRow,
  pick: (summary: ImageSummary) => number,
): ReactNode {
  if (row.loading || !row.lookup?.summary) return null;
  return pick(row.lookup.summary);
}

/** @public */
export const ConsecPage = (props: ConsecPageProps) => {
  const { entitiesFilter = { kind: 'Component' } } = props;
  const catalogApi = useApi(catalogApiRef);
  const consecApi = useApi(consecApiRef);
  const [filter, setFilter] = useState(entitiesFilter);
  useDeepCompareEffect(() => setFilter(entitiesFilter), [entitiesFilter]);

  const { value: entities, loading: entitiesLoading } = useAsync(
    () =>
      catalogApi.getEntities({
        filter,
        fields: [
          'kind',
          'metadata.namespace',
          'metadata.name',
          'metadata.annotations',
          'relations',
        ],
      }),
    [catalogApi, filter],
  );

  const annotated = useMemo(
    () =>
      (entities?.items ?? [])
        .map(entity => ({ entity, imageRef: getImageRef(entity) }))
        .filter((item): item is { entity: Entity; imageRef: string } =>
          Boolean(item.imageRef),
        ),
    [entities?.items],
  );

  const { value: lookups, loading: lookupsLoading } = useAsync(async () => {
    const settled = await Promise.allSettled(
      annotated.map(({ imageRef }) =>
        limit(() => consecApi.getImageSummary(imageRef)),
      ),
    );
    const byRef = new Map<string, Lookup>();
    settled.forEach((result, index) => {
      const imageRef = annotated[index].imageRef;
      byRef.set(
        imageRef,
        result.status === 'fulfilled'
          ? { summary: result.value }
          : { error: true },
      );
    });
    return byRef;
  }, [annotated, consecApi]);

  const rows = useMemo(() => {
    const built = annotated.map(({ entity, imageRef }) => {
      const owners = getEntityRelations(entity, RELATION_OWNED_BY);
      const lookup = lookups?.get(imageRef);
      return {
        entity,
        name: humanizeEntityRef(entity),
        ownerTitle: owners
          .map(owner => humanizeEntityRef(owner, { defaultKind: 'group' }))
          .join(', '),
        owners,
        imageRef,
        loading: lookupsLoading,
        lookup,
        gate: gateText(lookup),
      };
    });
    return built.sort((a, b) => {
      const byGate = gateRank(a) - gateRank(b);
      if (byGate !== 0) return byGate;
      return (b.lookup?.summary?.critical ?? 0) - (a.lookup?.summary?.critical ?? 0);
    });
  }, [annotated, lookups, lookupsLoading]);

  return (
    <Page themeId="home">
      <Header title="ConSec Image Overview" />
      <Content>
        <Table<ConsecRow>
          columns={columns}
          data={rows}
          filters={[
            { column: 'Owner', type: 'multiple-select' },
            { column: 'Gate', type: 'select' },
          ]}
          isLoading={entitiesLoading}
          options={{
            pageSize: 20,
            padding: 'dense',
            loadingType: 'linear',
            showEmptyDataSourceMessage: !entitiesLoading,
          }}
        />
      </Content>
    </Page>
  );
};
