import type { RelationshipMappingRegistry } from '../../../../src/databox/provisioning/RelationshipMappingRegistry';
import type { RelationshipRecord } from '../../../../src/databox/provisioning/ProvisioningTypes';
import { InMemoryTenantBindingRegistry } from '../../../../src/databox/tenant/TenantBindingRegistry';
import {
  NotImplementedTenantResolver,
  RegistryTenantResolver,
  TENANT_DENIED_MESSAGE,
} from '../../../../src/databox/tenant/TenantResolver';
import type { TenantResolverInput } from '../../../../src/databox/tenant/TenantContext';
import { NotFoundHttpError } from '../../../../src/util/errors/NotFoundHttpError';
import { NotImplementedHttpError } from '../../../../src/util/errors/NotImplementedHttpError';

const BASE = 'https://databox.example/boxes/';

// Program B owns box-b; program A is a *different* tenant used to mount cross-tenant attacks.
function recordB(overrides: Partial<RelationshipRecord> = {}): RelationshipRecord {
  return {
    relationshipId: 'rel-b',
    boxId: 'box-b',
    boxRoot: `${BASE}box-b/`,
    pairwiseWebId: 'https://vault.example/profile/b#me',
    organisation: 'org-b',
    program: 'prog-b',
    sourceSystem: 'sys-b',
    status: 'active',
    provisionedAt: '2026-07-15T00:00:00.000Z',
    ...overrides,
  };
}

function mappingReturning(record: RelationshipRecord | undefined): RelationshipMappingRegistry {
  return {
    register: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    findByBoxId: jest.fn().mockResolvedValue(record),
    findByRelationshipId: jest.fn(),
    resolveCustomer: jest.fn(),
  };
}

function bindings(): InMemoryTenantBindingRegistry {
  const registry = new InMemoryTenantBindingRegistry();
  registry.register({
    organisation: 'org-a',
    program: 'prog-a',
    origins: [ 'https://a.databox.example' ],
    audiences: [ 'aud-a' ],
    serviceIdentities: [ 'svc-a' ],
    storageNamespace: BASE,
  });
  registry.register({
    organisation: 'org-b',
    program: 'prog-b',
    origins: [ 'https://b.databox.example' ],
    audiences: [ 'aud-b' ],
    serviceIdentities: [ 'svc-b' ],
    storageNamespace: BASE,
  });
  return registry;
}

// Every tenant denial MUST be the identical non-leaking 404 (existence-hiding, T-01; CR-SRV-02/03).
async function expectDenied(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toThrow(NotFoundHttpError);
  await expect(promise).rejects.toThrow(TENANT_DENIED_MESSAGE);
}

describe('A RegistryTenantResolver', (): void => {
  function resolver(record: RelationshipRecord | undefined = recordB()): RegistryTenantResolver {
    return new RegistryTenantResolver(mappingReturning(record), bindings(), BASE);
  }

  const validB: TenantResolverInput = { audience: 'aud-b', target: `${BASE}box-b/records/x` };

  it('resolves the target tenant and returns an immutable context.', async(): Promise<void> => {
    const context = await resolver().handle(validB);
    expect(context.tenantId).toBe('org-b/prog-b');
    expect(context.organisation).toBe('org-b');
    expect(context.program).toBe('prog-b');
    expect(context.boxId).toBe('box-b');
    expect(context.boxRoot).toBe(`${BASE}box-b/`);
    expect(context.relationshipId).toBe('rel-b');
    expect(context.audience).toBe('aud-b');
    expect(Object.isFrozen(context)).toBe(true);
  });

  it('carries origin and service identity into the context when they agree.', async(): Promise<void> => {
    const context = await resolver().handle({
      audience: 'aud-b',
      origin: 'https://b.databox.example',
      serviceIdentity: 'svc-b',
      target: `${BASE}box-b/records/x`,
    });
    expect(context.origin).toBe('https://b.databox.example');
    expect(context.serviceIdentity).toBe('svc-b');
  });

  // --- Adversarial negatives (each denied, fail-closed, non-leaking) ---

  it('T-01: denies a program-A token whose target path was swapped to program B\'s box.', async(): Promise<void> => {
    await expectDenied(resolver().handle({ audience: 'aud-a', target: `${BASE}box-b/records/x` }));
  });

  it('T-01: denies a program-A origin swapped onto program B\'s box.', async(): Promise<void> => {
    await expectDenied(resolver().handle({ origin: 'https://a.databox.example', target: `${BASE}box-b/records/x` }));
  });

  it('T-02: denies program A\'s bridge service identity against program B\'s box.', async(): Promise<void> => {
    await expectDenied(resolver().handle({ serviceIdentity: 'svc-a', target: `${BASE}box-b/records/x` }));
  });

  it('T-31: denies a fact resolving to no tenant (no platform-wide credential).', async(): Promise<void> => {
    await expectDenied(resolver().handle({ serviceIdentity: 'svc-platform', target: `${BASE}box-b/records/x` }));
  });

  it('denies a request that carries no tenant-binding fact at all (fail closed).', async(): Promise<void> => {
    await expectDenied(resolver().handle({ target: `${BASE}box-b/records/x` }));
  });

  it('enumeration: denies a guessed box id mapping to no relationship (T-06).', async(): Promise<void> => {
    const empty = new RegistryTenantResolver(mappingReturning(undefined), bindings(), BASE);
    await expectDenied(empty.handle({ audience: 'aud-b', target: `${BASE}box-guessed/x` }));
  });

  it('denies a target outside the box namespace.', async(): Promise<void> => {
    await expectDenied(resolver().handle({ audience: 'aud-b', target: 'https://evil.example/boxes/box-b/x' }));
  });

  it('denies (fail closed) when the target tenant has no program-bound binding configured.', async(): Promise<void> => {
    const orphan = recordB({ organisation: 'org-c', program: 'prog-c' });
    await expectDenied(resolver(orphan).handle({ audience: 'aud-b', target: `${BASE}box-b/records/x` }));
  });

  it('denies when the box root is outside the tenant storage namespace.', async(): Promise<void> => {
    const escaped = recordB({ boxRoot: 'https://other.example/boxes/box-b/' });
    await expectDenied(resolver(escaped).handle({ audience: 'aud-b', target: `${BASE}box-b/records/x` }));
  });
});

describe('A NotImplementedTenantResolver', (): void => {
  it('refuses to resolve a default tenant (fail closed).', async(): Promise<void> => {
    await expect(new NotImplementedTenantResolver().handle()).rejects.toThrow(NotImplementedHttpError);
  });
});
