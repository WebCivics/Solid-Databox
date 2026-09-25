import type { AccessMode } from '../../authorization/permissions/Permissions';
import type { ResourceIdentifier } from '../../http/representation/ResourceIdentifier';
import type { ResourceStore } from '../../storage/ResourceStore';
import type { StatusListManager } from '../credential/BitstringStatusList';
import type { DataboxRequestContext } from '../context/DataboxRequestContext';
import type { DelegationInput } from '../ipms/modules/delegation/Delegation';
import { isDelegationValid } from '../ipms/modules/delegation/Delegation';
import { ODRL_NAMESPACE } from '../odrl/terms';
import type { PolicyEvaluator } from '../policy/PolicyEvaluator';
import type { RecordClass, SubmissionClass } from '../profile/InstitutionProfile';
import type { RelationshipMappingRegistry } from '../provisioning/RelationshipMappingRegistry';
import type {
  DelegationDecision,
  OdrlPreconditionDecision,
  RelationshipStatusSnapshot,
} from './DataboxAuthorizationInput';
import type {
  AcceptedResourceIndex,
  DelegationChecker,
  OdrlPreconditionSource,
  RelationshipStatusSource,
  ResourceClassifier,
} from './ProductionInputResolver';

/**
 * CIV-C26 — the concrete collaborators a deployment wires into
 * {@link ProductionDataboxAuthorizationInputResolver}. Each adapts an authoritative source
 * (the relationship registry, the credential status list, the append-only store's existence
 * check, the ODRL policy evaluator, a delegation-grant registry) to the resolver's seam —
 * and each is a plain Components.js-loadable class (object params, not bare functions), so
 * the whole authorizer chain is config-instantiable.
 *
 * These are reference deployments of the seams — a production deployment substitutes a
 * durable/access-audited registry or store behind the same interface without changing the
 * resolver.
 */

/** Whether a credential (connection) is currently revoked — satisfied by {@link StatusListManager}. */
export interface CredentialRevocationChecker {
  isRevoked: (connectionId: string) => boolean;
}

/** Where a delegation-grant registry resolves a presented `grantRef` to its grant. */
export interface DelegationGrantRegistry {
  findByRef: (grantRef: string) => Promise<DelegationInput | undefined>;
}

/** In-memory delegation-grant registry — the reference impl (deployment substitutes durable). */
export class InMemoryDelegationGrantRegistry implements DelegationGrantRegistry {
  private readonly grants = new Map<string, DelegationInput>();

  public async put(grant: DelegationInput): Promise<void> {
    this.grants.set(grant.id, grant);
  }

  public async findByRef(grantRef: string): Promise<DelegationInput | undefined> {
    return this.grants.get(grantRef);
  }
}

/** Maps an {@link AccessMode} to the ODRL action IRI the policy evaluates (ADR-0013). */
const MODE_TO_ACTION: Record<AccessMode, string> = {
  read: `${ODRL_NAMESPACE}read`,
  delete: `${ODRL_NAMESPACE}delete`,
  // Mutating/creating modes are a governed *use* of the resource under the class's policy.
  append: `${ODRL_NAMESPACE}use`,
  write: `${ODRL_NAMESPACE}use`,
  create: `${ODRL_NAMESPACE}use`,
};

/**
 * The accepted-resource index for the append-only classification (C6 / ADR-0018): a resource
 * is "accepted" iff the governed store already holds it — the case a replace/delete must be
 * denied for EVERY actor. Reads through to the underlying {@link ResourceStore}'s existence
 * check, so it is config-instantiable over the same store the AppendOnlyStore decorates.
 */
export class ResourceStoreAcceptedIndex implements AcceptedResourceIndex {
  public constructor(private readonly source: ResourceStore) {}

  public async isAccepted(identifier: ResourceIdentifier): Promise<boolean> {
    return this.source.hasResource(identifier);
  }
}

/**
 * The per-request relationship + credential-status re-check (DBX-13). `active` is the
 * relationship's lifecycle status; `credentialRevoked` is the connection credential's live
 * revocation bit. A relationship that cannot be resolved yields `undefined` → deny.
 */
export class RegistryRelationshipStatusSource implements RelationshipStatusSource {
  public constructor(
    private readonly registry: RelationshipMappingRegistry,
    private readonly revocation: CredentialRevocationChecker,
  ) {}

  public async snapshot(relationshipId: string): Promise<RelationshipStatusSnapshot | undefined> {
    const record = await this.registry.findByRelationshipId(relationshipId);
    if (record === undefined) {
      return undefined;
    }
    return {
      active: record.status === 'active',
      credentialRevoked: this.revocation.isRevoked(relationshipId),
    };
  }
}

/**
 * The per-op ODRL precondition (C12) — adapts {@link PolicyEvaluator}. Each requested mode
 * maps to its ODRL action and is evaluated; the strictest outcome wins (a `prohibited` or
 * `fail-closed` on ANY requested mode denies the whole operation — an ODRL permission can
 * never ADD reachability, only subtract; ADR-0013 two-plane).
 *
 * `serverDecisionTime` comes from the injected clock — NEVER a request-echoed timestamp
 * (MED-2: a caller-set time could select an earlier, more-permissive policy version).
 */
export class PolicyEvaluatorOdrlSource implements OdrlPreconditionSource {
  public constructor(
    private readonly evaluator: PolicyEvaluator,
    private readonly now: () => string = (): string => new Date().toISOString(),
  ) {}

  public async evaluate(
    assetClass: string,
    modes: ReadonlySet<AccessMode>,
    _context: DataboxRequestContext,
  ): Promise<OdrlPreconditionDecision> {
    const actions = new Set([ ...modes ].map(mode => MODE_TO_ACTION[mode]));
    let strictest: OdrlPreconditionDecision | undefined;
    for (const action of actions) {
      const result = this.evaluator.evaluate({
        assetClass,
        action,
        serverDecisionTime: this.now(),
      });
      if (result.outcome === 'permitted') {
        strictest = strictest ?? { outcome: 'permitted' };
      } else if (strictest?.outcome !== 'prohibited') {
        // Any non-permitted mode denies the operation outright — `prohibited` outranks
        // `fail-closed` for audit clarity, but both deny.
        strictest = { outcome: result.outcome };
      }
    }
    return strictest ?? { outcome: 'permitted' };
  }
}

/**
 * The per-op delegation-grant validity check (C9). The presented `grantRef` resolves to its
 * grant; the grant is valid iff it is in-scope for EVERY requested action and unexpired at
 * the (trusted) decision time. An unknown/absent grant is not valid — a delegation claim
 * never defaults to allowed.
 */
export class RegistryDelegationChecker implements DelegationChecker {
  public constructor(
    private readonly grants: DelegationGrantRegistry,
    private readonly now: () => string = (): string => new Date().toISOString(),
  ) {}

  public async check(
    grantRef: string,
    onBehalfOf: string,
    modes: ReadonlySet<AccessMode>,
  ): Promise<DelegationDecision> {
    const grant = await this.grants.findByRef(grantRef);
    if (grant?.principal !== onBehalfOf) {
      return { valid: false };
    }
    const at = this.now();
    const valid = [ ...modes ].every(mode =>
      isDelegationValid(grant, MODE_TO_ACTION[mode], at));
    return { valid };
  }
}

/**
 * Path-segment resource classifier — the deployment convention `{boxRoot}{kind}/{classId}/…`
 * maps a resource path to its governed record/submission class by the class's `id` segment.
 * An unmatched path yields `undefined` (the resource isn't a governed class → the engine
 * sees only the fail-closed defaults).
 */
export class PathSegmentResourceClassifier implements ResourceClassifier {
  private readonly byId = new Map<string, RecordClass | SubmissionClass>();

  public constructor(classes: (RecordClass | SubmissionClass)[]) {
    for (const klass of classes) {
      this.byId.set(klass.id, klass);
    }
  }

  public classify(identifier: ResourceIdentifier): RecordClass | SubmissionClass | undefined {
    const segments = identifier.path.split('/').filter(segment => segment.length > 0);
    for (const segment of segments) {
      const klass = this.byId.get(segment);
      if (klass !== undefined) {
        return klass;
      }
    }
    return undefined;
  }
}
