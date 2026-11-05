import { consecApiRef } from './api';
import { consecPlugin } from './plugin';

describe('consecPlugin', () => {
  it('is the consec plugin and provides the API', () => {
    expect(consecPlugin.getId()).toBe('consec');
    expect([...consecPlugin.getApis()].map(factory => factory.api)).toContain(
      consecApiRef,
    );
  });
});
