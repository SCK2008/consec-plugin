import { podImages } from './useEntityImages';

describe('podImages', () => {
  it('collects container and init container images from every cluster', () => {
    const pod = (images: string[], init: string[] = []) => ({
      spec: {
        containers: images.map(image => ({ image })),
        initContainers: init.map(image => ({ image })),
      },
    });
    expect(
      podImages({
        items: [
          {
            resources: [
              { type: 'pods', resources: [pod(['app:1'], ['init:1']), pod(['app:1'])] },
              { type: 'services', resources: [{}] },
            ],
          },
          { resources: [{ type: 'pods', resources: [pod(['sidecar:2'])] }] },
        ],
      }),
    ).toEqual(['init:1', 'app:1', 'sidecar:2']);
  });

  it('handles empty responses', () => {
    expect(podImages({ items: [] })).toEqual([]);
  });
});
