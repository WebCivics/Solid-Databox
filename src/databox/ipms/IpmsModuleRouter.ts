import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';

/**
 * Normalise a IPMS control-plane base path to a leading slash and no trailing slash
 * (or the empty string for a root mount), matching the Smithy API's convention.
 */
function normalizeBase(value: string): string {
  if (value.length === 0 || value === '/') {
    return '';
  }
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/**
 * A minimal method + path router for IPMS module control-plane routes
 * (see `databox/solid-ipms-plan.md`, §5.1).
 *
 * It generalises the hardcoded route ladder of {@link MappingSmithyHttpApi} into a table every
 * module registers into: a module contributes `(method, subpath) -> handler` entries under the
 * shared IPMS base (default `/.databox/ipms`), and the router resolves an incoming request to its
 * handler. It is deliberately transport-agnostic — it stores and resolves handlers of a
 * caller-defined type, so it can be unit-tested without an HTTP server and wired into a CSS
 * `HttpHandler` separately.
 */
export class IpmsModuleRouter<THandler = unknown> {
  private readonly base: string;
  private readonly handlers = new Map<string, THandler>();

  public constructor(base = '/.databox/ipms') {
    this.base = normalizeBase(base);
  }

  /** Register a handler for a method + subpath. Fails closed on empty input or a duplicate route. */
  public register(method: string, path: string, handler: THandler): void {
    if (method.length === 0 || path.length === 0) {
      throw new BadRequestHttpError('A IPMS route needs a non-empty method and path.');
    }
    const key = routeKey(method, path);
    if (this.handlers.has(key)) {
      throw new BadRequestHttpError(`A handler is already registered for ${key}.`);
    }
    this.handlers.set(key, handler);
  }

  /** The handler for an incoming method + URL, or `undefined` if no route matches. */
  public resolve(method: string, url: string): THandler | undefined {
    return this.handlers.get(routeKey(method, this.relative(url)));
  }

  /** Strip the IPMS base from a request URL's path, yielding the module-relative subpath. */
  public relative(url: string): string {
    const { pathname } = new URL(url, 'http://localhost');
    if (this.base.length === 0) {
      return pathname;
    }
    if (pathname === this.base) {
      return '/';
    }
    return pathname.startsWith(`${this.base}/`) ? pathname.slice(this.base.length) : pathname;
  }
}
