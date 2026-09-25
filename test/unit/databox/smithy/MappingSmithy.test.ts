import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { publicJwkFromKeyObject } from '../../../../src/databox/credential/Es256';
import { MappingSmithy } from '../../../../src/databox/smithy/MappingSmithy';

const profile = JSON.parse(readFileSync(
  join(__dirname, '../../../../databox/fixtures/loyalty-institution-profile.json'),
  'utf8',
)) as unknown;

function makeSmithy(): MappingSmithy {
  return new MappingSmithy({
    now: (): string => '2026-07-15T00:00:00.000Z',
    secretFactory: (): Buffer => Buffer.alloc(32, 9),
  });
}

function register(smithy: MappingSmithy): void {
  smithy.registerProgram({
    profile,
    programUri: 'https://rewards.megamart.example/program',
    databoxBaseUrl: 'https://databox.megamart.example/boxes/',
  });
}

describe('MappingSmithy', (): void => {
  it('registers a validated business profile and lists only public configuration.', (): void => {
    const smithy = makeSmithy();
    register(smithy);
    expect(smithy.listPrograms()).toStrictEqual([ expect.objectContaining({
      profileId: 'prog-megamart-rewards-loyalty',
      recordClasses: expect.arrayContaining([ 'rc-receipt', 'rc-rewards' ]) as unknown,
    }) ]);
    expect((): unknown => register(smithy)).toThrow('already registered');
  });

  it(
    'forges an idempotent opaque mapping and holder-bound credential without leaking the customer id.',
    async(): Promise<void> => {
      const smithy = makeSmithy();
      register(smithy);
      const holder = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      const input = {
        profileId: 'prog-megamart-rewards-loyalty',
        sourceSystem: 'sor-pos',
        customerIdNamespace: 'loyalty',
        customerId: 'RAW-CUSTOMER-SECRET',
        pairwiseWebId: 'https://consumer.example/profile/card#megamart',
        holderPublicJwk: publicJwkFromKeyObject(holder.publicKey),
      };
      const first = await smithy.forgeMapping(input);
      const again = await smithy.forgeMapping(input);
      expect(first.provisioning.reused).toBe(false);
      expect(again.provisioning.reused).toBe(true);
      expect(again.provisioning.relationship.boxId).toBe(first.provisioning.relationship.boxId);
      expect(first.credential.credential.credentialSubject.connection.relationship)
        .toBe(first.provisioning.relationship.relationshipId);
      expect(JSON.stringify(first)).not.toContain(input.customerId);
      expect(first.credential.jws).not.toContain(input.customerId);
    },
  );

  it(
    'bridges a mapped source event to a signed receipt and leaves an unknown mapping unresolved.',
    async(): Promise<void> => {
      const smithy = makeSmithy();
      register(smithy);
      const holder = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      await smithy.forgeMapping({
        profileId: 'prog-megamart-rewards-loyalty',
        sourceSystem: 'sor-pos',
        customerIdNamespace: 'loyalty',
        customerId: 'KNOWN',
        pairwiseWebId: 'https://consumer.example/profile/card#megamart',
        holderPublicJwk: publicJwkFromKeyObject(holder.publicKey),
      });
      const base = {
        profileId: 'prog-megamart-rewards-loyalty',
        sourceSystem: 'sor-pos',
        eventType: 'receipt',
        customerIdNamespace: 'loyalty',
        recordClass: 'rc-receipt',
        legalBasis: 'lb-contract',
        purpose: 'p-account',
        payload: { total: 42 },
      };
      const deposited = await smithy.depositSourceEvent({ ...base, sourceEventId: 'evt-1', customerId: 'KNOWN' });
      expect(deposited.status).toBe('reconciled');
      if (deposited.status !== 'reconciled') {
        throw new Error('Expected a reconciled bridge report.');
      }
      expect(deposited.receipt.jws.split('.')).toHaveLength(3);
      expect(JSON.stringify(deposited)).not.toContain('KNOWN');

      const unresolved = await smithy.depositSourceEvent({ ...base, sourceEventId: 'evt-2', customerId: 'UNKNOWN' });
      expect(unresolved).toStrictEqual(expect.objectContaining({ status: 'unresolved' }));
    },
  );

  it('fails closed for unknown programs and insecure public URLs.', async(): Promise<void> => {
    const smithy = makeSmithy();
    expect((): unknown => smithy.registerProgram({
      profile,
      programUri: 'http://insecure.example/program',
      databoxBaseUrl: 'https://boxes.example/',
    })).toThrow('absolute HTTPS URL or HTTP loopback URL');
    await expect(smithy.depositSourceEvent({
      profileId: 'missing',
      sourceSystem: 'source',
      eventType: 'event',
      sourceEventId: '1',
      customerIdNamespace: 'ns',
      customerId: 'id',
      recordClass: 'class',
      legalBasis: 'basis',
      purpose: 'purpose',
      payload: {},
    })).rejects.toThrow('Unknown program');
  });

  it('permits HTTP only for loopback live-integration URLs.', (): void => {
    const smithy = makeSmithy();
    expect((): unknown => smithy.registerProgram({
      profile,
      programUri: 'https://rewards.megamart.example/program',
      databoxBaseUrl: 'http://127.0.0.1:3456/databox/relationships/',
    })).not.toThrow();
  });

  it('blocks a legal-compliance publication that has not passed the compliance gate.', (): void => {
    const smithy = makeSmithy();
    expect((): unknown => smithy.registerProgram({
      profile,
      programUri: 'https://rewards.megamart.example/program',
      databoxBaseUrl: 'https://databox.megamart.example/boxes/',
      claimsLegalCompliance: true,
    })).toThrow('requires a compliance assessment');
  });
});
