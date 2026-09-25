import type { KeyObject } from 'node:crypto';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  randomFillSync,
} from 'node:crypto';
import type { PublicJwk } from '../credential/ConnectionCredentialTypes';
import { keyObjectFromPublicJwk, publicJwkFromKeyObject } from '../credential/Es256';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';

/**
 * Owner-key encrypted backups (CIV-A08; dbx knowledge-bank "the cooperative holds backups
 * it cannot read"): a member's pod export is encrypted with a hybrid scheme —
 * ephemeral P-256 ECDH → HKDF(SHA-256) → AES-256-GCM — so a cooperative host stores only
 * ciphertext. The coop operator has neither the owner's private key nor a plaintext oracle.
 *
 * Wire format (JSON, all base64url):
 * `{ v:1, epk:<ephemeral public JWK>, iv, tag, ct }` — the ephemeral public key travels
 * with the ciphertext so only the OWNER's private key can derive the shared secret.
 */

export interface OwnerKeyBackupBlob {
  readonly v: 1;
  /** Ephemeral P-256 public JWK — the recipient derives the shared secret from it. */
  readonly epk: PublicJwk;
  readonly iv: string;
  readonly tag: string;
  readonly ct: string;
}

const INFO = 'databox-owner-key-backup-v1';

function deriveKey(publicKey: KeyObject, privateKey: KeyObject): Buffer {
  // P-256 ECDH shared secret → HKDF-lite: SHA-256(secret || info) as the AES-256 key.
  const shared = diffieHellman({ privateKey, publicKey });
  return createHash('sha256').update(Buffer.concat([ shared, Buffer.from(INFO, 'utf8') ])).digest();
}

/** Encrypt a pod export so only the holder of `ownerPublicKey`'s private half can read it. */
export function encryptForOwner(payload: Buffer | string, ownerPublicKey: KeyObject | PublicJwk): OwnerKeyBackupBlob {
  const ownerKey = isKeyObject(ownerPublicKey) ? ownerPublicKey : keyObjectFromPublicJwk(ownerPublicKey);
  const { publicKey: ephemeralPublic, privateKey: ephemeralPrivate } =
    generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const key = deriveKey(ownerKey, ephemeralPrivate);
  const iv = Buffer.from(generateIv());
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([ cipher.update(payload), cipher.final() ]);
  return {
    v: 1,
    epk: publicJwkFromKeyObject(ephemeralPublic),
    iv: base64url(iv),
    tag: base64url(cipher.getAuthTag()),
    ct: base64url(ct),
  };
}

/** The owner decrypts a stored blob with their private key — the coop cannot. */
export function decryptForOwner(blob: OwnerKeyBackupBlob, ownerPrivateKey: KeyObject): Buffer {
  if (blob.v !== 1 || typeof blob.ct !== 'string' || typeof blob.iv !== 'string' || typeof blob.tag !== 'string') {
    throw new BadRequestHttpError('Malformed owner-key backup blob.');
  }
  const ephemeralPublic = keyObjectFromPublicJwk(blob.epk);
  const key = deriveKey(ephemeralPublic, ownerPrivateKey);
  const decipher = createDecipheriv('aes-256-gcm', key, unb64(blob.iv));
  decipher.setAuthTag(unb64(blob.tag));
  try {
    return Buffer.concat([ decipher.update(unb64(blob.ct)), decipher.final() ]);
  } catch {
    throw new BadRequestHttpError('Backup decryption failed — wrong owner key or corrupted blob.');
  }
}

/** A fresh P-256 owner keypair for backup purposes. */
export function generateOwnerKeyPair(): { publicKey: KeyObject; privateKey: KeyObject; publicJwk: PublicJwk } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return { publicKey, privateKey, publicJwk: publicJwkFromKeyObject(publicKey) };
}

/** Private key re-imported from a stored JWK (the owner's key, persisted by them alone). */
export function ownerPrivateKeyFromJwk(jwk: Record<string, unknown>): KeyObject {
  return createPrivateKey({ key: jwk, format: 'jwk' });
}

export function ownerPublicKeyFromJwk(jwk: Record<string, unknown>): KeyObject {
  return createPublicKey({ key: jwk, format: 'jwk' });
}

function isKeyObject(value: KeyObject | PublicJwk): value is KeyObject {
  return typeof (value as KeyObject).export === 'function';
}

function generateIv(): Buffer {
  const iv = Buffer.alloc(12);
  randomFillSync(iv);
  return iv;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function unb64(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}
