import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';

/**
 * The gated milestone spine (CIV-B24, `cooperative-projects.html`): a cooperative project's lifecycle
 * is a 3-stage spine — **inception/exploration → build → release** — where advancing a stage is a
 * gated act, not a free edit. Each gate requires the declared quorum of steward approvals plus any
 * declared evidence (e.g. a funded-exploration check, a release-readiness check). The spine is the
 * deterministic ordering — a project cannot skip a stage, and a gate that lacks its approvals stays
 * closed (fail closed).
 *
 * Fair-value scales ride along: each stage declares the valuation rules that apply to work done in
 * it (per-kind rate per unit) — so the contribution ledger's settlement weights follow the stage the
 * work belonged to, not a single flat rate.
 */

export type MilestoneStage = 'inception' | 'build' | 'release';
const STAGE_ORDER: readonly MilestoneStage[] = [ 'inception', 'build', 'release' ];

export interface StageGate {
  readonly stage: MilestoneStage;
  /** The steward WebIDs whose approval advances the stage (≥ quorum of them must approve). */
  readonly stewards: readonly string[];
  /** How many steward approvals the gate needs (default: all listed stewards). */
  readonly quorum?: number;
  /** Declared evidence labels the gate expects (e.g. `charter-approved`, `safety-check`). */
  readonly requiredEvidence?: readonly string[];
  /** The fair-value scale for work done IN this stage (per-kind rate per unit). */
  readonly fairValueScale: Readonly<Record<string, number>>;
}

export interface MilestoneSpine {
  readonly projectId: string;
  readonly currentStage: MilestoneStage;
  readonly currentStageIndex: number;
  readonly released: boolean;
}

interface GateState {
  readonly gate: StageGate;
  readonly approvals: Set<string>;
  readonly evidence: Set<string>;
}

export class MilestoneSpineTracker {
  private readonly projectId: string;
  private readonly gates: GateState[];
  private stageIndex = 0;

  public constructor(projectId: string, gates: StageGate[]) {
    if (projectId.trim().length === 0 || gates.length === 0) {
      throw new BadRequestHttpError('A milestone spine needs a projectId and at least one stage gate.');
    }
    // The gates must be declared in the canonical stage order — the spine is a strict sequence.
    for (const [ index, gate ] of gates.entries()) {
      if (gate.stage !== STAGE_ORDER[Math.min(index, STAGE_ORDER.length - 1)]) {
        throw new BadRequestHttpError(`Stage gate ${index} must be '${STAGE_ORDER[index] ?? 'release'}'.`);
      }
    }
    this.projectId = projectId;
    this.gates = gates.map((gate): GateState => ({ gate, approvals: new Set(), evidence: new Set() }));
    if (this.gates.length > STAGE_ORDER.length) {
      throw new BadRequestHttpError(`A milestone spine has at most ${STAGE_ORDER.length} stages.`);
    }
  }

  /** A steward approves the CURRENT stage's gate. Only a declared steward's approval counts. */
  public approve(steward: string): void {
    const gate = this.currentGate();
    if (!gate.gate.stewards.includes(steward)) {
      throw new BadRequestHttpError(`'${steward}' is not a steward of the '${this.stage()}' stage gate.`);
    }
    gate.approvals.add(steward);
  }

  /** Attach declared evidence to the current stage's gate (e.g. a signed readiness check). */
  public addEvidence(label: string): void {
    const gate = this.currentGate();
    if (gate.gate.requiredEvidence !== undefined && !gate.gate.requiredEvidence.includes(label)) {
      throw new BadRequestHttpError(`'${label}' is not declared evidence for the '${this.stage()}' gate.`);
    }
    gate.evidence.add(label);
  }

  /**
   * Advance to the next stage — only when the current gate is satisfied (quorum of stewards + all
   * declared evidence). A gate that isn't met refuses to advance (fail closed — no skipping a stage).
   */
  public advance(): MilestoneStage {
    const gate = this.currentGate();
    const quorum = gate.gate.quorum ?? gate.gate.stewards.length;
    if (gate.approvals.size < quorum) {
      throw new BadRequestHttpError(
        `Stage '${this.stage()}' needs ${quorum} steward approvals; has ${gate.approvals.size} (fail closed).`,
      );
    }
    for (const required of gate.gate.requiredEvidence ?? []) {
      if (!gate.evidence.has(required)) {
        throw new BadRequestHttpError(`Stage '${this.stage()}' is missing required evidence '${required}'.`);
      }
    }
    this.stageIndex = Math.min(this.stageIndex + 1, STAGE_ORDER.length - 1);
    return this.stage();
  }

  /** The fair-value scale for the CURRENT stage (the rate set the contribution settlement uses). */
  public fairValueScale(): Readonly<Record<string, number>> {
    return this.currentGate().gate.fairValueScale;
  }

  public state(): MilestoneSpine {
    return {
      projectId: this.projectId,
      currentStage: this.stage(),
      currentStageIndex: this.stageIndex,
      released: this.stageIndex === STAGE_ORDER.length - 1 && this.currentGateSatisfied(),
    };
  }

  private stage(): MilestoneStage {
    return STAGE_ORDER[this.stageIndex];
  }

  private currentGate(): GateState {
    const gate = this.gates[this.stageIndex];
    if (gate === undefined) {
      throw new InternalServerError(`No gate declared for stage '${this.stage()}'.`);
    }
    return gate;
  }

  private currentGateSatisfied(): boolean {
    const gate = this.currentGate();
    const quorum = gate.gate.quorum ?? gate.gate.stewards.length;
    return gate.approvals.size >= quorum &&
      (gate.gate.requiredEvidence ?? []).every(label => gate.evidence.has(label));
  }
}
