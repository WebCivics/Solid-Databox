import { InternalServerError } from '../../util/errors/InternalServerError';
import { InMemoryTenantBindingRegistry } from '../tenant/TenantBindingRegistry';
import type { TenantBinding } from '../tenant/TenantBindingRegistry';
import { InMemoryRelationshipMappingRegistry } from '../provisioning/RelationshipMappingRegistry';
import type {
  RelationshipMappingRegistry,
  RelationshipRegistration,
} from '../provisioning/RelationshipMappingRegistry';
import { InMemorySourceOutbox } from '../bridge/SourceOutbox';
import type { CommittedSourceEvent, TransactionalSourceOutbox } from '../bridge/SourceOutbox';
import type { BridgeReconciliation, SourceEvent } from '../bridge/BridgeTypes';
import type { RelationshipRecord } from '../provisioning/ProvisioningTypes';
import type { DurableStateStore } from './DurableStateStore';

/**
 * Durable, restart-surviving variants of the process-local authorities (CIV-C10) — the same
 * interfaces over a {@link DurableStateStore} instead of bare maps. Each write-throughs to the pod
 * and rehydrates on {@link initialize}; a fresh instance over the same store sees the prior state.
 *
 * Lifecycle: `await registry.initialize()` once at startup (rehydrates the in-memory indexes from the
 * persisted document), then the sync read paths serve from the index and every mutation persists
 * behind `await registry.flush()` (the durability boundary — call it before shutdown / at commit
 * points that must survive a restart).
 */

interface TenantBindingsState {
  readonly bindings: readonly TenantBinding[];
}

export class DurableTenantBindingRegistry extends InMemoryTenantBindingRegistry {
  private persisted: TenantBinding[] = [];
  private pending: Promise<void> = Promise.resolve();
  private initialized = false;

  public constructor(private readonly state: DurableStateStore) {
    super();
  }

  /** Rehydrate the binding indexes from the durable document (call once at startup). */
  public async initialize(): Promise<void> {
    const saved = await this.state.load<TenantBindingsState>();
    for (const binding of saved?.bindings ?? []) {
      // Re-runs the T-31 exclusivity checks on the replayed set.
      super.register(binding);
      this.persisted.push(binding);
    }
    this.initialized = true;
  }

  public override register(binding: TenantBinding): void {
    if (!this.initialized) {
      throw new InternalServerError('DurableTenantBindingRegistry must be initialized() before use.');
    }
    super.register(binding);
    this.persisted = [ ...this.persisted, binding ];
    this.pending = this.state.save<TenantBindingsState>({ bindings: this.persisted });
  }

  /** Await the outstanding persist — the point at which registered bindings are durable. */
  public async flush(): Promise<void> {
    await this.pending;
  }
}

interface RelationshipMappingsState {
  readonly registrations: readonly RelationshipRegistration[];
}

export class DurableRelationshipMappingRegistry
  extends InMemoryRelationshipMappingRegistry
  implements RelationshipMappingRegistry {
  private persisted: RelationshipRegistration[] = [];
  private initialized = false;

  public constructor(private readonly state: DurableStateStore) {
    super();
  }

  /** Rehydrate the mapping indexes by replaying the persisted registrations (idempotent register). */
  public async initialize(): Promise<void> {
    const saved = await this.state.load<RelationshipMappingsState>();
    for (const registration of saved?.registrations ?? []) {
      // Idempotent find-or-create; replays cleanly.
      await super.register(registration);
      this.persisted.push(registration);
    }
    this.initialized = true;
  }

  public override async register(registration: RelationshipRegistration): Promise<RelationshipRecord> {
    if (!this.initialized) {
      throw new InternalServerError('DurableRelationshipMappingRegistry must be initialized() before use.');
    }
    const isNew = await this.findByIdempotencyKey(registration.idempotencyKey) === undefined;
    const record = await super.register(registration);
    if (isNew) {
      this.persisted = [ ...this.persisted, registration ];
      await this.state.save<RelationshipMappingsState>({ registrations: this.persisted });
    }
    return record;
  }
}

interface SourceOutboxState {
  readonly committed: readonly CommittedSourceEvent[];
}

export class DurableSourceOutbox extends InMemorySourceOutbox implements TransactionalSourceOutbox {
  private persisted: CommittedSourceEvent[] = [];
  private pending: Promise<void> = Promise.resolve();
  private initialized = false;

  public constructor(private readonly state: DurableStateStore) {
    super();
  }

  /** Rehydrate the committed-event rows (with reconciliations) from the durable document. */
  public async initialize(): Promise<void> {
    const saved = await this.state.load<SourceOutboxState>();
    for (const row of saved?.committed ?? []) {
      // Re-derives the same businessRecordId from the tuple.
      const committed = super.commit(row.event);
      if (row.reconciliation !== undefined) {
        super.markReconciled(row.event.sourceEventId, row.reconciliation);
      }
      this.persisted.push({ ...committed, reconciliation: row.reconciliation });
    }
    this.initialized = true;
  }

  public override commit(event: SourceEvent): CommittedSourceEvent {
    if (!this.initialized) {
      throw new InternalServerError('DurableSourceOutbox must be initialized() before use.');
    }
    const record = super.commit(event);
    const isNew = !this.persisted.some(r => r.businessRecordId === record.businessRecordId);
    if (isNew) {
      this.persisted = [ ...this.persisted, record ];
      this.pending = this.state.save<SourceOutboxState>({ committed: this.persisted });
    }
    return record;
  }

  public override markReconciled(sourceEventId: string, reconciliation: BridgeReconciliation): void {
    if (!this.initialized) {
      throw new InternalServerError('DurableSourceOutbox must be initialized() before use.');
    }
    super.markReconciled(sourceEventId, reconciliation);
    this.persisted = this.persisted.map(r =>
      r.event.sourceEventId === sourceEventId ? { ...r, reconciliation } : r);
    this.pending = this.state.save<SourceOutboxState>({ committed: this.persisted });
  }

  /** Await the outstanding persist — the point at which committed rows are durable. */
  public async flush(): Promise<void> {
    await this.pending;
  }
}
