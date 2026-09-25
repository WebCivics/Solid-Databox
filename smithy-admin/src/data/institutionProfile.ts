// @ts-nocheck
import baseline from "./baseline-institution-profile.json";

/**
 * Onboarding scaffold for the Smithy's institution-profile contract
 * (`dbx-institution-profile/1.0.0`).
 *
 * The Smithy validates a *complete* profile fail-closed: tenancy, crypto,
 * identity providers, assurance mappings, record/submission classes, policy
 * templates, a compiled-policy attestation, a legislative corpus, legal bases,
 * declared purposes, retention, systems of record, notifications and redress —
 * plus cross-field invariants between them. A handful of form fields cannot
 * describe that, so onboarding starts from the proven-valid synthetic loyalty
 * baseline and overrides only the identity-bearing fields.
 *
 * What this produces is therefore a SYNTHETIC starter profile, not an attested
 * one: `synthetic` stays true and no legal-compliance claim is made. The
 * compiled-policy and corpus digests are the baseline's SYNTHETIC placeholders,
 * so the record classes, purposes and retention are the loyalty template's —
 * a starting point to edit, not a description of the onboarded organisation.
 * A real program supplies its own authored profile instead.
 */

export interface ScaffoldInput {
  profileId: string;
  legalName: string;
  jurisdiction: string;
  contact?: string;
  orgUrl?: string;
}

/** Mark generated names so a synthetic profile is never mistaken for a real one (ADR-0015). */
const SYNTHETIC_SUFFIX = "(SYNTHETIC)";

function labelSynthetic(name: string): string {
  return name.includes("SYNTHETIC") ? name : `${name} ${SYNTHETIC_SUFFIX}`;
}

/** Derive an https origin from a website URL, falling back to the baseline's. */
function originFrom(orgUrl: string | undefined, fallback: string): string {
  if (!orgUrl) return fallback;
  try {
    return new URL(orgUrl).origin + "/";
  } catch {
    return fallback;
  }
}

/**
 * Build a complete, schema-valid institution profile from minimal operator input.
 * Everything not listed here is inherited verbatim from the validated baseline.
 */
export function buildSyntheticProfile(input: ScaffoldInput): Record<string, unknown> {
  const base = structuredClone(baseline) as any;
  const origin = originFrom(input.orgUrl, base.tenancy.origin);
  const slug = input.profileId.replace(/[^a-zA-Z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").toLowerCase();

  return {
    ...base,
    profileId: input.profileId,
    synthetic: true,
    program: {
      principal: {
        ...base.program.principal,
        legalName: labelSynthetic(input.legalName),
        jurisdiction: input.jurisdiction,
        ...(input.contact ? { contact: input.contact } : {}),
      },
      accountableParty: {
        ...base.program.accountableParty,
        legalName: labelSynthetic(input.legalName),
        jurisdiction: input.jurisdiction,
      },
    },
    tenancy: { ...base.tenancy, origin, tokenAudience: origin },
    // Keys are per-program: a platform-wide signing key would break tenant isolation.
    crypto: { ...base.crypto, signingKeyRef: `kms://program/${slug}/signing/1` },
    compiledPolicy: { ...base.compiledPolicy, legalComplianceClaimed: false },
  };
}

export const BASELINE_PROFILE = baseline;
