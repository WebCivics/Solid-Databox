import type { HttpHandlerInput } from '../../server/HttpHandler';
import { HttpHandler } from '../../server/HttpHandler';
import type { HttpRequest } from '../../server/HttpRequest';
import type { HttpResponse } from '../../server/HttpResponse';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { HttpError } from '../../util/errors/HttpError';
import { NotImplementedHttpError } from '../../util/errors/NotImplementedHttpError';
import type { HolderProofChallengeSource, TokenExchangeEndpoint } from '../agent/AgentTypes';
import type { ProvisionalShortLivedToken } from '../credential/ConnectionCredentialTypes';
import type { CursorFeed } from '../feed/CursorFeed';
import type { IssuedTokenRegistry, SubmissionProcessor, TenantRecordStore } from './ConsumeApi';

/**
 * The organisation-side `/.databox/consume/*` serving surface (CIV-C27) — the half of the
 * person↔org contract {@link RemoteConsumeClient} calls. Composes the existing in-process
 * implementations (challenge issuer, token exchange, record store, submission processor,
 * cursor feed) behind injected interfaces — ordinary HTTP, never a private transport.
 *
 * Token authentication: a presented provisional token is validated against the org's own
 * {@link IssuedTokenRegistry} issuance record — the token is `notWireFormat` by design
 * (ADR-0005/0006), so the serve-side check is an issuance-recognition check, not bearer
 * trust. The registry binds the tenant at exchange; `feed` is thereby tenant-bound.
 */

export interface ConsumeHandlerDeps {
  /** Issues holder-proof challenges (the org's {@link HolderKeyProofVerifier}). */
  readonly challengeSource: HolderProofChallengeSource;
  /** The credential+proof → provisional token ceremony ({@link ProvisionalTokenExchange}). */
  readonly tokenExchange: TokenExchangeEndpoint;
  /** The org's per-connection servable records. */
  readonly recordStore: TenantRecordStore;
  /** Scoped submission → committed + receipted. */
  readonly submissionProcessor: SubmissionProcessor;
  /** The org's committed-event feed (tenant-scoped by the token). */
  readonly cursorFeed: CursorFeed;
  /** Records issued tokens + validates presented ones + binds the tenant. */
  readonly tokenRegistry: IssuedTokenRegistry;
  /** ConnectionId → tenantId — binds a presented token to its feed tenant. */
  readonly tenantFor: (connectionId: string) => string | undefined;
  /** The published status list, when the org serves one. */
  readonly statusListEncoded?: () => string | undefined;
  /** Injectable clock (epoch ms) for token-expiry checks — defaults to `Date.now`. */
  readonly now?: () => number;
}

export class ConsumeHttpHandler extends HttpHandler {
  private readonly routeBase = '/.databox/consume';

  public constructor(private readonly deps: ConsumeHandlerDeps) {
    super();
  }

  public async canHandle({ request }: HttpHandlerInput): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!path.startsWith(`${this.routeBase}/`)) {
      throw new NotImplementedHttpError('Not a consume route.');
    }
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
    try {
      await this.dispatch(request, response);
    } catch (error: unknown) {
      const status = error instanceof HttpError && typeof error.statusCode === 'number' ?
        error.statusCode :
        500;
      this.json(response, status, { error: error instanceof Error ? error.message : 'Consume error' });
    }
  }

  private async dispatch(request: HttpRequest, response: HttpResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname.slice(this.routeBase.length);
    const method = request.method ?? 'GET';

    if (method === 'GET' && path === '/challenge') {
      const audience = url.searchParams.get('audience');
      if (audience === null || audience.length === 0) {
        throw new BadRequestHttpError('A challenge needs an `audience`.');
      }
      this.json(response, 200, this.deps.challengeSource.issueChallenge(audience));
      return;
    }
    if (method === 'POST' && path === '/token') {
      const exchangeRequest = await readJson<Parameters<TokenExchangeEndpoint['exchange']>[0]>(request);
      const token = this.deps.tokenExchange.exchange(exchangeRequest);
      const tenantId = this.deps.tenantFor(token.connectionId);
      if (tenantId === undefined) {
        throw new BadRequestHttpError(`No tenant bound for connection "${token.connectionId}".`);
      }
      this.deps.tokenRegistry.record(token, tenantId);
      this.json(response, 200, token);
      return;
    }
    if (method === 'POST' && path === '/records') {
      const { token } = await readJson<{ token: ProvisionalShortLivedToken }>(request);
      this.deps.tokenRegistry.validate(token, this.now());
      this.json(response, 200, await this.deps.recordStore.listFor(token.connectionId));
      return;
    }
    if (method === 'POST' && path === '/submissions') {
      const { token, submission } = await readJson<{ token: ProvisionalShortLivedToken; submission: unknown }>(request);
      this.deps.tokenRegistry.validate(token, this.now());
      this.json(response, 200, await this.deps.submissionProcessor.process(token, submission));
      return;
    }
    if (method === 'GET' && path === '/feed') {
      const tenant = url.searchParams.get('tenant');
      const cursor = url.searchParams.get('cursor') ?? undefined;
      const token = bearerToken(request);
      const boundTenant = this.deps.tokenRegistry.validate(token, this.now());
      if (tenant === null || tenant !== boundTenant) {
        throw new BadRequestHttpError('The feed is tenant-bound to the presented token.');
      }
      this.json(response, 200, await this.deps.cursorFeed.pull(tenant, cursor));
      return;
    }
    if (method === 'GET' && path === '/statuslist') {
      const encoded = this.deps.statusListEncoded?.();
      if (encoded === undefined) {
        throw new NotImplementedHttpError('No status list is published by this databox.');
      }
      this.json(response, 200, { encodedList: encoded });
      return;
    }
    throw new NotImplementedHttpError(`No consume route for ${method} ${path}.`);
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  private json(response: HttpResponse, status: number, body: unknown): void {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(body));
  }
}

/** The token presented on the tenant-bound feed route — body or bearer. */
function bearerToken(request: HttpRequest): ProvisionalShortLivedToken {
  const auth = request.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    try {
      return JSON.parse(Buffer.from(auth.slice(7), 'base64url').toString('utf8')) as ProvisionalShortLivedToken;
    } catch {
      throw new BadRequestHttpError('Malformed consume bearer token.');
    }
  }
  const header = request.headers['x-consume-token'];
  if (typeof header === 'string') {
    try {
      return JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as ProvisionalShortLivedToken;
    } catch {
      throw new BadRequestHttpError('Malformed consume token header.');
    }
  }
  throw new BadRequestHttpError('A consume feed request needs a token.');
}

async function readJson<T>(request: HttpRequest): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  } catch {
    throw new BadRequestHttpError('The consume request body must be JSON.');
  }
}
