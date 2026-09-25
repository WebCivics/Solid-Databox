import { BasicRepresentation } from '../../../../src/http/representation/BasicRepresentation';
import type { Representation } from '../../../../src/http/representation/Representation';
import type { ResourceIdentifier } from '../../../../src/http/representation/ResourceIdentifier';
import type { RepresentationPreferences } from '../../../../src/http/representation/RepresentationPreferences';
import type { ResourceStore } from '../../../../src/storage/ResourceStore';
import { NotFoundHttpError } from '../../../../src/util/errors/NotFoundHttpError';
import { DurableStateStore } from '../../../../src/databox/durable/DurableStateStore';
import {
  DurableRelationshipMappingRegistry,
  DurableSourceOutbox,
  DurableTenantBindingRegistry,
} from '../../../../src/databox/durable/DurableRegistries';
import { DurableEvidenceLedger } from '../../../../src/databox/durable/DurableEvidenceLedger';
import type { RelationshipRecord } from '../../../../src/databox/provisioning/ProvisioningTypes';
import type { BridgeReconciliation, SourceEvent } from '../../../../src/databox/bridge/BridgeTypes';
import type { AuditEvidenceRecord } from '../../../../src/databox/evidence/AuditEvidence';

/**
 * CIV-C10 — restart-survival proof. The process-local `InMemory*` authorities lose their state on
 * restart; the `Durable*` variants persist it to the pod ResourceStore so a fresh instance over the
 * SAME store rehydrates the prior state. This suite simulates a restart by constructing a second
 * instance against a shared (persistent) store after the first has written.
 */

/** A persistent ResourceStore — documents survive across the two registry instances (the restart). */
class PersistentStore {
  private readonly docs = new Map<string, { contentType: string; body: string }>();

  public async getRepresentation(id: ResourceIdentifier, _p: RepresentationPreferences): Promise<Representation> {
    const doc = this.docs.get(id.path);
    if (doc === undefined) {
      throw new NotFoundHttpError();
    }
    return new BasicRepresentation([ Buffer.from(doc.body, 'utf-8') ], doc.contentType);
  }

  public async setRepresentation(id: ResourceIdentifier, representation: Representation): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of representation.data) {
      chunks.push(Buffer.from(chunk as string));
    }
    this.docs.set(id.path, {
      contentType: representation.metadata.contentType ?? 'application/json',
      body: Buffer.concat(chunks).toString('utf8'),
    });
  }
}

const storeOf = (p: PersistentStore): ResourceStore => p as unknown as ResourceStore;
const IRI = 'http://pod/internal/durable/relationships.json';

const binding = {
  organisation: 'org-a',
  program: 'loyalty',
  origins: [ 'https://app.example.org' ],
  audiences: [ 'https://databox.example.org' ],
  serviceIdentities: [ 'svc-loyalty' ],
  storageNamespace: 'http://pod/databox/relationships/',
};

const record: RelationshipRecord = {
  relationshipId: 'rel-1',
  boxId: 'box-abc',
  boxRoot: 'http://pod/databox/relationships/box-abc/',
  pairwiseWebId: 'http://pod/holder#me',
  organisation: 'org-a',
  program: 'loyalty',
  sourceSystem: 'pos',
  status: 'active',
  provisionedAt: '2026-01-01T00:00:00.000Z',
};

const registration = {
  idempotencyKey: 'idem-1',
  record,
  customer: {
    organisation: 'org-a',
    program: 'loyalty',
    sourceSystem: 'pos',
    customerIdNamespace: 'crm',
    customerId: 'cust-1',
  },
};

const event: SourceEvent = {
  organisation: 'org-a',
  program: 'loyalty',
  sourceSystem: 'pos',
  eventType: 'sale',
  sourceEventId: 'evt-1',
  customerIdNamespace: 'crm',
  customerId: 'cust-1',
  recordClass: 'sale',
  legalBasis: 'contract',
  purpose: 'fulfilment',
  payload: { total: '42.00' },
};

/** A minimal valid bound evidence record — digests + structured facts only, never protected payload. */
function auditRecord(targetDigest: string): AuditEvidenceRecord {
  return {
    kind: 'deposit-accepted',
    decision: 'allow',
    reasonCode: 'ok',
    operation: 'deposit',
    targetDigest,
    policy: { odrlPolicy: 'urn:policy:records', policyVersion: '1.0.0', policyDigest: 'urn:sha256:policy' },
    actor: { webId: 'https://consumer.example/id#me' },
  };
}

describe('Durable authorities — restart survival (CIV-C10)', (): void => {
  it('tenant bindings survive a restart over the shared durable store.', async(): Promise<void> => {
    const store = storeOf(new PersistentStore());
    const first = new DurableTenantBindingRegistry(new DurableStateStore(store, IRI));
    await first.initialize();
    first.register(binding);
    await first.flush();

    // "Restart": a brand-new instance over the same store rehydrates the binding.
    const second = new DurableTenantBindingRegistry(new DurableStateStore(store, IRI));
    await second.initialize();
    expect(second.findByTenant('org-a', 'loyalty')).toEqual(binding);
    expect(second.findByOrigin('https://app.example.org')).toEqual(binding);
    expect(second.findByAudience('https://databox.example.org')).toEqual(binding);
  });

  it('relationship mappings survive a restart — box→relationship resolution intact.', async(): Promise<void> => {
    const store = storeOf(new PersistentStore());
    const first = new DurableRelationshipMappingRegistry(new DurableStateStore(store, IRI));
    await first.initialize();
    await first.register(registration);

    const second = new DurableRelationshipMappingRegistry(new DurableStateStore(store, IRI));
    await second.initialize();
    await expect(second.findByBoxId('box-abc')).resolves.toEqual(record);
    await expect(second.findByRelationshipId('rel-1')).resolves.toEqual(record);
    // The control-plane customer binding survived too.
    await expect(second.resolveCustomer('rel-1')).resolves.toMatchObject({ customerId: 'cust-1' });
  });

  it('the source outbox survives a restart — committed rows + reconciliations persist.', async(): Promise<void> => {
    const store = storeOf(new PersistentStore());
    const first = new DurableSourceOutbox(new DurableStateStore(store, IRI));
    await first.initialize();
    const committed = first.commit(event);
    const recon: BridgeReconciliation = {
      sourceEventId: 'evt-1',
      status: 'unresolved',
      at: '2026-01-01T00:00:00.000Z',
    };
    first.markReconciled('evt-1', recon);
    await first.flush();

    const second = new DurableSourceOutbox(new DurableStateStore(store, IRI));
    await second.initialize();
    const pending = second.drain({ organisation: 'org-a', program: 'loyalty' });
    expect(pending.map(r => r.businessRecordId)).toEqual([ committed.businessRecordId ]);
    expect(second.reconciliation('evt-1')).toEqual(recon);
    // Idempotent: a re-commit of the same tuple on the new instance returns the original row.
    expect(second.commit(event).businessRecordId).toBe(committed.businessRecordId);
  });

  it('the WORM evidence ledger survives a restart — the hash chain stays intact.', async(): Promise<void> => {
    const store = storeOf(new PersistentStore());
    const iri = 'http://pod/internal/durable/evidence.json';
    const first = new DurableEvidenceLedger(new DurableStateStore(store, iri));
    await first.initialize();
    const e1 = await first.append({ tenantId: 'org-a', record: auditRecord('urn:sha256:r1') });
    const e2 = await first.append({ tenantId: 'org-a', record: auditRecord('urn:sha256:r2') });

    // "Restart": a fresh ledger over the same store restores the exact hash-chained entries.
    const second = new DurableEvidenceLedger(new DurableStateStore(store, iri));
    await second.initialize();
    expect(second.entries('org-a').map(e => e.entryDigest)).toEqual([ e1.entryDigest, e2.entryDigest ]);
    expect(second.verify('org-a').valid).toBe(true);
  });

  it('a tampered persisted ledger is rejected on initialize (integrity re-verified).', async(): Promise<void> => {
    const store = new PersistentStore();
    const iri = 'http://pod/internal/durable/evidence.json';
    const first = new DurableEvidenceLedger(new DurableStateStore(storeOf(store), iri));
    await first.initialize();
    await first.append({ tenantId: 'org-a', record: auditRecord('urn:sha256:r1') });
    // Corrupt the persisted document — drop a chain entry so the hash link breaks.
    await store.setRepresentation(
      { path: iri },
      new BasicRepresentation(
        [ Buffer.from(JSON.stringify({ chains: { 'org-a': [{ sequence: 5 }]}}), 'utf-8') ],
        'application/json',
      ),
    );
    const second = new DurableEvidenceLedger(new DurableStateStore(storeOf(store), iri));
    await expect(second.initialize()).rejects.toThrow('integrity');
  });

  it('a registry used before initialize() fails closed (no half-loaded authority).', (): void => {
    const store = storeOf(new PersistentStore());
    const registry = new DurableTenantBindingRegistry(new DurableStateStore(store, IRI));
    expect((): void => registry.register(binding)).toThrow('initialized');
  });
});
