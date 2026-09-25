import { generateKeyPairSync } from 'node:crypto';
import { carry, verifyOffline } from '../../../../src/databox/credential/OfflineCredential';
import { publicJwkFromKeyObject } from '../../../../src/databox/credential/Es256';

const ISSUER = 'https://concession-authority.example';
const issuer = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const issuerJwk = publicJwkFromKeyObject(issuer.publicKey);
const trusted = new Map([[ ISSUER, issuerJwk ]]);

const claims = {
  issuer: ISSUER,
  credentialClass: 'concession-pensioner',
  holderId: 'https://pod/alice#me',
  attributes: { concession: 'pensioner', transportFree: true },
  validFrom: '2020-01-01T00:00:00Z',
  validUntil: '2030-01-01T00:00:00Z',
};

describe('OfflineCredential — the carried card verifies without network (CIV-B07)', (): void => {
  it('carry mints a compact signed token; verifyOffline recovers the claims with no network.', (): void => {
    const { token } = carry(claims, issuer.privateKey, issuerJwk);
    expect(typeof token).toBe('string'); // Compact carryable form — QR/NFC payload.
    const recovered = verifyOffline(token, trusted, Date.parse('2026-01-01'));
    expect(recovered.credentialClass).toBe('concession-pensioner');
    expect(recovered.attributes.concession).toBe('pensioner');
    expect(recovered.holderId).toBe('https://pod/alice#me');
  });

  it('a substituted embedded key — a forgery — fails closed against the trusted map.', (): void => {
    const forger = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const forgerJwk = publicJwkFromKeyObject(forger.publicKey);
    // A forger self-signs a token embedding THEIR key, claiming to be the trusted issuer.
    const { token } = carry(claims, forger.privateKey, forgerJwk);
    expect((): unknown => verifyOffline(token, trusted, Date.parse('2026-01-01')))
      .toThrow('not the trusted key');
  });

  it('an untrusted issuer and an expired credential fail closed.', (): void => {
    const { token } = carry(claims, issuer.privateKey, issuerJwk);
    expect((): unknown => verifyOffline(token, new Map(), Date.parse('2026-01-01')))
      .toThrow('not trusted');
    const expired = carry({ ...claims, validUntil: '2020-06-01T00:00:00Z' }, issuer.privateKey, issuerJwk);
    expect((): unknown => verifyOffline(expired.token, trusted, Date.parse('2026-01-01')))
      .toThrow('outside its validity');
  });
});
