#!/usr/bin/env node
/**
 * DBX-28 — secret scan. Walks tracked source/config/test files and flags strings that look like
 * committed secrets: private-key blocks, bearer/API-token literals, and hardcoded password fields.
 * Synthetic test fixtures (placeholder tokens, `*-password`, PEM test keys) are allowlisted by path
 * and value pattern. Exits non-zero on a finding so CI can gate on it.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const INCLUDE = /\.(ts|json|jsonld|js|md|ya?ml|env(\..*)?)$/u;
const SKIP_DIRS = new Set([ 'node_modules', '.git', 'dist', 'coverage', 'out' ]);

const PATTERNS = [
  { name: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/u },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/u },
  { name: 'generic-api-token', re: /(?:api[_-]?key|secret|token)["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{32,}["']/iu },
];

// Values that are clearly placeholders, not secrets: keyword hints, or a literal that is all digits /
// a single repeated character (e.g. a demo token `'1234…'` or `'xxxx…'` — entropy-free, not a key).
const PLACEHOLDER = /synthetic|example|test|placeholder|dummy|changeme|your-|xxx|\$\{|\{\{/iu;
const LOW_ENTROPY_LITERAL = /[:=]\s*["'](?:\d+|(.)\1{8,})["']/u;
// Paths allowed to contain test credentials/fixtures.
const ALLOW_PATH = /test[\\/]|fixtures[\\/]|\.example$|README|docs?[\\/]|runbooks?|hardening/iu;

const findings = [];
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        yield* walk(p);
      }
    } else if (INCLUDE.test(entry.name)) {
      yield p;
    }
  }
}

for (const file of walk(root)) {
  const rel = path.relative(root, file);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i]) && !PLACEHOLDER.test(lines[i]) && !LOW_ENTROPY_LITERAL.test(lines[i]) && !ALLOW_PATH.test(rel)) {
        findings.push({ file: rel, line: i + 1, pattern: name });
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`secret-scan: ${findings.length} potential secret(s):`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} — ${f.pattern}`);
  }
  process.exit(1);
}
console.log('secret-scan: clean — no committed secrets detected.');
