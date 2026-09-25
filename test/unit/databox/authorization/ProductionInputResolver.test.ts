import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AccessMode } from '../../../../src/authorization/permissions/Permissions';
import type { Credentials } from '../../../../src/authentication/Credentials';
import type { ResourceIdentifier } from '../../../../src/http/representation/ResourceIdentifier';
import type { AuthenticatedContextExtractor } from '../../../../src/databox/context/AuthenticatedContextExtractor';
import type { DataboxRequestContext } from '../../../../src/databox/context/DataboxRequestContext';
import {
  ProductionDataboxAuthorizationInputResolver,
} from '../../../../src/databox/authorization/ProductionInputResolver';
import type { ProductionResolverDeps } from '../../../../src/databox/authorization/ProductionInputResolver';
import { loadInstitutionProfile } from '../../../../src/databox/profile/InstitutionProfileValidator';
import type { InstitutionProfile } from '../../../../src/databox/profile/InstitutionProfile';
import type { TenantResolver } from '../../../../src/databox/tenant/TenantResolver';
import type { TenantContext } from '../../../../src/databox/tenant/TenantContext';

const PROFILE: InstitutionProfile = loadInstitutionProfile(
  JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', '..', 'databox', 'fixtures', 'loyalty-institution-profile.json'),
      'utf8',
    ),
  ),
);

const ID: ResourceIdentifier = { path: '/box-1/records/rc-receipt/1' };
const CREDS = { agent: { webId: 'https://user.example/#me' }} as unknown as Credentials;

function context(partial: Partial<DataboxRequestContext> = {}): DataboxRequestContext {
  return {
    webId: 'https://user.example/#me',
    audience: 'https://org.example/programs/loyalty',
    ...partial,
  };
}

function tenantCtx(): TenantContext {
  return {
    tenantId: 'tenant-1',
    boxId: 'box-1',
    boxRoot: '/box-1/',
    relationshipId: 'rel-1',
    organisation: 'org-1',
    program: 'loyalty',
    origin: 'https://org.example',
  };
}

function deps(overrides: Partial<ProductionResolverDeps> = {}): ProductionResolverDeps {
  return {
    contextExtractor: {
      handleSafe: async(): Promise<DataboxRequestContext> => context(),
    } as unknown as AuthenticatedContextExtractor,
    tenantResolver: { handleSafe: async(): Promise<TenantContext> => tenantCtx() } as unknown as TenantResolver,
    defaultExistenceVisibility: PROFILE.redress.existenceVisibilityDefault,
    classifier: { classify: (): typeof PROFILE.recordClasses[0] | undefined => PROFILE.recordClasses[0] },
    relationshipSource: { snapshot: async(): Promise<{ active: boolean; credentialRevoked: boolean }> =>
      ({ active: true, credentialRevoked: false }) },
    acceptedIndex: { isAccepted: async(): Promise<boolean> => false },
    odrlPrecondition: { evaluate: async(): Promise<{ outcome: 'permitted' }> => ({ outcome: 'permitted' }) },
    origin: 'https://org.example',
    boxBase: '/box-1/',
    ...overrides,
  };
}

describe('ProductionDataboxAuthorizationInputResolver (CIV-C25)', (): void => {
  it('assembles all conjuncts from their authoritative sources.', async(): Promise<void> => {
    const resolver = new ProductionDataboxAuthorizationInputResolver(deps());
    const input = await resolver.resolve(ID, new Set([ AccessMode.read ]), CREDS);
    expect(input).toBeDefined();
    expect(input?.tenant?.tenantId).toBe('tenant-1');
    expect(input?.context?.webId).toBe('https://user.example/#me');
    expect(input?.relationship).toEqual({ active: true, credentialRevoked: false });
    expect(input?.requiredAssurance).toBe(PROFILE.recordClasses[0].minimumAssurance);
    expect(input?.existenceVisibility).toBe(PROFILE.recordClasses[0].existenceVisibility);
    expect(input?.immutable).toEqual({ mutatesAcceptedResource: false });
    expect(input?.odrl).toEqual({ outcome: 'permitted' });
    expect(input?.delegation).toBeUndefined();
  });

  it('fails closed when no tenant resolves.', async(): Promise<void> => {
    const resolver = new ProductionDataboxAuthorizationInputResolver(deps({
      tenantResolver: { handleSafe: async(): Promise<never> => {
        throw new Error('no tenant');
      } } as unknown as TenantResolver,
    }));
    // A governed box path whose tenant cannot resolve yields denying inputs (no tenant/context), not
    // a pass-through — the engine denies on the missing conjuncts.
    const input = await resolver.resolve(ID, new Set([ AccessMode.read ]), CREDS);
    expect(input).toBeDefined();
    expect(input?.tenant).toBeUndefined();
    expect(input?.context).toBeUndefined();
  });

  it('fails closed when the relationship snapshot is absent.', async(): Promise<void> => {
    const resolver = new ProductionDataboxAuthorizationInputResolver(deps({
      relationshipSource: { snapshot: async(): Promise<undefined> => undefined },
    }));
    const input = await resolver.resolve(ID, new Set([ AccessMode.read ]), CREDS);
    expect(input).toBeDefined();
    expect(input?.relationship).toBeUndefined();
  });

  it('passes through (undefined) a target outside the databox box namespace.', async(): Promise<void> => {
    // An ordinary Solid path — a pod, not a relationship box — is not databox-governed: the resolver
    // returns undefined so the composed reader applies the upstream WAC result unchanged.
    const resolver = new ProductionDataboxAuthorizationInputResolver(deps());
    await expect(resolver.resolve({ path: '/holder/profile/card' }, new Set([ AccessMode.read ]), CREDS))
      .resolves.toBeUndefined();
  });

  it('marks a write on an accepted resource as immutable-violating.', async(): Promise<void> => {
    const resolver = new ProductionDataboxAuthorizationInputResolver(deps({
      acceptedIndex: { isAccepted: async(): Promise<boolean> => true },
    }));
    const input = await resolver.resolve(ID, new Set([ AccessMode.write ]), CREDS);
    expect(input?.immutable).toEqual({ mutatesAcceptedResource: true });
    // A read on the same accepted resource is not a mutation.
    const read = await resolver.resolve(ID, new Set([ AccessMode.read ]), CREDS);
    expect(read?.immutable).toEqual({ mutatesAcceptedResource: false });
  });

  it('a delegation claim with no checker fails closed.', async(): Promise<void> => {
    const resolver = new ProductionDataboxAuthorizationInputResolver(deps({
      contextExtractor: { handleSafe: async(): Promise<DataboxRequestContext> =>
        context({ delegation: { onBehalfOf: 'https://other/#me', grantRef: 'grant-9' }}) } as unknown as AuthenticatedContextExtractor,
      // No `delegationChecker` configured.
    }));
    const input = await resolver.resolve(ID, new Set([ AccessMode.read ]), CREDS);
    expect(input?.delegation).toEqual({ valid: false });
  });

  it('an unclassified resource gets the profile\'s default visibility + empty assurance.', async(): Promise<void> => {
    const resolver = new ProductionDataboxAuthorizationInputResolver(deps({
      classifier: { classify: (): undefined => undefined },
    }));
    const input = await resolver.resolve(ID, new Set([ AccessMode.read ]), CREDS);
    expect(input?.requiredAssurance).toEqual([]);
    expect(input?.existenceVisibility).toBe(PROFILE.redress.existenceVisibilityDefault);
  });
});
