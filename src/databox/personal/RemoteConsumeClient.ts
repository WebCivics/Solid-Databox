import type {
  RetrievedRecordItem,
  SubmissionAcknowledgement,
} from '../agent/AgentTypes';
import type { ProofChallenge, ProvisionalShortLivedToken } from '../credential/ConnectionCredentialTypes';
import type { ExchangeRequest } from '../credential/ProvisionalTokenExchange';
import type { CursorFeedPage } from '../feed/CursorFeed';
import type { ScopedSubmission } from '../agent/ScopedSubmission';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';

/** The response shape remote clients consume. */
export interface RemoteResponse {
  readonly ok: boolean;
  readonly status: number;
  /** Response headers when available (account-API session cookies flow through these). */
  readonly headers?: { get?: (name: string) => string | null };
  json: () => Promise<unknown>;
}

/** The narrow fetch shape the clients need — injectable so tests stay fully offline. */
export type RemoteFetcher = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<RemoteResponse>;

/** The default transport — global `fetch` adapted to the narrow {@link RemoteFetcher} shape. */
async function defaultFetcher(
  url: string,
  init?: Parameters<RemoteFetcher>[1],
): ReturnType<RemoteFetcher> {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status, json: async(): Promise<unknown> => response.json() };
}

/**
 * The person-side HTTP transport for the consumer agent's remote operations (CIV-A07).
 * The organisation databox publishes these operations under `{databox}/.databox/consume/*` —
 * ordinary HTTP, never a private SDK transport (IF-01/IF-02/IF-09). The serving side lands
 * with CIV-C27; this client is the declared contract and fails honestly (non-2xx/malformed →
 * throw) rather than fabricating responses.
 *
 * Deliberately NOT an implementation of the agent's challenge-source/token-exchange
 * interfaces: those are synchronous by design (the organisation issues and verifies in
 * process), and remote transport is inherently async. {@link PersonalVaultService}
 * negotiates the remote session eagerly through these methods and replays it through a
 * session adapter into the agent's sync interfaces.
 */
export class RemoteConsumeClient {
  public constructor(private readonly fetcher: RemoteFetcher = defaultFetcher) {}

  /** IF-01 step 1: ask the addressed databox for a fresh, audience-bound challenge. */
  public async issueChallenge(databox: string): Promise<ProofChallenge> {
    return this.call(
      `${trimSlash(databox)}/.databox/consume/challenge?audience=${encodeURIComponent(databox)}`,
      'GET',
    );
  }

  /** IF-01 step 2: exchange credential + holder proof for a short-lived token. */
  public async exchangeToken(request: ExchangeRequest): Promise<ProvisionalShortLivedToken> {
    const databox = request.databox ?? request.audience;
    return this.call(`${trimSlash(databox)}/.databox/consume/token`, 'POST', request);
  }

  /** IF-02: pull the connection's secured records. */
  public async fetchRecords(token: ProvisionalShortLivedToken): Promise<readonly RetrievedRecordItem[]> {
    return this.call(`${trimSlash(token.audience)}/.databox/consume/records`, 'POST', { token });
  }

  /** IF-02: submit a scoped preference/correction; returns the signed acceptance receipt. */
  public async submit(
    token: ProvisionalShortLivedToken,
    submission: ScopedSubmission,
  ): Promise<SubmissionAcknowledgement> {
    return this.call(`${trimSlash(token.audience)}/.databox/consume/submissions`, 'POST', { token, submission });
  }

  /** IF-09: pull committed events after the cursor for the token's tenant (token-bound). */
  public async pullFeed(
    databox: string,
    token: ProvisionalShortLivedToken,
    tenantId: string,
    sinceCursor?: string,
  ): Promise<CursorFeedPage> {
    const cursor = sinceCursor === undefined || sinceCursor.length === 0 ?
      '' :
      `&cursor=${encodeURIComponent(sinceCursor)}`;
    return this.call(
      `${trimSlash(databox)}/.databox/consume/feed?tenant=${encodeURIComponent(tenantId)}${cursor}`,
      'GET',
      undefined,
      { authorization: `Bearer ${Buffer.from(JSON.stringify(token)).toString('base64url')}` },
    );
  }

  /** Fetch a published BitstringStatusList credential's encoded list (status-list refresh). */
  public async fetchStatusList(statusListCredentialUrl: string): Promise<{ encodedList: string }> {
    return this.call(statusListCredentialUrl, 'GET');
  }

  private async call(
    url: string,
    method: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<never> {
    let response: Awaited<ReturnType<RemoteFetcher>>;
    try {
      response = await this.fetcher(url, {
        method,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...extraHeaders,
        },
        ...body === undefined ? {} : { body: JSON.stringify(body) },
      });
    } catch (error: unknown) {
      throw new InternalServerError(`Databox consume call to ${url} failed: ${String(error)}`);
    }
    if (!response.ok) {
      throw new BadRequestHttpError(`Databox consume call to ${url} returned ${response.status}.`);
    }
    return response.json() as never;
  }
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
