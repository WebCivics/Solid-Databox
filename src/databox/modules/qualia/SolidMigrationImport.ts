/**
 * Import a Qualia leave/migrate Solid bundle via LDP PUT.
 *
 * Bundle shape comes from Qualia `export_solid_migration_wasm` /
 * `SolidExporter::export_to_solid_pod` — RDF only (no Quins on the Pod).
 *
 * @see databox/devdocs/handoffs/qualia-leave-migrate.md
 */

export interface QualiaSolidMigrationBundle {
  turtle?: string;
  nquads?: string;
  jsonld?: string;
  acl?: string;
  manifest_jsonld: string;
}

export interface ImportQualiaSolidBundleOptions {
  /** Target LDP container URL (with or without trailing slash). */
  containerUrl: string;
  fetch: typeof fetch;
  authorization?: string;
  bundle: QualiaSolidMigrationBundle;
}

export async function importQualiaSolidBundle(
  opts: ImportQualiaSolidBundleOptions,
): Promise<{ base: string }> {
  const base = opts.containerUrl.endsWith('/')
    ? opts.containerUrl
    : `${opts.containerUrl}/`;

  const headers = (contentType: string): HeadersInit => ({
    'Content-Type': contentType,
    ...(opts.authorization ? { Authorization: opts.authorization } : {}),
  });

  const put = async(name: string, body: string, type: string): Promise<void> => {
    const res = await opts.fetch(new URL(name, base), {
      method: 'PUT',
      headers: headers(type),
      body,
    });
    if (!res.ok) {
      throw new Error(`PUT ${name} failed: ${res.status} ${await res.text()}`);
    }
  };

  if (opts.bundle.turtle) {
    await put('data.ttl', opts.bundle.turtle, 'text/turtle');
  }
  if (opts.bundle.nquads) {
    await put('data.nq', opts.bundle.nquads, 'application/n-quads');
  }
  if (opts.bundle.jsonld) {
    await put('data.jsonld', opts.bundle.jsonld, 'application/ld+json');
  }
  if (opts.bundle.acl) {
    await put('data.ttl.acl', opts.bundle.acl, 'text/turtle');
  }
  await put('manifest.jsonld', opts.bundle.manifest_jsonld, 'application/ld+json');
  return { base };
}
