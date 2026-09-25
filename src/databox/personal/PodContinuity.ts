import type { KeyObject } from 'node:crypto';
import { createHash } from 'node:crypto';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import type { PublicJwk } from '../credential/ConnectionCredentialTypes';
import type { OwnerKeyBackupBlob } from './OwnerKeyBackup';
import { decryptForOwner, encryptForOwner } from './OwnerKeyBackup';

/**
 * Pod continuity service (CIV-B48 — the restore half of "the cooperative holds backups it cannot
 * read", and the answer to the **mobile-PWA pod** problem: an installed webapp's persistent storage
 * — OPFS / IndexedDB — can be evicted by the OS under pressure, on reset, or on uninstall. The pod
 * must not die with the store).
 *
 * The service is a snapshot→encrypt→sink→restore loop over the pod's resources:
 *  1. `snapshot` enumerates the pod's resources into a serialisable manifest (path → bytes +
 *     contentType), content-hashes the bundle, and owner-key-encrypts it via `encryptForOwner` —
 *     so the backup that leaves the device is CIPHERTEXT the sink cannot read.
 *  2. `backup` pushes the ciphertext to a sink (a cooperative backup endpoint, a user-chosen export,
 *     or a self-hosted store) — the sink holds bytes, not plaintext.
 *  3. `restore` on a wiped/reinstalled device pulls the blob, verifies the manifest digest, decrypts
 *     with the owner's private key (which lives in the device keystore / a recovery phrase — never
 *     in the evicted storage) and writes every resource back to a fresh ResourceStore.
 *
 * The owner's private key is the only thing that MUST outlive the device — the continuity story is
 * "key survives in the human's hands (recovery phrase / hardware key), everything else is
 * recoverable ciphertext". Fail closed throughout: a tampered blob fails the manifest digest, a
 * wrong key fails the AEAD tag, a malformed manifest is rejected.
 */

export interface PodResourceEntry {
  /** The pod-relative resource path. */
  readonly path: string;
  /** The resource's content type. */
  readonly contentType: string;
  /** The resource bytes, base64. */
  readonly data: string;
}

export interface PodSnapshot {
  readonly v: 1;
  readonly generatedAt: string;
  readonly resources: readonly PodResourceEntry[];
  /** Sha256 of the canonical resource set — a tampered manifest is caught on restore. */
  readonly manifestDigest: string;
}

/** Where the encrypted blob goes — a cooperative backup endpoint, a user file export, etc. */
export interface BackupSink {
  /** Store the ciphertext blob under a key (e.g. the owner's backup slot). */
  readonly put: (key: string, blob: OwnerKeyBackupBlob) => Promise<void>;
  /** Fetch the most recent blob for the key, or `undefined` when none exists. */
  readonly get: (key: string) => Promise<OwnerKeyBackupBlob | undefined>;
}

/** The pod's resources as enumerable entries — the WASM pod's OPFS/ResourceStore view. */
export interface PodResourceSource {
  readonly list: () => Promise<readonly PodResourceEntry[]>;
}

/** The target a restore writes into — a fresh pod's ResourceStore-shaped sink. */
export interface PodRestoreTarget {
  readonly put: (entry: PodResourceEntry) => Promise<void>;
}

/** Build a snapshot manifest from the pod's resources — deterministic digest over the content set. */
export async function snapshotPod(source: PodResourceSource, generatedAt?: string): Promise<PodSnapshot> {
  const resources = await source.list();
  const canonical = resources
    .map(r => ({ path: r.path, contentType: r.contentType, data: r.data }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const manifestDigest = createHash('sha256')
    .update(JSON.stringify(canonical), 'utf8')
    .digest('hex');
  return Object.freeze({ v: 1, generatedAt: generatedAt ?? new Date().toISOString(), resources, manifestDigest });
}

/** Encrypt a snapshot for the owner's key — the ciphertext a backup sink stores. */
export function encryptSnapshot(snapshot: PodSnapshot, ownerPublicKey: KeyObject | PublicJwk): OwnerKeyBackupBlob {
  return encryptForOwner(JSON.stringify(snapshot), ownerPublicKey);
}

/** Back up the pod: snapshot → owner-key-encrypt → sink. Returns the snapshot's manifest digest. */
export async function backupPod(
  source: PodResourceSource,
  sink: BackupSink,
  backupKey: string,
  ownerPublicKey: KeyObject | PublicJwk,
): Promise<{ manifestDigest: string }> {
  if (backupKey.trim().length === 0) {
    throw new BadRequestHttpError('A pod backup needs a backup key (the owner\'s backup slot).');
  }
  const snapshot = await snapshotPod(source);
  await sink.put(backupKey, encryptSnapshot(snapshot, ownerPublicKey));
  return { manifestDigest: snapshot.manifestDigest };
}

/**
 * Restore a pod from a sink blob: fetch → decrypt with the owner's private key → verify the
 * manifest digest → write every resource back. Fails closed: no blob, a tampered manifest, or a
 * wrong owner key all reject — a restore never lands half-corrupted content.
 */
export async function restorePod(
  sink: BackupSink,
  backupKey: string,
  ownerPrivateKey: KeyObject,
  target: PodRestoreTarget,
): Promise<{ restoredResources: number }> {
  const blob = await sink.get(backupKey);
  if (blob === undefined) {
    throw new BadRequestHttpError(`No continuity backup for '${backupKey}'.`);
  }
  const snapshot = JSON.parse(decryptForOwner(blob, ownerPrivateKey).toString('utf8')) as unknown as PodSnapshot;
  if (snapshot.v !== 1 || !Array.isArray(snapshot.resources)) {
    throw new InternalServerError('Restored pod manifest is malformed.');
  }
  // Re-digest the restored manifest — a tampered ciphertext (if it somehow decrypted) is caught here.
  const check = await snapshotPod(
    { list: async(): Promise<readonly PodResourceEntry[]> => snapshot.resources },
    snapshot.generatedAt,
  );
  if (check.manifestDigest !== snapshot.manifestDigest) {
    throw new InternalServerError('Restored pod manifest failed its integrity digest — not applying.');
  }
  const entries: readonly PodResourceEntry[] = snapshot.resources;
  for (const entry of entries) {
    await target.put(entry);
  }
  return { restoredResources: entries.length };
}

export type FetchFunction = (input: any, init?: any) => Promise<Response>;

/**
 * A cooperative/self-hosted backup sink over HTTP — posts the ciphertext to a backup endpoint and
 * fetches it back. The wire carries ONLY the owner-key ciphertext (the sink can never read it).
 */
export class HttpBackupSink implements BackupSink {
  private readonly base: string;

  public constructor(base: string, private readonly fetcher: FetchFunction = fetch) {
    this.base = base.replace(/\/$/u, '');
  }

  public async put(key: string, blob: OwnerKeyBackupBlob): Promise<void> {
    const response = await this.fetcher(`${this.base}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(blob),
    });
    if (!response.ok) {
      throw new InternalServerError(`Backup sink PUT returned ${response.status}.`);
    }
  }

  public async get(key: string): Promise<OwnerKeyBackupBlob | undefined> {
    const response = await this.fetcher(`${this.base}/${encodeURIComponent(key)}`, { method: 'GET' });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new InternalServerError(`Backup sink GET returned ${response.status}.`);
    }
    return (await response.json()) as OwnerKeyBackupBlob;
  }
}
