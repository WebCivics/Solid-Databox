import { InternalServerError } from '../../util/errors/InternalServerError';
import type { InstitutionalKey, RelationshipRecord } from './ProvisioningTypes';

/**
 * Input to {@link RelationshipMappingRegistry.register}: the protected chain of one relationship.
 */
export interface RelationshipRegistration {
  /**
   * The protected, keyed idempotency key for this relationship (a tenant-keyed HMAC of the namespaced
   * institutional tuple; ADR-0016 HD-12, ADR-0004). Program-local; never emitted.
   */
  readonly idempotencyKey: string;
  /** The relationship record to store if none exists for {@link idempotencyKey}. */
  readonly record: RelationshipRecord;
  /** The raw institutional key (incl. PII `customerId`) to retain registry-internally only. */
  readonly customer: InstitutionalKey;
}

/**
 * The protected, program-local relationship-mapping registry (component C11, DBX-04 §6; ADR-0016 HD-10).
 *
 * This is the authoritative store for the typed chain
 * `institutional key → opaque relationship → opaque Databox → pairwise WebID`. It is the crown-jewel PII
 * store: it is the only place the raw `customerId` is held, and it is a **control-plane** component that
 * MUST NOT be reachable through the data plane (ADR-0016 §Consequences). A durable JSON/SQLite-backed
 * implementation is a deployment choice (ADR-0016 §Open sub-questions); this interface fixes the
 * invariants, and {@link InMemoryRelationshipMappingRegistry} is the reference implementation.
 */
export interface RelationshipMappingRegistry {
  /**
   * Atomic find-or-create keyed by the (protected) idempotency key. If a relationship already exists for
   * the key, the existing record is returned unchanged and the input is discarded — this is the
   * relationship-level idempotency guarantee (ADR-0016; T-24). Otherwise the record is stored and
   * returned. A box identifier that is already bound to a *different* relationship is refused (identifiers
   * are never reassigned, ADR-0002 §3.2; fail closed).
   */
  register: (registration: RelationshipRegistration) => Promise<RelationshipRecord>;

  /**
   * Resolves a relationship by its (protected) idempotency key, or `undefined` if none. Never reveals
   * anything for an unknown key (enumeration fails safely, T-06).
   */
  findByIdempotencyKey: (idempotencyKey: string) => Promise<RelationshipRecord | undefined>;

  /**
   * Resolves the relationship an opaque box belongs to — the protected box→relationship map (invariant 2,
   * ADR-0002 §3.2). Returns `undefined` for an unknown/guessed box id (no existence leak, T-06).
   */
  findByBoxId: (boxId: string) => Promise<RelationshipRecord | undefined>;

  /**
   * Resolves a relationship record by its opaque relationship identifier — the per-request lifecycle
   * re-check (DBX-13) reads `status` here. Returns `undefined` for an unknown id (fail closed).
   */
  findByRelationshipId: (relationshipId: string) => Promise<RelationshipRecord | undefined>;

  /**
   * Control-plane-only reverse resolution of relationship → raw institutional key (for correction
   * connectors, ADR-0023). Returns `undefined` for an unknown relationship. This is the single method
   * that exposes PII and exists only inside the control plane.
   */
  resolveCustomer: (relationshipId: string) => Promise<InstitutionalKey | undefined>;
}

/**
 * In-memory reference implementation of {@link RelationshipMappingRegistry} (ADR-0016 §Open sub-questions
 * permits a local store behind this interface; HD-10). Backed by process-local maps; a production
 * deployment swaps in a durable, access-audited store without changing the interface.
 *
 * It keeps three indexes — by idempotency key, by box id, and by relationship id (to the raw key) — so
 * that idempotency, the protected box→relationship lookup, and control-plane PII resolution each resolve
 * in one hop. The raw `customerId` lives only in the relationship→customer index.
 */
export class InMemoryRelationshipMappingRegistry implements RelationshipMappingRegistry {
  private readonly byIdempotencyKey = new Map<string, RelationshipRecord>();
  private readonly byBoxId = new Map<string, RelationshipRecord>();
  private readonly byRelationshipId = new Map<string, RelationshipRecord>();
  private readonly customerByRelationship = new Map<string, InstitutionalKey>();

  public async register(registration: RelationshipRegistration): Promise<RelationshipRecord> {
    const { idempotencyKey, record, customer } = registration;

    const existing = this.byIdempotencyKey.get(idempotencyKey);
    if (existing) {
      // Idempotent hit: the relationship is already provisioned; return its assigned box unchanged.
      return existing;
    }

    const boxHolder = this.byBoxId.get(record.boxId);
    if (boxHolder) {
      // A box identifier is never reassigned to a second relationship (ADR-0002 §3.2). This is a
      // CSPRNG collision or a caller bug; fail closed rather than overwrite an existing binding.
      throw new InternalServerError(`Opaque box identifier ${record.boxId} is already bound; refusing to reassign.`);
    }

    this.byIdempotencyKey.set(idempotencyKey, record);
    this.byBoxId.set(record.boxId, record);
    this.byRelationshipId.set(record.relationshipId, record);
    this.customerByRelationship.set(record.relationshipId, customer);
    return record;
  }

  public async findByIdempotencyKey(idempotencyKey: string): Promise<RelationshipRecord | undefined> {
    return this.byIdempotencyKey.get(idempotencyKey);
  }

  public async findByBoxId(boxId: string): Promise<RelationshipRecord | undefined> {
    return this.byBoxId.get(boxId);
  }

  public async findByRelationshipId(relationshipId: string): Promise<RelationshipRecord | undefined> {
    return this.byRelationshipId.get(relationshipId);
  }

  public async resolveCustomer(relationshipId: string): Promise<InstitutionalKey | undefined> {
    return this.customerByRelationship.get(relationshipId);
  }
}
