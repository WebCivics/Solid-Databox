/* eslint-disable max-len */
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { ConflictHttpError } from '../../util/errors/ConflictHttpError';
import { BasicRepresentation } from '../../http/representation/BasicRepresentation';
import type { ResourceStore } from '../../storage/ResourceStore';
import { ensureTrailingSlash } from '../../util/PathUtil';
import type { DurableCommitInput } from '../bridge/DataboxBridge';
import type { ProvisionResult } from '../provisioning/ProvisioningTypes';
import type { DurableCommit } from '../receipt/DurableCommit';

const CONTAINER_TURTLE = '<> a <http://www.w3.org/ns/ldp#BasicContainer>.';

/**
 * Live CSS adapter for the two durable acts owned by the Smithy composition:
 * provisioning the private Solid surface and committing exact accepted record bytes.
 *
 * This adapter deliberately uses CSS's ResourceStore instead of a parallel web server or private data store,
 * so ordinary Solid HTTP retrieval, content negotiation and WAC remain on the normal CSS request path.
 */
export class CssDataboxStore {
  private readonly baseUrl: string;
  private readonly committedDigests = new Map<string, string>();
  private readonly managedRoots = new Map<string, string>();

  public constructor(
    private readonly source: ResourceStore,
    private readonly backend: ResourceStore,
    baseUrl: string,
  ) {
    this.baseUrl = ensureTrailingSlash(new URL(baseUrl).href);
  }

  /** Create idempotent containers and a private WAC boundary for the pairwise holder. */
  public async provision(result: ProvisionResult): Promise<void> {
    const root = ensureTrailingSlash(this.requireLocal(result.databox.root));
    const holder = this.requireSecureWebId(result.relationship.pairwiseWebId);
    this.managedRoots.set(root, holder);

    // Establish each private boundary before adding its resource. Explicit container ACLs keep this adapter independent
    // of any pre-existing ACLs on intermediate paths of a multi-tenant CSS deployment.
    await this.createIfAbsent(`${root}.acl`, this.rootAcl(holder), 'text/turtle');
    await this.createIfAbsent(root, CONTAINER_TURTLE, 'text/turtle');
    for (const container of result.databox.containers) {
      const path = ensureTrailingSlash(this.requireLocal(container));
      const acl = path === `${root}submissions/` ? this.submissionsAcl(holder) : this.rootAcl(holder);
      await this.createIfAbsent(`${path}.acl`, acl, 'text/turtle');
      await this.createIfAbsent(path, CONTAINER_TURTLE, 'text/turtle');
    }
  }

  /** Persist exact accepted bytes before the acceptance receipt can be issued. */
  public async commit(input: DurableCommitInput): Promise<DurableCommit> {
    const resource = this.requireLocal(input.resource);
    const holder = this.findHolder(resource);
    // Give each immutable accepted record a direct, least-privilege ACL. This also avoids relying on inherited ACL
    // discovery for bytes committed through the backend to preserve their signature digest.
    await this.createIfAbsent(`${resource}.acl`, this.resourceAcl(holder, resource), 'text/turtle');
    const knownDigest = this.committedDigests.get(resource);
    if (knownDigest !== undefined) {
      if (knownDigest !== input.payloadDigest) {
        throw new ConflictHttpError('A committed Databox resource cannot be replaced with different bytes.');
      }
      return this.confirm(input);
    }
    if (await this.backend.hasResource({ path: resource })) {
      // After a process restart the in-memory digest cache cannot prove byte equality. Fail closed rather than replace.
      throw new ConflictHttpError('Databox resource already exists and cannot be safely replaced.');
    }
    // Commit through the CSS backend so RDF conversion cannot reserialize the signed bytes. HTTP reads still
    // traverse the normal ResourceStore stack and WAC handler.
    await this.backend.setRepresentation(
      { path: resource },
      new BasicRepresentation([ Buffer.from(input.body.toString('utf8'), 'utf-8') ], input.mediaType, true),
    );
    this.committedDigests.set(resource, input.payloadDigest);
    return this.confirm(input);
  }

  private confirm(input: DurableCommitInput): DurableCommit {
    return {
      eventId: input.eventId,
      committedAt: input.committedAt,
      payloadDigest: input.payloadDigest,
      confirmed: true,
    };
  }

  private async createIfAbsent(path: string, body: string, contentType: string): Promise<void> {
    if (!await this.source.hasResource({ path })) {
      await this.source.setRepresentation({ path }, new BasicRepresentation([ Buffer.from(body, 'utf-8') ], contentType));
    }
  }

  private requireLocal(value: string): string {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestHttpError('A live Databox resource must be an absolute URL.');
    }
    if (!parsed.href.startsWith(this.baseUrl)) {
      throw new BadRequestHttpError('A live Databox resource must be below this CSS base URL.');
    }
    return parsed.href;
  }

  private requireSecureWebId(value: string): string {
    try {
      const parsed = new URL(value);
      const loopback = parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1');
      if (parsed.protocol !== 'https:' && !loopback) {
        throw new Error('not https');
      }
      return parsed.href;
    } catch {
      throw new BadRequestHttpError('The pairwise holder WebID must be an absolute HTTPS or HTTP loopback URL.');
    }
  }

  private rootAcl(holder: string): string {
    return `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
<#holder> a acl:Authorization;
  acl:agent <${holder}>;
  acl:accessTo <./>;
  acl:default <./>;
  acl:mode acl:Read.`;
  }

  private submissionsAcl(holder: string): string {
    return `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
<#holder> a acl:Authorization;
  acl:agent <${holder}>;
  acl:accessTo <./>;
  acl:default <./>;
  acl:mode acl:Read, acl:Append.`;
  }

  private resourceAcl(holder: string, resource: string): string {
    return `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
<#holder> a acl:Authorization;
  acl:agent <${holder}>;
  acl:accessTo <${resource}>;
  acl:mode acl:Read.`;
  }

  private findHolder(resource: string): string {
    const matches = [ ...this.managedRoots.entries() ]
      .filter(([ root ]): boolean => resource.startsWith(root))
      .sort(([ left ], [ right ]): number => right.length - left.length);
    if (matches.length === 0) {
      throw new BadRequestHttpError('The Databox resource has not been provisioned by this Smithy instance.');
    }
    return matches[0][1];
  }
}
