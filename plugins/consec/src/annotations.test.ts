import { Entity } from '@backstage/catalog-model';
import { getImageRef } from './annotations';

const entity = (annotations?: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'app', annotations },
  spec: { type: 'service', lifecycle: 'production', owner: 'team' },
});

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
