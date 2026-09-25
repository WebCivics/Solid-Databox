import type { Credentials } from '../../../../src/authentication/Credentials';
import type {
  AssuranceCrosswalkDocument,
  VerifiedClaimSet,
} from '../../../../src/databox/context/AssuranceCrosswalk';
import {
  LOWEST_ASSURANCE_GRADE,
  SignedAssuranceCrosswalk,
} from '../../../../src/databox/context/AssuranceCrosswalk';
import {
  NotImplementedContextExtractor,
  VerifiedAssuranceContextExtractor,
} from '../../../../src/databox/context/AuthenticatedContextExtractor';
import type { DataboxRequestContext } from '../../../../src/databox/context/DataboxRequestContext';
import { BadRequestHttpError } from '../../../../src/util/errors/BadRequestHttpError';
import { NotImplementedHttpError } from '../../../../src/util/errors/NotImplementedHttpError';

const EXPECTED_VERSION = 'dbx-crosswalk/1.0.0';
const ISS = 'https://idp.example';
const OTHER_ISS = 'https://other.example';
const WEBID = 'https://alice.example/#me';
const CLIENT = 'https://app.example/id';

const DOCUMENT: AssuranceCrosswalkDocument = {
  crosswalkId: 'prog-x',
  version: EXPECTED_VERSION,
  signature: 'sig:provisional',
  approvedIssuers: [ ISS ],
  entries: [
    { issuer: ISS, claim: 'acr', value: 'urn:strong', dimension: 'authenticatorStrength', level: 3 },
    { issuer: ISS, claim: 'amr', dimension: 'identityProofing', level: 2 },
  ],
};

function extractor(): VerifiedAssuranceContextExtractor {
  return new VerifiedAssuranceContextExtractor(
    new SignedAssuranceCrosswalk(JSON.stringify(DOCUMENT), EXPECTED_VERSION),
  );
}

const fullCredentials: Credentials = {
  agent: { webId: WEBID },
  client: { clientId: CLIENT },
  issuer: { url: ISS },
};

describe('A VerifiedAssuranceContextExtractor', (): void => {
  describe('the plain Solid-OIDC path (no enriched verified claims)', (): void => {
    it('preserves the verified identity and fails closed to no assurance (T-16).', async(): Promise<void> => {
      const context = await extractor().handle({ credentials: fullCredentials });
      expect(context.webId).toBe(WEBID);
      expect(context.clientId).toBe(CLIENT);
      expect(context.issuer).toBe(ISS);
      expect(context.actor).toBe(WEBID);
      expect(context.assurance).toBeUndefined();
    });

    it('tolerates credentials with none of the three fields present.', async(): Promise<void> => {
      const context = await extractor().handle({ credentials: {}});
      expect(context.webId).toBeUndefined();
      expect(context.clientId).toBeUndefined();
      expect(context.issuer).toBeUndefined();
      expect(context.actor).toBeUndefined();
    });
  });

  describe('the enriched (broker) path — binding preconditions (findings 2 & 3)', (): void => {
    it('rejects enriched claims not backed by a CSS-verified issuer (finding 3).', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = { issuer: ISS, claims: { acr: 'urn:strong' }};
      await expect(extractor().handle({ credentials: {}, verifiedClaims })).rejects.toThrow(BadRequestHttpError);
    });

    it('rejects enriched claims with an issuer but NO CSS-verified subject (finding 3).', async(): Promise<void> => {
      const credentials: Credentials = { issuer: { url: ISS }};
      const verifiedClaims: VerifiedClaimSet = { issuer: ISS, claims: { acr: 'urn:strong' }};
      await expect(extractor().handle({ credentials, verifiedClaims })).rejects.toThrow(BadRequestHttpError);
    });

    it('rejects an enriched issuer that disagrees with the credential issuer.', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = { issuer: OTHER_ISS, claims: { acr: 'urn:strong' }};
      await expect(extractor().handle({ credentials: fullCredentials, verifiedClaims }))
        .rejects.toThrow(BadRequestHttpError);
    });

    it('rejects an enriched WebID mismatching the credential WebID (finding 2).', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = { issuer: ISS, webId: 'https://mallory.example/#me' };
      await expect(extractor().handle({ credentials: fullCredentials, verifiedClaims }))
        .rejects.toThrow(BadRequestHttpError);
    });

    it('rejects an enriched client mismatching the credential client (finding 2).', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = { issuer: ISS, clientId: 'https://evil.example/id' };
      await expect(extractor().handle({ credentials: fullCredentials, verifiedClaims }))
        .rejects.toThrow(BadRequestHttpError);
    });

    it('rejects verified claims from an unapproved issuer (T-13).', async(): Promise<void> => {
      const credentials: Credentials = { agent: { webId: WEBID }, issuer: { url: OTHER_ISS }};
      const verifiedClaims: VerifiedClaimSet = { issuer: OTHER_ISS, claims: { acr: 'urn:strong' }};
      await expect(extractor().handle({ credentials, verifiedClaims })).rejects.toThrow(BadRequestHttpError);
    });

    it('accepts a matching enriched WebID/client (binding satisfied).', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = {
        issuer: ISS,
        webId: WEBID,
        clientId: CLIENT,
        claims: { acr: 'urn:strong' },
      };
      const context = await extractor().handle({ credentials: fullCredentials, verifiedClaims });
      expect(context.webId).toBe(WEBID);
      expect(context.clientId).toBe(CLIENT);
      expect(context.assurance?.dimensions.authenticatorStrength).toBe(3);
    });

    it('accepts a client-only credential and never sources WebID from the claims.', async(): Promise<void> => {
      const credentials: Credentials = { client: { clientId: CLIENT }, issuer: { url: ISS }};
      const verifiedClaims: VerifiedClaimSet = { issuer: ISS, webId: 'https://ignored.example/#me' };
      const context = await extractor().handle({ credentials, verifiedClaims });
      expect(context.webId).toBeUndefined();
      expect(context.clientId).toBe(CLIENT);
      expect(context.actor).toBeUndefined();
    });

    it('accepts a WebID-only credential and never sources client from the claims.', async(): Promise<void> => {
      const credentials: Credentials = { agent: { webId: WEBID }, issuer: { url: ISS }};
      const verifiedClaims: VerifiedClaimSet = { issuer: ISS, clientId: 'https://ignored.example/id' };
      const context = await extractor().handle({ credentials, verifiedClaims });
      expect(context.clientId).toBeUndefined();
      expect(context.webId).toBe(WEBID);
    });
  });

  describe('the enriched (broker) path — assurance derivation', (): void => {
    it('maps approved verified claims into normalized dimensions with a traceable grade.', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = {
        issuer: ISS,
        audience: 'https://box.example',
        authTime: '2026-07-15T10:00:00Z',
        claims: { acr: 'urn:strong', amr: [ 'pwd' ]},
      };
      const context = await extractor().handle({ credentials: fullCredentials, verifiedClaims });
      expect(context.audience).toBe('https://box.example');
      expect(context.authTime).toBe('2026-07-15T10:00:00Z');
      expect(context.assurance?.grade).toBe(`prog-x@${EXPECTED_VERSION}`);
      expect(context.assurance?.dimensions.authenticatorStrength).toBe(3);
      expect(context.assurance?.dimensions.identityProofing).toBe(2);
      expect(context.assurance?.crosswalkVersion).toBe(EXPECTED_VERSION);
      expect(context.assurance?.methodRefs).toStrictEqual([ 'acr=urn:strong', 'amr' ]);
    });

    it('falls closed to the lowest grade when the verified claims map to nothing.', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = { issuer: ISS, claims: { loa: 'unmapped' }};
      const context = await extractor().handle({ credentials: fullCredentials, verifiedClaims });
      expect(context.assurance?.grade).toBe(LOWEST_ASSURANCE_GRADE);
      expect(Object.values(context.assurance!.dimensions).every((level): boolean => level === 0)).toBe(true);
      expect(context.assurance?.methodRefs).toHaveLength(0);
    });

    it('ignores an assurance value injected into an untrusted field/header (T-12).', async(): Promise<void> => {
      const forged: Credentials = { ...fullCredentials, acr: 'urn:strong', assurance: 'high' };
      const verifiedClaims: VerifiedClaimSet = { issuer: ISS, claims: {}};
      const context = await extractor().handle({ credentials: forged, verifiedClaims });
      expect(context.assurance?.grade).toBe(LOWEST_ASSURANCE_GRADE);
      expect(context.assurance?.dimensions.authenticatorStrength).toBe(0);
    });
  });

  describe('actor / represented-entity / delegation (kept distinct; RFC 8693 provisional seam)', (): void => {
    it('keeps actor/represented-entity distinct and carries delegation (T-14/T-47).', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = {
        issuer: ISS,
        actor: 'https://guardian.example/#me',
        onBehalfOf: 'https://ward.example/#me',
        delegationGrantRef: 'grant:abc',
        claims: { acr: 'urn:strong' },
      };
      const context = await extractor().handle({ credentials: fullCredentials, verifiedClaims });
      expect(context.actor).toBe('https://guardian.example/#me');
      expect(context.representedEntity).toBe('https://ward.example/#me');
      expect(context.delegation).toStrictEqual({ onBehalfOf: 'https://ward.example/#me', grantRef: 'grant:abc' });
    });

    it('records the represented entity but no delegation when the grant ref is absent.', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = {
        issuer: ISS,
        onBehalfOf: 'https://ward.example/#me',
        claims: { acr: 'urn:strong' },
      };
      const context = await extractor().handle({ credentials: fullCredentials, verifiedClaims });
      expect(context.representedEntity).toBe('https://ward.example/#me');
      expect(context.delegation).toBeUndefined();
    });
  });

  describe('immutability of the produced context', (): void => {
    it('deep-freezes the context, its assurance and its dimensions.', async(): Promise<void> => {
      const verifiedClaims: VerifiedClaimSet = { issuer: ISS, claims: { acr: 'urn:strong' }};
      const context: DataboxRequestContext =
        await extractor().handle({ credentials: fullCredentials, verifiedClaims });
      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.isFrozen(context.assurance)).toBe(true);
      expect(Object.isFrozen(context.assurance!.dimensions)).toBe(true);
      expect(Object.isFrozen(context.assurance!.methodRefs)).toBe(true);
    });
  });
});

describe('A NotImplementedContextExtractor', (): void => {
  it('refuses to fabricate a context (fail closed).', async(): Promise<void> => {
    await expect(new NotImplementedContextExtractor().handle()).rejects.toThrow(NotImplementedHttpError);
  });
});
