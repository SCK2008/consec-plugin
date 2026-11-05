import { Entity } from '@backstage/catalog-model';
import { configApiRef, useApi, useApiHolder } from '@backstage/core-plugin-api';
import {
  kubernetesApiRef,
  kubernetesAuthProvidersApiRef,
} from '@backstage/plugin-kubernetes-react';
import { useMemo } from 'react';
import useAsync from 'react-use/esm/useAsync';
import {
  addImage,
  EntityImage,
  getEntityImages,
  hasKubernetesImages,
} from '../annotations';

type Container = { image?: string };
type Pod = {
  spec?: { containers?: Container[]; initContainers?: Container[] };
};
type ObjectsResponse = {
  items: Array<{ resources: Array<{ type: string; resources: unknown[] }> }>;
};

/** Every container image in the pods the Kubernetes plugin returns. */
export const podImages = (response: ObjectsResponse): string[] => {
  const images = new Set<string>();
  for (const cluster of response.items ?? []) {
    for (const group of cluster.resources ?? []) {
      if (group.type !== 'pods') continue;
      for (const pod of group.resources as Pod[]) {
        for (const container of [
          ...(pod.spec?.initContainers ?? []),
          ...(pod.spec?.containers ?? []),
        ]) {
          const image = container.image?.trim();
          if (image) images.add(image);
        }
      }
    }
  }
  return [...images];
};

export type EntityImagesState = {
  images: EntityImage[];
  /** True while running pods are still being read. */
  loadingKubernetes: boolean;
  kubernetesError?: Error;
};

/**
 * Images for an entity: consec.io/image-ref, the JFrog image, and the images
 * running in its pods. The Kubernetes part is skipped when the app has no
 * Kubernetes plugin or the entity has no Kubernetes annotation.
 */
export const useEntityImages = (entity: Entity): EntityImagesState => {
  const config = useApi(configApiRef);
  const apis = useApiHolder();
  const registry = config.getOptionalString('consec.jfrogRegistry');
  const kubernetesApi = apis.get(kubernetesApiRef);
  const authApi = apis.get(kubernetesAuthProvidersApiRef);
  const wantsKubernetes =
    hasKubernetesImages(entity) && Boolean(kubernetesApi && authApi);

  const pods = useAsync(async () => {
    if (!wantsKubernetes || !kubernetesApi || !authApi) return [];
    const clusters = await kubernetesApi.getClusters();
    const providers = [
      ...new Set(
        clusters.map(
          c =>
            `${c.authProvider}${
              c.oidcTokenProvider ? `.${c.oidcTokenProvider}` : ''
            }`,
        ),
      ),
    ];
    let body: Parameters<typeof authApi.decorateRequestBodyForAuth>[1] = {
      entity,
    };
    for (const provider of providers) {
      body = await authApi.decorateRequestBodyForAuth(provider, body);
    }
    const response = await kubernetesApi.getObjectsByEntity({
      entity,
      auth: body.auth ?? {},
    });
    return podImages(response as unknown as ObjectsResponse);
  }, [entity, wantsKubernetes]);

  const images = useMemo(() => {
    const list = getEntityImages(entity, registry);
    (pods.value ?? []).forEach(ref => addImage(list, ref, 'kubernetes'));
    return list;
  }, [entity, registry, pods.value]);

  return {
    images,
    loadingKubernetes: wantsKubernetes && pods.loading,
    kubernetesError: pods.error,
  };
};
