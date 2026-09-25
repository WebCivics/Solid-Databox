// Builds the smithy-admin "Admin" app as a static, backend-free demo and stages
// it into docs/admin/ for GitHub Pages.
//
// The demo build sets VITE_DEMO=true, which makes App.tsx use the in-memory
// demoDataProvider + HashRouter (see smithy-admin/src/App.tsx). The live/dev
// build is unaffected. Relative base (./) lets the output run from any Pages
// sub-path. Cross-platform: no shell-specific env syntax.
//
// Usage: `npm run build:demo` (from the repo root), or run in CI.

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const smithyDir = join(root, 'smithy-admin');
const distDir = join(smithyDir, 'dist');
const outDir = join(root, 'docs', 'admin');

if (!existsSync(join(smithyDir, 'node_modules'))) {
  process.stdout.write('› Installing smithy-admin dependencies …\n');
  execSync('npm ci', { cwd: smithyDir, stdio: 'inherit' });
}

process.stdout.write('› Building smithy-admin demo (VITE_DEMO=true, base=./) …\n');
execSync('npx vite build --base=./', {
  cwd: smithyDir,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEMO: 'true' },
});

process.stdout.write('› Staging build into docs/admin …\n');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(distDir, outDir, { recursive: true });

process.stdout.write('✓ docs/admin refreshed.\n');
