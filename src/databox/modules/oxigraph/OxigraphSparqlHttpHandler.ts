import type { HttpHandlerInput } from '../../../server/HttpHandler';
import { HttpHandler } from '../../../server/HttpHandler';
import type { HttpRequest } from '../../../server/HttpRequest';
import { BadRequestHttpError } from '../../../util/errors/BadRequestHttpError';
import { HttpError } from '../../../util/errors/HttpError';
import { NotImplementedHttpError } from '../../../util/errors/NotImplementedHttpError';
import type { SparqlEngine } from '../rdf/SparqlEngine';

/**
 * The module's SPARQL-over-HTTP surface (the modularised form of `scripts/oxigraph-wasm-
 * server.mjs`): `POST {base}/query` (SPARQL 1.1 Query) and `POST {base}/update` (SPARQL 1.1
 * Update), backed by the WASM store — no external endpoint, works identically on a
 * personal pod or an organisation databox.
 *
 * Auth is an injected `authorize` predicate (owner-WebID on a personal pod, the control
 * token or WAC on an org databox). When none is supplied the handler serves unauthenticated
 * — a deliberate explicit choice at wiring, not a hidden default; deployments that must
 * not expose the graph supply the authorizer.
 */
export type SparqlAuthorizer = (request: HttpRequest) => Promise<void>;

export class OxigraphSparqlHttpHandler extends HttpHandler {
  private readonly routeBase: string;

  public constructor(
    private readonly module: SparqlEngine,
    private readonly authorize?: SparqlAuthorizer,
    routeBase = '/.databox/sparql',
  ) {
    super();
    this.routeBase = routeBase.endsWith('/') ? routeBase.slice(0, -1) : routeBase;
  }

  public async canHandle({ request }: HttpHandlerInput): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!path.startsWith(`${this.routeBase}/`) && path !== this.routeBase) {
      throw new NotImplementedHttpError('Not a SPARQL route.');
    }
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
    try {
      if (this.authorize !== undefined) {
        await this.authorize(request);
      }
      await this.dispatch(request, response);
    } catch (error: unknown) {
      const status = error instanceof HttpError && typeof error.statusCode === 'number' ?
        error.statusCode :
        500;
      response.statusCode = status;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'SPARQL error' }));
    }
  }

  private async dispatch(
    request: HttpRequest,
    response: HttpHandlerInput['response'],
  ): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname.slice(this.routeBase.length);
    const method = request.method ?? 'POST';
    const body = await readText(request);

    if (method === 'POST' && path === '/query') {
      this.json(response, 200, await this.module.query(sparqlFrom(body, request)));
      return;
    }
    if (method === 'POST' && path === '/update') {
      await this.module.update(sparqlFrom(body, request));
      this.json(response, 200, { ok: true });
      return;
    }
    if (method === 'GET' && path === '/dump') {
      this.json(response, 200, { nquads: await this.module.dump() });
      return;
    }
    throw new NotImplementedHttpError(`No SPARQL route for ${method} ${path}.`);
  }

  private json(response: HttpHandlerInput['response'], status: number, body: unknown): void {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(body));
  }
}

/**
 * The SPARQL protocol carries the query either as `application/sparql-query` (raw body),
 * `application/x-www-form-urlencoded` (`query=` / `update=`), or the module's JSON form
 * (`{ "query": … }` / `{ "update": … }`).
 */
function sparqlFrom(body: string, request: HttpRequest): string {
  const contentType = typeof request.headers['content-type'] === 'string' ?
    request.headers['content-type'] :
    '';
  if (contentType.includes('application/sparql-query') || contentType.includes('application/sparql-update')) {
    return body;
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(body);
    const value = params.get('query') ?? params.get('update');
    if (value !== null) {
      return value;
    }
    throw new BadRequestHttpError('Form body must carry `query` or `update`.');
  }
  try {
    const parsed = JSON.parse(body) as { query?: unknown; update?: unknown };
    const value = parsed.query ?? parsed.update;
    if (typeof value === 'string') {
      return value;
    }
  } catch {
    // Fall through to treating the body as raw SPARQL.
  }
  return body;
}

async function readText(request: HttpRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}
