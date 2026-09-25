import { ContributionLedger } from '../../../../../../src/databox/ipms/modules/community-ledger/ContributionLedger';
import { anonymisedCommunityStats } from '../../../../../../src/databox/ipms/modules/community-ledger/CommunityStats';
import { MilestoneSpineTracker } from '../../../../../../src/databox/ipms/modules/community-ledger/MilestoneSpine';
import type { StageGate } from '../../../../../../src/databox/ipms/modules/community-ledger/MilestoneSpine';

async function recognised(
  ledger: ContributionLedger,
  id: string,
  contributor: string,
  kind = 'time',
  value = 10,
  unit = 'hours',
): Promise<void> {
  await ledger.log({
    contributionId: id,
    projectId: 'proj-coop',
    contributorId: contributor,
    kind: kind as never,
    quantity: { value, unit },
    description: 'work',
  });
  await ledger.recognise('proj-coop', id, 'admin');
}

function gates(): StageGate[] {
  return [
    {
      stage: 'inception',
      stewards: [ 'a', 'b' ],
      quorum: 2,
      requiredEvidence: [ 'charter' ],
      fairValueScale: { time: 25 },
    },
    { stage: 'build', stewards: [ 'a' ], quorum: 1, fairValueScale: { time: 30 }},
    {
      stage: 'release',
      stewards: [ 'a', 'b' ],
      quorum: 2,
      requiredEvidence: [ 'safety' ],
      fairValueScale: { time: 35 },
    },
  ];
}

describe('CommunityStats + MilestoneSpine — cooperative economics (CIV-B23/B24)', (): void => {
  it('aggregates k-anonymously — a too-small group cell is suppressed.', async(): Promise<void> => {
    const ledger = new ContributionLedger();
    await recognised(ledger, 't1', 'alice', 'time', 10);
    await recognised(ledger, 't2', 'bob', 'time', 10);
    await recognised(ledger, 't3', 'carol', 'time', 10);
    await recognised(ledger, 'f1', 'dave', 'funds', 100, 'AUD'); // A 1-person funds group — suppressed.
    const stats = anonymisedCommunityStats('proj-coop', ledger.contributions('proj-coop'));
    const time = stats.find(s => s.kind === 'time');
    expect(time?.contributorCount).toBe(3);
    expect(time?.totalQuantity).toBe(30);
    expect(stats.find(s => s.kind === 'funds')).toBeUndefined(); // <k suppressed, not re-identifying.
    // And NO contributor identity leaks into any stat.
    expect(JSON.stringify(stats)).not.toContain('alice');
  });

  it('advances the milestone spine only when a gate is satisfied — fail closed otherwise.', (): void => {
    const spine = new MilestoneSpineTracker('proj-coop', gates());
    expect(spine.state().currentStage).toBe('inception');
    // Missing quorum + evidence → the gate stays shut.
    expect((): unknown => spine.advance()).toThrow('fail closed');
    spine.approve('a');
    spine.approve('b');
    spine.addEvidence('charter');
    expect(spine.advance()).toBe('build');
    spine.approve('a');
    expect(spine.advance()).toBe('release');
  });

  it('a non-steward cannot approve a stage, and stages cannot be skipped.', (): void => {
    const spine = new MilestoneSpineTracker('proj-coop', gates());
    expect((): void => spine.approve('mallory')).toThrow('not a steward');
    spine.approve('a');
    spine.approve('b');
    spine.addEvidence('charter');
    spine.advance();
    // Still at build — 'release' can't be reached without its own gate.
    expect(spine.state().currentStage).toBe('build');
    expect(spine.fairValueScale()).toEqual({ time: 30 }); // The build-stage rate.
  });

  it('rejects a gate set out of canonical stage order.', (): void => {
    expect((): MilestoneSpineTracker => new MilestoneSpineTracker('p', [ gates()[1] ]))
      .toThrow('\'inception\'');
  });
});
