import {
  issueDeviceFallbackCredential,
  verifyDeviceFallback,
} from '../../../../../../src/databox/ipms/modules/device-auth/DeviceFallbackAuth';

function issue(over = {}) {
  return issueDeviceFallbackCredential({
    deviceId: 'https://pod.example/devices/sensor#thing',
    dpopJkt: 'jkt-device-key',
    scopes: [ 'devices/sensor/telemetry' ],
    expiresAt: '2027-01-01T00:00:00Z',
    ...over,
  });
}

describe('DeviceFallbackAuth — client-credentials+DPoP for non-mTLS devices (CIV-B36)', (): void => {
  it('issues a scoped credential and stores only the secret hash — never plaintext.', (): void => {
    const { credential, stored } = issue();
    expect(stored.secretHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(stored).not.toHaveProperty('clientSecret'); // Plaintext goes to the device once, not stored.
    const ok = verifyDeviceFallback(stored, {
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      dpopJkt: 'jkt-device-key',
      requestedScope: 'devices/sensor/telemetry',
    });
    expect(ok.scope).toBe('devices/sensor/telemetry');
  });

  it('rejects a wrong secret, an unbound DPoP key, and an out-of-scope ask — fail closed.', (): void => {
    const { credential, stored } = issue();
    expect((): unknown => verifyDeviceFallback(stored, {
      clientId: credential.clientId,
      clientSecret: 'wrong',
      dpopJkt: 'jkt-device-key',
      requestedScope: 'devices/sensor/telemetry',
    })).toThrow('secret');
    expect((): unknown => verifyDeviceFallback(stored, {
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      dpopJkt: 'jkt-stolen',
      requestedScope: 'devices/sensor/telemetry',
    })).toThrow('not bound'); // Stolen secret without the DPoP key → rejected.
    expect((): unknown => verifyDeviceFallback(stored, {
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      dpopJkt: 'jkt-device-key',
      requestedScope: 'admin/', // A scope the credential doesn't cover.
    })).toThrow('outside');
  });

  it('fails closed on issue with no scope or no expiry — a fallback is never pod-wide.', (): void => {
    expect((): unknown => issue({ scopes: []})).toThrow('scope');
    expect((): unknown => issue({ expiresAt: 'not-a-date' })).toThrow('expiresAt');
  });
});
