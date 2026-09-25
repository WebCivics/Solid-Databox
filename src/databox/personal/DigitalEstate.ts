import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import { canonicalDigest } from '../proof/Canonicalization';

/**
 * Digital estate / standing instructions (CIV-B49, `data-safe.html`): a member's declaration of what
 * passes to whom when they die or lose capacity — "standing instructions" the cooperative honours.
 *
 * The design mirrors a will: a grantor declares, per resource-class, a beneficiary (pairwise WebID);
 * the instruction only *fires* when a triggering event (death / incapacity) is attested by the
 * declared quorum of attestors — a single claim never executes an estate transfer. Each instruction
 * is content-digest-bound (tamper-evident), and a superseding instruction replaces the whole set
 * (there is no partial edit — a new instruction is a new directive). A revoked instruction never
 * fires. Fail closed throughout: an unattested event activates nothing.
 *
 * Privacy: beneficiaries + attestors are pairwise WebIDs; the directive stores no raw identity.
 */

export type EstateTrigger = 'death' | 'incapacity';

export interface EstateBequest {
  /** The resource-class or pod sub-tree the bequest covers (e.g. `records/`, `photos/`). */
  readonly resourceClass: string;
  /** The beneficiary pairwise WebID who receives it. */
  readonly beneficiary: string;
  /** Whether custody transfers (custodial handoff) or read-access is granted. */
  readonly mode: 'custody' | 'access';
}

export interface StandingInstruction {
  /** The grantor's pairwise WebID. */
  readonly grantor: string;
  /** The trigger the instruction fires on. */
  readonly trigger: EstateTrigger;
  /** Who must attest the trigger — ≥ quorum of these attestors must confirm. */
  readonly attestors: readonly string[];
  /** How many attestations the trigger needs (default: all listed attestors). */
  readonly quorum?: number;
  /** The bequests that take effect when the trigger is attested. */
  readonly bequests: readonly EstateBequest[];
  /** ISO-8601 time the instruction was declared. */
  readonly declaredAt: string;
  /** Content digest binding the instruction (tamper-evident, supersession-linked). */
  readonly instructionDigest: string;
}

export interface EstateOutcome {
  /** The instruction that fired. */
  readonly instruction: StandingInstruction;
  /** The bequests now in effect. */
  readonly bequests: readonly EstateBequest[];
}

interface InstructionState {
  readonly instruction: StandingInstruction;
  readonly attestations: Set<string>;
  readonly revoked: boolean;
}

export class DigitalEstate {
  private readonly instructions = new Map<string, InstructionState>();
  private readonly now: () => string;

  public constructor(now: () => string = (): string => new Date().toISOString()) {
    this.now = now;
  }

  /**
   * Declare a standing instruction. A grantor may hold several (different triggers / beneficiaries);
   * each is content-digest-bound so a tampered directive is detectable. A new instruction with the
   * same digest is idempotent; a CHANGED instruction is a distinct directive (supersession is by
   * re-declaration + revocation of the prior, never a silent edit).
   */
  public declare(
    grantor: string,
    trigger: EstateTrigger,
    attestors: readonly string[],
    bequests: readonly EstateBequest[],
    quorum?: number,
  ): StandingInstruction {
    if (grantor.trim().length === 0 || attestors.length === 0 || bequests.length === 0) {
      throw new BadRequestHttpError('A standing instruction needs a grantor, ≥1 attestor and ≥1 bequest.');
    }
    const needed = quorum ?? attestors.length;
    if (needed < 1 || needed > attestors.length) {
      throw new BadRequestHttpError(`Quorum ${needed} must be within 1..${attestors.length} attestors.`);
    }
    for (const bequest of bequests) {
      if (bequest.resourceClass.trim().length === 0 || bequest.beneficiary.trim().length === 0) {
        throw new BadRequestHttpError('Every bequest needs a resourceClass and a beneficiary.');
      }
    }
    const base = { grantor, trigger, attestors, quorum: needed, bequests, declaredAt: this.now() };
    const instruction: StandingInstruction = Object.freeze({ ...base, instructionDigest: canonicalDigest(base) });
    const id = instruction.instructionDigest;
    if (!this.instructions.has(id)) {
      this.instructions.set(id, { instruction, attestations: new Set(), revoked: false });
    }
    return instruction;
  }

  /** An attestor confirms the trigger occurred for an instruction. Only a named attestor counts. */
  public attest(instructionDigest: string, attestor: string): void {
    const state = this.get(instructionDigest);
    if (!state.instruction.attestors.includes(attestor)) {
      throw new BadRequestHttpError(`'${attestor}' is not a named attestor of this instruction.`);
    }
    state.attestations.add(attestor);
  }

  /**
   * Evaluate whether an instruction fires — only when its attestation quorum is met AND it is not
   * revoked. Returns the outcome (bequests now in effect) or `undefined` when the trigger isn't
   * satisfied — an unattested event activates nothing (fail closed).
   */
  public evaluate(instructionDigest: string): EstateOutcome | undefined {
    const state = this.get(instructionDigest);
    if (state.revoked) {
      return undefined;
    }
    const quorum = state.instruction.quorum ?? state.instruction.attestors.length;
    if (state.attestations.size < quorum) {
      return undefined;
    }
    return { instruction: state.instruction, bequests: state.instruction.bequests };
  }

  /** Revoke an instruction — a revoked directive never fires (the grantor changes their mind). */
  public revoke(instructionDigest: string, grantor: string): void {
    const state = this.get(instructionDigest);
    if (state.instruction.grantor !== grantor) {
      throw new BadRequestHttpError('Only the grantor can revoke their standing instruction.');
    }
    state.attestations.clear();
    // Mark revoked by replacing state — a revoked directive is tombstoned, never silently fired.
    (state as { revoked: boolean }).revoked = true;
  }

  /** The standing instructions a grantor has declared (audit surface). */
  public forGrantor(grantor: string): readonly StandingInstruction[] {
    return [ ...this.instructions.values() ]
      .filter(s => s.instruction.grantor === grantor)
      .map(s => s.instruction);
  }

  private get(digest: string): InstructionState {
    const state = this.instructions.get(digest);
    if (state === undefined) {
      throw new InternalServerError(`No standing instruction for digest '${digest}'.`);
    }
    return state;
  }
}
