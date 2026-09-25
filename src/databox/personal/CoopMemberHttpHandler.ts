import type { HttpHandlerInput } from '../../server/HttpHandler';
import { HttpHandler } from '../../server/HttpHandler';
import type { HttpRequest } from '../../server/HttpRequest';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { HttpError } from '../../util/errors/HttpError';
import { NotFoundHttpError } from '../../util/errors/NotFoundHttpError';
import { NotImplementedHttpError } from '../../util/errors/NotImplementedHttpError';
import { UnauthorizedHttpError } from '../../util/errors/UnauthorizedHttpError';
import { ForbiddenHttpError } from '../../util/errors/ForbiddenHttpError';
import type { PodProvisioner } from './PersonalOnboardingService';

/**
 * The cooperative-hosted side of CIV-A08, mounted at `/.databox/coop` on the coop's
 * (organisation-profile) databox. It serves the member surface {@link
 * CooperativeMemberClient} speaks to: pod provisioning for members who cannot run a box,
 * and opaque owner-key-encrypted backup storage the coop can hold but never read.
 *
 * Dependencies are injected interfaces so the coop deployment composes its own member
 * registry/pod store/backup store; the handler enforces member-token auth and that a
 * member can only ever address THEIR OWN resources (`/members/{id}` must equal the
 * authenticated member — cross-member access is a 403, and absent resources 404).
 */

/** Resolves a member token to its member id — or `undefined` when invalid. */
export interface MemberAuthenticator {
  authenticate: (token: string) => Promise<string | undefined>;
}

/** The coop's opaque blob store for encrypted member backups. */
export interface MemberBackupStore {
  put: (memberId: string, blob: unknown) => Promise<void>;
  get: (memberId: string) => Promise<unknown>;
}

export class CoopMemberHttpHandler extends HttpHandler {
  private readonly routeBase: string;

  public constructor(
    private readonly authenticator: MemberAuthenticator,
    private readonly podProvisioner: PodProvisioner,
    private readonly backupStore: MemberBackupStore,
    routeBase = '/.databox/coop',
  ) {
    super();
    this.routeBase = normalizeRouteBase(routeBase);
  }

  public async canHandle({ request }: HttpHandlerInput): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path !== this.routeBase && !path.startsWith(`${this.routeBase}/`)) {
      throw new NotImplementedHttpError('Not a cooperative member route.');
    }
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
    try {
      const memberId = await this.requireMember(request);
      response.setHeader('cache-control', 'no-store');
      await this.dispatch(request, response, memberId);
    } catch (error: unknown) {
      const status = error instanceof HttpError && typeof error.statusCode === 'number' ?
        error.statusCode :
        500;
      response.statusCode = status;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'cooperative-member error',
      }));
    }
  }

  /** Member-token auth → member id. 401 without a valid token. */
  private async requireMember(request: HttpRequest): Promise<string> {
    const header = request.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ?
        header.slice('Bearer '.length) :
      undefined;
    const memberId = token === undefined ? undefined : await this.authenticator.authenticate(token);
    if (memberId === undefined) {
      throw new UnauthorizedHttpError('A cooperative member token is required.');
    }
    return memberId;
  }

  private async dispatch(
    request: HttpRequest,
    response: HttpHandlerInput['response'],
    memberId: string,
  ): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname.slice(this.routeBase.length) || '/';
    const method = request.method ?? 'GET';

    if (method === 'POST' && path === '/members/pod') {
      const body = await readJson(request);
      const requested = body.memberId;
      // A member provisions only their own pod — a mismatch is a 403, never silent.
      if (requested !== undefined && requested !== memberId) {
        throw new ForbiddenHttpError('A member may only provision their own pod.');
      }
      const result = await this.podProvisioner.provisionPod({
        podName: typeof body.podName === 'string' && body.podName.length > 0 ? body.podName : memberId,
        password: typeof body.password === 'string' ? body.password : '',
      });
      this.json(response, 201, result);
      return;
    }

    const backupMatch = /^\/members\/([^/]+)\/backup$/u.exec(path);
    if (backupMatch) {
      const target = decodeURIComponent(backupMatch[1]);
      if (target !== memberId) {
        throw new ForbiddenHttpError('A member may only address their own backup.');
      }
      if (method === 'PUT') {
        await this.backupStore.put(memberId, await readJson(request));
        this.json(response, 200, { stored: true });
        return;
      }
      if (method === 'GET') {
        const blob = await this.backupStore.get(memberId);
        if (blob === undefined) {
          throw new NotFoundHttpError();
        }
        this.json(response, 200, blob);
        return;
      }
    }

    throw new NotImplementedHttpError(`No cooperative member route for ${method} ${path}.`);
  }

  private json(response: HttpHandlerInput['response'], status: number, body: unknown): void {
    response.statusCode = status;
    response.setHeader('content-type', 'application/ld+json; charset=utf-8');
    response.end(JSON.stringify(body));
  }
}

async function readJson(request: HttpRequest): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new BadRequestHttpError('Request body must be valid JSON.');
  }
}

function normalizeRouteBase(value: string): string {
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}
