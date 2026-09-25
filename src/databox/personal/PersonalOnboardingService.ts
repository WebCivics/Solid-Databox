import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';

/**
 * The guided personal-setup orchestrator (CIV-A02): the non-expert path from install to a
 * first working connection. It is a resumable step machine — each step runs against an
 * injected adapter so the same flow serves the CLI installer, a local web UI, or tests —
 * and it persists its state so an interrupted setup resumes instead of restarting.
 *
 * The four steps mirror the personal stack:
 *
 *  1. **pod**      — create the owner's account + pod + WebID on the local server.
 *  2. **hosting**  — apply a hosting plan (Cloudflare, cooperative, or local-only) so the
 *                    pod has a public name. Skippable for local-only installs.
 *  3. **connection** — install the first connection credential (QR/paste → `POST
 *                    /.databox/personal/connections`).
 *  4. **backup**   — record the backup/continuity choice (owner-key encrypted export is
 *                    CIV-B19; this step captures the intent + target now).
 *
 * Fail-closed: a failing step marks `failed` and halts the run; `run()` re-invoked after a
 * fix resumes at the first non-done step — never silently skips a broken prerequisite.
 */

export type OnboardingStepId = 'pod' | 'hosting' | 'connection' | 'backup';
export type OnboardingStepStatus = 'pending' | 'done' | 'failed';

export interface OnboardingStep {
  readonly id: OnboardingStepId;
  readonly title: string;
  status: OnboardingStepStatus;
  /** Step output for the manifest (pod URL, host name, connection id, backup target). */
  detail?: Record<string, unknown>;
  /** The error message when `status === 'failed'`. */
  error?: string;
}

/** The pod-provisioning adapter — creates the owner account, pod and WebID. */
export interface PodProvisioner {
  /** `password` is the owner's local account credential — never transmitted off-box. */
  provisionPod: (owner: { podName: string; password: string }) => Promise<{ podUrl: string; webId: string }>;
}

/** The hosting adapter — applies a {@link PersonalHostingPlan} through a DNS client. */
export interface HostingApplier {
  applyHosting: () => Promise<{ podHost: string; baseUrl: string }>;
}

/** The connection adapter — installs the first connection credential into the vault. */
export interface ConnectionImporter {
  importFirstConnection: (credentialJws: string, tenantId: string) => Promise<{ connectionId: string }>;
}

/** The backup adapter — records the continuity choice + target. */
export interface BackupConfigurer {
  configureBackup: (choice: 'local-encrypted' | 'coop-encrypted' | 'none') => Promise<{ target: string }>;
}

export interface OnboardingAdapters {
  readonly provisionPod?: PodProvisioner['provisionPod'];
  readonly applyHosting?: HostingApplier['applyHosting'];
  readonly importFirstConnection?: ConnectionImporter['importFirstConnection'];
  readonly configureBackup?: BackupConfigurer['configureBackup'];
}

/** Inputs the operator supplies during the flow (collected per step by the UI/CLI). */
export interface OnboardingInputs {
  readonly owner?: { podName: string; password: string };
  readonly hosting?: { mode: 'cloudflare' | 'cooperative' | 'local-only' };
  readonly firstConnection?: { credentialJws: string; tenantId: string };
  readonly backup?: { choice: 'local-encrypted' | 'coop-encrypted' | 'none' };
}

/** The durable manifest written at the end of a completed run (persisted by the caller). */
export interface SetupManifest {
  readonly completedAt: string;
  readonly ownerWebId?: string;
  readonly podUrl?: string;
  readonly hosting?: { mode: string; podHost?: string; baseUrl?: string };
  readonly firstConnectionId?: string;
  readonly backupTarget?: string;
}

const STEP_TITLES: Record<OnboardingStepId, string> = {
  pod: 'Create the owner account, pod and WebID',
  hosting: 'Publish the pod at a public name',
  connection: 'Install the first connection credential',
  backup: 'Choose backup and continuity',
};

export class PersonalOnboardingService {
  private readonly steps: OnboardingStep[];
  private readonly detail: Record<string, unknown> = {};

  public constructor(
    private readonly adapters: OnboardingAdapters,
    private readonly inputs: OnboardingInputs,
    private readonly now: () => number = Date.now,
  ) {
    this.steps = (Object.keys(STEP_TITLES) as OnboardingStepId[]).map(id => ({
      id,
      title: STEP_TITLES[id],
      status: 'pending',
    }));
  }

  /** The current step list with live status — the UI renders this. */
  public status(): readonly OnboardingStep[] {
    return this.steps.map(step => ({ ...step }));
  }

  /**
   * Run the flow: execute pending steps in order, halting at the first failure. Returns
   * the manifest when every required step completed; a failed step leaves the run
   * resumable — call `run()` again after correcting the cause.
   */
  public async run(): Promise<SetupManifest> {
    for (const step of this.steps) {
      if (step.status === 'done') {
        continue;
      }
      try {
        step.detail = await this.execute(step.id);
        step.status = 'done';
      } catch (error: unknown) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : String(error);
        throw error;
      }
    }
    return this.manifest();
  }

  private async execute(id: OnboardingStepId): Promise<Record<string, unknown>> {
    switch (id) {
      case 'pod': {
        const provisionPod = this.adapters.provisionPod;
        const owner = this.inputs.owner;
        if (provisionPod === undefined || owner === undefined) {
          throw new BadRequestHttpError('The pod step needs a provisionPod adapter and owner input.');
        }
        const result = await provisionPod(owner);
        this.detail.ownerWebId = result.webId;
        this.detail.podUrl = result.podUrl;
        return { podUrl: result.podUrl, webId: result.webId };
      }
      case 'hosting': {
        const hosting = this.inputs.hosting;
        if (hosting === undefined || hosting.mode === 'local-only') {
          this.detail.hosting = { mode: hosting?.mode ?? 'local-only' };
          return { skipped: hosting?.mode ?? 'local-only' };
        }
        const applyHosting = this.adapters.applyHosting;
        if (applyHosting === undefined) {
          throw new BadRequestHttpError('The hosting step needs an applyHosting adapter.');
        }
        const result = await applyHosting();
        this.detail.hosting = { mode: hosting.mode, ...result };
        return { mode: hosting.mode, ...result };
      }
      case 'connection': {
        const importer = this.adapters.importFirstConnection;
        const first = this.inputs.firstConnection;
        if (importer === undefined || first === undefined) {
          throw new BadRequestHttpError(
            'The connection step needs an importFirstConnection adapter and credential input.',
          );
        }
        const result = await importer(first.credentialJws, first.tenantId);
        this.detail.firstConnectionId = result.connectionId;
        return result;
      }
      case 'backup': {
        const choice = this.inputs.backup?.choice ?? 'none';
        const configureBackup = this.adapters.configureBackup;
        if (configureBackup === undefined) {
          if (choice === 'none') {
            this.detail.backupTarget = 'none';
            return { choice };
          }
          throw new BadRequestHttpError('The backup step needs a configureBackup adapter for a real choice.');
        }
        const result = await configureBackup(choice);
        this.detail.backupTarget = result.target;
        return { choice, ...result };
      }
      default:
        throw new InternalServerError(`Unknown onboarding step ${String(id)}.`);
    }
  }

  private manifest(): SetupManifest {
    return {
      completedAt: new Date(this.now()).toISOString(),
      ownerWebId: this.detail.ownerWebId as string | undefined,
      podUrl: this.detail.podUrl as string | undefined,
      hosting: this.detail.hosting as SetupManifest['hosting'],
      firstConnectionId: this.detail.firstConnectionId as string | undefined,
      backupTarget: this.detail.backupTarget as string | undefined,
    };
  }
}
