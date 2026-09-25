import type { KeyObject } from 'node:crypto';
import { BadRequestHttpError } from '../../util/errors/BadRequestHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import type { OwnerKeyBackupBlob } from './OwnerKeyBackup';
import { decryptForOwner, encryptForOwner } from './OwnerKeyBackup';
import type { RemoteFetcher } from './RemoteConsumeClient';

/**
 * The member-side client for the cooperative-hosted fallback (CIV-A08): for a person who
 * cannot run their own box, the coop server provisions their pod and stores their backup —
 * but the backup is owner-key encrypted BEFORE upload, so the coop stores ciphertext only.
 *
 * Endpoints (coop-side serving: {@link CoopMemberHttpHandler}):
 *   POST {coop}/members/pod           → provision the member's pod (member-token auth)
 *   PUT  {coop}/members/{id}/backup   → store an owner-key-encrypted blob
 *   GET  {coop}/members/{id}/backup   → fetch the blob (decrypted locally by the owner)
 */
export class CooperativeMemberClient {
  private readonly apiBase: string;

  public constructor(
    coopApiBase: string,
    private readonly memberToken: string,
    private readonly fetcher: RemoteFetcher = defaultFetcher,
  ) {
    if (typeof coopApiBase !== 'string' || coopApiBase.trim().length === 0 ||
      typeof memberToken !== 'string' || memberToken.trim().length === 0) {
      throw new BadRequestHttpError('A coop member client needs an API base and a member token.');
    }
    this.apiBase = trimSlash(coopApiBase.trim());
  }

  /** Ask the coop to provision the member's pod; returns its URL and the member's WebID. */
  public async provisionPod(memberId: string): Promise<{ podUrl: string; webId: string }> {
    const body = await this.call(`${this.apiBase}/members/pod`, 'POST', { memberId });
    const pod = body as { podUrl?: unknown; webId?: unknown };
    if (typeof pod.podUrl !== 'string' || typeof pod.webId !== 'string') {
      throw new InternalServerError('The coop returned a malformed pod-provisioning result.');
    }
    return { podUrl: pod.podUrl, webId: pod.webId };
  }

  /** Encrypt-then-upload: the coop receives ciphertext it cannot read. */
  public async uploadEncryptedBackup(
    memberId: string,
    podExport: Buffer | string,
    ownerPublicKey: KeyObject,
  ): Promise<void> {
    const blob = encryptForOwner(podExport, ownerPublicKey);
    await this.call(`${this.apiBase}/members/${encodeURIComponent(memberId)}/backup`, 'PUT', blob);
  }

  /** Fetch the stored blob and decrypt locally — plaintext never transits the coop. */
  public async restoreBackup(memberId: string, ownerPrivateKey: KeyObject): Promise<Buffer> {
    const body = await this.call(
      `${this.apiBase}/members/${encodeURIComponent(memberId)}/backup`,
      'GET',
    );
    return decryptForOwner(body as OwnerKeyBackupBlob, ownerPrivateKey);
  }

  private async call(url: string, method: string, body?: unknown): Promise<unknown> {
    let response: Awaited<ReturnType<RemoteFetcher>>;
    try {
      response = await this.fetcher(url, {
        method,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: `Bearer ${this.memberToken}`,
        },
        ...body === undefined ? {} : { body: JSON.stringify(body) },
      });
    } catch (error: unknown) {
      throw new InternalServerError(`Cooperative member call to ${url} failed: ${String(error)}`);
    }
    if (!response.ok) {
      throw new BadRequestHttpError(`Cooperative member call to ${url} returned ${response.status}.`);
    }
    return response.json();
  }
}

async function defaultFetcher(
  url: string,
  init?: Parameters<RemoteFetcher>[1],
): ReturnType<RemoteFetcher> {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status, json: async(): Promise<unknown> => response.json() };
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
