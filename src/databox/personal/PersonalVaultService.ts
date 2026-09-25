import type { KeyObject } from 'node:crypto';
import { generateKeyPairSync } from 'node:crypto';
import type { ProofChallenge, ProvisionalShortLivedToken } from '../credential/ConnectionCredentialTypes';
import { ConnectionCredentialValidator } from '../credential/ConnectionCredentialValidator';
import { signHolderProof } from '../credential/HolderKeyProof';
import { BitstringStatusList } from '../credential/BitstringStatusList';
import { RecordProofValidator } from '../proof/RecordProofValidator';
import { AcceptanceReceiptVerifier } from '../receipt/AcceptanceReceiptVerifier';
import { IssuerTrustStore } from '../proof/IssuerTrustStore';
import { PinnedContextSet } from '../proof/OfflineVerification';
import type { IssuerKeyDescriptor } from '../proof/RecordProofTypes';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import type {
  ConnectionVerificationConfig,
  ConsumerAgentDependencies,
  RetrievedRecordItem,
  SubmissionAcknowledgement,
} from '../agent/AgentTypes';
import { ProgramAgent } from '../agent/ReferenceConsumerAgent';
import { ConsumerConnectionRegistry } from '../agent/ConsumerConnectionRegistry';
import type { ConsumerConnection } from '../agent/ConsumerConnectionRegistry';
import type { EvidenceBundle, StoredRecord } from '../agent/LocalKnowledgeStore';
import type { ScopedSubmissionMeta } from '../agent/ScopedSubmission';
import type { CommittedEvent } from '../feed/CursorFeed';
import type { SubmissionResult } from '../agent/ReferenceConsumerAgent';
import type { RemoteConsumeClient } from './RemoteConsumeClient';

/**
 * The person-side vault service (CIV-A07): the shared `ReferenceConsumerAgent`/`ProgramAgent`
 * engine plus the remote-transport seams a *server-hosted* personal databox needs that the
 * in-process agent does not provide.
 *
 * The two sync/async seams are handled honestly rather than faked:
 *
 * - **Challenge + token exchange are sync interfaces** (the organisation issues/verifies in
 *   process). A remote session is negotiated eagerly by {@link authenticateRemote} — fetch
 *   the challenge over HTTP, sign the holder proof locally, exchange for the token — and
 *   {@link sessionAdapters} then replay that session into the agent's sync interfaces for
 *   the duration of the operation. A call without a negotiated session fails closed.
 * - **Status-list resolution is sync** ({@link StatusListResolver}). Lists are fetched over
 *   HTTP into {@link statusListCache} ahead of verification (seeded at import, refreshed on
 *   demand); a list absent from the cache makes the validator fail closed per ADR-0020 —
 *   never "assumed not revoked".
 *
 * State is process-local (registry, cursors, stores) — the durable persistence layer is the
 * follow-up item; the cursor contract (recover/replay) is already correct in memory.
 */

/** The verification config the person supplies at import, in JSON-safe form. */
export interface VerificationInput {
  /** Trusted issuer keys for this connection's RECORD proofs (ADR-0020). */
  readonly recordIssuerKeys: readonly IssuerKeyDescriptor[];
  /** Trusted issuer keys for acceptance RECEIPTS (offline verification, ADR-0019). */
  readonly receiptIssuerKeys: readonly IssuerKeyDescriptor[];
  /** Pinned JSON-LD context URL → content map (unpinned/remote contexts fail closed, T-21). */
  readonly pinnedContexts?: Readonly<Record<string, string>>;
  /** Seed status lists: status-list-credential URL → base64url-encoded list. */
  readonly pinnedStatusLists?: Readonly<Record<string, string>>;
}

export interface ImportInput {
  readonly program: string;
  readonly credentialJws: string;
  readonly tenantId: string;
  readonly verification: VerificationInput;
  /**
   * The holder private key the credential binds — supplied when the key was generated
   * BEFORE issuance (the person generates a key, the org issues against its public half,
   * then imports). Absent → a keypair is generated here and the credential must bind it
   * (self-issued/bootstrap path). The private half never leaves the box.
   */
  readonly holderPrivateKey?: KeyObject;
}

export interface ImportResult {
  readonly connectionId: string;
  readonly holderThumbprint: string;
}

export interface PersonalVaultDependencies {
  /** Trusted issuer keys for CONNECTION credentials (the vault's root of trust). */
  readonly issuerKeys: ReadonlyMap<string, KeyObject>;
  readonly remote: RemoteConsumeClient;
  readonly now?: () => number;
}

/** The negotiated remote session replayed into the agent's sync interfaces. */
interface RemoteSession {
  readonly challenge: ProofChallenge;
  readonly token: ProvisionalShortLivedToken;
}

export class PersonalVaultService {
  private readonly registry = new ConsumerConnectionRegistry();
  private readonly deps: ConsumerAgentDependencies;
  private readonly remote: RemoteConsumeClient;
  private readonly now: () => number;
  /** TenantId → databox base URL, bound at import for cursor-feed routing. */
  private readonly tenantDatabox = new Map<string, string>();
  private readonly statusListCache = new Map<string, BitstringStatusList>();
  private session?: RemoteSession;

  public constructor(deps: PersonalVaultDependencies) {
    this.remote = deps.remote;
    this.now = deps.now ?? Date.now;

    this.deps = {
      credentialValidator: new ConnectionCredentialValidator(deps.issuerKeys),
      recordValidator: new RecordProofValidator(),
      receiptVerifier: new AcceptanceReceiptVerifier(),
      challengeSource: {
        issueChallenge: (audience): ProofChallenge => {
          const session = this.requireSession(audience);
          return session.challenge;
        },
      },
      tokenExchange: {
        exchange: (request): ProvisionalShortLivedToken => {
          const session = this.requireSession(request.audience);
          return session.token;
        },
      },
      recordEndpoint: {
        fetchRecords: async(token): Promise<readonly RetrievedRecordItem[]> =>
          this.remote.fetchRecords(token),
      },
      submissionEndpoint: {
        submit: async(token, submission): Promise<SubmissionAcknowledgement> =>
          this.remote.submit(token, submission),
      },
      cursorFeed: {
        pull: async(tenantId, sinceCursor): ReturnType<typeof this.remote.pullFeed> => {
          const databox = this.tenantDatabox.get(tenantId);
          if (databox === undefined) {
            throw new BadRequestHttpError('No databox bound to this tenant (fail closed).');
          }
          // The feed is tenant-bound: the presented token must be this tenant's session token.
          const token = this.session?.token;
          if (token === undefined) {
            throw new BadRequestHttpError('No negotiated session for the feed (fail closed).');
          }
          return this.remote.pullFeed(databox, token, tenantId, sinceCursor);
        },
      },
      now: deps.now,
    };
  }

  /** The session adapter requires an already-negotiated session for `audience` — fail closed. */
  private requireSession(audience: string): RemoteSession {
    if (this.session?.challenge.audience !== audience) {
      throw new BadRequestHttpError(
        `No negotiated remote session for audience ${audience} (fail closed).`,
      );
    }
    return this.session;
  }

  /**
   * A program-scoped agent over THIS service's registry — the same registry the service
   * inspects for describe/remove/tenant bindings, so every operation shares one store.
   */
  private programAgent(program: string): ProgramAgent {
    return new ProgramAgent(program, this.registry, this.deps, this.now);
  }

  /**
   * The credential install target: import a connection credential into the per-program
   * registry. The holder keypair is generated HERE on the person's own box (ADR-0026: the
   * consumer's private key is never transmitted); only the thumbprint leaves in proofs.
   */
  public importConnection(input: ImportInput): ImportResult {
    if (typeof input.program !== 'string' || input.program.length === 0 ||
      typeof input.credentialJws !== 'string' || input.credentialJws.length === 0 ||
      typeof input.tenantId !== 'string' || input.tenantId.length === 0) {
      throw new BadRequestHttpError('A connection import requires program, credentialJws and tenantId.');
    }
    const holderPrivateKey = input.holderPrivateKey ??
      generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
    const verification = this.buildVerification(input.program, input.verification);

    const agent = this.programAgent(input.program);
    const connectionId = agent.importConnection({
      credentialJws: input.credentialJws,
      holderPrivateKey,
      tenantId: input.tenantId,
      verification,
    });

    const connection = this.registry.require(input.program, connectionId);
    this.tenantDatabox.set(input.tenantId, connection.databox);
    for (const [ iri, encoded ] of Object.entries(input.verification.pinnedStatusLists ?? {})) {
      this.statusListCache.set(iri, BitstringStatusList.decode(encoded));
    }
    return { connectionId, holderThumbprint: connection.holderThumbprint };
  }

  private buildVerification(program: string, input: VerificationInput): ConnectionVerificationConfig {
    return {
      recordTrustStore: new IssuerTrustStore(program, input.recordIssuerKeys),
      pinnedContexts: new PinnedContextSet(new Map(Object.entries(input.pinnedContexts ?? {}))),
      statusListResolver: (statusListCredential): BitstringStatusList | undefined =>
        this.statusListCache.get(statusListCredential),
      receiptTrustStore: new IssuerTrustStore(program, input.receiptIssuerKeys),
    };
  }

  /**
   * Negotiate the remote session for a connection: org-issued challenge → locally signed
   * holder proof → short-lived token. The session is then replayed into the agent's sync
   * interfaces. The holder private key never leaves the registry (signHolderProof only).
   */
  public async authenticateRemote(program: string, connectionId: string): Promise<ProvisionalShortLivedToken> {
    const connection = this.registry.requireActive(program, connectionId);
    const binding = connection.validated.credential.credentialSubject.connection;
    const challenge = await this.remote.issueChallenge(connection.databox);
    const proofJws = signHolderProof(challenge, connection.holderPrivateKey, connection.holderThumbprint);
    const token = await this.remote.exchangeToken({
      credentialJws: connection.credentialJws,
      proofJws,
      audience: connection.databox,
      program,
      databox: connection.databox,
      accessGrantDigest: binding.accessGrantDigest,
      relationship: connection.relationship,
      now: this.now(),
    });
    this.session = { challenge, token };
    this.registry.setToken(connection, token);
    return token;
  }

  /** Notify-then-pull sync: authenticate, fetch, independently verify, store inert copies. */
  public async sync(program: string, connectionId: string): Promise<readonly StoredRecord[]> {
    await this.authenticateRemote(program, connectionId);
    return this.programAgent(program).retrieveAndStore(connectionId);
  }

  /**
   * Missed-event recovery off the authoritative cursor feed (durable cursor per connection).
   * The feed is token-bound — authenticate first so the tenant's session token exists.
   */
  public async recover(program: string, connectionId: string): Promise<readonly CommittedEvent[]> {
    await this.authenticateRemote(program, connectionId);
    return this.programAgent(program).recover(connectionId);
  }

  /** The private submission composer: selected-fields-only, receipt verified and stored. */
  public async submit(
    program: string,
    connectionId: string,
    candidate: Readonly<Record<string, unknown>>,
    selectedFields: readonly string[],
    meta: ScopedSubmissionMeta,
  ): Promise<SubmissionResult> {
    await this.authenticateRemote(program, connectionId);
    return this.programAgent(program).submitCorrection(connectionId, candidate, selectedFields, meta);
  }

  /** Refresh one status list over HTTP into the verification cache (list freshness). */
  public async refreshStatusList(statusListCredentialUrl: string): Promise<void> {
    const published = await this.remote.fetchStatusList(statusListCredentialUrl);
    this.statusListCache.set(statusListCredentialUrl, BitstringStatusList.decode(published.encodedList));
  }

  public listConnections(program: string): string[] {
    return this.programAgent(program).listConnections();
  }

  /** Connection metadata for display — never the credential, keys, or token. */
  public describeConnection(program: string, connectionId: string): {
    connectionId: string;
    program: string;
    relationship: string;
    databox: string;
    state: string;
    hasToken: boolean;
    lastCursor?: string;
  } {
    const connection: ConsumerConnection = this.registry.require(program, connectionId);
    return {
      connectionId: connection.connectionId,
      program: connection.program,
      relationship: connection.relationship,
      databox: connection.databox,
      state: connection.state,
      hasToken: connection.token !== undefined,
      ...connection.lastCursor === undefined ? {} : { lastCursor: connection.lastCursor },
    };
  }

  public records(program: string, connectionId: string): readonly StoredRecord[] {
    return this.programAgent(program).storedRecords(connectionId);
  }

  public exportEvidence(program: string, connectionId: string): EvidenceBundle {
    return this.programAgent(program).exportEvidence(connectionId);
  }

  public pause(program: string, connectionId: string): void {
    this.programAgent(program).pause(connectionId);
  }

  public resume(program: string, connectionId: string): void {
    this.programAgent(program).resume(connectionId);
  }

  public remove(program: string, connectionId: string): void {
    const connection = this.registry.require(program, connectionId);
    this.programAgent(program).remove(connectionId);
    this.tenantDatabox.delete(connection.tenantId);
  }
}
