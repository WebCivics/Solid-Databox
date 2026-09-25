import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { canonicalDigest } from '../proof/Canonicalization';

/**
 * Scoped-disclosure matching (CIV-B41, `food-health.html` + the concession/verification verticals):
 * a verifier asks for the attributes it needs; the holder's pod answers with ONLY those — and only
 * the ones the holder's disclosure policy permits for that purpose/recipient. "Minimal by
 * construction": the presentation contains exactly the requested, permitted attributes — nothing
 * else is derivable from it.
 *
 * The disclosure carries a binding — the purpose and recipient it's scoped to — so a presentation
 * minted for `purpose:allergy-check` can't be re-presented to a different party or a different
 * purpose (the digest binds the scope). Attribute-level policy lets a field be declared
 * `always-shareable` (e.g. `allergen-gluten`) vs `consent-required` vs `never` — a request for a
 * `never`-scoped attribute returns nothing for it, and the presentation notes the denial.
 *
 * This is the holder-side counterpart of a verifiable-presentation flow: it produces the minimal
 * disclosure object a verifier consumes; the cryptographic envelope (VP signature) wraps it upstream.
 */

/** How visible an attribute is under a holder's disclosure policy. */
export type AttributeScope = 'always' | 'purpose-scoped' | 'consent-required' | 'never';

export interface AttributePolicy {
  /** The attribute name. */
  readonly attribute: string;
  /** Its disclosure scope. */
  readonly scope: AttributeScope;
  /** For `purpose-scoped`: the purposes it may be shared under. */
  readonly purposes?: readonly string[];
}

export interface DisclosureRequest {
  /** The verifier's pairwise identifier. */
  readonly recipient: string;
  /** The declared purpose the attributes are needed for. */
  readonly purpose: string;
  /** The attributes the verifier asks for. */
  readonly attributes: readonly string[];
  /** How long the presentation is valid (seconds; default 300). */
  readonly ttlSeconds?: number;
}

export interface ScopedPresentation {
  /** The recipient + purpose the disclosure is bound to. */
  readonly recipient: string;
  readonly purpose: string;
  /** The disclosed attributes — ONLY the requested, permitted ones. */
  readonly disclosed: Readonly<Record<string, unknown>>;
  /** The attributes requested but denied by policy (named, never valued). */
  readonly denied: readonly string[];
  readonly issuedAt: string;
  readonly expiresAt: string;
  /** Digest binding this presentation to its recipient+purpose+content — not re-scopable. */
  readonly presentationDigest: string;
}

const DEFAULT_TTL = 300;

/**
 * Produce a scoped presentation for a verifier's request. `attributes` is the holder's full
 * attribute set (held privately); `policy` declares each attribute's disclosure scope. The result
 * contains ONLY the requested attributes the policy permits for that purpose — the rest is denied
 * (named, never valued) or absent. Consent-required attributes are denied unless `consented` is
 * passed true for the request (the holder actively consented out-of-band).
 */
export function scopeDisclosure(
  request: DisclosureRequest,
  attributes: Readonly<Record<string, unknown>>,
  policy: readonly AttributePolicy[],
  options: { consented?: boolean; now?: () => string } = {},
): ScopedPresentation {
  if (request.recipient.trim().length === 0 || request.purpose.trim().length === 0) {
    throw new BadRequestHttpError('A disclosure request needs a recipient and a declared purpose.');
  }
  const now = options.now ?? ((): string => new Date().toISOString());
  const issuedAt = now();
  const expiresAt = new Date(Date.parse(issuedAt) + (request.ttlSeconds ?? DEFAULT_TTL) * 1000).toISOString();

  const policies = new Map(policy.map(p => [ p.attribute, p ]));
  const disclosed: Record<string, unknown> = {};
  const denied: string[] = [];

  for (const attribute of request.attributes) {
    // The holder doesn't carry it — nothing to disclose (no existence oracle).
    if (!(attribute in attributes)) {
      continue;
    }
    const rule = policies.get(attribute);
    // Undeclared attributes default to never — fail closed.
    const scope = rule?.scope ?? 'never';
    const permitted =
      scope === 'always' ||
      (scope === 'purpose-scoped' && rule?.purposes?.includes(request.purpose) === true) ||
      (scope === 'consent-required' && options.consented === true);
    if (permitted) {
      disclosed[attribute] = attributes[attribute];
    } else {
      denied.push(attribute);
    }
  }

  const base = {
    recipient: request.recipient,
    purpose: request.purpose,
    disclosed,
    denied,
    issuedAt,
    expiresAt,
  };
  return Object.freeze({ ...base, presentationDigest: canonicalDigest(base) });
}
