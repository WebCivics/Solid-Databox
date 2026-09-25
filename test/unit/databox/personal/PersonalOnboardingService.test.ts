import { PersonalOnboardingService } from '../../../../src/databox/personal/PersonalOnboardingService';
import type { OnboardingAdapters } from '../../../../src/databox/personal/PersonalOnboardingService';

const OWNER = { podName: 'person', password: 'hunter2-secret' };
const OWNER_WEBID = 'http://localhost:3100/person/profile/card#me';

/** A mutable view of the adapters so a test can swap/delete a step's adapter mid-flight. */
type MutableAdapters = {-readonly [K in keyof OnboardingAdapters]: OnboardingAdapters[K] };

function fullAdapters(spy: Record<string, jest.Mock>): MutableAdapters {
  return {
    provisionPod: spy.provisionPod.mockResolvedValue({
      podUrl: 'http://localhost:3100/person/',
      webId: OWNER_WEBID,
    }),
    applyHosting: spy.applyHosting.mockResolvedValue({
      podHost: 'pod.example.org',
      baseUrl: 'https://pod.example.org/',
    }),
    importFirstConnection: spy.importFirstConnection.mockResolvedValue({ connectionId: 'conn-1' }),
    configureBackup: spy.configureBackup.mockResolvedValue({ target: 'coop:backups/me' }),
  };
}

function spies(): Record<string, jest.Mock> {
  return {
    provisionPod: jest.fn(),
    applyHosting: jest.fn(),
    importFirstConnection: jest.fn(),
    configureBackup: jest.fn(),
  };
}

describe('PersonalOnboardingService', (): void => {
  it('runs the full guided flow and emits the setup manifest.', async(): Promise<void> => {
    const spy = spies();
    const service = new PersonalOnboardingService(fullAdapters(spy), {
      owner: OWNER,
      hosting: { mode: 'cooperative' },
      firstConnection: { credentialJws: 'jws', tenantId: 't1' },
      backup: { choice: 'coop-encrypted' },
    }, (): number => 5_000_000);

    const manifest = await service.run();
    expect(manifest.ownerWebId).toBe(OWNER_WEBID);
    expect(manifest.podUrl).toBe('http://localhost:3100/person/');
    expect(manifest.hosting).toMatchObject({ mode: 'cooperative', podHost: 'pod.example.org' });
    expect(manifest.firstConnectionId).toBe('conn-1');
    expect(manifest.backupTarget).toBe('coop:backups/me');
    expect(service.status().every(step => step.status === 'done')).toBe(true);
    expect(spy.provisionPod).toHaveBeenCalledWith(OWNER);
  });

  it('skips hosting for a local-only install.', async(): Promise<void> => {
    const spy = spies();
    const service = new PersonalOnboardingService(fullAdapters(spy), {
      owner: OWNER,
      hosting: { mode: 'local-only' },
      firstConnection: { credentialJws: 'jws', tenantId: 't1' },
      backup: { choice: 'none' },
    });
    const manifest = await service.run();
    expect(spy.applyHosting).not.toHaveBeenCalled();
    expect(manifest.hosting?.mode).toBe('local-only');
  });

  it('halts fail-closed on a failing step and resumes at it after the cause is fixed.', async(): Promise<void> => {
    const spy = spies();
    const failing = fullAdapters(spy);
    failing.provisionPod = spy.provisionPod.mockRejectedValue(new Error('pod create failed'));

    const service = new PersonalOnboardingService(failing, {
      owner: OWNER,
      hosting: { mode: 'local-only' },
      firstConnection: { credentialJws: 'jws', tenantId: 't1' },
      backup: { choice: 'none' },
    });

    await expect(service.run()).rejects.toThrow('pod create failed');
    expect(service.status().find(step => step.id === 'pod')?.status).toBe('failed');
    expect(service.status().find(step => step.id === 'hosting')?.status).toBe('pending');

    // Fix the cause and re-run — the failed step re-runs, done steps are skipped.
    failing.provisionPod = spy.provisionPod.mockResolvedValue({
      podUrl: 'http://localhost:3100/person/',
      webId: OWNER_WEBID,
    });
    await expect(service.run()).resolves.toMatchObject({ ownerWebId: OWNER_WEBID });
    expect(service.status().every(step => step.status === 'done')).toBe(true);
  });

  it('fails closed when a required adapter or input is missing.', async(): Promise<void> => {
    const service = new PersonalOnboardingService({}, {});
    await expect(service.run()).rejects.toThrow('provisionPod adapter');
  });

  it('accepts an explicit no-backup choice without a backup adapter.', async(): Promise<void> => {
    const spy = spies();
    const adapters = fullAdapters(spy);
    delete adapters.configureBackup;
    const service = new PersonalOnboardingService(adapters, {
      owner: OWNER,
      hosting: { mode: 'local-only' },
      firstConnection: { credentialJws: 'jws', tenantId: 't1' },
      backup: { choice: 'none' },
    });
    const manifest = await service.run();
    expect(manifest.backupTarget).toBe('none');
  });
});
