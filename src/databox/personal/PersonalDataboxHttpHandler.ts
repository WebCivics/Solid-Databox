import type { KeyObject } from 'node:crypto';
import { keyObjectFromPublicJwk } from '../credential/Es256';
import type { PublicJwk } from '../credential/ConnectionCredentialTypes';
import type { CredentialsExtractor } from '../../authentication/CredentialsExtractor';
import type { HttpHandlerInput } from '../../server/HttpHandler';
import { HttpHandler } from '../../server/HttpHandler';
import type { HttpRequest } from '../../server/HttpRequest';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { HttpError } from '../../util/errors/HttpError';
import { NotImplementedHttpError } from '../../util/errors/NotImplementedHttpError';
import { UnauthorizedHttpError } from '../../util/errors/UnauthorizedHttpError';
import { ForbiddenHttpError } from '../../util/errors/ForbiddenHttpError';
import type { ScopedSubmissionMeta } from '../agent/ScopedSubmission';
import type { ImportInput, PersonalVaultService } from './PersonalVaultService';
import { PersonalVaultService as PersonalVaultServiceImpl } from './PersonalVaultService';
import { RemoteConsumeClient } from './RemoteConsumeClient';

/**
 * The person-facing Databox HTTP surface (CIV-A07), mounted at `/.databox/personal` on a
 * personal-databox preset. It exposes the consumer-vault operations — connection-credential
 * install, per-program registry, notify-then-pull sync, cursor recovery, evidence export,
 * scoped submission — as ordinary authenticated HTTP on the person's own pod.
 *
 * Authentication is the OWNER's WebID: a request must carry credentials whose agent WebID
 * equals the configured `ownerWebId` — never a shared bearer token (the personal profile
 * has no control plane; ADR-0027). Unknown callers get 401; a wrong-WebID principal gets 403.
 */
export class PersonalDataboxHttpHandler extends HttpHandler {
  private readonly routeBase: string;
  /** `protected` so a test subclass may substitute a stub service after `super()`. */
  protected service: PersonalVaultService;
  private readonly ownerWebId: string;

  public constructor(
    baseUrl: string,
    ownerWebId: string,
    private readonly credentialsExtractor: CredentialsExtractor,
    issuerKeysJson: string,
    routeBase = '/.databox/personal',
  ) {
    super();
    if (typeof ownerWebId !== 'string' || ownerWebId.length === 0) {
      throw new TypeError('A personal Databox requires the owner WebID.');
    }
    if (typeof baseUrl !== 'string' || baseUrl.length === 0) {
      throw new TypeError('A personal Databox requires the server base URL.');
    }
    this.ownerWebId = ownerWebId;
    this.routeBase = normalizeRouteBase(routeBase);
    this.service = new PersonalVaultServiceImpl({
      issuerKeys: parseIssuerKeys(issuerKeysJson),
      remote: new RemoteConsumeClient(),
    });
  }

  public async canHandle({ request }: HttpHandlerInput): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path !== this.routeBase && !path.startsWith(`${this.routeBase}/`)) {
      throw new NotImplementedHttpError('Not a personal Databox route.');
    }
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
    try {
      await this.requireOwner(request);
      response.setHeader('cache-control', 'no-store');
      await this.dispatch(request, response);
    } catch (error: unknown) {
      const status = error instanceof HttpError && typeof error.statusCode === 'number' ?
        error.statusCode :
        500;
      response.statusCode = status;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      if (status === 401) {
        response.setHeader('www-authenticate', 'Bearer scope="openid webid"');
      }
      response.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'personal-databox error',
      }));
    }
  }

  /** Owner-WebID gate: 401 without credentials, 403 for a different WebID. */
  private async requireOwner(request: HttpRequest): Promise<void> {
    const credentials = await this.credentialsExtractor.handleSafe(request);
    const webId = credentials.agent?.webId;
    if (webId === undefined) {
      throw new UnauthorizedHttpError('The personal Databox requires the owner credentials.');
    }
    if (webId !== this.ownerWebId) {
      throw new ForbiddenHttpError('Only the databox owner may use the personal endpoints.');
    }
  }

  private async dispatch(request: HttpRequest, response: HttpHandlerInput['response']): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname.slice(this.routeBase.length) || '/';
    const method = request.method ?? 'GET';
    const program = url.searchParams.get('program') ?? undefined;

    if (method === 'GET' && path === '/') {
      this.json(response, 200, {
        '@type': 'PersonalDatabox',
        routes: [
          'POST /connections',
          'GET /connections?program=…',
          'GET /connections/{id}?program=…',
          'POST /connections/{id}/pause|resume',
          'DELETE /connections/{id}?program=…',
          'POST /connections/{id}/sync',
          'POST /connections/{id}/recover',
          'GET /connections/{id}/records?program=…',
          'GET /connections/{id}/evidence?program=…',
          'POST /connections/{id}/submissions?program=…',
          'POST /status-lists/refresh',
        ],
      });
      return;
    }

    if (method === 'POST' && path === '/connections') {
      const body = await readJson(request);
      this.json(response, 201, this.service.importConnection(body as unknown as ImportInput));
      return;
    }

    if (method === 'GET' && path === '/connections') {
      this.json(response, 200, { connections: this.service.listConnections(requireProgram(program)) });
      return;
    }

    const connectionMatch =
      /^\/connections\/([^/]+)(?:\/(pause|resume|sync|recover|records|evidence|submissions))?$/u.exec(path);
    if (connectionMatch) {
      const connectionId = decodeURIComponent(connectionMatch[1]);
      const sub = connectionMatch[2];
      const scopedProgram = requireProgram(program);

      if (sub === undefined && method === 'GET') {
        this.json(response, 200, this.service.describeConnection(scopedProgram, connectionId));
        return;
      }
      if (sub === undefined && method === 'DELETE') {
        this.service.remove(scopedProgram, connectionId);
        this.json(response, 200, { removed: connectionId });
        return;
      }
      if (sub === 'pause' && method === 'POST') {
        this.service.pause(scopedProgram, connectionId);
        this.json(response, 200, { connectionId, state: 'paused' });
        return;
      }
      if (sub === 'resume' && method === 'POST') {
        this.service.resume(scopedProgram, connectionId);
        this.json(response, 200, { connectionId, state: 'active' });
        return;
      }
      if (sub === 'sync' && method === 'POST') {
        const stored = await this.service.sync(scopedProgram, connectionId);
        this.json(response, 200, { stored: stored.length });
        return;
      }
      if (sub === 'recover' && method === 'POST') {
        const recovered = await this.service.recover(scopedProgram, connectionId);
        this.json(response, 200, { recovered: recovered.length });
        return;
      }
      if (sub === 'records' && method === 'GET') {
        this.json(response, 200, { records: this.service.records(scopedProgram, connectionId) });
        return;
      }
      if (sub === 'evidence' && method === 'GET') {
        this.json(response, 200, this.service.exportEvidence(scopedProgram, connectionId));
        return;
      }
      if (sub === 'submissions' && method === 'POST') {
        const body = await readJson(request);
        const result = await this.service.submit(
          scopedProgram,
          connectionId,
          body.candidate as Readonly<Record<string, unknown>>,
          body.selectedFields as readonly string[],
          body.meta as ScopedSubmissionMeta,
        );
        this.json(response, 200, result);
        return;
      }
    }

    if (method === 'POST' && path === '/status-lists/refresh') {
      const body = await readJson(request);
      const listUrl = body.url;
      if (typeof listUrl !== 'string' || listUrl.length === 0) {
        throw new BadRequestHttpError('status-lists/refresh requires a url.');
      }
      await this.service.refreshStatusList(listUrl);
      this.json(response, 200, { refreshed: listUrl });
      return;
    }

    throw new NotImplementedHttpError(`No personal Databox route for ${method} ${path}.`);
  }

  private json(response: HttpHandlerInput['response'], status: number, body: unknown): void {
    response.statusCode = status;
    response.setHeader('content-type', 'application/ld+json; charset=utf-8');
    response.end(JSON.stringify(body, bufferToBase64));
  }
}

function requireProgram(program: string | undefined): string {
  if (program === undefined || program.length === 0) {
    throw new BadRequestHttpError('A program query parameter is required (per-program isolation).');
  }
  return program;
}

/**
 * Parse the JSON issuer→public-JWK map supplied via the `databoxPersonalIssuerKeys` variable
 * (a `ReadonlyMap<string, KeyObject>` is not expressible in Components.js config). Each key
 * is fail-closed validated as a P-256 public JWK at construction.
 */
function parseIssuerKeys(json: string): ReadonlyMap<string, KeyObject> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new BadRequestHttpError('databoxPersonalIssuerKeys must be a JSON object of issuer→public-JWK.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestHttpError('databoxPersonalIssuerKeys must be a JSON object of issuer→public-JWK.');
  }
  const map = new Map<string, KeyObject>();
  for (const [ issuer, jwk ] of Object.entries(parsed)) {
    map.set(issuer, keyObjectFromPublicJwk(jwk as PublicJwk));
  }
  return map;
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

/** Serialize Buffer payloads honestly (base64) inside evidence exports. */
function bufferToBase64(_key: string, value: unknown): unknown {
  return Buffer.isBuffer(value) ? { encoding: 'base64', data: value.toString('base64') } : value;
}

function normalizeRouteBase(value: string): string {
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}
