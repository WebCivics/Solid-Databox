import type {
  AssuranceCrosswalkDocument,
  AssuranceCrosswalkEntry,
} from '../../../../src/databox/context/AssuranceCrosswalk';
import {
  LOWEST_ASSURANCE_GRADE,
  SignedAssuranceCrosswalk,
} from '../../../../src/databox/context/AssuranceCrosswalk';
import { BadRequestHttpError } from '../../../../src/util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../src/util/errors/InternalServerError';

const EXPECTED_VERSION = 'dbx-crosswalk/1.0.0';
const ISS = 'https://idp.example';
const OTHER_ISS = 'https://other.example';

const ENTRIES: AssuranceCrosswalkEntry[] = [
  // Exact-value entry (raises authenticatorStrength to 3).
  { issuer: ISS, claim: 'acr', value: 'urn:strong', dimension: 'authenticatorStrength', level: 3 },
  // A lower duplicate for the same claim/value: exercises the "level not greater than current" path.
  { issuer: ISS, claim: 'acr', value: 'urn:strong', dimension: 'authenticatorStrength', level: 1 },
  // Presence-based entry (no `value`): any verified `amr` raises identityProofing.
  { issuer: ISS, claim: 'amr', dimension: 'identityProofing', level: 2 },
  // An entry for a DIFFERENT issuer: must never fire for ISS.
  { issuer: OTHER_ISS, claim: 'acr', value: 'urn:strong', dimension: 'federationTrust', level: 5 },
];

function doc(overrides: Partial<AssuranceCrosswalkDocument> = {}): string {
  // CIV-C26: the crosswalk's constructor takes the signed document as a JSON string (config-loadable);
  // the tests exercise the same admission checks on the parsed form.
  return JSON.stringify({
    crosswalkId: 'prog-x',
    version: EXPECTED_VERSION,
    signature: 'sig:provisional',
    approvedIssuers: [ ISS ],
    entries: ENTRIES,
    ...overrides,
  });
}

describe('A SignedAssuranceCrosswalk', (): void => {
  describe('admission (fail-closed construction)', (): void => {
    it('admits a well-formed, correctly-versioned, signed crosswalk.', (): void => {
      const crosswalk = new SignedAssuranceCrosswalk(doc(), EXPECTED_VERSION);
      expect(crosswalk.crosswalkId).toBe('prog-x');
      expect(crosswalk.version).toBe(EXPECTED_VERSION);
    });

    it('refuses a crosswalk whose version is not the expected one.', (): void => {
      expect((): unknown => new SignedAssuranceCrosswalk(doc({ version: 'dbx-crosswalk/9.9.9' }), EXPECTED_VERSION))
        .toThrow(InternalServerError);
    });

    it('refuses an unsigned crosswalk.', (): void => {
      expect((): unknown => new SignedAssuranceCrosswalk(doc({ signature: '' }), EXPECTED_VERSION))
        .toThrow(InternalServerError);
    });

    it('refuses a crosswalk that names an unknown assurance dimension.', (): void => {
      const bad = doc({ entries: [
        { issuer: ISS, claim: 'acr', dimension: 'notADimension' as any, level: 1 },
      ]});
      expect((): unknown => new SignedAssuranceCrosswalk(bad, EXPECTED_VERSION)).toThrow(InternalServerError);
    });

    it('refuses a non-integer level.', (): void => {
      const bad = doc({ entries: [
        { issuer: ISS, claim: 'acr', dimension: 'authenticatorStrength', level: 1.5 },
      ]});
      expect((): unknown => new SignedAssuranceCrosswalk(bad, EXPECTED_VERSION)).toThrow(InternalServerError);
    });

    it('refuses a negative level.', (): void => {
      const bad = doc({ entries: [
        { issuer: ISS, claim: 'acr', dimension: 'authenticatorStrength', level: -1 },
      ]});
      expect((): unknown => new SignedAssuranceCrosswalk(bad, EXPECTED_VERSION)).toThrow(InternalServerError);
    });

    // Robustness against untyped JSON (finding 6): absent/wrong-typed fields raise InternalServerError,
    // never a raw TypeError.
    it('refuses a crosswalk whose crosswalkId is not a non-empty string.', (): void => {
      expect((): unknown => new SignedAssuranceCrosswalk(doc({ crosswalkId: 42 as any }), EXPECTED_VERSION))
        .toThrow(InternalServerError);
    });

    it('refuses a crosswalk whose approvedIssuers is not an array.', (): void => {
      expect((): unknown => new SignedAssuranceCrosswalk(doc({ approvedIssuers: 'nope' as any }), EXPECTED_VERSION))
        .toThrow(InternalServerError);
    });

    it('refuses a crosswalk whose entries is not an array.', (): void => {
      expect((): unknown => new SignedAssuranceCrosswalk(doc({ entries: undefined as any }), EXPECTED_VERSION))
        .toThrow(InternalServerError);
    });

    it('refuses an entry that is missing an issuer.', (): void => {
      const bad = doc({ entries: [
        { claim: 'acr', dimension: 'authenticatorStrength', level: 1 } as any,
      ]});
      expect((): unknown => new SignedAssuranceCrosswalk(bad, EXPECTED_VERSION)).toThrow(InternalServerError);
    });

    it('refuses an entry whose value is present but not a string.', (): void => {
      const bad = doc({ entries: [
        { issuer: ISS, claim: 'acr', value: 7 as any, dimension: 'authenticatorStrength', level: 1 },
      ]});
      expect((): unknown => new SignedAssuranceCrosswalk(bad, EXPECTED_VERSION)).toThrow(InternalServerError);
    });
  });

  describe('issuer trust', (): void => {
    const crosswalk = new SignedAssuranceCrosswalk(doc(), EXPECTED_VERSION);

    it('recognises an approved issuer and rejects an unapproved one.', (): void => {
      expect(crosswalk.isApprovedIssuer(ISS)).toBe(true);
      expect(crosswalk.isApprovedIssuer(OTHER_ISS)).toBe(false);
    });

    it('assertApprovedIssuer passes for an approved issuer.', (): void => {
      expect((): void => crosswalk.assertApprovedIssuer(ISS)).not.toThrow();
    });

    it('assertApprovedIssuer rejects an unapproved issuer (T-13).', (): void => {
      expect((): void => crosswalk.assertApprovedIssuer(OTHER_ISS)).toThrow(BadRequestHttpError);
    });
  });

  describe('deriving normalized dimensions', (): void => {
    const crosswalk = new SignedAssuranceCrosswalk(doc(), EXPECTED_VERSION);

    it('maps an exact-value string claim and keeps the highest level, tracing the accepted claim.', (): void => {
      const { dimensions, methodRefs } = crosswalk.derive(ISS, { acr: 'urn:strong' });
      expect(dimensions.authenticatorStrength).toBe(3);
      expect(dimensions.identityProofing).toBe(0);
      expect(methodRefs).toStrictEqual([ 'acr=urn:strong' ]);
    });

    it('maps a presence-based claim from a multi-valued (array) claim.', (): void => {
      const { dimensions, methodRefs } = crosswalk.derive(ISS, { amr: [ 'pwd', 'otp' ]});
      expect(dimensions.identityProofing).toBe(2);
      expect(methodRefs).toStrictEqual([ 'amr' ]);
    });

    it('ignores a claim whose value does not match (fail closed, no escalation).', (): void => {
      const { dimensions, methodRefs } = crosswalk.derive(ISS, { acr: 'urn:weak' });
      expect(dimensions.authenticatorStrength).toBe(0);
      expect(methodRefs).toHaveLength(0);
    });

    it('does not let an empty-string claim satisfy a presence dimension (finding 5).', (): void => {
      const { dimensions, methodRefs } = crosswalk.derive(ISS, { amr: '' });
      expect(dimensions.identityProofing).toBe(0);
      expect(methodRefs).toHaveLength(0);
    });

    it('filters empty strings out of a multi-valued claim but keeps the non-empty ones (finding 5).', (): void => {
      const { dimensions, methodRefs } = crosswalk.derive(ISS, { amr: [ '', 'pwd' ]});
      expect(dimensions.identityProofing).toBe(2);
      expect(methodRefs).toStrictEqual([ 'amr' ]);
    });

    it('ignores an unmapped claim and returns every dimension at its lowest value.', (): void => {
      const { dimensions, methodRefs } = crosswalk.derive(ISS, { loa: 'novel-unmapped' });
      expect(Object.values(dimensions).every((level): boolean => level === 0)).toBe(true);
      expect(methodRefs).toHaveLength(0);
    });

    it('never fires an entry that belongs to a different issuer.', (): void => {
      const { dimensions } = crosswalk.derive(ISS, { acr: 'urn:strong' });
      // The OTHER_ISS federationTrust:5 entry must NOT contribute for ISS.
      expect(dimensions.federationTrust).toBe(0);
    });

    it('defaults to no claims when none are supplied.', (): void => {
      const { dimensions, methodRefs } = crosswalk.derive(ISS);
      expect(Object.values(dimensions).every((level): boolean => level === 0)).toBe(true);
      expect(methodRefs).toHaveLength(0);
    });
  });

  it('exposes a stable lowest-grade sentinel.', (): void => {
    expect(LOWEST_ASSURANCE_GRADE).toBe('databox-assurance:lowest');
  });
});
