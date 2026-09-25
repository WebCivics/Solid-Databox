import { BadRequestHttpError } from '../../../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../../../util/errors/InternalServerError';
import { canonicalDigest } from '../../../proof/Canonicalization';

/**
 * Multi-site project federation (CIV-B25, `community-ledger.html`): a cooperative project spans
 * several sites — several databoxes each holding part of the project's state (their members'
 * contributions, their site ledger). The sites federate: each presents a **federation credential** —
 * a signed statement from the community's federation authority naming the site + the project it may
 * sync — and cross-site replication is gated on that credential. A site without a valid credential
 * cannot pull or push into the federation.
 *
 * The credential is the trust boundary: `issueFederationCredential` mints a credential naming the
 * site, the project and its expiry; `join`/`sync`/`pull` all verify it (issuer, expiry, project
 * scope) — a credential is the ONLY way in, and it can be revoked (federation access is a revocable
 * authority, not a hard-coded trust). Synced project state is attributable per site — each site's
 * ledger contribution is recorded against the credential's site.
 *
 * This pairs with `SharedNamespace` — the federation resolves the project's resources to whichever
 * federated site hosts them, and the credential governs WHO may read/write that shared fabric.
 */

export interface FederationCredential {
  /** The site being admitted (its WebID/site id). */
  readonly site: string;
  /** The project the credential is scoped to. */
  readonly project: string;
  /** The federation authority that issued it. */
  readonly issuer: string;
  /** ISO-8601 expiry — federation membership is time-bounded, re-issued on renewal. */
  readonly expiresAt: string;
  /** A credential signature digest binding the credential's claims. */
  readonly signature: string;
}

export interface SiteState {
  /** The site the state came from. */
  readonly site: string;
  /** The project's state fragment (the site's ledger tail). */
  readonly head: string;
  readonly syncedAt: string;
}

interface FederatedProject {
  readonly project: string;
  readonly members: Map<string, { credential: FederationCredential; revoked: boolean }>;
  readonly state: SiteState[];
}

export class ProjectFederation {
  private readonly projects = new Map<string, FederatedProject>();
  private readonly now: () => string;

  public constructor(
    private readonly federationAuthority: string,
    now: () => string = (): string => new Date().toISOString(),
  ) {
    if (federationAuthority.trim().length === 0) {
      throw new InternalServerError('A federation needs its governing authority id.');
    }
    this.now = now;
  }

  /** Mint a federation credential for a site+project — signed by the authority's digest. */
  public issueFederationCredential(site: string, project: string, expiresAt: string): FederationCredential {
    if (site.trim().length === 0 || project.trim().length === 0 ||
      Number.isNaN(Date.parse(expiresAt))) {
      throw new BadRequestHttpError('A federation credential needs a site, a project and a valid expiry.');
    }
    const base = { site, project, issuer: this.federationAuthority, expiresAt };
    return Object.freeze({ ...base, signature: canonicalDigest(base) });
  }

  /**
   * A site joins the project federation by presenting a valid credential — verified for issuer,
   * signature integrity, project scope and expiry. Fail closed on any violation.
   */
  public join(project: string, credential: FederationCredential): void {
    this.verifyCredential(project, credential);
    const fed = this.project(project, true);
    fed.members.set(credential.site, { credential, revoked: false });
  }

  /**
   * A federated site pushes its project state fragment — gated on a live credential. The state is
   * appended so the project's federated history is attributable per site.
   */
  public sync(project: string, credential: FederationCredential, head: string): void {
    this.authorizeMember(project, credential);
    this.project(project).state.push({ site: credential.site, head, syncedAt: this.now() });
  }

  /** A federated site pulls the project's federated state — gated on a live credential. */
  public pull(project: string, credential: FederationCredential): readonly SiteState[] {
    this.authorizeMember(project, credential);
    return [ ...this.project(project).state ];
  }

  /**
   * Revoke a site's federation membership — a credential is a revocable authority, not a permanent
   * trust. After revocation the site's pushes/pulls all fail closed.
   */
  public revoke(project: string, site: string): void {
    const member = this.projects.get(project)?.members.get(site);
    if (member === undefined) {
      throw new InternalServerError(`'${site}' is not a member of project '${project}'.`);
    }
    this.project(project).members.set(site, { ...member, revoked: true });
  }

  /** The credential-verification primitive: issuer + signature + project + expiry, fail closed. */
  public verifyCredential(project: string, credential: FederationCredential): void {
    if (credential.issuer !== this.federationAuthority) {
      throw new BadRequestHttpError('Federation credential not issued by this authority.');
    }
    if (credential.project !== project) {
      throw new BadRequestHttpError(`Federation credential is scoped to '${credential.project}', not '${project}'.`);
    }
    const { signature, ...claims } = credential;
    if (signature !== canonicalDigest(claims)) {
      throw new BadRequestHttpError('Federation credential signature does not match its claims (tampered).');
    }
    if (Date.parse(this.now()) > Date.parse(credential.expiresAt)) {
      throw new BadRequestHttpError('Federation credential expired.');
    }
  }

  private authorizeMember(
    project: string,
    credential: FederationCredential,
  ): { credential: FederationCredential; revoked: boolean } {
    this.verifyCredential(project, credential);
    const member = this.project(project).members.get(credential.site);
    if (member === undefined) {
      throw new BadRequestHttpError(`'${credential.site}' has not joined project '${project}'.`);
    }
    if (member.revoked) {
      throw new BadRequestHttpError(`'${credential.site}' has been revoked from project '${project}'.`);
    }
    return member;
  }

  private project(project: string, create = false): FederatedProject {
    let fed = this.projects.get(project);
    if (fed === undefined) {
      if (!create) {
        throw new InternalServerError(`Unknown federated project '${project}'.`);
      }
      fed = { project, members: new Map(), state: []};
      this.projects.set(project, fed);
    }
    return fed;
  }
}
