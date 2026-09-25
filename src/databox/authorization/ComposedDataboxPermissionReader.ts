import type { Credentials } from '../../authentication/Credentials';
import type { PermissionReaderInput } from '../../authorization/PermissionReader';
import { PermissionReader } from '../../authorization/PermissionReader';
import type { PermissionMap, PermissionSet } from '../../authorization/permissions/Permissions';
import { AccessMode } from '../../authorization/permissions/Permissions';
import type { ResourceIdentifier } from '../../http/representation/ResourceIdentifier';
import { IdentifierMap } from '../../util/map/IdentifierMap';
import type { ExistenceVisibility } from '../profile/InstitutionProfile';
import type { DataboxAuthorizationDecision } from './AuthorizationReasonCodes';
import { evaluateDataboxAuthorization } from './ComposedAuthorizationEngine';
import type { DataboxAuthorizationInput } from './DataboxAuthorizationInput';
import type { ComposedDataboxAuthorizer } from './DataboxAuthorizer';

/**
 * The policy inputs a {@link DataboxAuthorizationInputResolver} supplies for one (resource, request):
 * everything the engine needs except the requested modes and resource path, which the reader fills from
 * the CSS {@link PermissionReaderInput}.
 */
export type DataboxPolicyInputs = Omit<DataboxAuthorizationInput, 'requestedModes' | 'resourcePath'>;

/**
 * Resolves the per-request Databox policy inputs (immutable tenant C5, verified context C3, relationship
 * status C13, class assurance minimums, delegation validity, immutability classification, ODRL decision)
 * for a given resource and credentials.
 *
 * Returning `undefined` means "no Databox authorization context could be established" and the reader
 * fails closed for that resource (denies every requested mode). This is the seam the request-pipeline
 * wiring (out of DBX-14 scope) fills by pulling the deep-frozen upstream contexts off the request; it is
 * deliberately authorization-system-neutral (ADR-0003) — it names no WAC/ACP internals.
 */
export interface DataboxAuthorizationInputResolver {
  resolve: (
    identifier: ResourceIdentifier,
    modes: ReadonlySet<AccessMode>,
    credentials: Credentials,
  ) => Promise<DataboxPolicyInputs | undefined>;
}

/** An audit-sink event: the composed decision plus the facts the safe-response surface needs. */
export interface DataboxDecisionEvent {
  /** The resource the decision was made for. */
  readonly resource: ResourceIdentifier;
  /** The structured, audit-safe decision (reason code + step-up, no protected content). */
  readonly decision: DataboxAuthorizationDecision;
  /**
   * Whether the POST-narrow (composed) result grants Read — i.e. the actor may STILL observe the resource
   * after the Databox layer narrowed it. Keyed on the composed result, not the pre-narrow WAC one, so an
   * assurance denial that removed Read cannot surface a 403 step-up that confirms existence (M2, T-07).
   */
  readonly composedReadObservable: boolean;
  /** The record/submission-class existence visibility (ADR-0023); `suppressed` always hides behind 404. */
  readonly existenceVisibility: ExistenceVisibility;
}

/**
 * Receives every composed authorization decision for the C13 evidence deny/allow event (ADR-0019). The
 * reader emits the decision here; routing it to the ledger is the wiring's concern.
 */
export interface DataboxDecisionSink {
  record: (event: DataboxDecisionEvent) => void;
}

/**
 * The composed Databox authorizer (component C4, DBX-14) as a CSS {@link PermissionReader} that composes
 * *over* an upstream WAC (or, later, ACP) {@link PermissionReader}, narrowing its result and never
 * widening it (ADR-0003, invariant 12).
 *
 * For every requested resource it:
 *  1. reads the upstream (WAC) {@link PermissionMap};
 *  2. resolves the per-request Databox policy inputs (fail closed if none);
 *  3. evaluates the deterministic conjunction ({@link evaluateDataboxAuthorization});
 *  4. produces a narrowed {@link PermissionSet} that starts from the WAC result and only ever forces the
 *     engine's `deniedModes` to `false` — it NEVER introduces a `true` the WAC surface did not grant.
 *
 * Guarantee (structural, not merely intended): for every mode, the narrowed result is `true` only if the
 * upstream WAC result was already `true`. A broad WAC grant therefore cannot bypass tenant, assurance,
 * immutability or an ODRL prohibition — those can only subtract.
 */
export class ComposedDataboxPermissionReader extends PermissionReader implements ComposedDataboxAuthorizer {
  public readonly narrowNeverBroaden = true as const;

  private readonly source: PermissionReader;
  private readonly resolver: DataboxAuthorizationInputResolver;
  private readonly sink?: DataboxDecisionSink;

  /**
   * @param source - The upstream authorization-system-neutral reader whose result is narrowed (WAC now).
   * @param resolver - Supplies the per-request Databox policy inputs; `undefined` fails closed.
   * @param sink - Optional audit sink receiving every decision (routed to the C13 ledger by the wiring).
   */
  public constructor(
    source: PermissionReader,
    resolver: DataboxAuthorizationInputResolver,
    sink?: DataboxDecisionSink,
  ) {
    super();
    this.source = source;
    this.resolver = resolver;
    this.sink = sink;
  }

  public async handle(input: PermissionReaderInput): Promise<PermissionMap> {
    const upstream = await this.source.handleSafe(input);
    const result: PermissionMap = new IdentifierMap();

    for (const [ identifier, modes ] of input.requestedModes.entrySets()) {
      const wacSet = upstream.get(identifier) ?? {};
      const resolved = await this.resolver.resolve(identifier, modes, input.credentials);
      // `undefined` means the resource is NOT databox-governed (not a relationship-box path) — pass
      // through the upstream WAC result unchanged rather than deny: ordinary Solid resources (pods,
      // public documents) carry no Databox conjuncts, and a box path that cannot resolve a tenant
      // degrades to its own ACL. Narrowing applies only when a databox context actually resolved.
      const decision = resolved === undefined ? undefined : this.evaluate(resolved, identifier, modes);
      const narrowed = decision === undefined ? { ...wacSet } : this.narrow(wacSet, decision);
      result.set(identifier, narrowed);
      // The audit event carries the POST-narrow (composed) Read grant, NOT the pre-narrow WAC one
      // (round-2 fix M2): an assurance denial that narrows Read→false must NOT surface a 403 step-up that
      // would confirm existence. A pass-through (non-databox resource) emits no decision event —
      // existence visibility defaults to `suppressed` for any resolved databox context.
      if (decision !== undefined) {
        this.sink?.record({
          resource: identifier,
          decision,
          composedReadObservable: narrowed[AccessMode.read] === true,
          existenceVisibility: resolved?.existenceVisibility ?? 'suppressed',
        });
      }
    }

    // Pass through any upstream entries the request did not ask about, UNCHANGED. This is faithful to the
    // WAC surface and still narrow-never-broaden: an unchanged copy introduces no new `true`.
    for (const [ identifier, wacSet ] of upstream) {
      if (!result.has(identifier)) {
        result.set(identifier, { ...wacSet });
      }
    }
    return result;
  }

  /**
   * Evaluate the conjunction for one resolved databox resource. Called only when the resolver produced
   * inputs (the path is databox-governed); a missing conjunct inside those inputs is what fails closed.
   */
  private evaluate(
    resolved: DataboxPolicyInputs,
    identifier: ResourceIdentifier,
    modes: ReadonlySet<AccessMode>,
  ): DataboxAuthorizationDecision {
    return evaluateDataboxAuthorization({ ...resolved, requestedModes: modes, resourcePath: identifier.path });
  }

  /**
   * Narrow a single upstream permission set: start from a copy of the WAC result and force each denied
   * mode to `false`. No `true` is ever introduced — this is the narrow-never-broaden guarantee in one
   * place (invariant 12).
   */
  private narrow(wacSet: PermissionSet, decision: DataboxAuthorizationDecision): PermissionSet {
    const narrowed: PermissionSet = { ...wacSet };
    for (const mode of decision.deniedModes) {
      narrowed[mode] = false;
    }
    return narrowed;
  }
}
