import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';

/**
 * The living archive (CIV-B44, `community-library.html`): a heritage/local-history collection does
 * not live on ONE host — it is a LIVING archive, replicated across the community's sites so a
 * collection outlives any databox that hosts it. One site holds the canonical copy; others hold
 * replicas. Localising (moving the canonical to a healthier host) is a governed act — the archive
 * persists by replication, not by trusting a single server to stay up.
 *
 *  - `register` declares a collection: the canonical host + the replica set.
 *  - `addReplica` widens the copy set — more sites holding it, more durable it is.
 *  - `localise` moves the canonical role to a replica (fail closed: only an existing replica can be
 *    promoted — the archive never points canonical at a host that isn't already a copy).
 *  - `replicaCurrent` compares a replica's content digest to the canonical's — an out-of-sync replica
 *    is detected, not silently trusted.
 *
 * Paired with `SharedNamespace`, the collection's stable community URI always resolves to wherever
 * the canonical currently lives — the archive's public URI survives every localisation.
 */

export interface ArchiveCollection {
  /** The stable community URI the collection is known by. */
  readonly collectionId: string;
  /** The site holding the canonical copy. */
  readonly canonicalSite: string;
  /** The sites holding replica copies. */
  readonly replicas: readonly string[];
  /** The canonical copy's content digest — replicas are checked against it. */
  readonly canonicalDigest: string;
}

export class LivingArchive {
  private readonly collections = new Map<string, ArchiveCollection>();

  /** Register a collection: a canonical host + ≥1 replica (a single copy is not an archive). */
  public register(
    collectionId: string,
    canonicalSite: string,
    canonicalDigest: string,
    replicas: readonly string[],
  ): ArchiveCollection {
    if (collectionId.trim().length === 0 || canonicalSite.trim().length === 0 ||
      canonicalDigest.trim().length === 0) {
      throw new BadRequestHttpError('A collection needs a stable id, a canonical site and a content digest.');
    }
    if (replicas.length === 0) {
      throw new BadRequestHttpError('A living archive needs ≥1 replica — a single copy is not an archive.');
    }
    if (replicas.includes(canonicalSite)) {
      throw new BadRequestHttpError('The canonical site cannot also be a replica of its own collection.');
    }
    const collection = Object.freeze({ collectionId, canonicalSite, canonicalDigest, replicas });
    this.collections.set(collectionId, collection);
    return collection;
  }

  /** Widen the replica set — another site holds a copy. */
  public addReplica(collectionId: string, site: string): ArchiveCollection {
    const c = this.require(collectionId);
    if (site === c.canonicalSite || c.replicas.includes(site)) {
      throw new BadRequestHttpError(`'${site}' already holds '${collectionId}'.`);
    }
    return this.write({ ...c, replicas: [ ...c.replicas, site ]});
  }

  /**
   * Localise: move the canonical role to an existing replica (the old canonical becomes a replica —
   * it still holds a copy). Fails closed on a host that isn't already a replica — canonical only
   * ever points at a verified copy.
   */
  public localise(collectionId: string, newCanonicalSite: string, newCanonicalDigest: string): ArchiveCollection {
    const c = this.require(collectionId);
    if (!c.replicas.includes(newCanonicalSite)) {
      throw new BadRequestHttpError(
        `Cannot localise '${collectionId}' to '${newCanonicalSite}' — only an existing replica can take canonical.`,
      );
    }
    if (newCanonicalDigest !== c.canonicalDigest) {
      throw new BadRequestHttpError(
        'The promoted replica\u2019s digest does not match the canonical — sync it before localising.',
      );
    }
    return this.write({
      ...c,
      canonicalSite: newCanonicalSite,
      canonicalDigest: newCanonicalDigest,
      replicas: [ c.canonicalSite, ...c.replicas.filter(s => s !== newCanonicalSite) ],
    });
  }

  /** Whether a replica's content digest matches the canonical's — in-sync detection. */
  public replicaCurrent(collectionId: string, site: string, replicaDigest: string): boolean {
    const c = this.require(collectionId);
    if (!c.replicas.includes(site)) {
      throw new BadRequestHttpError(`'${site}' holds no replica of '${collectionId}'.`);
    }
    return replicaDigest === c.canonicalDigest;
  }

  /** The collection's hosting set. */
  public collection(collectionId: string): ArchiveCollection {
    return this.require(collectionId);
  }

  private require(collectionId: string): ArchiveCollection {
    const c = this.collections.get(collectionId);
    if (c === undefined) {
      throw new InternalServerError(`No archive collection '${collectionId}'.`);
    }
    return c;
  }

  private write(collection: ArchiveCollection): ArchiveCollection {
    this.collections.set(collection.collectionId, collection);
    return collection;
  }
}
