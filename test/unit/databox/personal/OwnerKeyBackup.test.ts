import { generateKeyPairSync } from 'node:crypto';
import {
  decryptForOwner,
  encryptForOwner,
  generateOwnerKeyPair,
  ownerPrivateKeyFromJwk,
  ownerPublicKeyFromJwk,
} from '../../../../src/databox/personal/OwnerKeyBackup';
import type { OwnerKeyBackupBlob } from '../../../../src/databox/personal/OwnerKeyBackup';

const PAYLOAD = 'the pod export — my evidence, my records, my life';

describe('OwnerKeyBackup', (): void => {
  it('round-trips a pod export — only the owner private key opens it.', (): void => {
    const owner = generateOwnerKeyPair();
    const blob = encryptForOwner(PAYLOAD, owner.publicKey);
    expect(blob.v).toBe(1);
    expect(blob.epk.kty).toBe('EC');
    expect(decryptForOwner(blob, owner.privateKey).toString('utf8')).toBe(PAYLOAD);
  });

  it('the coop (or any other key) cannot decrypt the blob.', (): void => {
    const owner = generateOwnerKeyPair();
    const attacker = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const blob = encryptForOwner(PAYLOAD, owner.publicJwk);
    expect((): unknown => decryptForOwner(blob, attacker.privateKey)).toThrow('decryption failed');
  });

  it('restores from a JWK-persisted owner key pair.', (): void => {
    const owner = generateOwnerKeyPair();
    const privateJwk = owner.privateKey.export({ format: 'jwk' }) as Record<string, unknown>;
    const publicJwk = owner.publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
    const blob = encryptForOwner(PAYLOAD, ownerPublicKeyFromJwk(publicJwk));
    const restored = decryptForOwner(blob, ownerPrivateKeyFromJwk(privateJwk));
    expect(restored.toString('utf8')).toBe(PAYLOAD);
  });

  it('fails closed on a malformed or tampered blob.', (): void => {
    const owner = generateOwnerKeyPair();
    const blob = encryptForOwner(PAYLOAD, owner.publicKey);
    expect((): unknown => decryptForOwner({ ...blob, ct: 'AAAA' }, owner.privateKey)).toThrow();
    expect((): unknown =>
      decryptForOwner(
        { v: 2, epk: blob.epk, iv: blob.iv, tag: blob.tag, ct: blob.ct } as unknown as OwnerKeyBackupBlob,
        owner.privateKey,
      ))
      .toThrow('Malformed');
  });
});
