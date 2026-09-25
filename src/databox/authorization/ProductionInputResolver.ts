import type { Credentials } from '../../authentication/Credentials';
import { AccessMode } from '../../authorization/permissions/Permissions';
import type { ResourceIdentifier } from '../../http/representation/ResourceIdentifier';
import type { AuthenticatedContextExtractor } from '../context/AuthenticatedContextExtractor';
import type { DataboxRequestContext } from '../context/DataboxRequestContext';
import type { ExistenceVisibility, RecordClass, SubmissionClass } from '../profile/InstitutionProfile';
import type { TenantResolver } from '../tenant/TenantResolver';
import { boxIdFromTarget } from '../tenant/TenantContext';
import type {
  DelegationDecision,
  ImmutableOperationClassification,
  OdrlPreconditionDecision,
  RelationshipStatusSnapshot,
} from './DataboxAuthorizationInput';
import type { DataboxAuthorizationInputResolver, DataboxPolicyInputs } from './ComposedDataboxPermissionReader';

/**
 * CIV-C25 — the production {@link DataboxAuthorizationInputResolver}. Until now only test
 * fixtures filled the seam (a static `inputs` object); this is the real per-request
 * assembler the {@link ComposedDataboxPermissionReader} (DBX-14) composes over.
 *
 * For one (resource, request) it pulls each conjunct from its authoritative source —
 * tenant (C5), authenticated context (C3), the per-request relationship/status re-check,
 * the record-class assurance minimums + existence visibility (the InstitutionProfile),
 * the delegation validity, the append-only classification, and the ODRL precondition —
 * and fails closed (`undefined`) when a required conjunct cannot be resolved.
 *
 * Ordering matters: the verified context is extracted FIRST because the tenant resolver
 * binds against the token's audience (DBX-11 §7 — the audience is a verified claim, never
 * a request-echoed header).
 */

/** Which access modes would mutate (replace/delete) an existing resource — the append-only check. */
const MUTATING_MODES: ReadonlySet<AccessMode> = new Set([ AccessMode.write, AccessMode.delete ]);

/**
 * Resolves the record/submission class a resource path belongs to — deployment-specific
 * (a path-segment convention or a registry). Absent → the resource isn't a governed class;
 * the engine then sees only the fail-closed defaults.
 *
 * A typed collaborator (not a bare function) so the param is Components.js-loadable —
 * a concrete implementation emits as a component (CIV-C26).
 */
export interface ResourceClassifier {
  classify: (identifier: ResourceIdentifier) => RecordClass | SubmissionClass | undefined;
}

/** The per-request relationship/status re-check (DBX-13) for the resolved relationship. */
export interface RelationshipStatusSource {
  snapshot: (relationshipId: string) => Promise<RelationshipStatusSnapshot | undefined>;
}

/** Whether `identifier` holds an already-accepted record the operation would overwrite/delete. */
export interface AcceptedResourceIndex {
  isAccepted: (identifier: ResourceIdentifier) => Promise<boolean>;
}

/** The per-op ODRL precondition evaluation (C12) for the resolved class + action. */
export interface OdrlPreconditionSource {
  evaluate: (
    assetClass: string,
    modes: ReadonlySet<AccessMode>,
    context: DataboxRequestContext,
  ) => Promise<OdrlPreconditionDecision>;
}

/** The per-op delegation-grant validity check (C9) when the context carries a claim. */
export interface DelegationChecker {
  check: (
    grantRef: string,
    onBehalfOf: string,
    modes: ReadonlySet<AccessMode>,
  ) => Promise<DelegationDecision>;
}

export interface ProductionResolverDeps {
  /** The verified authenticated-context extractor (C3). */
  readonly contextExtractor: AuthenticatedContextExtractor;
  /** The authoritative tenant resolver (C5). */
  readonly tenantResolver: TenantResolver;
  /**
   * The default record-existence visibility for unclassified resources (ADR-0023). Passed as a
   * scalar, not the whole {@link InstitutionProfile} — a deep config object is not a loadable
   * constructor param (CIV-C26).
   */
  readonly defaultExistenceVisibility: ExistenceVisibility;
  /** Maps a resource path to its governed record/submission class. */
  readonly classifier: ResourceClassifier;
  /** The per-request relationship + credential-status re-check. */
  readonly relationshipSource: RelationshipStatusSource;
  /** The accepted-resource index for the append-only classification. */
  readonly acceptedIndex: AcceptedResourceIndex;
  /** The per-op ODRL precondition evaluator. */
  readonly odrlPrecondition: OdrlPreconditionSource;
  /** The delegation-grant checker — required only when the context asserts a delegation. */
  readonly delegationChecker?: DelegationChecker;
  /** The request origin the tenant was validated against (attacker-controllable — C5 re-asserts). */
  readonly origin?: string;
  /** The program service identity a bridge presented, when present. */
  readonly serviceIdentity?: string;
  /**
   * The databox box-root namespace prefix (the base the opaque box id sits under). A target outside
   * it is NOT a databox resource — {@link resolve} returns `undefined` so the composed reader passes
   * the upstream WAC result through. A target INSIDE it is databox-governed: a failed resolution then
   * returns denying inputs rather than `undefined`, so a broken box mapping still fails closed (DBX-26:
   * the composed reader must deny databox paths it cannot resolve, but must not deny ordinary Solid
   * resources).
   */
  readonly boxBase: string;
}

export class ProductionDataboxAuthorizationInputResolver implements DataboxAuthorizationInputResolver {
  public constructor(private readonly deps: ProductionResolverDeps) {}

  public async resolve(
    identifier: ResourceIdentifier,
    modes: ReadonlySet<AccessMode>,
    credentials: Credentials,
  ): Promise<DataboxPolicyInputs | undefined> {
    // 0. Scope gate — a target outside the box namespace is NOT databox-governed: return `undefined`
    //    so the composed reader passes the upstream WAC result through (ordinary Solid resources —
    //    pods, public docs — carry no Databox conjuncts). A target inside the namespace IS governed;
    //    any resolution failure below then yields denying inputs, never `undefined`.
    const boxId = boxIdFromTarget(identifier.path, this.deps.boxBase);
    if (boxId === undefined) {
      return undefined;
    }
    return this.resolveGoverned(identifier, modes, credentials);
  }

  private async resolveGoverned(
    identifier: ResourceIdentifier,
    modes: ReadonlySet<AccessMode>,
    credentials: Credentials,
  ): Promise<DataboxPolicyInputs> {
    const deny = (): DataboxPolicyInputs => ({
      requiredAssurance: [],
      existenceVisibility: this.deps.defaultExistenceVisibility,
    });

    // 1. Verified context FIRST — the tenant binds against its audience (verified claim).
    const context = await this.deps.contextExtractor.handleSafe({ credentials });

    // 2. Tenant — resolved from the target path + verified audience (fail closed if absent).
    let tenant;
    try {
      tenant = await this.deps.tenantResolver.handleSafe({
        target: identifier.path,
        ...context.webId === undefined ? {} : { webId: context.webId },
        ...context.audience === undefined ? {} : { audience: context.audience },
        ...this.deps.origin === undefined ? {} : { origin: this.deps.origin },
        ...this.deps.serviceIdentity === undefined ? {} : { serviceIdentity: this.deps.serviceIdentity },
      });
    } catch {
      // A databox path whose tenant cannot resolve is a governed resource with a missing conjunct → deny.
      return deny();
    }

    // 3. Classify the resource → its assurance minimums + existence visibility.
    const klass = this.deps.classifier.classify(identifier);

    // 4. Per-request relationship status re-check (DBX-13).
    const relationship = await this.deps.relationshipSource.snapshot(tenant.relationshipId);
    if (relationship === undefined) {
      // A missing relationship snapshot on a governed path is a missing conjunct → deny.
      return deny();
    }

    // 5. Append-only classification — a mutating mode on an accepted resource.
    const mutating = [ ...modes ].some(mode => MUTATING_MODES.has(mode));
    const immutable: ImmutableOperationClassification = {
      mutatesAcceptedResource: mutating && await this.deps.acceptedIndex.isAccepted(identifier),
    };

    // 6. ODRL precondition — evaluated only when a governed class resolved. An unclassified resource
    //    carries no policy constraint, so the outcome is `permitted` (ODRL can only SUBTRACT
    //    reachability, never add it — ADR-0013; there is nothing to subtract without a class). Running
    //    the evaluator on an unclassified asset would fail closed on an absent policy and wrongly deny
    //    the holder's own reads of resources that simply aren't class-governed.
    const odrl: OdrlPreconditionDecision = klass === undefined ?
        { outcome: 'permitted' } :
        await this.deps.odrlPrecondition.evaluate(klass.id, modes, context);

    // 7. Delegation — required only when the context asserts an on-behalf-of claim.
    const delegation = await this.resolveDelegation(context, modes);

    return {
      tenant,
      context,
      relationship,
      requiredAssurance: 'minimumAssurance' in (klass ?? {}) ?
          (klass!).minimumAssurance :
          [],
      ...delegation === undefined ? {} : { delegation },
      immutable,
      odrl,
      existenceVisibility: 'existenceVisibility' in (klass ?? {}) ?
          (klass as RecordClass).existenceVisibility :
        this.deps.defaultExistenceVisibility,
    };
  }

  private async resolveDelegation(
    context: DataboxRequestContext,
    modes: ReadonlySet<AccessMode>,
  ): Promise<DelegationDecision | undefined> {
    const claim = context.delegation;
    if (claim === undefined) {
      return undefined;
    }
    if (this.deps.delegationChecker === undefined) {
      // A delegation claim with no checker configured → the claim cannot be validated → deny.
      return { valid: false };
    }
    return this.deps.delegationChecker.check(claim.grantRef, claim.onBehalfOf, modes);
  }
}
