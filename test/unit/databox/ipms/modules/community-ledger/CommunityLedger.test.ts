import { ContributionLedger } from '../../../../../../src/databox/ipms/modules/community-ledger/ContributionLedger';
import { settle } from '../../../../../../src/databox/ipms/modules/community-ledger/PaybackWaterfall';
import { DurableStateStore } from '../../../../../../src/databox/durable/DurableStateStore';
import { BasicRepresentation } from '../../../../../../src/http/representation/BasicRepresentation';
import type { Representation } from '../../../../../../src/http/representation/Representation';
import type { ResourceIdentifier } from '../../../../../../src/http/representation/ResourceIdentifier';
import type { RepresentationPreferences } from '../../../../../../src/http/representation/RepresentationPreferences';
import type { ResourceStore } from '../../../../../../src/storage/ResourceStore';
import { NotFoundHttpError } from '../../../../../../src/util/errors/NotFoundHttpError';

/** A persistent ResourceStore — the shared doc survives across ledger instances (the "restart"). */
class Store {
  private readonly docs = new Map<string, string>();
  public async setRepresentation(id: ResourceIdentifier, rep: Representation): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const c of rep.data) {
      chunks.push(Buffer.from(c as string));
    }
    this.docs.set(id.path, Buffer.concat(chunks).toString('utf8'));
  }

  public async getRepresentation(id: ResourceIdentifier, _p: RepresentationPreferences): Promise<Representation> {
    const doc = this.docs.get(id.path);
    if (doc === undefined) {
      throw new NotFoundHttpError();
    }
    return new BasicRepresentation([ Buffer.from(doc, 'utf-8') ], 'application/json');
  }
}
const asStore = (s: Store): ResourceStore => s as unknown as ResourceStore;

function contribution(id: string, contributor = 'https://pod/alice#me') {
  return {
    contributionId: id,
    projectId: 'proj-coop',
    contributorId: contributor,
    kind: 'time' as const,
    quantity: { value: 10, unit: 'hours' },
    description: 'built the raised beds',
  };
}

describe('ContributionLedger + PaybackWaterfall — community "counting what counts" (CIV-B2)', (): void => {
  it('logs, recognises and folds contribution state — append-only, ordered.', async(): Promise<void> => {
    const ledger = new ContributionLedger();
    const e1 = await ledger.log(contribution('c1'));
    const e2 = await ledger.recognise('proj-coop', 'c1', 'https://pod/coop#admin');
    expect(e1.sequence).toBe(0);
    expect(e2.sequence).toBe(1);
    expect(e2.prevDigest).toBe(e1.entryDigest); // Hash-chained.
    const state = ledger.contributions('proj-coop');
    expect(state[0].recognised).toBe(true);
    expect(ledger.verify('proj-coop').valid).toBe(true);
  });

  it('a re-log of the same contribution is idempotent — no second entry.', async(): Promise<void> => {
    const ledger = new ContributionLedger();
    await ledger.log(contribution('c1'));
    await ledger.log(contribution('c1'));
    expect(ledger.events('proj-coop')).toHaveLength(1); // T-24: never mint a second.
  });

  it('recognise/withdraw on an unknown or withdrawn contribution fails closed.', async(): Promise<void> => {
    const ledger = new ContributionLedger();
    await expect(ledger.recognise('proj-coop', 'nope', 'x')).rejects.toThrow('No logged');
    await ledger.log(contribution('c1'));
    await ledger.withdraw('proj-coop', 'c1', 'https://pod/alice#me');
    await expect(ledger.recognise('proj-coop', 'c1', 'x')).rejects.toThrow('withdrawn');
    expect(ledger.verify('proj-coop').valid).toBe(true);
  });

  it('a tampered entry fails verification — the digest binds the content.', async(): Promise<void> => {
    const ledger = new ContributionLedger();
    await ledger.log(contribution('c1'));
    await ledger.log(contribution('c2'));
    expect(ledger.verify('proj-coop').valid).toBe(true);

    // Smithy the first entry's recorded contributionId WITHOUT recomputing the chain.
    interface Mutable { chains: Map<string, { contributionId: string }[]> }
    const internals = ledger as unknown as Mutable;
    const chain = internals.chains.get('proj-coop')!;
    chain[0] = { ...chain[0], contributionId: 'forged' };
    expect(ledger.verify('proj-coop').valid).toBe(false); // T-27: the edit broke the hash link.
  });

  it('settles revenue across recognised contributors, honouring charitable routing.', async(): Promise<void> => {
    const ledger = new ContributionLedger();
    await ledger.log(contribution('c1', 'https://pod/alice#me')); // 10 h
    await ledger.log({ ...contribution('c2', 'https://pod/bob#me'), quantity: { value: 20, unit: 'hours' }});
    await ledger.log({ ...contribution('c3', 'https://pod/carol#me'), kind: 'funds', quantity: { value: 100, unit: 'AUD' }});
    await ledger.recognise('proj-coop', 'c1', 'admin');
    await ledger.recognise('proj-coop', 'c2', 'admin');
    // Carol's funds are logged but NOT recognised — they earn nothing.
    const result = settle(600, ledger.contributions('proj-coop'), {
      ratePerUnit: { time: 30, funds: 1 },
      routeTo: { 'https://pod/bob#me': 'charity:foodbank' },
    });
    // Alice: 10h×30=300; bob: 20h×30=600; total 900 → alice 200, bob 400 (routed to foodbank).
    const alice = result.payouts.find(p => p.contributorId === 'https://pod/alice#me');
    const bob = result.payouts.find(p => p.contributorId === 'https://pod/bob#me');
    expect(alice?.amount).toBe(200);
    expect(bob?.amount).toBe(400);
    expect(bob?.beneficiaryId).toBe('charity:foodbank'); // Recognition alice's/bob's, dollars to charity.
    expect(result.payouts).toHaveLength(2); // Carol's unrecognised funds excluded.
  });

  it('a durable ledger survives a restart — the contribution chain persists + verifies.', async(): Promise<void> => {
    const store = asStore(new Store());
    const iri = 'https://pod.example/internal/community-ledger.json';
    const first = new ContributionLedger(undefined, new DurableStateStore(store, iri));
    await first.initialize();
    await first.log(contribution('c1'));
    await first.recognise('proj-coop', 'c1', 'admin');

    // "Restart": a fresh ledger over the same store restores the chain intact.
    const second = new ContributionLedger(undefined, new DurableStateStore(store, iri));
    await second.initialize();
    expect(second.contributions('proj-coop')[0].recognised).toBe(true);
    expect(second.verify('proj-coop').valid).toBe(true);
    expect(second.events('proj-coop')).toHaveLength(2);
  });
});
