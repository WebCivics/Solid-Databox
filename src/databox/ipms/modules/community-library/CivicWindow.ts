import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { canonicalDigest } from '../../../proof/Canonicalization';
import type { SharedNamespace } from './SharedNamespace';

/**
 * The civic window (CIV-B45, `community-library.html`): a place's LIVING data rendered as a public
 * display document — the window into a community's digital fabric that anyone can look through
 * without auth. The physical analogue is the community noticeboard at a library's entrance; the
 * digital one is a resolvable document aggregating the site's published (public) resources.
 *
 * A civic window lists only what the site has declared public — contributions the namespace binds
 * and marks `public`. The rendered document is content-addressed (a digest of its contents) so a
 * mirrored window can verify it renders the genuine community state — a fabricated noticeboard
 * differs in digest. The window is the public face; private/scoped resources never appear (the
 * window only lists what was already declared public — it reveals nothing the site kept private).
 */

export interface CivicWindowItem {
  /** The stable community URI the item is published under. */
  readonly communityUri: string;
  /** The site URI it resolves to. */
  readonly siteUri: string;
  /** A human-facing label (the noticeboard line). */
  readonly title: string;
  /** The public kind — `collection`, `event`, `notice`, `service`. */
  readonly kind: 'collection' | 'event' | 'notice' | 'service';
}

export interface CivicWindowDocument {
  readonly '@context': 'https://w3id.org/solid-databox/civic-window/v1';
  readonly type: 'CivicWindow';
  /** The place/site the window belongs to. */
  readonly site: string;
  readonly generatedAt: string;
  /** The published items — the living public surface. */
  readonly items: readonly CivicWindowItem[];
  /** A content digest of the items — a mirror verifies it renders the genuine state. */
  readonly windowDigest: string;
}

/**
 * Render a site's civic window from its published items + the shared namespace (each item's
 * community URI resolves to the hosting site URI). Fails closed on a public item whose community URI
 * doesn't resolve — a window never lists an item it can't point at.
 */
export function renderCivicWindow(
  site: string,
  published: readonly { communityUri: string; title: string; kind: CivicWindowItem['kind'] }[],
  namespace: SharedNamespace,
  generatedAt = new Date().toISOString(),
): CivicWindowDocument {
  if (site.trim().length === 0) {
    throw new BadRequestHttpError('A civic window needs the site it belongs to.');
  }
  const items: CivicWindowItem[] = published.map((item) => {
    const binding = namespace.resolve(item.communityUri);
    if (binding === undefined) {
      throw new BadRequestHttpError(`Published item '${item.communityUri}' has no namespace binding.`);
    }
    return Object.freeze({
      communityUri: item.communityUri,
      siteUri: binding.siteUri,
      title: item.title,
      kind: item.kind,
    });
  });
  const windowDigest = canonicalDigest(items.map(i => ({ u: i.communityUri, t: i.title, k: i.kind })));
  return Object.freeze({
    '@context': 'https://w3id.org/solid-databox/civic-window/v1',
    type: 'CivicWindow',
    site,
    generatedAt,
    items,
    windowDigest,
  });
}
