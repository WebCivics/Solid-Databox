import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import type { MappingSmithy, SmithyMappingInput, SmithyProgramInput, SmithySourceEventInput } from './MappingSmithy';

export interface RunningForgeApi {
  readonly url: string;
  readonly close: () => Promise<void>;
}

/** Thin JSON control-plane API, intentionally separate from the public Databox data plane. */
export class MappingSmithyHttpApi {
  private readonly basePath: string;

  public constructor(private readonly smithy: MappingSmithy, basePath = '') {
    this.basePath = normalizeBasePath(basePath);
  }

  public async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const route = this.route(request.url);
      if (request.method === 'GET' && route === '/programs') {
        this.json(response, 200, this.smithy.listPrograms());
        return;
      }
      if (request.method === 'POST' && route === '/programs') {
        this.json(response, 201, this.smithy.registerProgram(await readJson<SmithyProgramInput>(request)));
        return;
      }
      if (request.method === 'POST' && route === '/mappings') {
        this.json(response, 201, await this.smithy.forgeMapping(await readJson<SmithyMappingInput>(request)));
        return;
      }
      if (request.method === 'POST' && route === '/source-events') {
        this.json(response, 202, await this.smithy.depositSourceEvent(await readJson<SmithySourceEventInput>(request)));
        return;
      }
      this.json(response, 404, { error: 'not-found' });
    } catch (error: unknown) {
      this.json(response, error instanceof BadRequestHttpError ? 400 : 500, {
        error: error instanceof Error ? error.message : 'Unexpected smithy error.',
      });
    }
  }

  private route(url: string | undefined): string {
    const path = new URL(url ?? '/', 'http://localhost').pathname;
    if (this.basePath.length === 0) {
      return path;
    }
    return path.startsWith(`${this.basePath}/`) ? path.slice(this.basePath.length) : path;
  }

  public async listen(port = 0, hostname = '127.0.0.1'): Promise<RunningForgeApi> {
    const server = createServer((request, response): void => {
      this.handle(request, response).catch((error: unknown): void => {
        response.statusCode = 500;
        response.end(error instanceof Error ? error.message : 'Unexpected smithy error.');
      });
    });
    await new Promise<void>((resolve, reject): void => {
      server.once('error', reject);
      server.listen(port, hostname, resolve);
    });
    const address = server.address() as AddressInfo;
    return {
      url: `http://${hostname}:${address.port}`,
      close: async(): Promise<void> => new Promise<void>((resolve, reject): void => {
        server.close((error): void => error ? reject(error) : resolve());
      }),
    };
  }

  private json(response: ServerResponse, status: number, value: unknown): void {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(value));
  }
}

function normalizeBasePath(value: string): string {
  if (value.length === 0 || value === '/') {
    return '';
  }
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += bytes.length;
    if (size > 1_000_000) {
      throw new BadRequestHttpError('Smithy request body exceeds 1 MB.');
    }
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  } catch {
    throw new BadRequestHttpError('Smithy request body must be valid JSON.');
  }
}

export * from './MappingSmithy';
