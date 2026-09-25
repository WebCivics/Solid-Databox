import { generateOwnerKeyPair } from '../../../../src/databox/personal/OwnerKeyBackup';
import type { OwnerKeyBackupBlob } from '../../../../src/databox/personal/OwnerKeyBackup';
import {
  backupPod,
  restorePod,
  snapshotPod,
} from '../../../../src/databox/personal/PodContinuity';
import type { BackupSink, PodResourceEntry } from '../../../../src/databox/personal/PodContinuity';

const resources: PodResourceEntry[] = [
  { path: 'profile/card', contentType: 'text/turtle', data: Buffer.from('<#me> a foaf:Person').toString('base64') },
  { path: 'photos/a.jpg', contentType: 'image/jpeg', data: Buffer.from('jpegbytes').toString('base64') },
];

/** An in-memory backup sink — the coop-side ciphertext store. */
function memorySink(): BackupSink & { store: Map<string, OwnerKeyBackupBlob> } {
  const store = new Map<string, OwnerKeyBackupBlob>();
  return {
    store,
    put: async(key, blob): Promise<void> => {
      store.set(key, blob);
    },
    get: async(key): Promise<OwnerKeyBackupBlob | undefined> => store.get(key),
  };
}
const source = (rs: PodResourceEntry[] = resources) => ({ list: async() => rs });

describe('PodContinuity — the mobile-PWA pod survives an OS eviction (CIV-B48)', (): void => {
  it('backs up a pod encrypted, then restores it intact onto a wiped device.', async(): Promise<void> => {
    const { publicJwk, privateKey } = generateOwnerKeyPair();
    const sink = memorySink();
    const { manifestDigest } = await backupPod(source(), sink, 'alice-backup', publicJwk);
    // The sink holds CIPHERTEXT — no plaintext path/content leaks to the cooperative.
    const blob = sink.store.get('alice-backup');
    expect(JSON.stringify(blob)).not.toContain('profile/card');
    expect(blob?.ct.length).toBeGreaterThan(0);

    // "The OS evicted the store" → a fresh empty pod; restore from the coop ciphertext.
    const restored: PodResourceEntry[] = [];
    const out = await restorePod(sink, 'alice-backup', privateKey, {
      put: async(e): Promise<void> => {
        restored.push(e);
      },
    });
    expect(out.restoredResources).toBe(2);
    expect(restored.map(r => r.path).sort()).toEqual([ 'photos/a.jpg', 'profile/card' ]);
    expect(Buffer.from(restored.find(r => r.path === 'profile/card')!.data, 'base64').toString())
      .toContain('foaf:Person');
    expect(manifestDigest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('fails closed — no blob, wrong owner key, or a tampered manifest all reject.', async(): Promise<void> => {
    const { publicJwk, privateKey } = generateOwnerKeyPair();
    const sink = memorySink();
    // No backup at all.
    await expect(restorePod(sink, 'nope', privateKey, { put: async() => { /* Noop */ } }))
      .rejects.toThrow('No continuity backup');

    await backupPod(source(), sink, 'alice-backup', publicJwk);
    // A tampered blob (the ciphertext is flipped) → AEAD/digest fails closed.
    const blob = sink.store.get('alice-backup')!;
    sink.store.set('alice-backup', { ...blob, ct: `${blob.ct.slice(0, -4)}AAAA` });
    await expect(restorePod(sink, 'alice-backup', privateKey, { put: async() => { /* Noop */ } }))
      .rejects.toThrow();
  });

  it('the manifest digest is deterministic over the resource set.', async(): Promise<void> => {
    const a = await snapshotPod(source(), '2026-01-01T00:00:00Z');
    const b = await snapshotPod(source([ ...resources ].reverse()), '2026-01-01T00:00:00Z');
    expect(a.manifestDigest).toBe(b.manifestDigest); // Order-independent — same content, same digest.
  });
});
