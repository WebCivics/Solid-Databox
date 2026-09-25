import { AccessMode } from '../../../../src/authorization/permissions/Permissions';
import type { ResourceIdentifier } from '../../../../src/http/representation/ResourceIdentifier';
import type { ResourceStore } from '../../../../src/storage/ResourceStore';
import {
  InMemoryDelegationGrantRegistry,
  PathSegmentResourceClassifier,
  PolicyEvaluatorOdrlSource,
  RegistryDelegationChecker,
  RegistryRelationshipStatusSource,
  ResourceStoreAcceptedIndex,
} from '../../../../src/databox/authorization/ResolverCollaborators';
import type { PolicyEvaluator } from '../../../../src/databox/policy/PolicyEvaluator';
import type { RelationshipMappingRegistry } from '../../../../src/databox/provisioning/RelationshipMappingRegistry';
import type { RelationshipRecord } from '../../../../src/databox/provisioning/ProvisioningTypes';

const ID: ResourceIdentifier = { path: '/box-1/records/rc-1/1' };

function record(status: 'active' | 'suspended'): RelationshipRecord {
  return {
    relationshipId: 'rel-1',
    boxId: 'box-1',
    boxRoot: '/box-1/',
    pairwiseWebId: 'https://pairwise.example/#me',
    organisation: 'org-1',
    program: 'loyalty',
    sourceSystem: 'crm',
    status,
    provisionedAt: '2026-01-01',
  };
}

function registry(rec?: RelationshipRecord): RelationshipMappingRegistry {
  return {
    findByRelationshipId: async(): Promise<RelationshipRecord | undefined> => rec,
    findByBoxId: async(): Promise<RelationshipRecord | undefined> => rec,
    findByIdempotencyKey: async(): Promise<RelationshipRecord | undefined> => rec,
    register: async(): Promise<RelationshipRecord> => rec!,
    resolveCustomer: async(): Promise<undefined> => undefined,
  };
}

describe('resolver collaborators (CIV-C26)', (): void => {
  it('ResourceStoreAcceptedIndex reports store existence as the accepted flag.', async(): Promise<void> => {
    const store = { hasResource: async(): Promise<boolean> => true } as unknown as ResourceStore;
    await expect(new ResourceStoreAcceptedIndex(store).isAccepted(ID)).resolves.toBe(true);
    const empty = { hasResource: async(): Promise<boolean> => false } as unknown as ResourceStore;
    await expect(new ResourceStoreAcceptedIndex(empty).isAccepted(ID)).resolves.toBe(false);
  });

  it('RegistryRelationshipStatusSource yields active+revocation; unknown → undefined.', async(): Promise<void> => {
    const revoked = { isRevoked: (): boolean => true };
    const source = new RegistryRelationshipStatusSource(registry(record('active')), revoked);
    await expect(source.snapshot('rel-1')).resolves.toEqual({ active: true, credentialRevoked: true });
    const missing = new RegistryRelationshipStatusSource(registry(undefined), revoked);
    await expect(missing.snapshot('ghost')).resolves.toBeUndefined();
    const suspended = new RegistryRelationshipStatusSource(registry(record('suspended')), revoked);
    expect((await suspended.snapshot('rel-1'))?.active).toBe(false);
  });

  it('PolicyEvaluatorOdrlSource evaluates each mode; any non-permitted denies.', async(): Promise<void> => {
    const permitted = { evaluate: (): { outcome: string } => ({ outcome: 'permitted' }) } as unknown as PolicyEvaluator;
    const evalSource = new PolicyEvaluatorOdrlSource(permitted, (): string => '2026-01-01');
    await expect(evalSource.evaluate('rc-1', new Set([ AccessMode.read ]), {} as any)).resolves
      .toEqual({ outcome: 'permitted' });
    const prohibiting = { evaluate: (req: { action: string }): { outcome: string } =>
      ({ outcome: req.action.includes('delete') ? 'prohibited' : 'permitted' }) } as unknown as PolicyEvaluator;
    const deny = new PolicyEvaluatorOdrlSource(prohibiting, (): string => '2026-01-01');
    const result = await deny.evaluate('rc-1', new Set([ AccessMode.read, AccessMode.delete ]), {});
    expect(result.outcome).toBe('prohibited');
  });

  it('RegistryDelegationChecker fails closed on an unknown/mismatched grant.', async(): Promise<void> => {
    const grants = new InMemoryDelegationGrantRegistry();
    const checker = new RegistryDelegationChecker(grants, (): string => '2026-06-01');
    await grants.put({
      id: 'grant-1',
      principal: 'https://org.example/#me',
      delegate: 'https://agent.example/#me',
      scope: [ 'http://www.w3.org/ns/odrl/2/read' ],
      expires: '2027-01-01',
    });
    await expect(checker.check('grant-1', 'https://org.example/#me', new Set([ AccessMode.read ]))).resolves
      .toEqual({ valid: true });
    // Out-of-scope action, wrong principal, unknown grant — all invalid.
    await expect(checker.check('grant-1', 'https://org.example/#me', new Set([ AccessMode.delete ]))).resolves
      .toEqual({ valid: false });
    await expect(checker.check('grant-1', 'https://other/#me', new Set([ AccessMode.read ]))).resolves
      .toEqual({ valid: false });
    await expect(checker.check('ghost', 'https://org.example/#me', new Set([ AccessMode.read ]))).resolves
      .toEqual({ valid: false });
  });

  it('PathSegmentResourceClassifier maps a class-id path segment; unmatched → undefined.', (): void => {
    const klass = { id: 'rc-receipt' } as any;
    const classifier = new PathSegmentResourceClassifier([ klass ]);
    expect(classifier.classify({ path: '/box-1/records/rc-receipt/1' })).toBe(klass);
    expect(classifier.classify({ path: '/box-1/records/other/1' })).toBeUndefined();
  });
});
