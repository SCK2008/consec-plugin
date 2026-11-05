import { Entity } from '@backstage/catalog-model';
import {
  getAnnotatedImageRefs,
  getEntityImages,
  getImageRef,
  getJfrogImageRef,
  isConsecAvailable,
} from './annotations';

const entity = (annotations?: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'app', annotations },
  spec: { type: 'service', lifecycle: 'production', owner: 'team' },
});

const jfrog = {
  'jfrog-artifactory/image-name': 'ami-agent-runtime',
  'jfrog-artifactory/repo-filter': 'lp231-bmcamiplatform-docker-qa-local',
};

describe('getImageRef', () => {
  it('returns the annotation value', () => {
    expect(
      getImageRef(entity({ 'consec.io/image-ref': 'ghcr.io/org/app:1.4' })),
    ).toBe('ghcr.io/org/app:1.4');
  });

  it('trims surrounding whitespace', () => {
    expect(
      getImageRef(entity({ 'consec.io/image-ref': '  alpine:3.21  ' })),
    ).toBe('alpine:3.21');
  });

  it('returns undefined when the annotation is missing or blank', () => {
    expect(getImageRef(entity())).toBeUndefined();
    expect(getImageRef(entity({}))).toBeUndefined();
    expect(getImageRef(entity({ 'consec.io/image-ref': '' }))).toBeUndefined();
    expect(
      getImageRef(entity({ 'consec.io/image-ref': '   ' })),
    ).toBeUndefined();
  });
});

describe('getAnnotatedImageRefs', () => {
  it('splits on commas and newlines and drops blanks', () => {
    expect(
      getAnnotatedImageRefs(
        entity({ 'consec.io/image-ref': 'a:1, b:2\n\n c@sha256:abc ,' }),
      ),
    ).toEqual(['a:1', 'b:2', 'c@sha256:abc']);
  });
});

describe('getJfrogImageRef', () => {
  it('builds the Artifactory reference the JFrog tab shows', () => {
    expect(getJfrogImageRef(entity(jfrog))).toBe(
      'artifactory.bmc.com/lp231-bmcamiplatform-docker-qa-local/ami-agent-runtime:latest',
    );
  });

  it('keeps an explicit tag or digest', () => {
    expect(
      getJfrogImageRef(
        entity({ ...jfrog, 'jfrog-artifactory/image-name': 'app:2.1' }),
      ),
    ).toBe('artifactory.bmc.com/lp231-bmcamiplatform-docker-qa-local/app:2.1');
  });

  it('honours a configured registry host', () => {
    expect(getJfrogImageRef(entity(jfrog), 'https://registry.example/')).toBe(
      'registry.example/lp231-bmcamiplatform-docker-qa-local/ami-agent-runtime:latest',
    );
  });

  it('needs both annotations', () => {
    expect(
      getJfrogImageRef(
        entity({ 'jfrog-artifactory/image-name': 'ami-agent-runtime' }),
      ),
    ).toBeUndefined();
  });
});

describe('getEntityImages', () => {
  it('merges sources when two annotations name the same image', () => {
    const ref =
      'artifactory.bmc.com/lp231-bmcamiplatform-docker-qa-local/ami-agent-runtime:latest';
    expect(
      getEntityImages(entity({ ...jfrog, 'consec.io/image-ref': ref })),
    ).toEqual([{ reference: ref, sources: ['annotation', 'jfrog'] }]);
  });
});

describe('isConsecAvailable', () => {
  it('is true for an annotation, JFrog, or Kubernetes id', () => {
    expect(isConsecAvailable(entity({ 'consec.io/image-ref': 'a:1' }))).toBe(
      true,
    );
    expect(isConsecAvailable(entity(jfrog))).toBe(true);
    expect(
      isConsecAvailable(entity({ 'backstage.io/kubernetes-id': 'app' })),
    ).toBe(true);
  });

  it('is false with nothing to look up', () => {
    expect(isConsecAvailable(entity())).toBe(false);
    expect(isConsecAvailable(entity({ 'consec.io/image-ref': ' ' }))).toBe(
      false,
    );
  });
});
