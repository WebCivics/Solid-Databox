import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import { canonicalDigest } from '../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../evidence/EvidenceChain';

/**
 * Multi-party duty webs (CIV-B03, `social-web.html`): a duty that is never one person's — a child's
 * care decision is held by the co-parents AND the specialist; a community project's duty to maintain
 * a shared asset is held by the crew AND the steward. A `DutyWeb` declares the parts a duty needs —
 * each part assigned to a responsible party — and the duty only completes when EVERY part is signed
 * off. The web is the honest model: a decision that truly needs multiple people's part isn't done
 * until they all carry it, and each part's holder is recorded (accountability is distributed, never
 * diffuse).
 *
 * Each `sign` is a hash-chained audit entry recording which party satisfied which part — the web's
 * record is tamper-evident (a forged sign-off breaks it). A duty with no parts can't be declared;
 * a part can only be signed by the party it names (fail closed — a stranger can't satisfy another's
 * part); a completed web is closed to further sign-off.
 */

export interface DutyPart {
  /** The part's id within the web. */
  readonly partId: string;
  /** What this part of the duty is — the obligation it names. */
  readonly obligation: string;
  /** The party responsible for it (their pairwise id). */
  readonly holder: string;
  /** Whether the holder has signed it off, and when. */
  readonly signedAt?: string;
}

export interface WebEvent {
  readonly sequence: number;
  readonly webId: string;
  readonly action: 'declare' | 'sign' | 'complete';
  readonly partId?: string;
  readonly holder?: string;
  readonly at: string;
  readonly prevDigest: string;
  readonly eventDigest: string;
}

export class DutyWeb {
  private readonly parts = new Map<string, DutyPart>();
  private readonly events: WebEvent[] = [];
  private completed = false;
  private readonly now: () => string;

  /**
   * @param webId - The duty web's id.
   * @param parts - The obligations + their responsible parties — every part names a holder.
   */
  public constructor(
    public readonly webId: string,
    parts: { partId: string; obligation: string; holder: string }[],
    now: () => string = (): string => new Date().toISOString(),
  ) {
    if (webId.trim().length === 0 || parts.length === 0) {
      throw new InternalServerError('A duty web needs an id and ≥1 part.');
    }
    for (const part of parts) {
      if (part.partId.trim().length === 0 || part.obligation.trim().length === 0 ||
        part.holder.trim().length === 0) {
        throw new BadRequestHttpError('A duty part needs an id, an obligation and a responsible party.');
      }
      this.parts.set(part.partId, Object.freeze({ ...part, signedAt: undefined }));
    }
    this.now = now;
    this.record('declare');
  }

  /**
   * The duty's state — `open` until every part is signed, then `discharged`. The web answers "is
   * this shared duty actually carried?" — not until each holder's part is done.
   */
  public state(): 'open' | 'discharged' {
    return this.completed ? 'discharged' : 'open';
  }

  /** The parts still unsigned — which holders haven't yet carried their part. */
  public outstanding(): readonly DutyPart[] {
    return [ ...this.parts.values() ].filter(p => p.signedAt === undefined);
  }

  /**
   * A holder signs off their part — only the named party can satisfy it (a stranger's sign-off
   * doesn't count). When the last part signs, the web discharges — and each signature is a
   * hash-chained audit entry.
   */
  public sign(partId: string, holderId: string): DutyPart {
    if (this.completed) {
      throw new BadRequestHttpError(`The duty web '${this.webId}' is already discharged.`);
    }
    const part = this.parts.get(partId);
    if (part === undefined) {
      throw new BadRequestHttpError(`No part '${partId}' in this web.`);
    }
    if (part.holder !== holderId) {
      throw new BadRequestHttpError(`'${holderId}' cannot satisfy part '${partId}' — it is '${part.holder}'s part.`);
    }
    const updated = Object.freeze({ ...part, signedAt: this.now() });
    this.parts.set(partId, updated);
    this.record('sign', partId, holderId);
    if (this.outstanding().length === 0) {
      this.completed = true;
      this.record('complete');
    }
    return updated;
  }

  /** The web's audit trail — every declaration + sign-off + discharge, hash-chained. */
  public audit(): readonly WebEvent[] {
    return [ ...this.events ];
  }

  /** Verify the audit trail — a tampered sign-off fails (T-27). */
  public verify(): { readonly valid: boolean } {
    for (const [ index, event ] of this.events.entries()) {
      const { eventDigest, ...contents } = event;
      const expected = index === 0 ? GENESIS_PREV_DIGEST : this.events[index - 1].eventDigest;
      if (event.sequence !== index || event.prevDigest !== expected ||
        eventDigest !== canonicalDigest(contents)) {
        return { valid: false };
      }
    }
    return { valid: true };
  }

  private record(action: WebEvent['action'], partId?: string, holder?: string): void {
    const base = {
      sequence: this.events.length,
      webId: this.webId,
      action,
      partId,
      holder,
      at: this.now(),
      prevDigest: this.events.at(-1)?.eventDigest ?? GENESIS_PREV_DIGEST,
    };
    this.events.push(Object.freeze({ ...base, eventDigest: canonicalDigest(base) }));
  }
}
