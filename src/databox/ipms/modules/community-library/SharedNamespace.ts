import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';

/**
 * The cross-site shared namespace + federation map (CIV-B46, `community-library.html`): a community
 * library's digital fabric spans several sites (a main library + branches, or several cooperatives)
 * — each an autonomous databox. For the fabric to be ONE community rather than N silos, a resource
 * needs a STABLE community-namespace URI that resolves to whichever site physically hosts it.
 *
 * This is a bidirectional map: `community://library/…` (the stable, site-independent namespace) ↔
 * `https://site.example/…` (the concrete site resource). A contribution's stable URI never changes
 * when the resource migrates between sites — the community's links outlive any one host. Resolving
 * goes namespace→site; `toCommunityUri` goes site→namespace. Two sites claiming the same
 * community URI is a conflict (fail closed) — the namespace is governed, not grab-able.
 */

export interface NamespaceBinding {
  /** The stable community-namespace URI (e.g. `community://library/books/42`). */
  readonly communityUri: string;
  /** The concrete site resource it currently resolves to (e.g. `https://site-a.example/books/42`). */
  readonly siteUri: string;
  /** The site (databox) hosting it. */
  readonly site: string;
}

export class SharedNamespace {
  private readonly bindings = new Map<string, NamespaceBinding>();

  /**
   * Bind a stable community URI to a site resource. Fails closed on a conflicting binding — a
   * community URI is bound once (re-binding to a DIFFERENT site URI needs an explicit rebind).
   */
  public bind(communityUri: string, siteUri: string, site: string): NamespaceBinding {
    if (communityUri.trim().length === 0 || siteUri.trim().length === 0 || site.trim().length === 0) {
      throw new BadRequestHttpError('A namespace binding needs a community URI, a site URI and the site id.');
    }
    const existing = this.bindings.get(communityUri);
    if (existing !== undefined && existing.siteUri !== siteUri) {
      throw new BadRequestHttpError(
        `Community URI '${communityUri}' already resolves to '${existing.siteUri}' — rebind explicitly.`,
      );
    }
    const binding: NamespaceBinding = Object.freeze({ communityUri, siteUri, site });
    this.bindings.set(communityUri, binding);
    return binding;
  }

  /** Rebind a community URI to a NEW site — the governed migration path (a moved collection). */
  public rebind(communityUri: string, siteUri: string, site: string): NamespaceBinding {
    if (this.bindings.get(communityUri) === undefined) {
      throw new InternalServerError(`No binding for '${communityUri}' to rebind.`);
    }
    const binding: NamespaceBinding = Object.freeze({ communityUri, siteUri, site });
    this.bindings.set(communityUri, binding);
    return binding;
  }

  /** Resolve a community URI to the site resource it currently points at. */
  public resolve(communityUri: string): NamespaceBinding | undefined {
    return this.bindings.get(communityUri);
  }

  /** The community URI a site URI is bound under (site→namespace). */
  public toCommunityUri(siteUri: string): string | undefined {
    for (const binding of this.bindings.values()) {
      if (binding.siteUri === siteUri) {
        return binding.communityUri;
      }
    }
    return undefined;
  }

  /** All bindings a site hosts — the fabric's federated map. */
  public forSite(site: string): readonly NamespaceBinding[] {
    return [ ...this.bindings.values() ].filter(b => b.site === site);
  }
}
