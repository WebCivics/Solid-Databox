import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';
import { canonicalDigest } from '../../../proof/Canonicalization';
import { GENESIS_PREV_DIGEST } from '../../../evidence/EvidenceChain';

/**
 * Physical-site services (CIV-B47, `community-library.html`): the physical place is where the
 * digital fabric meets the world — a tool library, a seed library, a community-fridge shelf, an
 * equipment locker. A physical ITEM (not a time-slot — see `bookings/`) is lent to a member and
 * returned: `checkout` marks it out with a due date and the member's id; `checkin` returns it,
 * noting condition; an overdue item is detected. Every movement is append-only + hash-chained —
 * the community's record of who has which physical thing is auditable, not a notebook.
 *
 * Member-gated: only a member of the site may take an item; an item already out can't be taken
 * twice; a return requires it be out (fail closed throughout). The due-date makes "bring it back"
 * an accountable, recorded obligation — a community asset's custody is visible.
 */

export type ItemStatus = 'available' | 'checked-out';

export interface LentItem {
  /** The physical item's id. */
  readonly itemId: string;
  /** What it is — `drill`, `ladder`, `seed-packet`. */
  readonly label: string;
  /** The site the item belongs to. */
  readonly site: string;
  /** The member it is currently out to (when `checked-out`). */
  readonly borrowerId?: string;
  /** ISO-8601 due-back date (when `checked-out`). */
  readonly dueAt?: string;
  readonly status: ItemStatus;
}

export interface LendingEvent {
  readonly sequence: number;
  readonly itemId: string;
  readonly action: 'checkout' | 'return';
  readonly memberId: string;
  /** The item's condition on return (`good` | `damaged` | `lost`). */
  readonly condition?: string;
  readonly at: string;
  readonly prevDigest: string;
  readonly eventDigest: string;
}

export class ItemLending {
  private readonly items = new Map<string, LentItem>();
  private readonly events: LendingEvent[] = [];
  private readonly members = new Set<string>();
  private readonly now: () => string;

  public constructor(now: () => string = (): string => new Date().toISOString()) {
    this.now = now;
  }

  /** Enrol a member of the site — only members may take physical items. */
  public enrol(memberId: string): void {
    if (memberId.trim().length === 0) {
      throw new BadRequestHttpError('A member needs a pairwise id.');
    }
    this.members.add(memberId);
  }

  /** Stock a physical item at a site. */
  public stock(itemId: string, label: string, site: string): LentItem {
    if (itemId.trim().length === 0 || label.trim().length === 0 || site.trim().length === 0) {
      throw new BadRequestHttpError('An item needs an id, a label and a site.');
    }
    const item = Object.freeze({ itemId, label, site, status: 'available' });
    this.items.set(itemId, item);
    return item;
  }

  /** A member checks out an item — out with a due date. Fail closed: member-only, single-custody. */
  public checkout(itemId: string, memberId: string, dueAt: string): LentItem {
    if (!this.members.has(memberId)) {
      throw new BadRequestHttpError(`'${memberId}' is not a member of this site.`);
    }
    if (Number.isNaN(Date.parse(dueAt))) {
      throw new BadRequestHttpError('A checkout needs a valid due-back date.');
    }
    const item = this.requireItem(itemId);
    if (item.status === 'checked-out') {
      throw new BadRequestHttpError(`'${itemId}' is already checked out — single custody.`);
    }
    const updated = Object.freeze({ ...item, status: 'checked-out', borrowerId: memberId, dueAt });
    this.items.set(itemId, updated);
    this.record(itemId, 'checkout', memberId);
    return updated;
  }

  /** A member returns an item — condition noted. Fail closed: only an out item can return. */
  public checkin(itemId: string, memberId: string, condition: 'good' | 'damaged' | 'lost'): LentItem {
    const item = this.requireItem(itemId);
    if (item.status !== 'checked-out' || item.borrowerId !== memberId) {
      throw new BadRequestHttpError(`'${itemId}' is not checked out to '${memberId}'.`);
    }
    const updated = Object.freeze({ ...item, status: 'available' });
    this.items.set(itemId, updated);
    this.record(itemId, 'return', memberId, condition);
    return { ...updated, borrowerId: undefined, dueAt: undefined };
  }

  /** Items past their due date — the community's "bring it back" view. */
  public overdue(): readonly LentItem[] {
    const now = Date.parse(this.now());
    return [ ...this.items.values() ].filter(i =>
      i.status === 'checked-out' && i.dueAt !== undefined && Date.parse(i.dueAt) < now);
  }

  /** The item's movement history — append-only, hash-chained. */
  public history(itemId: string): readonly LendingEvent[] {
    return this.events.filter(e => e.itemId === itemId);
  }

  /** Verify the movement trail — a tampered custody event fails (T-27). */
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

  private requireItem(itemId: string): LentItem {
    const item = this.items.get(itemId);
    if (item === undefined) {
      throw new InternalServerError(`No item '${itemId}' stocked.`);
    }
    return item;
  }

  private record(itemId: string, action: LendingEvent['action'], memberId: string, condition?: string): void {
    const base = {
      sequence: this.events.length,
      itemId,
      action,
      memberId,
      condition,
      at: this.now(),
      prevDigest: this.events.at(-1)?.eventDigest ?? GENESIS_PREV_DIGEST,
    };
    this.events.push(Object.freeze({ ...base, eventDigest: canonicalDigest(base) }));
  }
}
