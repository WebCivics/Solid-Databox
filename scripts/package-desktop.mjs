import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const nativeTarget = process.env.DATABOX_NATIVE_TARGET;
const target = resolveTarget(nativeTarget);
const extension = target.platform === 'windows' ? '.exe' : '';
const nativeRelease = nativeTarget ?
    join(root, 'native', 'target', nativeTarget, 'release') :
    join(root, 'native', 'target', 'release');
const output = join(root, 'release', 'Databox IPMS');
const app = join(output, 'payload', 'app');
const helpers = join(output, 'payload', 'bin');

const required = [
  join(nativeRelease, `databox-installer${extension}`),
  join(nativeRelease, `tray-supervisor${extension}`),
  join(nativeRelease, `pos-edge${extension}`),
  join(root, 'dist'),
];
const missing = required.filter(path => !existsSync(path));
if (missing.length > 0) {
  throw new Error(`Desktop package prerequisites are missing:\n${missing.join('\n')}\n\nRun npm run build and npm run build:native first.`);
}

await rm(output, { recursive: true, force: true });
await mkdir(helpers, { recursive: true });
await cp(join(nativeRelease, `databox-installer${extension}`), join(output, `Databox IPMS Setup${extension}`));
for (const helper of [ 'tray-supervisor', 'pos-edge' ]) {
  await cp(join(nativeRelease, `${helper}${extension}`), join(helpers, `${helper}${extension}`));
}
for (const entry of [ 'bin', 'config', 'dist', 'templates', 'patches' ]) {
  if (existsSync(join(root, entry))) {
    await cp(join(root, entry), join(app, entry), { recursive: true });
  }
}
// The server consumes the built admin asset, never the admin project's development dependencies.
if (existsSync(join(root, 'smithy-admin', 'dist'))) {
  await cp(join(root, 'smithy-admin', 'dist'), join(app, 'smithy-admin', 'dist'), { recursive: true });
}
for (const entry of [ 'package.json', 'package-lock.json' ]) {
  await cp(join(root, entry), join(app, entry));
}
const setupCommand = target.platform === 'windows' ?
  `Double-click "Databox IPMS Setup${extension}".` :
  `In Terminal, run: ./"Databox IPMS Setup${extension}"`;
const manifest = {
  schemaVersion: 1,
  product: 'Databox IPMS',
  target: target.triple,
  platform: target.platform,
  architecture: target.architecture,
  nodeVersion: 'v24.18.0',
};
await writeFile(join(output, 'payload', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(output, 'README.txt'), `Databox IPMS\n===========\n\nPackage: ${target.platform} (${target.architecture})\n\n1. ${setupCommand}\n2. Setup downloads a private, checksum-verified Node.js runtime and installs the locked application dependencies.\n3. Setup starts Databox from the notification area. Use the tray icon to open the admin panel, view logs, or start and stop the server.\n\nThe first setup needs an internet connection. It does not use or modify a system-wide Node.js installation.\n`);
console.log(`Desktop package created at ${output}`);

function resolveTarget(value) {
  if (value) {
    const platform = value.includes('windows') ? 'windows' : value.includes('apple-darwin') ? 'macos' : value.includes('linux') ? 'linux' : undefined;
    const architecture = value.startsWith('x86_64') ? 'x64' : value.startsWith('aarch64') ? 'arm64' : undefined;
    if (platform && architecture) {
      return { triple: value, platform, architecture };
    }
    throw new Error(`Unsupported DATABOX_NATIVE_TARGET: ${value}`);
  }

  const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : process.platform === 'linux' ? 'linux' : undefined;
  const architecture = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : undefined;
  if (!platform || !architecture) {
    throw new Error(`Desktop packaging is unsupported on ${process.platform}/${process.arch}.`);
  }
  return { triple: `${platform}-${architecture}`, platform, architecture };
}
