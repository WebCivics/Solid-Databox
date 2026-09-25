import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RandomOpaqueIdentifierGenerator } from '../../../../src/databox/identifiers/OpaqueIdentifierGenerator';
import {
  boxIdFromRoot,
  buildPolicyRefs,
  DataboxProvisioner,
} from '../../../../src/databox/provisioning/DataboxProvisioner';
import { InMemoryRelationshipMappingRegistry } from '../../../../src/databox/provisioning/RelationshipMappingRegistry';
import type { InstitutionalKey } from '../../../../src/databox/provisioning/ProvisioningTypes';
import type { InstitutionProfile } from '../../../../src/databox/profile/InstitutionProfile';
import { BadRequestHttpError } from '../../../../src/util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../src/util/errors/InternalServerError';

const BASE = 'https://databox.example/boxes/';
const validProfile = JSON.parse(
  readFileSync(join(__dirname, '../profile/fixtures/valid-institution-profile.json'), 'utf8'),
) as InstitutionProfile;

function freshProfile(): InstitutionProfile {
  return structuredClone(validProfile);
}

function key(overrides: Partial<InstitutionalKey> = {}): InstitutionalKey {
  return {
    organisation: 'org-acme',
    program: 'prog-rewards',
    sourceSystem: 'sys-pos',
    customerIdNamespace: 'loyalty',
    customerId: 'customer-000999',
    ...overrides,
  };
}

const WEBID = 'https://vault.example/profile/1#me';

function makeProvisioner(registry = new InMemoryRelationshipMappingRegistry()): {
  provisioner: DataboxProvisioner;
  registry: InMemoryRelationshipMappingRegistry;
} {
  let counter = 0;
  function relationshipIdFactory(): string {
    counter += 1;
    return `rel-${counter}`;
  }
  const provisioner = new DataboxProvisioner(new RandomOpaqueIdentifierGenerator(BASE), registry, {
    relationshipIdFactory,
    clock: (): string => '2026-07-15T00:00:00.000Z',
  });
  return { provisioner, registry };
}

describe('A DataboxProvisioner', (): void => {
  describe('provisioning a fresh relationship', (): void => {
    it('mints an opaque box, descriptor, policy refs and a protected record.', async(): Promise<void> => {
      const { provisioner, registry } = makeProvisioner();
      const result = await provisioner.provision(freshProfile(), key(), WEBID);

      expect(result.reused).toBe(false);
      expect(result.relationship.status).toBe('active');
      expect(result.relationship.pairwiseWebId).toBe(WEBID);
      // The box id is a >= 128-bit CSPRNG hex token.
      expect(result.databox.boxId).toMatch(/^[0-9a-f]{32}$/u);
      expect(result.databox.root).toBe(`${BASE}${result.databox.boxId}/`);
      // Descriptor containers are derived from the box root + program class labels (no PII).
      expect(result.databox.containers).toContain(`${result.databox.root}records/rc-receipt/`);
      expect(result.databox.containers).toContain(`${result.databox.root}submissions/sc-correction/`);
      // Program-scoped policy refs, one per record + submission class.
      expect(result.policyRefs).toEqual(expect.arrayContaining([
        {
          classId: 'rc-receipt',
          policyTemplate: 'pt-records',
          policyVersion: '1.0.0',
          odrlProfile: expect.any(String),
        },
        {
          classId: 'sc-correction',
          policyTemplate: 'pt-submissions',
          policyVersion: '1.0.0',
          odrlProfile: expect.any(String),
        },
      ]));
      // The relationship is resolvable by its opaque box id in the protected registry.
      await expect(registry.findByBoxId(result.databox.boxId)).resolves.toEqual(result.relationship);
    });

    it('keeps the raw customerId out of every emitted id / path / record (invariant 2).', async(): Promise<void> => {
      const registry = new InMemoryRelationshipMappingRegistry();
      // Inject a DETERMINISTIC, digit-free box id so the non-leakage assertions below are structural, not
      // probabilistic (a random hex id contains a short substring like '42' ~11% of the time by chance).
      // The spy also proves the customerId never reaches the generator — the id cannot be name-derived.
      const generateArgs: string[] = [];
      const stubGenerator = {
        opaque: true as const,
        generate: (name: string): { path: string } => {
          generateArgs.push(name);
          return { path: `${BASE}boxaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/` };
        },
        extractPod: (identifier: { path: string }): { path: string } => identifier,
      };
      const provisioner = new DataboxProvisioner(stubGenerator, registry, {
        relationshipIdFactory: (): string => 'rel-1',
        clock: (): string => '2026-07-15T00:00:00.000Z',
      });
      const result = await provisioner.provision(freshProfile(), key({ customerId: 'SECRET-CUSTOMER-42' }), WEBID);

      // The generator was invoked WITHOUT any customer data, so the box id cannot be customer-derived.
      expect(generateArgs).toEqual([ '' ]);
      const emitted = JSON.stringify(result);
      expect(emitted).not.toContain('SECRET-CUSTOMER-42');
      expect(emitted).not.toContain('42');
      expect(result.databox.boxId).toBe('boxaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(result.relationship).not.toHaveProperty('customerId');
      // The raw customerId is retained ONLY inside the registry, reachable only via the control-plane path.
      await expect(registry.resolveCustomer(result.relationship.relationshipId))
        .resolves.toEqual(key({ customerId: 'SECRET-CUSTOMER-42' }));
    });
  });

  describe('idempotency (ADR-0016 HD-12 / T-24)', (): void => {
    it('returns the same opaque box on repeated authorized provisioning.', async(): Promise<void> => {
      const { provisioner } = makeProvisioner();
      const first = await provisioner.provision(freshProfile(), key(), WEBID);
      const second = await provisioner.provision(freshProfile(), key(), WEBID);

      expect(second.reused).toBe(true);
      expect(second.databox.boxId).toBe(first.databox.boxId);
      expect(second.relationship.relationshipId).toBe(first.relationship.relationshipId);
      expect(second.relationship.boxRoot).toBe(first.relationship.boxRoot);
    });

    it('does not mint a fresh id per attempt across many retries.', async(): Promise<void> => {
      const { provisioner } = makeProvisioner();
      const boxes = new Set<string>();
      for (let i = 0; i < 25; i++) {
        boxes.add((await provisioner.provision(freshProfile(), key(), WEBID)).databox.boxId);
      }
      expect(boxes.size).toBe(1);
    });
  });

  describe('cross-program / cross-tenant isolation (T-01 / T-54)', (): void => {
    it('assigns unrelated boxes to the same customerId in two different programs.', async(): Promise<void> => {
      const { provisioner } = makeProvisioner();
      const a = await provisioner.provision(freshProfile(), key({ program: 'prog-a' }), WEBID);
      const b = await provisioner.provision(freshProfile(), key({ program: 'prog-b' }), WEBID);

      expect(a.databox.boxId).not.toBe(b.databox.boxId);
      expect(a.relationship.relationshipId).not.toBe(b.relationship.relationshipId);
    });

    it('assigns unrelated boxes to the same customerId in two different organisations.', async(): Promise<void> => {
      const { provisioner } = makeProvisioner();
      const a = await provisioner.provision(freshProfile(), key({ organisation: 'org-a' }), WEBID);
      const b = await provisioner.provision(freshProfile(), key({ organisation: 'org-b' }), WEBID);

      expect(a.databox.boxId).not.toBe(b.databox.boxId);
    });
  });

  describe('enumeration fails safely (T-06)', (): void => {
    it('resolves nothing for a guessed box id or idempotency key.', async(): Promise<void> => {
      const { provisioner, registry } = makeProvisioner();
      await provisioner.provision(freshProfile(), key(), WEBID);
      await expect(registry.findByBoxId('deadbeef'.repeat(4))).resolves.toBeUndefined();
      await expect(registry.findByIdempotencyKey('guessed')).resolves.toBeUndefined();
    });
  });

  describe('failing closed on invalid input', (): void => {
    it('rejects an invalid institution profile.', async(): Promise<void> => {
      const { provisioner } = makeProvisioner();
      await expect(provisioner.provision({ not: 'a profile' }, key(), WEBID)).rejects.toThrow(BadRequestHttpError);
    });

    it('rejects an institutional key with an empty field.', async(): Promise<void> => {
      const { provisioner } = makeProvisioner();
      await expect(provisioner.provision(freshProfile(), key({ customerId: '' }), WEBID))
        .rejects.toThrow(BadRequestHttpError);
    });

    it('rejects an institutional key with a non-string field.', async(): Promise<void> => {
      const { provisioner } = makeProvisioner();
      const bad = { ...key(), organisation: 42 as unknown as string };
      await expect(provisioner.provision(freshProfile(), bad, WEBID)).rejects.toThrow(BadRequestHttpError);
    });

    it('rejects a non-https / malformed pairwise WebID.', async(): Promise<void> => {
      const { provisioner } = makeProvisioner();
      await expect(provisioner.provision(freshProfile(), key(), 'http://vault.example/1#me'))
        .rejects.toThrow(BadRequestHttpError);
      await expect(provisioner.provision(freshProfile(), key(), 'not a url')).rejects.toThrow(BadRequestHttpError);
    });

    it('allows an HTTP pairwise WebID only on loopback for live integration tests.', async(): Promise<void> => {
      const { provisioner } = makeProvisioner();
      await expect(provisioner.provision(freshProfile(), key(), 'http://127.0.0.1:3456/profile/card#me'))
        .resolves.toBeDefined();
    });
  });

  describe('TOCTOU safety (T-54): a concurrent create wins atomically', (): void => {
    it('returns the already-registered box when the registry reports a winner.', async(): Promise<void> => {
      // A registry whose register() always reports a pre-existing winner (simulating a concurrent
      // provision landing first). The provisioner must surface that as reused, not a second box.
      const winner = {
        relationshipId: 'rel-winner',
        boxId: 'box-winner',
        boxRoot: `${BASE}box-winner/`,
        pairwiseWebId: WEBID,
        organisation: 'org-acme',
        program: 'prog-rewards',
        sourceSystem: 'sys-pos',
        status: 'active' as const,
        provisionedAt: '2026-07-15T00:00:00.000Z',
      };
      const racyRegistry = {
        register: async(): Promise<typeof winner> => winner,
        findByIdempotencyKey: async(): Promise<undefined> => undefined,
        findByBoxId: async(): Promise<undefined> => undefined,
        findByRelationshipId: async(): Promise<undefined> => undefined,
        resolveCustomer: async(): Promise<undefined> => undefined,
      };
      const provisioner = new DataboxProvisioner(new RandomOpaqueIdentifierGenerator(BASE), racyRegistry);
      const result = await provisioner.provision(freshProfile(), key(), WEBID);
      expect(result.reused).toBe(true);
      expect(result.databox.boxId).toBe('box-winner');
    });
  });
});

describe('boxIdFromRoot', (): void => {
  it('returns the final path segment of a box root.', (): void => {
    expect(boxIdFromRoot(`${BASE}abc123/`)).toBe('abc123');
    expect(boxIdFromRoot(`${BASE}abc123`)).toBe('abc123');
  });

  it('throws when the root has no box segment (fail closed).', (): void => {
    expect((): unknown => boxIdFromRoot('/')).toThrow(InternalServerError);
    expect((): unknown => boxIdFromRoot('')).toThrow(InternalServerError);
  });
});

describe('buildPolicyRefs', (): void => {
  it('produces one program-scoped ref per record and submission class.', (): void => {
    const refs = buildPolicyRefs(validProfile);
    expect(refs).toHaveLength(validProfile.recordClasses.length + validProfile.submissionClasses.length);
    expect(refs.map((ref): string => ref.classId))
      .toEqual([ 'rc-receipt', 'rc-warranty', 'sc-correction' ]);
  });
});
