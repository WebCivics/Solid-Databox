#!/usr/bin/env node
/**
 * DBX-28 — SBOM generation. Emits a CycloneDX 1.5 software bill of materials for the deployed
 * component set (production dependencies only — dev/test tooling is excluded so the SBOM reflects
 * what actually ships). Output: `databox/ops/sbom.cyclonedx.json`.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function licenseOf(dep) {
  try {
    const dpkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', dep, 'package.json'), 'utf8'));
    return dpkg.license ?? 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

const deps = Object.entries(pkg.dependencies ?? {}).map(([ name, range ]) => {
  let version = range.replace(/^[^0-9]*/u, '');
  try {
    version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
  } catch {
    // Keep the declared range if the package isn't installed locally.
  }
  return {
    type: 'library',
    'bom-ref': `pkg:npm/${name}@${version}`,
    name,
    version: String(version),
    licenses: [{ license: { name: licenseOf(name) } }],
    purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
  };
});

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${Date.now().toString(16)}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      'bom-ref': `pkg:npm/${pkg.name}@${pkg.version}`,
      name: pkg.name,
      version: pkg.version,
      description: 'Solid Databox — privacy-preserving Solid pod server (databox deployment).',
    },
  },
  components: deps,
};

const outDir = path.join(root, 'databox', 'ops');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'sbom.cyclonedx.json');
fs.writeFileSync(out, `${JSON.stringify(sbom, null, 2)}\n`);
console.log(`SBOM written: ${out} (${deps.length} components)`);
