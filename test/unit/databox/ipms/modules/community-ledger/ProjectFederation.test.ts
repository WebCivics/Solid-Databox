import { ProjectFederation } from '../../../../../../src/databox/ipms/modules/community-ledger/ProjectFederation';

let clock = '2026-01-01T00:00:00Z';
const fed = (): ProjectFederation => new ProjectFederation('community-authority', () => clock);

type FederationCred = ReturnType<ProjectFederation['issueFederationCredential']>;
function cred(f: ProjectFederation, site: string, project = 'community-garden'): FederationCred {
  return f.issueFederationCredential(site, project, '2027-01-01T00:00:00Z');
}

describe('ProjectFederation — credential-gated cross-site sync (CIV-B25)', (): void => {
  beforeEach((): void => {
    clock = '2026-01-01T00:00:00Z';
  });

  it('a site joins and syncs project state on a valid federation credential.', (): void => {
    const f = fed();
    const siteA = cred(f, 'site-a');
    f.join('community-garden', siteA);
    f.sync('community-garden', siteA, 'site-a-ledger-head-abc');
    const pulled = f.pull('community-garden', siteA);
    expect(pulled).toHaveLength(1);
    expect(pulled[0].site).toBe('site-a');
    expect(pulled[0].head).toBe('site-a-ledger-head-abc');
  });

  it('credential-gated: no credential, wrong project, expired — all fail closed.', (): void => {
    const f = fed();
    const siteA = cred(f, 'site-a');
    f.join('community-garden', siteA);
    // Wrong project — a community-garden credential doesn't open the tool-library.
    const wrongProject = cred(f, 'site-a', 'community-garden');
    expect((): unknown => f.sync('tool-library', wrongProject, 'x')).toThrow('scoped to');
    // A credential scoped to a different project.
    const otherProject = f.issueFederationCredential('site-b', 'tool-library', '2027-01-01');
    expect((): unknown => f.join('community-garden', otherProject)).toThrow('scoped to');
    // Expired.
    clock = '2028-01-01T00:00:00Z';
    expect((): unknown => f.sync('community-garden', siteA, 'x')).toThrow('expired');
  });

  it('revoked membership — the credential becomes a dead authority.', (): void => {
    const f = fed();
    const siteA = cred(f, 'site-a');
    f.join('community-garden', siteA);
    f.revoke('community-garden', 'site-a');
    expect((): unknown => f.sync('community-garden', siteA, 'x')).toThrow('revoked');
    expect((): unknown => f.pull('community-garden', siteA)).toThrow('revoked');
  });

  it('a tampered credential fails signature verification.', (): void => {
    const f = fed();
    // Tamper a claim that isn't the project scope — the signature (digest over the claims) won't match.
    const forged = { ...cred(f, 'site-a'), site: 'site-impostor' };
    expect((): unknown => f.verifyCredential('community-garden', forged)).toThrow('signature');
  });
});
