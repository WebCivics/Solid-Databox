import type { RelationshipMappingRegistry } from '../../../../src/databox/provisioning/RelationshipMappingRegistry';
import type { RelationshipRecord } from '../../../../src/databox/provisioning/ProvisioningTypes';
import type { TenantContext } from '../../../../src/databox/tenant/TenantContext';
import { freezeTenantContext, tenantIdOf } from '../../../../src/databox/tenant/TenantContext';
import { TenantIsolationGuard } from '../../../../src/databox/tenant/TenantIsolationGuard';
import { TENANT_DENIED_MESSAGE } from '../../../../src/databox/tenant/TenantResolver';
import { NotFoundHttpError } from '../../../../src/util/errors/NotFoundHttpError';

const BASE = 'https://databox.example/boxes/';

function record(overrides: Partial<RelationshipRecord> = {}): RelationshipRecord {
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

function context(): TenantContext {
  return freezeTenantContext({
    tenantId: tenantIdOf('org-b', 'prog-b'),
    organisation: 'org-b',
    program: 'prog-b',
    boxId: 'box-b',
    boxRoot: `${BASE}box-b/`,
    relationshipId: 'rel-b',
    audience: 'aud-b',
  });
}

function mappingReturning(current: RelationshipRecord | undefined): RelationshipMappingRegistry {
  return {
    register: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    findByBoxId: jest.fn().mockResolvedValue(current),
    findByRelationshipId: jest.fn(),
    resolveCustomer: jest.fn(),
  };
}

async function expectDenied(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toThrow(NotFoundHttpError);
  await expect(promise).rejects.toThrow(TENANT_DENIED_MESSAGE);
}

describe('A TenantIsolationGuard (store-boundary re-validation, T-54)', (): void => {
  it('resolves quietly when the box still binds the same tenant/relationship/root.', async(): Promise<void> => {
    const guard = new TenantIsolationGuard(mappingReturning(record()));
    await expect(guard.assertStillBound(context())).resolves.toBeUndefined();
  });

  it('denies when the box binding vanished between resolution and the store op.', async(): Promise<void> => {
    const guard = new TenantIsolationGuard(mappingReturning(undefined));
    await expectDenied(guard.assertStillBound(context()));
  });

  it('denies when the box was re-bound to another tenant mid-flight (TOCTOU).', async(): Promise<void> => {
    const mutated = record({ organisation: 'org-a', program: 'prog-a' });
    const guard = new TenantIsolationGuard(mappingReturning(mutated));
    await expectDenied(guard.assertStillBound(context()));
  });

  it('denies when the relationship changed between resolution and the store op.', async(): Promise<void> => {
    const guard = new TenantIsolationGuard(mappingReturning(record({ relationshipId: 'rel-other' })));
    await expectDenied(guard.assertStillBound(context()));
  });

  it('denies when the box root changed between resolution and the store op.', async(): Promise<void> => {
    const guard = new TenantIsolationGuard(mappingReturning(record({ boxRoot: `${BASE}box-b-moved/` })));
    await expectDenied(guard.assertStillBound(context()));
  });
});
