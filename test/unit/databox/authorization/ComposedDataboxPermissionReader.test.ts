import type { PermissionReaderInput } from '../../../../src/authorization/PermissionReader';
import { PermissionReader } from '../../../../src/authorization/PermissionReader';
import type { PermissionMap, PermissionSet } from '../../../../src/authorization/permissions/Permissions';
import { AccessMode } from '../../../../src/authorization/permissions/Permissions';
import type {
  DataboxAuthorizationInputResolver,
  DataboxDecisionEvent,
  DataboxPolicyInputs,
} from '../../../../src/databox/authorization/ComposedDataboxPermissionReader';
import { ComposedDataboxPermissionReader } from '../../../../src/databox/authorization/ComposedDataboxPermissionReader';
import { DATABOX_DENIAL_CODES } from '../../../../src/databox/authorization/AuthorizationReasonCodes';
import type { DataboxRequestContext } from '../../../../src/databox/context/DataboxRequestContext';
import type { TenantContext } from '../../../../src/databox/tenant/TenantContext';
import type { ResourceIdentifier } from '../../../../src/http/representation/ResourceIdentifier';
import { IdentifierMap, IdentifierSetMultiMap } from '../../../../src/util/map/IdentifierMap';

const BOX_ROOT = 'https://databox.example/boxes/box-a/';
const AUDIENCE = 'https://databox.example/aud/prog-a';
const target: ResourceIdentifier = { path: `${BOX_ROOT}records/r1` };

function tenant(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: 'org-a/prog-a',
    organisation: 'org-a',
    program: 'prog-a',
    boxId: 'box-a',
    boxRoot: BOX_ROOT,
    relationshipId: 'rel-a',
    audience: AUDIENCE,
    ...overrides,
  };
}

function context(overrides: Partial<DataboxRequestContext> = {}): DataboxRequestContext {
  return {
    webId: 'https://vault.example/a#me',
    audience: AUDIENCE,
    assurance: {
      grade: 'g',
      dimensions: {
        identityProofing: 3,
        authenticatorStrength: 3,
        federationTrust: 3,
        authenticationFreshness: 3,
        stepUpState: 3,
        delegationEvidence: 3,
      },
    },
    ...overrides,
  };
}

function policyInputs(overrides: Partial<DataboxPolicyInputs> = {}): DataboxPolicyInputs {
  return {
    tenant: tenant(),
    context: context(),
    relationship: { active: true, credentialRevoked: false },
    requiredAssurance: [],
    immutable: { mutatesAcceptedResource: false },
    odrl: { outcome: 'permitted' },
    existenceVisibility: 'visible',
    ...overrides,
  };
}

class StubReader extends PermissionReader {
  private readonly map: PermissionMap;

  public constructor(map: PermissionMap) {
    super();
    this.map = map;
  }

  public async handle(): Promise<PermissionMap> {
    return this.map;
  }
}

function upstream(entries: [ResourceIdentifier, PermissionSet][]): PermissionMap {
  return new IdentifierMap<PermissionSet>(entries);
}

function requestFor(modes: AccessMode[], identifier: ResourceIdentifier = target): PermissionReaderInput {
  return {
    credentials: { agent: { webId: 'https://vault.example/a#me' }},
    requestedModes: new IdentifierSetMultiMap<AccessMode>([[ identifier, new Set(modes) ]]),
  };
}

function resolverFor(inputs: DataboxPolicyInputs | undefined): DataboxAuthorizationInputResolver {
  return { resolve: async(): Promise<DataboxPolicyInputs | undefined> => inputs };
}

/** Build a reader over a broad WAC grant (read+write+append true) narrowed by the given policy inputs. */
function broadReader(inputs: DataboxPolicyInputs): ComposedDataboxPermissionReader {
  return new ComposedDataboxPermissionReader(
    new StubReader(upstream([[ target, { read: true, write: true, append: true }]])),
    resolverFor(inputs),
  );
}

function sinkCollecting(events: DataboxDecisionEvent[]): { record: (event: DataboxDecisionEvent) => void } {
  return { record: (event: DataboxDecisionEvent): void => {
    events.push(event);
  } };
}

/** Run the reader and return the narrowed permission set for the default target. */
async function narrowedFor(
  reader: ComposedDataboxPermissionReader,
  request: PermissionReaderInput,
): Promise<PermissionSet | undefined> {
  const result = await reader.handleSafe(request);
  return result.get(target);
}

describe('ComposedDataboxPermissionReader (narrow-never-broaden)', (): void => {
  it('flags itself as narrow-never-broaden.', (): void => {
    const reader = new ComposedDataboxPermissionReader(
      new StubReader(upstream([])),
      resolverFor(policyInputs()),
    );
    expect(reader.narrowNeverBroaden).toBe(true);
  });

  it('passes an allowed WAC grant through unchanged.', async(): Promise<void> => {
    const reader = new ComposedDataboxPermissionReader(
      new StubReader(upstream([[ target, { read: true }]])),
      resolverFor(policyInputs()),
    );
    const result = await reader.handleSafe(requestFor([ AccessMode.read ]));
    expect(result.get(target)).toEqual({ read: true });
  });

  it('narrows a WAC grant to false when a Databox conjunct denies (append-only write).', async(): Promise<void> => {
    const reader = new ComposedDataboxPermissionReader(
      new StubReader(upstream([[ target, { read: true, write: true }]])),
      resolverFor(policyInputs({ immutable: { mutatesAcceptedResource: true }})),
    );
    const result = await reader.handleSafe(requestFor([ AccessMode.read, AccessMode.write ]));
    // Read (not a mutating mode) survives; write is forced to false. No `true` is ever introduced.
    expect(result.get(target)).toEqual({ read: true, write: false });
  });

  describe('a broad WAC permission cannot bypass ANY conjunct (M3)', (): void => {
    const request = requestFor([ AccessMode.read, AccessMode.write, AccessMode.append ]);
    const denied = { read: false, write: false, append: false };

    it('...tenant (target outside the tenant box).', async(): Promise<void> => {
      const reader = broadReader(policyInputs({ tenant: tenant({ boxRoot: 'https://databox.example/boxes/box-b/' }) }));
      await expect(narrowedFor(reader, request)).resolves.toEqual(denied);
    });

    it('...token-audience (context audience not bound to the tenant).', async(): Promise<void> => {
      const reader = broadReader(policyInputs({ context: context({ audience: 'https://evil.example/aud' }) }));
      await expect(narrowedFor(reader, request)).resolves.toEqual(denied);
    });

    it('...relationship (inactive).', async(): Promise<void> => {
      const reader = broadReader(policyInputs({ relationship: { active: false, credentialRevoked: false }}));
      await expect(narrowedFor(reader, request)).resolves.toEqual(denied);
    });

    it('...credential (revoked).', async(): Promise<void> => {
      const reader = broadReader(policyInputs({ relationship: { active: true, credentialRevoked: true }}));
      await expect(narrowedFor(reader, request)).resolves.toEqual(denied);
    });

    it('...assurance (below the record-class minimum).', async(): Promise<void> => {
      const reader = broadReader(policyInputs({
        requiredAssurance: [{ dimension: 'identityProofing', minLevel: 4 }],
        context: context({ assurance: undefined }),
      }));
      await expect(narrowedFor(reader, request)).resolves.toEqual(denied);
    });

    it('...delegation (claim present, grant invalid).', async(): Promise<void> => {
      const reader = broadReader(policyInputs({
        context: context({ delegation: { onBehalfOf: 'https://vault.example/b#me', grantRef: 'g' }}),
        delegation: { valid: false },
      }));
      await expect(narrowedFor(reader, request)).resolves.toEqual(denied);
    });

    it('...ODRL (prohibition).', async(): Promise<void> => {
      const reader = broadReader(policyInputs({ odrl: { outcome: 'prohibited' }}));
      await expect(narrowedFor(reader, request)).resolves.toEqual(denied);
    });

    it('...malformed input (empty immutable object fails closed, not skipped).', async(): Promise<void> => {
      const reader = broadReader(policyInputs({
        immutable: {} as unknown as DataboxPolicyInputs['immutable'],
      }));
      await expect(narrowedFor(reader, request)).resolves.toEqual(denied);
    });
  });

  it('passes the upstream result through when no Databox context resolves.', async(): Promise<void> => {
    // `undefined` from the resolver means the resource is NOT databox-governed — the reader passes the
    // WAC result through unchanged rather than deny: ordinary Solid resources carry no conjuncts.
    const reader = new ComposedDataboxPermissionReader(
      new StubReader(upstream([[ target, { read: true, write: true }]])),
      resolverFor(undefined),
    );
    const result = await reader.handleSafe(requestFor([ AccessMode.read, AccessMode.write ]));
    expect(result.get(target)).toEqual({ read: true, write: true });
  });

  it('handles a missing upstream entry as an empty set and still narrows.', async(): Promise<void> => {
    const reader = new ComposedDataboxPermissionReader(
      new StubReader(upstream([])),
      resolverFor(policyInputs({ odrl: { outcome: 'prohibited' }})),
    );
    const result = await reader.handleSafe(requestFor([ AccessMode.read ]));
    expect(result.get(target)).toEqual({ read: false });
  });

  it('passes through upstream entries the request did not ask about, unchanged.', async(): Promise<void> => {
    const other: ResourceIdentifier = { path: `${BOX_ROOT}records/other` };
    const reader = new ComposedDataboxPermissionReader(
      new StubReader(upstream([
        [ target, { read: true }],
        [ other, { read: true, write: true }],
      ])),
      resolverFor(policyInputs()),
    );
    const result = await reader.handleSafe(requestFor([ AccessMode.read ]));
    expect(result.get(other)).toEqual({ read: true, write: true });
  });

  it('emits each decision with POST-narrow Read and the existence visibility.', async(): Promise<void> => {
    const events: DataboxDecisionEvent[] = [];
    const reader = new ComposedDataboxPermissionReader(
      new StubReader(upstream([[ target, { read: true }]])),
      // WAC grants Read, but ODRL prohibits → composed Read is narrowed to false.
      resolverFor(policyInputs({ odrl: { outcome: 'prohibited' }, existenceVisibility: 'suppressed' })),
      sinkCollecting(events),
    );
    await reader.handleSafe(requestFor([ AccessMode.read ]));
    expect(events).toHaveLength(1);
    expect(events[0].resource).toBe(target);
    expect(events[0].decision.code).toBe(DATABOX_DENIAL_CODES.odrlProhibited);
    // Keyed on the composed (post-narrow) Read, NOT the pre-narrow WAC Read (M2).
    expect(events[0].composedReadObservable).toBe(false);
    expect(events[0].existenceVisibility).toBe('suppressed');
  });

  it('reports composedReadObservable true when Read survives narrowing.', async(): Promise<void> => {
    const events: DataboxDecisionEvent[] = [];
    const reader = new ComposedDataboxPermissionReader(
      new StubReader(upstream([[ target, { read: true, write: true }]])),
      // Only write is narrowed (append-only); Read survives → composedReadObservable is true.
      resolverFor(policyInputs({ immutable: { mutatesAcceptedResource: true }})),
      sinkCollecting(events),
    );
    await reader.handleSafe(requestFor([ AccessMode.read, AccessMode.write ]));
    expect(events[0].composedReadObservable).toBe(true);
    expect(events[0].existenceVisibility).toBe('visible');
  });

  it('emits no decision event for a pass-through (non-databox) resource.', async(): Promise<void> => {
    // A resource with no databox context is not governed — no composed decision exists to audit.
    const events: DataboxDecisionEvent[] = [];
    const reader = new ComposedDataboxPermissionReader(
      new StubReader(upstream([[ target, { read: true }]])),
      resolverFor(undefined),
      sinkCollecting(events),
    );
    await reader.handleSafe(requestFor([ AccessMode.read ]));
    expect(events).toHaveLength(0);
  });
});
