import type { CredentialsExtractor } from '../../../authentication/CredentialsExtractor';
import type { HttpHandlerInput } from '../../../server/HttpHandler';
import { HttpHandler } from '../../../server/HttpHandler';
import type { HttpRequest } from '../../../server/HttpRequest';
import type { HttpResponse } from '../../../server/HttpResponse';
import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import { HttpError } from '../../../util/errors/HttpError';
import { NotImplementedHttpError } from '../../../util/errors/NotImplementedHttpError';
import { UnauthorizedHttpError } from '../../../util/errors/UnauthorizedHttpError';
import type { DisputeResolver } from './GuardianNetwork';
import type { GuardianshipRelation } from './Guardianship';
import type { HouseholdService } from './HouseholdService';
import type { WardDecisionRequest } from './WardDecisions';
import type { SpecialistAccessGrant } from './SpecialistAccess';

/**
 * The household HTTP surface (CIV-A14), mounted at `/.databox/household` on a personal
 * (family/share-house) preset — the reachable face of the guardianship layer.
 *
 * Callers are *members*, resolved from their authenticated WebID (`member.webId`): a
 * parent in a second household, a kinship carer, a supporter — each acts under their own
 * identity, never as the box owner. Dispute resolvers authenticate under their own WebID
 * matched to the declared resolver's agentId — they need not be members.
 *
 * Fail-closed: 401 without credentials, 403 for an unbound WebID, and the requester/
 * approver/asserter is ALWAYS the caller's memberId — never a body field (no one may
 * act as someone else by naming them).
 */
export class HouseholdHttpHandler extends HttpHandler {
  private readonly routeBase = '/.databox/household';

  public constructor(
    private readonly service: HouseholdService,
    private readonly credentialsExtractor: CredentialsExtractor,
  ) {
    super();
  }

  public async canHandle({ request }: HttpHandlerInput): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path !== this.routeBase && !path.startsWith(`${this.routeBase}/`)) {
      throw new NotImplementedHttpError('Not a household route.');
    }
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
    try {
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
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'household error' }));
    }
  }

  private async dispatch(request: HttpRequest, response: HttpResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname.slice(this.routeBase.length) || '/';
    const method = request.method ?? 'GET';
    const callerWebId = await this.requireWebId(request);

    // The resolver route is the ONE external surface — the resolver authenticates as their
    // own WebID (matched to the declared resolver inside). Handled before member resolution.
    const disputeMatch = /^\/disputes\/([^/]+)\/resolve$/u.exec(path);
    if (disputeMatch && method === 'POST') {
      const body = await readJson(request);
      this.json(response, 200, this.service.resolveDispute(
        decodeURIComponent(disputeMatch[1]),
        callerWebId,
        body.determination as 'uphold' | 'deny' | 'remit',
        typeof body.rationale === 'string' ? body.rationale : '',
      ));
      return;
    }

    // Every other route requires a caller bound to a household member — a stranger can't
    // even enumerate the surface.
    const caller = this.service.memberForWebId(callerWebId);

    if (method === 'GET' && path === '/') {
      this.json(response, 200, {
        '@type': 'Household',
        routes: [
          'POST /relations',
          'GET /relations?ward=…',
          'GET /recipes',
          'GET /recipes/{id}',
          'POST /decisions',
          'GET /decisions/{id}',
          'POST /decisions/{id}/decide',
          'POST /decisions/{id}/dispute',
          'POST /disputes/{requestId}/resolve',
          'POST /specialist-access',
          'POST /specialist-access/{id}/revoke',
          'GET /specialist-access',
        ],
      });
      return;
    }

    // ---- Guardian relations ------------------------------------------------
    if (method === 'POST' && path === '/relations') {
      const body = await readJson(request);
      this.service.addRelation(caller, body as unknown as GuardianshipRelation);
      this.json(response, 201, { added: body.guardianId });
      return;
    }
    if (method === 'GET' && path === '/relations') {
      const ward = url.searchParams.get('ward');
      if (ward === null || ward.length === 0) {
        throw new BadRequestHttpError('relations requires a `ward` query parameter.');
      }
      this.json(response, 200, {
        relations: this.service.relationsFor(ward, url.searchParams.get('household') ?? undefined),
      });
      return;
    }

    // ---- Recipes ------------------------------------------------------------
    if (method === 'GET' && path === '/recipes') {
      this.json(response, 200, {
        recipes: this.service.listRecipes().map(recipe => ({
          id: recipe.id,
          name: recipe.name,
          scope: recipe.scope,
          consentRule: recipe.consentRule,
          wardVoice: recipe.wardVoice,
          appliesToCapacity: recipe.appliesToCapacity,
          rightsAnchors: recipe.rightsAnchors,
        })),
      });
      return;
    }
    const recipeMatch = /^\/recipes\/([^/]+)$/u.exec(path);
    if (method === 'GET' && recipeMatch) {
      const recipe = this.service.recipe(decodeURIComponent(recipeMatch[1]));
      this.json(response, 200, recipe);
      return;
    }

    // ---- Ward decisions ------------------------------------------------------
    if (method === 'POST' && path === '/decisions') {
      const body = await readJson(request);
      const decision = this.service.requestDecision(
        caller,
        body as unknown as Omit<WardDecisionRequest, 'requesterId'>,
      );
      this.json(response, 201, decision);
      return;
    }
    const decisionMatch = /^\/decisions\/([^/]+)(?:\/(decide|dispute))?$/u.exec(path);
    if (decisionMatch) {
      const requestId = decodeURIComponent(decisionMatch[1]);
      const sub = decisionMatch[2];
      if (sub === undefined && method === 'GET') {
        this.json(response, 200, this.service.getDecision(requestId));
        return;
      }
      if (sub === 'decide' && method === 'POST') {
        const body = await readJson(request);
        this.json(
          response,
          200,
          await this.service.decideDecision(requestId, caller, body.approve === true),
        );
        return;
      }
      if (sub === 'dispute' && method === 'POST') {
        const body = await readJson(request);
        this.json(response, 201, this.service.openDispute(requestId, body as unknown as DisputeResolver));
        return;
      }
    }

    // ---- Specialist access -----------------------------------------------------
    if (method === 'POST' && path === '/specialist-access') {
      const body = await readJson(request);
      this.json(
        response,
        201,
        this.service.assertSpecialistAccess(
          caller,
          body as unknown as Omit<SpecialistAccessGrant, 'assertedBy' | 'assertedAt' | 'status'>,
        ),
      );
      return;
    }
    const accessMatch = /^\/specialist-access\/([^/]+)\/revoke$/u.exec(path);
    if (accessMatch && method === 'POST') {
      this.json(
        response,
        200,
        this.service.revokeSpecialistAccess(caller, decodeURIComponent(accessMatch[1])),
      );
      return;
    }
    if (method === 'GET' && path === '/specialist-access') {
      this.json(response, 200, { grants: this.service.listSpecialistAccess() });
      return;
    }

    throw new NotImplementedHttpError(`No household route for ${method} ${path}.`);
  }

  /** Authenticate → WebID. Members resolve to memberId inside the service; resolvers use it raw. */
  private async requireWebId(request: HttpRequest): Promise<string> {
    const credentials = await this.credentialsExtractor.handleSafe(request);
    const webId = credentials.agent?.webId;
    if (webId === undefined) {
      throw new UnauthorizedHttpError('The household surface requires an authenticated WebID.');
    }
    return webId;
  }

  private json(response: HttpResponse, status: number, body: unknown): void {
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new BadRequestHttpError('Request body must be valid JSON.');
  }
}
