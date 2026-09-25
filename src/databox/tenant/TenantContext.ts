/**
 * Value types and pure helpers for the resolved program tenant (component C5, DBX-04 §2/§6; ADR-0002;
 * DBX-11). No runtime dependencies on the request pipeline live here, so the immutable shape of a
 * resolved tenant is stated once and cannot drift between the resolver, the isolation guard and the
 * store boundary.
 *
 * CSS 7.1.9 has no tenant / multi-realm concept (DBX-01 §5), so all of this is net-new.
 */

/**
 * A minimal tenant-scoping pair. Both fields are the opaque, PII-free identifiers minted by
 * provisioning (ADR-0002/ADR-0004): they are the accountable organisation and its program, and are
 * the only facts that define "one tenant". Never a raw customer/PII value.
 */
export interface TenantScope {
  /** Opaque accountable-organisation identifier (the tenant principal, ADR-0004). */
  readonly organisation: string;
  /** Opaque program identifier within the organisation. */
  readonly program: string;
}

/**
 * The resolved, validated program tenant for a single request (component C5, DBX-04 §9.1).
 *
 * Tenant identity is resolved and validated *before* authorization (closes T-01/T-54) and is then
 * carried immutably into the operation. Every field is `readonly` and the object is deep-frozen at
 * construction ({@link freezeTenantContext}), so no downstream layer (authorizer C4, store C6, audit)
 * can mutate a resolved tenant — the immutability the architecture requires (DBX-04 §6, decision 1).
 */
export interface TenantContext extends TenantScope {
  /**
   * Opaque, stable tenant identifier derived only from {@link TenantScope}. Never a raw customer or
   * PII value; safe to place in an audit event.
   */
  readonly tenantId: string;
  /** The opaque box identifier the request targets (resolved from the request target path). */
  readonly boxId: string;
  /** The opaque box root path the target lives under (the tenant's storage namespace member). */
  readonly boxRoot: string;
  /** The opaque relationship this box belongs to (from the mapping registry). */
  readonly relationshipId: string;
  /** The request origin/host the tenant was validated against, retained for audit. */
  readonly origin?: string;
  /** The token audience the tenant was validated against, when a token was presented. */
  readonly audience?: string;
  /** The program service identity the tenant was validated against, when a bridge presented one. */
  readonly serviceIdentity?: string;
  /**
   * When the request bound via the holder's pairwise WebID (the vault-controlled per-relationship
   * identity, ADR-0004), this carries it so the authorizer can re-assert `context.webId ===
   * pairwiseWebId` independently — the pairwise match, not a program audience, is the binding.
   */
  readonly pairwiseWebId?: string;
}

/**
 * Input to a {@link TenantResolver}: the request-identifying facts used to resolve and validate a
 * tenant. `target` is the (potentially attacker-rewritten) request target path — the host/path swap of
 * T-01 lands here — while `origin`/`audience`/`serviceIdentity` are the credential facts that MUST all
 * agree with the target's owning tenant.
 */
export interface TenantResolverInput {
  /** The request origin / host authority the request arrived on. */
  readonly origin?: string;
  /** The audience the presented token was bound to (program-bound, ADR-0002/ADR-0009). */
  readonly audience?: string;
  /** The program service identity a bridge authenticated as (per-program, ADR-0016 HD-13). */
  readonly serviceIdentity?: string;
  /**
   * The verified WebID the request authenticates as (component C3). When it equals the relationship's
   * `pairwiseWebId` the holder is bound directly — the pairwise WebID is the vault-controlled
   * per-relationship identity (ADR-0004), a stronger binding than a program-level audience/origin.
   */
  readonly webId?: string;
  /** The request target path; the box identifier is derived from it (never from a name/slug). */
  readonly target: string;
}

/**
 * The stable, opaque tenant identifier for a scope. Deterministic and reversible-free of PII: it is a
 * function of the two opaque provisioning identifiers only. Encoded so a `/` inside either value cannot
 * smithy a different scope's id.
 */
export function tenantIdOf(organisation: string, program: string): string {
  return `${encodeURIComponent(organisation)}/${encodeURIComponent(program)}`;
}

/**
 * Whether two records name the exact same tenant. The single definition of tenant equality used by the
 * resolver, the isolation guard and the store boundary, so "same tenant" cannot mean different things in
 * different places.
 */
export function sameTenant(a: TenantScope, b: TenantScope): boolean {
  return a.organisation === b.organisation && a.program === b.program;
}

/**
 * Derive the opaque box identifier from a request target path under the configured box base. Fails
 * closed (returns `undefined`) for a target outside the base namespace, a target with no box segment, or
 * a relative-traversal segment — none of which name a real box, so the resolver denies. The identifier
 * is taken from the path only; it is never derived from a customer name or slug (ADR-0002/ADR-0004).
 */
export function boxIdFromTarget(target: string, base: string): string | undefined {
  if (!target.startsWith(base)) {
    return undefined;
  }
  const segment = target.slice(base.length).split('/', 1)[0];
  if (segment.length === 0 || segment === '.' || segment === '..') {
    return undefined;
  }
  return segment;
}

/**
 * Recursively freeze the assembled context so no downstream layer can mutate a resolved tenant fact.
 * Mirrors the C3 context immutability pattern: only non-null objects are frozen; primitives and
 * `null`/`undefined` short-circuit so `Object.values` is never called on a non-object.
 */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

/**
 * Produce the immutable {@link TenantContext} carried into the operation. The returned object is
 * deep-frozen; attempting to reassign any field throws in strict mode (T-54: the resolved tenant cannot
 * be re-pointed after resolution).
 */
export function freezeTenantContext(context: TenantContext): TenantContext {
  return deepFreeze(context);
}
