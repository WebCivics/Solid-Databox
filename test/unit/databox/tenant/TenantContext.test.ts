import type { TenantContext } from '../../../../src/databox/tenant/TenantContext';
import {
  boxIdFromTarget,
  freezeTenantContext,
  sameTenant,
  tenantIdOf,
} from '../../../../src/databox/tenant/TenantContext';

const BASE = 'https://databox.example/boxes/';

function context(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: tenantIdOf('org-a', 'prog-a'),
    organisation: 'org-a',
    program: 'prog-a',
    boxId: 'box-a',
    boxRoot: `${BASE}box-a/`,
    relationshipId: 'rel-a',
    origin: undefined,
    audience: 'aud-a',
    serviceIdentity: undefined,
    ...overrides,
  };
}

describe('tenantIdOf', (): void => {
  it('is a deterministic function of the two opaque identifiers.', (): void => {
    expect(tenantIdOf('org-a', 'prog-a')).toBe('org-a/prog-a');
    expect(tenantIdOf('org-a', 'prog-a')).toBe(tenantIdOf('org-a', 'prog-a'));
  });

  it('encodes separators so one scope cannot smithy another scope id.', (): void => {
    // 'a/b' + 'c' must NOT collide with 'a' + 'b/c'.
    expect(tenantIdOf('a/b', 'c')).not.toBe(tenantIdOf('a', 'b/c'));
    expect(tenantIdOf('a/b', 'c')).toBe('a%2Fb/c');
  });
});

describe('sameTenant', (): void => {
  it('is true only when organisation AND program match.', (): void => {
    expect(sameTenant({ organisation: 'o', program: 'p' }, { organisation: 'o', program: 'p' })).toBe(true);
    expect(sameTenant({ organisation: 'o', program: 'p' }, { organisation: 'o', program: 'q' })).toBe(false);
    expect(sameTenant({ organisation: 'o', program: 'p' }, { organisation: 'x', program: 'p' })).toBe(false);
  });
});

describe('boxIdFromTarget', (): void => {
  it('extracts the opaque box segment from a target under the base.', (): void => {
    expect(boxIdFromTarget(`${BASE}box-a/records/x`, BASE)).toBe('box-a');
    expect(boxIdFromTarget(`${BASE}box-a/`, BASE)).toBe('box-a');
    expect(boxIdFromTarget(`${BASE}box-a`, BASE)).toBe('box-a');
  });

  it('fails closed (undefined) for a target outside the base namespace.', (): void => {
    expect(boxIdFromTarget('https://evil.example/boxes/box-a/', BASE)).toBeUndefined();
  });

  it('fails closed (undefined) for a target with no box segment.', (): void => {
    expect(boxIdFromTarget(BASE, BASE)).toBeUndefined();
    expect(boxIdFromTarget(`${BASE}/box-a`, BASE)).toBeUndefined();
  });

  it('fails closed (undefined) for a relative-traversal box segment.', (): void => {
    expect(boxIdFromTarget(`${BASE}./x`, BASE)).toBeUndefined();
    expect(boxIdFromTarget(`${BASE}../x`, BASE)).toBeUndefined();
  });
});

describe('freezeTenantContext', (): void => {
  it('returns a deep-frozen context that cannot be re-pointed after resolution (T-54).', (): void => {
    const frozen = freezeTenantContext(context());
    expect(Object.isFrozen(frozen)).toBe(true);
    expect((): void => {
      (frozen as { tenantId: string }).tenantId = 'other';
    }).toThrow(TypeError);
  });

  it('handles present-but-undefined optional fields without error.', (): void => {
    const frozen = freezeTenantContext(context({ origin: undefined, serviceIdentity: undefined }));
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen.origin).toBeUndefined();
  });
});
