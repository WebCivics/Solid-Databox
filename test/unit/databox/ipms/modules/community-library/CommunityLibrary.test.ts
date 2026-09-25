import { SharedNamespace } from '../../../../../../src/databox/ipms/modules/community-library/SharedNamespace';
import { renderCivicWindow } from '../../../../../../src/databox/ipms/modules/community-library/CivicWindow';

describe('SharedNamespace — stable community URIs across federated sites (CIV-B46)', (): void => {
  it('binds a stable community URI to a site resource and resolves it both ways.', (): void => {
    const ns = new SharedNamespace();
    ns.bind('community://library/books/42', 'https://site-a.example/books/42', 'site-a');
    expect(ns.resolve('community://library/books/42')?.siteUri).toBe('https://site-a.example/books/42');
    expect(ns.toCommunityUri('https://site-a.example/books/42')).toBe('community://library/books/42');
    expect(ns.forSite('site-a')).toHaveLength(1);
  });

  it('a conflicting claim fails closed; a governed rebind moves a collection between sites.', (): void => {
    const ns = new SharedNamespace();
    ns.bind('community://library/col/x', 'https://site-a.example/col/x', 'site-a');
    // A second site grabbing the same community URI → conflict.
    expect((): unknown => ns.bind('community://library/col/x', 'https://site-b.example/col/x', 'site-b'))
      .toThrow('rebind');
    // The governed migration — the stable URI now points at site-b.
    ns.rebind('community://library/col/x', 'https://site-b.example/col/x', 'site-b');
    expect(ns.resolve('community://library/col/x')?.site).toBe('site-b');
    expect(ns.forSite('site-a')).toHaveLength(0);
  });
});

describe('CivicWindow — the place\u2019s living public data as a display (CIV-B45)', (): void => {
  it('renders a content-addressed public window over the namespace.', (): void => {
    const ns = new SharedNamespace();
    ns.bind('community://library/books', 'https://lib.example/books', 'lib');
    const win = renderCivicWindow('lib', [
      { communityUri: 'community://library/books', title: 'Local-history collection', kind: 'collection' },
    ], ns, '2026-01-01T00:00:00Z');
    expect(win.items[0].siteUri).toBe('https://lib.example/books');
    expect(win.windowDigest).toMatch(/^urn:sha256/u); // A mirror verifies it renders genuine state.
    expect(win['@context']).toContain('civic-window');
  });

  it('fails closed on a public item with no namespace binding — never lists an unresolvable item.', (): void => {
    const ns = new SharedNamespace();
    expect((): unknown => renderCivicWindow('lib', [
      { communityUri: 'community://library/ghost', title: 'x', kind: 'notice' },
    ], ns)).toThrow('no namespace binding');
  });
});
