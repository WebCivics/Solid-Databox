import { Readable } from 'node:stream';
import { RdfParser } from 'componentsjs/lib/rdf/RdfParser';

describe('Node 24 linked-data compatibility', (): void => {
  const originalFetch = globalThis.fetch;

  afterEach((): void => {
    globalThis.fetch = originalFetch;
  });

  it('adapts fetched RDF configuration to the Node stream API expected by Components.js', async(): Promise<void> => {
    globalThis.fetch = async(): Promise<Response> => new Response(
      '<https://example.test/s> <https://example.test/p> <https://example.test/o>.',
    );

    const body = await RdfParser.fetchFileOrUrl('https://example.test/config.ttl');

    expect(body).toBeInstanceOf(Readable);
    expect(typeof body.on).toBe('function');
  });
});
