import { NotFoundHttpError } from '../../../util/errors/NotFoundHttpError';
import type { GuardianshipScope } from './Guardianship';
import type { MemberCapacity } from './HouseholdProfile';

/**
 * Safety recipes (CIV-A12): pre-defined, SHACL-grounded decision templates guardians
 * negotiate under. Each recipe declares:
 *  - the guardianship scope it governs,
 *  - the consent rule (who must approve — see `GuardianNetwork.resolveDecision`),
 *  - whether the ward's own voice is required/advisory (CRC Art. 12),
 *  - the SHACL shape a resulting decision record must satisfy before it may stand, and
 *  - the human-rights anchors the recipe is built on.
 *
 * Recipes are negotiation scaffolds, not verdicts — they give guardians a shared,
 * rights-anchored structure inside which to decide, and every decision produces a
 * SHACL-conformant, auditable record.
 */

export type ConsentRule =
  /** Any single guardian at the highest precedence tier suffices (one fit parent). */
  | 'top-tier-any' |
  /** Every highest-tier guardian must approve — equal-precedence split is a deadlock. */
  'top-tier-all' |
  /** Every in-force holder of the scope must approve. */
  'all-scoped' |
  /** CRPD Art. 12: the ward's own assent is operative; supporters advise. */
  'ward-with-support';

export interface SafetyRecipe {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly scope: GuardianshipScope;
  readonly appliesToCapacity: readonly MemberCapacity[];
  readonly consentRule: ConsentRule;
  readonly wardVoice: 'required' | 'advisory' | 'not-required';
  /** SHACL shapes (Turtle) the decision record must conform to. */
  readonly shaclShape: string;
  /** Rights instruments the recipe encodes. */
  readonly rightsAnchors: readonly string[];
  /** What a deadlocked (equal-precedence split) decision escalates to. */
  readonly escalation: 'mediation' | 'court' | 'defer';
}

const SHACL_PREFIX = `@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix fam:  <https://databox.example.org/ns/family#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
`;

/** The catalog — addressable by id, each grounded in SHACL + rights anchors. */
export const SAFETY_RECIPES: readonly SafetyRecipe[] = [
  {
    id: 'online-contact-boundary',
    name: 'Online contact boundary',
    description:
      'Who the ward may contact or be contacted by online — the bounded-space rule. ' +
      'Contact outside the boundary is unreachable, not filtered-after-the-fact.',
    scope: 'online-contact',
    appliesToCapacity: [ 'emerging', 'limited' ],
    consentRule: 'top-tier-all',
    wardVoice: 'advisory',
    rightsAnchors: [ 'CRC-5', 'CRC-12', 'CRC-16' ],
    escalation: 'mediation',
    shaclShape: `${SHACL_PREFIX}
fam:OnlineContactBoundary a sh:NodeShape ;
  sh:targetClass fam:ContactBoundaryDecision ;
  sh:property [
    sh:path fam:allowedContact ;
    sh:minCount 0 ;
  ] ;
  sh:property [
    sh:path fam:reviewDate ;
    sh:datatype xsd:date ;
    sh:minCount 1 ; sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path prov:wasAssociatedWith ;
    sh:minCount 1 ;
  ] .`,
  },
  {
    id: 'data-sharing-third-party',
    name: 'Data sharing with a third party',
    description:
      'Disclosure of the ward’s data to a school, clinic, researcher or service — ' +
      'purpose, recipient and retention must be declared before the grant stands.',
    scope: 'data-sharing',
    appliesToCapacity: [ 'emerging', 'limited', 'supported' ],
    consentRule: 'top-tier-all',
    wardVoice: 'required',
    rightsAnchors: [ 'CRC-16', 'CRPD-22', 'UDHR-12' ],
    escalation: 'mediation',
    shaclShape: `${SHACL_PREFIX}
fam:DataSharingDecision a sh:NodeShape ;
  sh:targetClass fam:DataSharingGrant ;
  sh:property [ sh:path fam:recipient ; sh:minCount 1 ; sh:maxCount 1 ] ;
  sh:property [ sh:path fam:purpose ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:retentionUntil ; sh:datatype xsd:date ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:scope ; sh:minCount 1 ] .`,
  },
  {
    id: 'location-sharing',
    name: 'Location sharing',
    description:
      'Who may see the ward’s live or stored location — the ward’s own voice is required ' +
      'where capacity allows (emerging+); sharing defaults to nobody.',
    scope: 'location-sharing',
    appliesToCapacity: [ 'emerging', 'limited', 'supported' ],
    consentRule: 'top-tier-all',
    wardVoice: 'required',
    rightsAnchors: [ 'CRC-12', 'CRC-16', 'CRPD-22' ],
    escalation: 'mediation',
    shaclShape: `${SHACL_PREFIX}
fam:LocationSharingDecision a sh:NodeShape ;
  sh:targetClass fam:LocationGrant ;
  sh:property [ sh:path fam:viewer ; sh:minCount 0 ] ;
  sh:property [ sh:path fam:wardAssentRecorded ; sh:datatype xsd:boolean ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:reviewDate ; sh:datatype xsd:date ; sh:minCount 1 ] .`,
  },
  {
    id: 'residence-schedule',
    name: 'Residence / overnight schedule',
    description:
      'Where the ward lives and the cross-household schedule — the separated-household ' +
      'decision: both sides’ top-tier guardians decide; a split deadlocks to escalation.',
    scope: 'residence',
    appliesToCapacity: [ 'emerging', 'limited' ],
    consentRule: 'top-tier-all',
    wardVoice: 'required',
    rightsAnchors: [ 'CRC-3', 'CRC-9', 'CRC-12' ],
    escalation: 'court',
    shaclShape: `${SHACL_PREFIX}
fam:ResidenceDecision a sh:NodeShape ;
  sh:targetClass fam:ResidenceSchedule ;
  sh:property [ sh:path fam:primaryHousehold ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:schedule ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:effectiveFrom ; sh:datatype xsd:date ; sh:minCount 1 ] .`,
  },
  {
    id: 'medical-major',
    name: 'Major medical decision',
    description:
      'Non-routine healthcare for the ward — every scoped top-tier guardian decides; the ' +
      'ward’s voice is required. Routine care stays with the caring household.',
    scope: 'medical',
    appliesToCapacity: [ 'emerging', 'limited', 'supported' ],
    consentRule: 'all-scoped',
    wardVoice: 'required',
    rightsAnchors: [ 'CRC-3', 'CRC-24', 'CRPD-25' ],
    escalation: 'court',
    shaclShape: `${SHACL_PREFIX}
fam:MedicalDecision a sh:NodeShape ;
  sh:targetClass fam:MajorMedicalConsent ;
  sh:property [ sh:path fam:treatment ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:urgency ; sh:in ( "routine" "urgent" "elective" ) ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:wardAssentRecorded ; sh:datatype xsd:boolean ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:alternativesConsidered ; sh:minCount 1 ] .`,
  },
  {
    id: 'supported-decision',
    name: 'Supported decision (CRPD Art. 12)',
    description:
      'The supported person’s own decision, made with supporter advice — the ward’s assent ' +
      'IS the act; supporters are recorded as consulted, never as substitutes. For severe ' +
      'disability and elder care where the person retains legal capacity.',
    scope: 'daily-care',
    appliesToCapacity: [ 'supported' ],
    consentRule: 'ward-with-support',
    wardVoice: 'required',
    rightsAnchors: [ 'CRPD-12', 'CRPD-19', 'CRPD-22' ],
    escalation: 'defer',
    shaclShape: `${SHACL_PREFIX}
fam:SupportedDecision a sh:NodeShape ;
  sh:targetClass fam:SupportedDecisionRecord ;
  sh:property [ sh:path fam:wardAssent ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:supportersConsulted ; sh:minCount 0 ] ;
  sh:property [ sh:path fam:decisionSummary ; sh:minCount 1 ] .`,
  },
  {
    id: 'emergency-safety',
    name: 'Emergency safety action',
    description:
      'Immediate risk to the ward — any in-force guardian may act alone; every other ' +
      'scoped guardian is notified and the action carries a mandatory review date. ' +
      'Break-glass with accountability, not a silent override.',
    scope: 'daily-care',
    appliesToCapacity: [ 'emerging', 'limited', 'supported' ],
    consentRule: 'top-tier-any',
    wardVoice: 'advisory',
    rightsAnchors: [ 'CRC-3', 'CRC-6' ],
    escalation: 'defer',
    shaclShape: `${SHACL_PREFIX}
fam:EmergencyAction a sh:NodeShape ;
  sh:targetClass fam:EmergencyActionRecord ;
  sh:property [ sh:path fam:actionTaken ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:justification ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:notifiedGuardian ; sh:minCount 1 ] ;
  sh:property [ sh:path fam:reviewBy ; sh:datatype xsd:dateTime ; sh:minCount 1 ] .`,
  },
];

/** Look a recipe up by id — fails closed on unknowns. */
export function safetyRecipe(id: string): SafetyRecipe {
  const recipe = SAFETY_RECIPES.find(item => item.id === id);
  if (recipe === undefined) {
    throw new NotFoundHttpError(`Unknown safety recipe "${id}".`);
  }
  return recipe;
}
