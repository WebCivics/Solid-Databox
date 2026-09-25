import { getLoggerFor } from '../../logging/LogUtil';
import { NotFoundHttpError } from '../../util/errors/NotFoundHttpError';
import { NotImplementedHttpError } from '../../util/errors/NotImplementedHttpError';
import { AsyncHandler } from '../../util/handlers/AsyncHandler';
import type { RelationshipMappingRegistry } from '../provisioning/RelationshipMappingRegistry';
import type { TenantBindingRegistry } from './TenantBindingRegistry';
import type { TenantContext, TenantResolverInput } from './TenantContext';
import { boxIdFromTarget, freezeTenantContext, sameTenant, tenantIdOf } from './TenantContext';
import { TENANT_DENIED_MESSAGE } from './TenantIsolationGuard';

// Re-export the tenant plane so the existing single `export * from './tenant/TenantResolver'` barrel
// line (src/databox/index.ts, src/index.ts) transitively re-exports every DBX-11 symbol without a
// barrel edit. See databox/handoffs/DBX-11.md §barrel.
export * from './TenantContext';
export * from './TenantBindingRegistry';
export * from './TenantIsolationGuard';

/**
 * Resolves and validates the program tenant for a request before authorization runs (component C5,
 * DBX-04 §9.1; ADR-0002; DBX-11). Fails closed: an unresolved or mismatched tenant denies (existence-
 * hiding) rather than defaulting to a tenant. Concrete resolver is {@link RegistryTenantResolver}.
 */
export abstract class TenantResolver extends AsyncHandler<TenantResolverInput, TenantContext> {}

/**
 * The real C5 tenant resolver (DBX-11), replacing the fail-closed stub.
 *
 * It resolves the *authoritative* tenant of the request from the **target box** — the resource's owning
 * tenant comes from the protected box→relationship mapping (DBX-10), which no credential can spoof — and
 * then requires that every credential fact the request presents (token audience, request origin, bridge
 * service identity) agrees with that one tenant, via the program-bound {@link TenantBindingRegistry}
 * (ADR-0002/ADR-0016). Any disagreement, or a request that carries no tenant-binding fact at all, denies.
 *
 * Threats closed here (all deny with the identical existence-hiding response, no leak):
 * - **T-01** host/path swap: a valid token for program A's box, target rewritten to program B's box,
 *   fails because B's tenant does not match A's audience/origin.
 * - **T-02** cross-program bridge credential: program A's service identity presented against program B's
 *   box is refused (the service identity resolves to A, the box to B).
 * - **T-31** platform-wide data-plane credential: structurally impossible — a service identity/audience/
 *   origin can be bound to only one tenant (see {@link TenantBindingRegistry}); a fact that resolves to
 *   no single tenant is denied.
 *
 * The resolved tenant is returned as an immutable, deep-frozen {@link TenantContext} carried into the
 * operation; the store boundary re-validates it via `TenantIsolationGuard` to close the T-54 race.
 */
export class RegistryTenantResolver extends TenantResolver {
  private readonly logger = getLoggerFor(this);
  private readonly mapping: RelationshipMappingRegistry;
  private readonly bindings: TenantBindingRegistry;
  private readonly boxBase: string;

  /**
   * @param mapping - The protected box→relationship mapping registry (DBX-10). Control-plane; reached
   *   below the data-plane surface, never through a consumer token (ADR-0002/ADR-0016).
   * @param bindings - The program-bound origin/audience/service-identity registry (ADR-0002/ADR-0016).
   * @param boxBase - The box-root base URL the opaque box id is a path segment under.
   */
  public constructor(mapping: RelationshipMappingRegistry, bindings: TenantBindingRegistry, boxBase: string) {
    super();
    this.mapping = mapping;
    this.bindings = bindings;
    this.boxBase = boxBase;
  }

  public async handle(input: TenantResolverInput): Promise<TenantContext> {
    const { origin, audience, serviceIdentity, webId, target } = input;

    // 1. Derive the opaque box id from the (possibly rewritten) target path; fail closed on a target
    //    outside the box namespace or with no box segment (never a name/slug, ADR-0004).
    const boxId = boxIdFromTarget(target, this.boxBase);
    if (boxId === undefined) {
      throw this.deny('target is outside the box namespace or carries no box segment');
    }

    // 2. Resolve the target's AUTHORITATIVE tenant from the protected mapping. An unknown/guessed box
    //    resolves to nothing and is denied identically to a real box the caller may not see (T-01/T-06).
    const record = await this.mapping.findByBoxId(boxId);
    if (!record) {
      throw this.deny('no relationship is bound to the target box');
    }

    // 2b. Holder binding — the request's verified WebID IS the relationship's pairwise WebID. The
    //     pairwise identity is the vault-controlled per-relationship credential (ADR-0004): it binds
    //     the holder directly to this tenant without a program-level audience/origin fact (the holder's
    //     own data-plane access to their box). Any OTHER webId is not a pairwise match.
    const holderBound = webId !== undefined && webId === record.pairwiseWebId;
    if (holderBound) {
      return freezeTenantContext({
        tenantId: tenantIdOf(record.organisation, record.program),
        organisation: record.organisation,
        program: record.program,
        boxId,
        boxRoot: record.boxRoot,
        relationshipId: record.relationshipId,
        pairwiseWebId: record.pairwiseWebId,
        origin,
        audience,
        serviceIdentity,
      });
    }

    // 3. The tenant MUST have program-bound facts configured; absence fails closed (never default).
    const binding = this.bindings.findByTenant(record.organisation, record.program);
    if (!binding) {
      throw this.deny('no program-bound tenant binding is configured for the target tenant');
    }

    // 4. The request MUST carry at least one fact that binds it to a tenant; a bare box target with no
    //    audience/origin/service identity cannot be attributed to a tenant and is denied.
    if (audience === undefined && origin === undefined && serviceIdentity === undefined) {
      throw this.deny('request carries no tenant-binding fact (audience/origin/service identity)');
    }

    // 5. Every presented fact MUST resolve to the SAME tenant as the target box. A fact bound to another
    //    tenant, or to no single tenant, denies (T-01 audience/origin swap; T-02/T-31 service identity).
    this.assertFactAgrees('audience', audience, this.bindings.findByAudience.bind(this.bindings), record);
    this.assertFactAgrees('origin', origin, this.bindings.findByOrigin.bind(this.bindings), record);
    this.assertFactAgrees(
      'service identity',
      serviceIdentity,
      this.bindings.findByServiceIdentity.bind(this.bindings),
      record,
    );

    // 6. Storage-namespace binding: the box root MUST live under the tenant's namespace (ADR-0002 §3.2).
    if (!record.boxRoot.startsWith(binding.storageNamespace)) {
      throw this.deny('target box root is outside the tenant storage namespace');
    }

    // Build the immutable, deep-frozen tenant context carried into the operation.
    this.logger.debug(`Resolved tenant ${tenantIdOf(record.organisation, record.program)} for box ${boxId}.`);
    return freezeTenantContext({
      tenantId: tenantIdOf(record.organisation, record.program),
      organisation: record.organisation,
      program: record.program,
      boxId,
      boxRoot: record.boxRoot,
      relationshipId: record.relationshipId,
      origin,
      audience,
      serviceIdentity,
    });
  }

  /**
   * Assert a presented credential fact resolves to exactly the target's tenant. An absent fact is not
   * checked (step 4 already required at least one). A fact that resolves to no tenant, or to a different
   * tenant, denies — the single check behind T-01 (audience/origin) and T-02/T-31 (service identity).
   */
  private assertFactAgrees(
    kind: string,
    value: string | undefined,
    lookup: (value: string) => { organisation: string; program: string } | undefined,
    target: { organisation: string; program: string },
  ): void {
    if (value === undefined) {
      return;
    }
    const owner = lookup(value);
    if (!owner || !sameTenant(owner, target)) {
      throw this.deny(`presented ${kind} does not resolve to the target tenant`);
    }
  }

  /**
   * Build the non-leaking denial. The specific reason is logged for the audit deny event only; the
   * thrown error carries the generic existence-hiding message (404-not-403), so the response reveals
   * nothing about tenancy or box existence (T-01, ADR-0002 §Consequences).
   */
  private deny(reason: string): NotFoundHttpError {
    this.logger.warn(`Tenant resolution denied: ${reason}.`);
    return new NotFoundHttpError(TENANT_DENIED_MESSAGE);
  }
}

/**
 * Fail-closed placeholder for {@link TenantResolver}.
 *
 * Retained default wiring until a program tenancy is configured (DBX-11). It resolves *no* tenant: it
 * throws {@link NotImplementedHttpError} instead of inventing a default tenant, because inventing one
 * would let a request cross a tenant wall. Refusing is the only safe behavior.
 */
export class NotImplementedTenantResolver extends TenantResolver {
  public async handle(): Promise<TenantContext> {
    throw new NotImplementedHttpError('Databox tenant resolver (C5) is not implemented (DBX-11).');
  }
}
