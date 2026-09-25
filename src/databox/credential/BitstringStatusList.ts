import { gunzipSync, gzipSync } from 'node:zlib';
import type { CredentialRevocationChecker } from '../authorization/ResolverCollaborators';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import { base64UrlDecode, base64UrlEncode } from './Es256';

/**
 * BitstringStatusList (ADR-0007: credential status MUST use BitstringStatusList) — the revocation/status
 * bitstring plus a small per-program manager. Two threat-model properties are deliberate:
 *
 * - **Herd privacy (T-56).** A status list is shared by *many* connections so that checking one entry does
 *   not single out one consumer. {@link BitstringStatusList} is created at a fixed minimum size
 *   ({@link MIN_STATUS_LIST_SIZE}) and {@link StatusListManager} refuses to publish a list whose populated
 *   herd is below a configured floor — a status list of one is a tracking vector, not privacy.
 * - **Fail closed.** An out-of-range index, a corrupt encoded list or an under-herd publish all raise
 *   rather than silently reporting "not revoked".
 */

/** The smallest bitstring this profile allocates (16 KiB = 131072 entries) — a real herd, not a handful. */
export const MIN_STATUS_LIST_SIZE = 131072;

/** The multibase identifier for base64url-encoded data (W3C Bitstring Status List v1.0 `encodedList`). */
export const MULTIBASE_BASE64URL_PREFIX = 'u';

/**
 * A single-purpose status bitstring. Bit `1` at an index means the status (e.g. `revocation`) is set for
 * the connection assigned that index. Backed by a `Buffer`; `encode`/`decode` use GZIP + base64url exactly
 * as the BitstringStatusList data model specifies.
 */
export class BitstringStatusList {
  private readonly bits: Buffer;

  /**
   * @param size - Number of entries (bits). Defaults to and may not be below {@link MIN_STATUS_LIST_SIZE};
   *   must be a multiple of 8 so it maps cleanly onto bytes. A weaker/odd size fails closed.
   */
  public constructor(size: number = MIN_STATUS_LIST_SIZE) {
    if (!Number.isInteger(size) || size < MIN_STATUS_LIST_SIZE || size % 8 !== 0) {
      throw new InternalServerError(
        `Status list size must be an integer multiple of 8 and >= ${MIN_STATUS_LIST_SIZE}; refusing ${size}.`,
      );
    }
    this.bits = Buffer.alloc(size / 8);
  }

  /** The number of entries (bits) in the list. */
  public get size(): number {
    return this.bits.length * 8;
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new BadRequestHttpError(`Status index ${index} is out of range [0, ${this.size}).`);
    }
  }

  /** Set or clear the status bit at `index`. */
  public setStatus(index: number, value: boolean): void {
    this.assertIndex(index);
    const byte = index >>> 3;
    const mask = 0x80 >>> (index & 7);
    if (value) {
      this.bits[byte] |= mask;
    } else {
      this.bits[byte] &= ~mask & 0xFF;
    }
  }

  /** Whether the status bit at `index` is set. */
  public getStatus(index: number): boolean {
    this.assertIndex(index);
    return (this.bits[index >>> 3] & (0x80 >>> (index & 7))) !== 0;
  }

  /** Count of set bits — the current herd of set (e.g. revoked) entries. Used only for diagnostics. */
  public get populationCount(): number {
    let count = 0;
    for (const byte of this.bits) {
      let value = byte;
      while (value !== 0) {
        count += value & 1;
        value >>>= 1;
      }
    }
    return count;
  }

  /**
   * GZIP + base64url encode the bitstring, prefixed with the multibase base64url identifier `u` as required
   * by W3C Bitstring Status List v1.0 for `encodedList` (LOW-4). Bit ordering is MSB-first (kept).
   */
  public encode(): string {
    return `${MULTIBASE_BASE64URL_PREFIX}${base64UrlEncode(gzipSync(this.bits))}`;
  }

  /**
   * Decode a multibase (`u`) GZIP + base64url `encodedList` back into a {@link BitstringStatusList}. A list
   * missing the `u` prefix, one that does not decompress, or one whose size is below the minimum/not
   * byte-aligned, is rejected (fail closed).
   */
  public static decode(encodedList: string): BitstringStatusList {
    if (typeof encodedList !== 'string' || !encodedList.startsWith(MULTIBASE_BASE64URL_PREFIX)) {
      throw new BadRequestHttpError('Status list must be multibase base64url ("u"-prefixed) per Bitstring StatusList.');
    }
    let raw: Buffer;
    try {
      raw = gunzipSync(base64UrlDecode(encodedList.slice(MULTIBASE_BASE64URL_PREFIX.length)));
    } catch {
      throw new BadRequestHttpError('Status list is not a valid GZIP+base64url encoded bitstring.');
    }
    const list = new BitstringStatusList(raw.length * 8);
    raw.copy(list.bits);
    return list;
  }
}

/** The published form of a status list (ADR-0007) — what a verifier fetches to check an entry. */
export interface PublishedStatusList {
  readonly statusListCredential: string;
  readonly statusPurpose: string;
  readonly encodedList: string;
  readonly herdSize: number;
}

/**
 * A per-program status-list manager (component C16). It assigns each connection a stable index in one
 * shared list and drives set/clear for a single status purpose (default `revocation`). Isolation: it holds
 * only *this* program's indices; it never reveals the mapping and returns `false` for any index it did not
 * assign (no existence leak).
 */
export class StatusListManager implements CredentialRevocationChecker {
  private readonly list: BitstringStatusList;
  private readonly indexByConnection = new Map<string, number>();
  private nextIndex = 0;

  /**
   * @param statusListCredential - The identifier of the published status list.
   * @param statusPurpose - The status purpose this list tracks (ADR-0007). Defaults to `revocation`.
   * @param minHerdSize - The smallest populated herd allowed at publish time (T-56). Defaults to 2 (a list
   *   that has only ever tracked one connection cannot be published as "status of one").
   * @param size - The bitstring size (defaults to {@link MIN_STATUS_LIST_SIZE}).
   */
  public constructor(
    private readonly statusListCredential: string,
    private readonly statusPurpose = 'revocation',
    private readonly minHerdSize = 2,
    size: number = MIN_STATUS_LIST_SIZE,
  ) {
    this.list = new BitstringStatusList(size);
  }

  /**
   * Assign a fresh, stable index to `connectionId` (or return the existing one). MED-3: this method is the
   * **single source of truth** for a connection's status index — the returned value MUST be the
   * `statusListIndex` embedded in the issued credential, so that {@link setRevoked}/{@link isRevoked} (keyed
   * by connection) and a verifier reading the credential's own `statusListIndex` via
   * {@link isRevokedByIndex} always flip/read the same bit.
   */
  public register(connectionId: string): number {
    const existing = this.indexByConnection.get(connectionId);
    if (existing !== undefined) {
      return existing;
    }
    const index = this.nextIndex;
    this.nextIndex += 1;
    this.indexByConnection.set(connectionId, index);
    return index;
  }

  /** The index assigned to `connectionId`, or `undefined` if it was never registered (no existence leak). */
  public indexForConnection(connectionId: string): number | undefined {
    return this.indexByConnection.get(connectionId);
  }

  private indexOf(connectionId: string): number {
    const index = this.indexByConnection.get(connectionId);
    if (index === undefined) {
      throw new BadRequestHttpError('Unknown connection for status list; register it first.');
    }
    return index;
  }

  /** Set the status bit for `connectionId` (e.g. revoke), operating on its registered index. */
  public setRevoked(connectionId: string, revoked: boolean): void {
    this.list.setStatus(this.indexOf(connectionId), revoked);
  }

  /**
   * Set the status bit at an explicit `index` — the credential's embedded `statusListIndex`. Used by the
   * lifecycle registry (MED-2) which holds the credential's own index rather than a connection key. An
   * out-of-range index fails closed (via {@link BitstringStatusList.setStatus}).
   */
  public setRevokedByIndex(index: number, revoked: boolean): void {
    this.list.setStatus(index, revoked);
  }

  /**
   * Whether `connectionId` is currently set (revoked). An unregistered connection is treated as **not**
   * known to this list and returns `false` here; the caller's lifecycle state is the authority for
   * unknown connections. (This method never throws on an unknown id, so a status check cannot be used to
   * enumerate which ids were ever registered.)
   */
  public isRevoked(connectionId: string): boolean {
    const index = this.indexByConnection.get(connectionId);
    return index !== undefined && this.list.getStatus(index);
  }

  /**
   * Whether the bit at the credential's embedded `index` is set. MED-3: the token exchange reads status by
   * the credential's OWN `statusListIndex`, not by a re-derived sequence, so what is checked is exactly what
   * a verifier reading the credential would check. An out-of-range index fails closed (deny).
   */
  public isRevokedByIndex(index: number): boolean {
    return this.list.getStatus(index);
  }

  /** Publish the current list, refusing if the populated herd is below the privacy floor (T-56). */
  public publish(): PublishedStatusList {
    const herdSize = this.indexByConnection.size;
    if (herdSize < this.minHerdSize) {
      throw new InternalServerError(
        `Refusing to publish a status list with herd size ${herdSize} < ${this.minHerdSize} (T-56 privacy).`,
      );
    }
    return {
      statusListCredential: this.statusListCredential,
      statusPurpose: this.statusPurpose,
      encodedList: this.list.encode(),
      herdSize,
    };
  }
}
