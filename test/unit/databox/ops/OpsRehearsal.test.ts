import { generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { createBackup, restoreBackup } from '../../../../src/databox/ipms/modules/backups/BackupManager';
import type { BackupCreateInput, BackupRestoreInput } from '../../../../src/databox/ipms/modules/backups/BackupManager';
import { decryptForOwner, encryptForOwner } from '../../../../src/databox/personal/OwnerKeyBackup';
import { IssuerTrustStore } from '../../../../src/databox/proof/IssuerTrustStore';
import type { IssuerKeyDescriptor } from '../../../../src/databox/proof/RecordProofTypes';
import { publicJwkFromKeyObject } from '../../../../src/databox/credential/Es256';

/**
 * DBX-28 — operational rehearsal. The release gate requires restore and key-rotation rehearsals to
 * PASS — not just to be documented. This suite exercises the real components end-to-end:
 *   - backup → restore round-trips the exact resources (the restore rehearsal);
 *   - owner-key encrypted backup recovers only under the owner's private key (holder self-custody);
 *   - the signing-key ceremony → rotation → revocation lifecycle resolves the right key per window
 *     and fails closed on a retired, revoked, or substituted key (the key-rotation rehearsal).
 */

const org = 'https://databox.example.org/org';
const issuer = 'https://issuer.example.org';

function p256(): { publicKey: KeyObject; privateKey: KeyObject } {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' });
}

function descriptor(
  key: ReturnType<typeof p256>,
  verificationMethod: string,
  status: IssuerKeyDescriptor['status'],
  validFrom: string,
  validUntil?: string,
): IssuerKeyDescriptor {
  return {
    issuer,
    verificationMethod,
    publicKeyJwk: publicJwkFromKeyObject(key.publicKey),
    status,
    validFrom,
    validUntil,
  };
}

describe('DBX-28 operational rehearsal', (): void => {
  it('restore rehearsal — an encrypted backup restores the exact resources.', (): void => {
    const resources = [
      { uri: `${org}/records/1`, contentType: 'text/turtle', data: '<a> <b> <c>.' },
      { uri: `${org}/records/2`, contentType: 'text/turtle', data: '<d> <e> <f>.' },
    ];
    const create: BackupCreateInput = {
      id: `${org}/backups/rehearsal-1`,
      organisation: org,
      password: 'rehearsal-password-9',
      format: 'json-ld',
      resources,
    };
    const created = createBackup(create);
    const restore: BackupRestoreInput = {
      id: created.id,
      password: 'rehearsal-password-9',
      encryptedBlob: created.encryptedBlob,
      salt: created.salt,
      iv: created.iv,
      tag: created.tag,
      format: 'json-ld',
    };
    const restored = restoreBackup(restore);
    expect(restored.resourceCount).toBe(2);
    expect(restored.resources.map((r): string => r.uri)).toEqual(resources.map((r): string => r.uri));
    expect(restored.resources.map((r): string => r.data)).toEqual(resources.map((r): string => r.data));
    // A wrong passphrase cannot open the backup (the restore path fails closed).
    expect((): unknown => restoreBackup({ ...restore, password: 'wrong-passphrase-9' })).toThrow();
  });

  it('owner-key rehearsal — a holder-key backup recovers only under the owner private key.', (): void => {
    const owner = p256();
    const stranger = p256();
    const payload = Buffer.from('pod export: receipts + vault content', 'utf8');
    const blob = encryptForOwner(payload, owner.publicKey);
    expect(decryptForOwner(blob, owner.privateKey).equals(payload)).toBe(true);
    // The cooperative holds the backup but cannot read it — a non-owner key cannot decrypt.
    expect((): Buffer => decryptForOwner(blob, stranger.privateKey)).toThrow();
  });

  it('key-rotation rehearsal — rotated keys verify in-window; retired/revoked/substituted fail.', (): void => {
    const keyA = p256();
    const keyB = p256();
    const t0 = '2026-01-01T00:00:00.000Z';
    const t1 = '2026-03-01T00:00:00.000Z';
    const insideA = Date.parse('2026-01-15T00:00:00.000Z');
    const insideB = Date.parse('2026-03-15T00:00:00.000Z');
    const afterA = Date.parse('2026-04-01T00:00:00.000Z');

    // Ceremony → rotation: key-A is rotated out at t1, key-B takes over; BOTH descriptors retained.
    const rotated = new IssuerTrustStore('prog', [
      descriptor(keyA, `${issuer}#key-1`, 'rotated', t0, t1),
      descriptor(keyB, `${issuer}#key-2`, 'active', t1),
    ]);
    // A record issued while key-A was live still resolves key-A (rotation does not orphan history).
    expect(rotated.resolve(issuer, `${issuer}#key-1`, insideA)).toBeTruthy();
    // The new key resolves for records issued after the rotation point.
    expect(rotated.resolve(issuer, `${issuer}#key-2`, insideB)).toBeTruthy();
    // The retired key cannot mint "new" records — resolve outside its window fails closed.
    expect((): unknown => rotated.resolve(issuer, `${issuer}#key-1`, afterA)).toThrow();
    // A substituted/untrusted key never resolves (T-20).
    expect((): unknown => rotated.resolve(issuer, `${issuer}#forged`, insideA)).toThrow();

    // Revocation: a compromised key is rejected outright — even for in-window history (T-20).
    const revoked = new IssuerTrustStore('prog', [
      descriptor(keyA, `${issuer}#key-1`, 'revoked', t0, t1),
      descriptor(keyB, `${issuer}#key-2`, 'active', t1),
    ]);
    expect((): unknown => revoked.resolve(issuer, `${issuer}#key-1`, insideA)).toThrow(/revoked/u);
  });
});
