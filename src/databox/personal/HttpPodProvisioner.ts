import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import type { PodProvisioner } from './PersonalOnboardingService';
import type { RemoteFetcher } from './RemoteConsumeClient';

interface Controls {
  readonly controls?: {
    readonly account?: Record<string, string>;
  };
  readonly resource?: string;
  readonly cookie?: string;
}

/**
 * A real {@link PodProvisioner} against the local server's CSS account API (`/.account/`).
 * It follows the self-describing `controls` JSON links — bootstrap → create account → set
 * password → create pod — rather than hard-coding version-bound paths, and fails closed
 * when a required control is absent. Cookies are tracked across the flow (the account API
 * is session-based); the owner's password is sent only to the local server it configures.
 */
export class HttpPodProvisioner implements PodProvisioner {
  private readonly baseUrl: string;

  public constructor(baseUrl: string, private readonly fetcher: RemoteFetcher = defaultFetcher) {
    if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
      throw new BadRequestHttpError('The pod provisioner needs the server base URL.');
    }
    this.baseUrl = trimSlash(baseUrl.trim());
  }

  public async provisionPod(owner: { podName: string; password: string }): Promise<{ podUrl: string; webId: string }> {
    if (owner.podName.trim().length === 0 || owner.password.length < 6) {
      throw new BadRequestHttpError('Pod provisioning needs a pod name and a password of ≥6 chars.');
    }

    const index = await this.call(`${this.baseUrl}/.account/`, 'GET');
    const controls = index.controls?.account;
    const bootstrap = controls?.bootstrap;
    if (bootstrap === undefined) {
      throw new InternalServerError('The account API did not expose a bootstrap control.');
    }

    const boot = await this.call(bootstrap, 'POST', { podName: owner.podName, password: owner.password });
    const cookie = boot.cookie ?? '';
    const accountControls = boot.controls?.account ?? controls;

    const createAccount = accountControls?.account;
    if (createAccount !== undefined) {
      await this.call(createAccount, 'POST', { name: owner.podName, password: owner.password }, cookie);
    }

    const createPod = accountControls?.pod;
    if (createPod === undefined) {
      throw new InternalServerError('The account API did not expose a pod-creation control.');
    }
    const pod = await this.call(createPod, 'POST', { name: owner.podName }, cookie);
    const podUrl = typeof pod.resource === 'string' ? pod.resource : `${this.baseUrl}/${owner.podName}/`;
    const webId = `${trimSlash(podUrl)}/profile/card#me`;
    return { podUrl, webId };
  }

  private async call(url: string, method: string, body?: unknown, cookie = ''): Promise<Controls> {
    const response = await this.fetcher(url, {
      method,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...cookie.length > 0 ? { cookie } : {},
      },
      ...body === undefined ? {} : { body: JSON.stringify(body) },
    });
    if (!response.ok) {
      throw new BadRequestHttpError(`Account API call to ${url} returned ${response.status}.`);
    }
    const json = await response.json() as Controls;
    const setCookie = response.headers?.get?.('set-cookie');
    return { ...json, cookie: setCookie ?? cookie };
  }
}

async function defaultFetcher(
  url: string,
  init?: Parameters<RemoteFetcher>[1],
): ReturnType<RemoteFetcher> {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    json: async(): Promise<unknown> => response.json(),
  };
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
