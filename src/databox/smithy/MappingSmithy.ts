import type { KeyObject } from 'node:crypto';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { APPLICATION_LD_JSON } from '../../util/ContentTypes';
import { DataboxBridge } from '../bridge/DataboxBridge';
import type {
  BridgeDepositReport,
  DurableCommitConfirmer,
  ProgramServiceIdentity,
  SourceEvent,
} from '../bridge/DataboxBridge';
import { InstitutionalRecordBuilder } from '../bridge/InstitutionalRecordBuilder';
import { KeyedHmacRelationshipResolver } from '../bridge/RelationshipResolver';
import { InMemorySourceOutbox } from '../bridge/SourceOutbox';
import type { TransactionalSourceOutbox } from '../bridge/SourceOutbox';
import { StatusListManager } from '../credential/BitstringStatusList';
import { ComplianceEngine } from '../compliance/ComplianceEngine';
import type { ComplianceEvaluationInput } from '../compliance/ComplianceEngine';
import { ConnectionCredentialIssuer } from '../credential/ConnectionCredentialIssuer';
import type { IssuedConnectionCredential } from '../credential/ConnectionCredentialIssuer';
import type { PublicJwk } from '../credential/ConnectionCredentialTypes';
import { publicJwkFromKeyObject } from '../credential/Es256';
import { BinaryEvidenceQuarantine, FailClosedScanner } from '../gateway/BinaryEvidenceQuarantine';
import { DepositSubmissionGateway } from '../gateway/DepositSubmissionGateway';
import type { GatewayBounds } from '../gateway/DepositSubmissionGateway';
import { IdempotencyRegistry } from '../gateway/IdempotencyRegistry';
import { DEFAULT_RDF_SHAPE_LIMITS } from '../gateway/RdfShapeValidator';
import { RandomOpaqueIdentifierGenerator } from '../identifiers/OpaqueIdentifierGenerator';
import type { InstitutionProfile } from '../profile/InstitutionProfile';
import { loadInstitutionProfile } from '../profile/InstitutionProfileValidator';
import { DataboxProvisioner } from '../provisioning/DataboxProvisioner';
import { InMemoryRelationshipMappingRegistry } from '../provisioning/RelationshipMappingRegistry';
import type { RelationshipMappingRegistry } from '../provisioning/RelationshipMappingRegistry';
import type { ProvisionResult } from '../provisioning/ProvisioningTypes';
import { AcceptanceReceiptSigner } from '../receipt/AcceptanceReceiptSigner';

/** Business-controlled settings for one program in the mapping smithy. */
export interface SmithyProgramInput {
  readonly profile: unknown;
  readonly programUri: string;
  readonly databoxBaseUrl: string;
  readonly issuer?: string;
  /** A legal claim is blocked unless the compliance publication gate passes. */
  readonly claimsLegalCompliance?: boolean;
  readonly compliance?: ComplianceEvaluationInput;
}

/**
 * The declared legal basis and purposes a record class is bound to. A deposit naming any other
 * basis or purpose is refused (`legal-basis-mismatch` / `purpose-not-permitted`), so publishing the
 * bindings lets a source system compose a valid deposit instead of guessing at profile-internal ids.
 */
export interface SmithyRecordClassBinding {
  readonly id: string;
  readonly label: string;
  readonly legalBasis: string;
  readonly purposes: readonly string[];
}

export interface SmithyProgramSummary {
  readonly profileId: string;
  readonly profileVersion: string;
  /** Public legal name of the program principal, for operator-facing display. */
  readonly principalLegalName: string;
  /** Jurisdiction the principal is accountable in. */
  readonly principalJurisdiction: string;
  readonly programUri: string;
  readonly databoxBaseUrl: string;
  readonly recordClasses: readonly string[];
  readonly submissionClasses: readonly string[];
  /** Per-record-class legal basis / purpose bindings (see {@link SmithyRecordClassBinding}). */
  readonly recordClassBindings: readonly SmithyRecordClassBinding[];
  readonly legalComplianceClaimed: boolean;
}

export interface SmithyMappingInput {
  readonly profileId: string;
  readonly sourceSystem: string;
  readonly customerIdNamespace: string;
  /** Control-plane PII. Deliberately absent from SmithyMappingResult. */
  readonly customerId: string;
  readonly pairwiseWebId: string;
  readonly holderPublicJwk: PublicJwk;
}

export interface SmithyMappingResult {
  readonly provisioning: ProvisionResult;
  readonly credential: IssuedConnectionCredential;
}

export interface SmithySourceEventInput {
  readonly profileId: string;
  readonly sourceSystem: string;
  readonly eventType: string;
  readonly sourceEventId: string;
  readonly customerIdNamespace: string;
  /** Control-plane PII. Deliberately absent from BridgeDepositReport. */
  readonly customerId: string;
  readonly recordClass: string;
  readonly legalBasis: string;
  readonly purpose: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

interface ProgramRuntime {
  readonly profile: InstitutionProfile;
  readonly summary: SmithyProgramSummary;
  readonly provisioner: DataboxProvisioner;
  readonly credentialIssuer: ConnectionCredentialIssuer;
  readonly status: StatusListManager;
  readonly statusListCredential: string;
  readonly outbox: TransactionalSourceOutbox;
  readonly bridge: DataboxBridge;
}

export interface MappingSmithyOptions {
  readonly now?: () => string;
  readonly keyFactory?: () => { readonly publicKey: KeyObject; readonly privateKey: KeyObject };
  readonly secretFactory?: () => Buffer;
  /** Optional live storage/provisioning sink. The reference default remains in-memory. */
  readonly durableCommit?: DurableCommitConfirmer;
  /** Creates the Solid container/ACL surface after a relationship is provisioned. */
  readonly provision?: (result: ProvisionResult) => Promise<void>;
  readonly complianceEngine?: ComplianceEngine;
  /**
   * The relationship-mapping registry the smithy writes box→relationship records into. Injected when the
   * provisioning path must SHARE the registry the composed authorizer reads (CIV-C26 / DBX-26: the live
   * preset binds the same Components.js component to both, so a provisioned box resolves for the holder).
   * Defaults to a private in-memory registry for the standalone/test smithy.
   */
  readonly registry?: RelationshipMappingRegistry;
  /**
   * Per-program source-outbox factory (CIV-C10). Defaults to `InMemorySourceOutbox`; a durable
   * deployment injects a factory returning a {@link TransactionalSourceOutbox} backed by durable
   * storage so committed bridge rows survive a restart.
   */
  readonly outboxFactory?: () => TransactionalSourceOutbox;
}

/** Control plane for validating profiles, forging mappings, issuing credentials, and bridging source events. */
export class MappingSmithy {
  private readonly programs = new Map<string, ProgramRuntime>();
  private readonly registry: RelationshipMappingRegistry;
  private readonly now: () => string;
  private readonly keyFactory: () => { readonly publicKey: KeyObject; readonly privateKey: KeyObject };
  private readonly secretFactory: () => Buffer;
  private readonly durableCommit?: DurableCommitConfirmer;
  private readonly provision?: (result: ProvisionResult) => Promise<void>;
  private readonly complianceEngine: ComplianceEngine;
  private readonly outboxFactory: () => TransactionalSourceOutbox;

  public constructor(options: MappingSmithyOptions = {}) {
    this.now = options.now ?? ((): string => new Date().toISOString());
    this.keyFactory = options.keyFactory ??
      ((): { publicKey: KeyObject; privateKey: KeyObject } => generateKeyPairSync('ec', { namedCurve: 'P-256' }));
    this.secretFactory = options.secretFactory ?? ((): Buffer => randomBytes(32));
    this.durableCommit = options.durableCommit;
    this.provision = options.provision;
    this.complianceEngine = options.complianceEngine ?? new ComplianceEngine();
    this.registry = options.registry ?? new InMemoryRelationshipMappingRegistry();
    this.outboxFactory = options.outboxFactory ??
      ((): TransactionalSourceOutbox => new InMemorySourceOutbox({ clock: this.now }));
  }

  public registerProgram(input: SmithyProgramInput): SmithyProgramSummary {
    const profile = loadInstitutionProfile(input.profile);
    if (input.claimsLegalCompliance === true) {
      if (!input.compliance) {
        throw new BadRequestHttpError('A legal-compliance publication requires a compliance assessment.');
      }
      const gate = this.complianceEngine.publicationGate(input.compliance);
      if (!gate.allowed) {
        throw new BadRequestHttpError(`Compliance publication blocked: ${gate.blockers.join(' ')}`);
      }
    }
    if (this.programs.has(profile.profileId)) {
      throw new BadRequestHttpError(`Program '${profile.profileId}' is already registered.`);
    }
    requireHttps(input.programUri, 'programUri');
    requireHttps(input.databoxBaseUrl, 'databoxBaseUrl');
    const issuer = input.issuer ?? `${new URL(input.programUri).origin}/databox/issuer`;
    requireHttps(issuer, 'issuer');

    const keys = this.keyFactory();
    const secret = this.secretFactory();
    const provisioner = new DataboxProvisioner(
      new RandomOpaqueIdentifierGenerator(input.databoxBaseUrl),
      this.registry,
      { secretFactory: (): Buffer => secret, clock: this.now },
    );
    const identity: ProgramServiceIdentity = {
      organisation: profile.program.principal.id,
      program: profile.profileId,
      programPrincipal: profile.program.principal.id,
      serviceIdentity: `${new URL(input.programUri).origin}/databox/bridge`,
      issuer,
    };
    const outbox = this.outboxFactory();
    const resolver = new KeyedHmacRelationshipResolver(this.registry, { secretFactory: (): Buffer => secret });
    const gateway = new DepositSubmissionGateway(
      new IdempotencyRegistry(),
      new BinaryEvidenceQuarantine(new FailClosedScanner()),
    );
    const bounds: GatewayBounds = {
      default: { maxBytes: 1_000_000, allowedMediaTypes: [ APPLICATION_LD_JSON ]},
      rdf: { pinnedContexts: [], limits: DEFAULT_RDF_SHAPE_LIMITS },
    };
    const bridge = new DataboxBridge({
      identity,
      profile,
      outbox,
      resolver,
      builder: new InstitutionalRecordBuilder(identity, keys.privateKey, { clock: this.now }),
      gateway,
      gatewayBounds: bounds,
      issuerKeys: [{ issuer, publicKey: publicJwkFromKeyObject(keys.publicKey) }],
      receiptSigner: new AcceptanceReceiptSigner(issuer, keys.privateKey, `${issuer}#key-1`),
      clock: this.now,
      ...this.durableCommit === undefined ? {} : { durableCommit: this.durableCommit },
    });
    const summary: SmithyProgramSummary = {
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      principalLegalName: profile.program.principal.legalName,
      principalJurisdiction: profile.program.principal.jurisdiction,
      programUri: input.programUri,
      databoxBaseUrl: input.databoxBaseUrl,
      recordClasses: profile.recordClasses.map((entry): string => entry.id),
      submissionClasses: profile.submissionClasses.map((entry): string => entry.id),
      recordClassBindings: profile.recordClasses.map((entry): SmithyRecordClassBinding => ({
        id: entry.id,
        label: entry.label,
        legalBasis: entry.legalBasis,
        purposes: entry.purposes,
      })),
      legalComplianceClaimed: input.claimsLegalCompliance === true,
    };
    const statusListCredential = `${issuer}/status/1`;
    this.programs.set(profile.profileId, {
      profile,
      summary,
      provisioner,
      credentialIssuer: new ConnectionCredentialIssuer(issuer, keys.privateKey, `${issuer}#key-1`),
      status: new StatusListManager(statusListCredential),
      statusListCredential,
      outbox,
      bridge,
    });
    return summary;
  }

  public listPrograms(): readonly SmithyProgramSummary[] {
    return [ ...this.programs.values() ].map((runtime): SmithyProgramSummary => runtime.summary);
  }

  public async forgeMapping(input: SmithyMappingInput): Promise<SmithyMappingResult> {
    const runtime = this.requireProgram(input.profileId);
    const provisioning = await runtime.provisioner.provision(runtime.profile, {
      organisation: runtime.profile.program.principal.id,
      program: runtime.profile.profileId,
      sourceSystem: input.sourceSystem,
      customerIdNamespace: input.customerIdNamespace,
      customerId: input.customerId,
    }, input.pairwiseWebId);
    await this.provision?.(provisioning);
    const statusListIndex = runtime.status.register(provisioning.relationship.relationshipId);
    const credential = runtime.credentialIssuer.issue({
      pairwiseWebId: input.pairwiseWebId,
      holderPublicJwk: input.holderPublicJwk,
      program: runtime.summary.programUri,
      databox: provisioning.databox.root,
      storageDescription: `${provisioning.databox.root}.well-known/solid`,
      accessGrant: { id: `${provisioning.databox.root}access-grant`, bytes: JSON.stringify(provisioning.policyRefs) },
      accessProfile: 'solid-databox-access/1.0',
      conformsTo: [ 'https://www.w3.org/TR/solid-protocol/', 'https://w3id.org/solid-databox/profile/v1' ],
      syncProfile: 'solid-databox-sync/1.0',
      relationship: provisioning.relationship.relationshipId,
      statusListIndex,
      statusListCredential: runtime.statusListCredential,
    });
    return { provisioning, credential };
  }

  public async depositSourceEvent(input: SmithySourceEventInput): Promise<BridgeDepositReport> {
    const runtime = this.requireProgram(input.profileId);
    const event: SourceEvent = {
      organisation: runtime.profile.program.principal.id,
      program: runtime.profile.profileId,
      sourceSystem: input.sourceSystem,
      eventType: input.eventType,
      sourceEventId: input.sourceEventId,
      customerIdNamespace: input.customerIdNamespace,
      customerId: input.customerId,
      recordClass: input.recordClass,
      legalBasis: input.legalBasis,
      purpose: input.purpose,
      payload: input.payload,
    };
    runtime.outbox.commit(event);
    const reports = await runtime.bridge.drain();
    const report = reports.find((entry): boolean => entry.reconciliation.sourceEventId === input.sourceEventId);
    if (!report) {
      throw new BadRequestHttpError(`Source event '${input.sourceEventId}' is already reconciled.`);
    }
    return report;
  }

  private requireProgram(profileId: string): ProgramRuntime {
    const runtime = this.programs.get(profileId);
    if (!runtime) {
      throw new BadRequestHttpError(`Unknown program profile '${profileId}'.`);
    }
    return runtime;
  }
}

function requireHttps(value: string, field: string): void {
  try {
    const parsed = new URL(value);
    const loopback = parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1');
    if (parsed.protocol !== 'https:' && !loopback) {
      throw new Error('not https');
    }
  } catch {
    throw new BadRequestHttpError(`Smithy field '${field}' must be an absolute HTTPS URL or HTTP loopback URL.`);
  }
}
