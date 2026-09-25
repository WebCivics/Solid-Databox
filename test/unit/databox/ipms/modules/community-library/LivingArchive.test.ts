import { LivingArchive } from '../../../../../../src/databox/ipms/modules/community-library/LivingArchive';

function archive(): LivingArchive {
  const a = new LivingArchive();
  a.register('community://lib/history', 'site-a', 'digest-v1', [ 'site-b', 'site-c' ]);
  return a;
}

describe('LivingArchive — a collection outlives any single host (CIV-B44)', (): void => {
  it('registers a canonical + replica set; a single copy is refused.', (): void => {
    const a = archive();
    expect(a.collection('community://lib/history').replicas).toHaveLength(2);
    expect((): unknown => new LivingArchive().register('x', 's', 'd', []))
      .toThrow('single copy is not an archive');
  });

  it('localise moves the canonical to a replica — the archive survives the host going away.', (): void => {
    const a = archive();
    const after = a.localise('community://lib/history', 'site-b', 'digest-v1');
    expect(after.canonicalSite).toBe('site-b'); // Site-b promoted.
    expect(after.replicas).toContain('site-a'); // Old canonical still holds a copy.
    expect(after.replicas).toContain('site-c');
  });

  it('a replica must digest-match before it can take canonical — never promote an out-of-sync copy.', (): void => {
    const a = archive();
    expect((): unknown => a.localise('community://lib/history', 'site-b', 'digest-WRONG'))
      .toThrow('does not match');
    // A non-replica can never take canonical.
    expect((): unknown => a.localise('community://lib/history', 'site-x', 'digest-v1'))
      .toThrow('only an existing replica');
  });

  it('replica-in-sync checks the replica\u2019s digest against the canonical.', (): void => {
    const a = archive();
    expect(a.replicaCurrent('community://lib/history', 'site-b', 'digest-v1')).toBe(true);
    expect(a.replicaCurrent('community://lib/history', 'site-b', 'digest-stale')).toBe(false);
  });
});
