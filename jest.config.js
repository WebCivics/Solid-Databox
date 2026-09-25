const os = require('node:os');
const v8 = require('node:v8');

// Several parts inspired by https://github.com/renovatebot/renovate/blob/main/package.json

const ci = Boolean(process.env.CI);

const cpus = os.cpus();
const mem = os.totalmem();
const stats = v8.getHeapStatistics();

if (ci) {
  process.stderr.write(`Host stats:
  Cpus:      ${cpus.length}
  Memory:    ${(mem / 1024 / 1024 / 1024).toFixed(2)} GB
  HeapLimit: ${(stats.heap_size_limit / 1024 / 1024 / 1024).toFixed(2)} GB
`);
}

// See also https://github.com/jestjs/jest/issues/11956
function jestGithubRunnerSpecs() {
  return {
    maxWorkers: cpus.length,
    workerIdleMemoryLimit: '1500MB',
  };
}

// ESM libraries that need to be transformed so Jest can handle them
const esModules = [
  // `jose` v6 and `uuid` v14 are ESM-only ("type": "module", no CJS build).
  // The `@inrupt/solid-client-authn-*` packages depend on those versions, while this project uses
  // jose v4 / uuid v9, so npm nests the ESM copies inside those packages' own `node_modules`.
  // `transformIgnorePatterns` is matched against the full path, and would match at the *first*
  // `/node_modules/` segment (followed by `@inrupt/`), so the `@inrupt` packages have to be listed
  // here as well for the nested ESM dependencies to be reached and transformed.
  'jose',
  'uuid',
  '@inrupt/solid-client-authn-core',
  '@inrupt/solid-client-authn-node',
  'oidc-provider',
  'nanoid',
  'got',
  'quick-lru',
  '@sindresorhus/is',
  'p-cancelable',
  '@szmarczak/http-timer',
  'cacheable-request',
  'normalize-url',
  'responselike',
  'lowercase-keys',
  'mimic-response',
  'form-data-encoder',
  'cacheable-lookup',
  // ESM-only packages added in latest dependency upgrade
  'cookie',
  'url-join',
  'escape-string-regexp',
  '@isaacs/ttlcache',
  'rdf-validate-shacl',
  'shacl-engine',
  'grapoi',
  'rdf-literal',
  'rdf-validation',
  'rdf-ext',
  'oxigraph',
  '@rdfjs/term-set',
  '@rdfjs/environment',
  '@rdfjs/data-model',
  '@rdfjs/dataset',
  '@rdfjs/namespace',
  '@rdfjs/term-map',
  '@rdfjs/to-ntriples',
  'clownface',
  'set-cookie-parser',
  'marked',
  'bcryptjs',
  'yargs',
  'yargs-parser',
  '@solid/access-control-policy',
  'rdf-validate-datatype',
  'raw-body',
  'formidable',
  '@tpluscode/rdf-ns-builders',
  '@zazuko/prefixes',
  '@traqula',
  'anynum',
  'strnum',
  'htmlparser2',
  'micromark',
  'micromark-core-commonmark',
  'micromark-extension',
  'micromark-factory',
  'micromark-util',
  'devlop',
  'decode-named-character-reference',
  'character-entities',
  'character-reference-invalid',
  'is-alphabetical',
  'is-alphanumerical',
  'is-hexadecimal',
  'is-decimal',
  'parse-entities',
  'strip-indent',
  'indent-string',
  'eta',
  'color',
  'color-convert',
  'color-name',
  'color-string',
  'ansi-regex',
  'string-width',
  'strip-ansi',
  'wrap-ansi',
  'cliui',
  '@isaacs/cliui',
  'chalk',
  'y18n',
  'flatted',
  'glob',
  'minipass',
  'path-scurry',
  'foreground-child',
  'jackspeak',
  'pathe',
  'tinyglobby',
  'tinyexec',
  'unicorn-magic',
  'synckit',
  'stable-hash-x',
  'object-deep-merge',
  'argue-cli',
  'get-east-asian-width',
  'find-up-simple',
  'is-path-inside',
  'is-plain-obj',
  'is-unsafe',
  'builtin-modules',
  'detect-indent',
  'fd-package-json',
  'package-json-from-dist',
  'get-tsconfig',
  'get-package-type',
  'resolve-pkg-maps',
  'parse-imports-exports',
  'parse-statements',
  'path-expression-matcher',
  'xml-naming',
  'fast-xml-parser',
  'fast-xml-builder',
  'smol-toml',
  'jiti',
  'ts-api-utils',
  'ts-declaration-location',
  '@pkgr/core',
  'change-case',
  'are-docs-informative',
  'eslint-scope',
  'eslint-visitor-keys',
  'espree',
  'eslint-regex',
  '@eslint',
  '@humanfs',
  '@humanwhocodes',
  '@ungap/structured-clone',
  '@shikijs',
  '@nodable/entities',
  '@simple-libs',
  '@conventional-changelog',
  'conventional-changelog',
  'conventional-commits',
  'conventional-recommended-bump',
  'markdownlint',
  'markdownlint-cli2',
  'micromark-util',
  'opinionated-eslint-config',
  'eslint-plugin-antfu',
  'eslint-plugin-unicorn',
  'eslint-flat-config-utils',
  '@stylistic/eslint-plugin',
  '@es-joy/jsdoccomment',
  'jsdoc-type-pratt-parser',
  'lru-cache',
  'node-releases',
  'baseline-browser-mapping',
  'walk-up-path',
  'global-directory',
  'argue-cli',
  'is-builtin-module',
  'parse-entities',
  '@vocabulary/sh',
];

module.exports = {
  transform: {
    '^.+\\.ts$': [ 'ts-jest', {
      tsconfig: '<rootDir>/test/tsconfig.json',
      diagnostics: false,
      isolatedModules: true,
    }],
    // This transformer converts ESM packages to CJS
    '^.+node_modules.+\\.(js|mjs)$': 'jest-esm-transformer-2',
  },
  // By default, node_modules are not transformed, but we want to transform the ESM packages
  transformIgnorePatterns: [ `/node_modules/(?!(${esModules.join('|')})/)` ],
  testRegex: '/test/(unit|integration|adversarial)/.*\\.test\\.ts$',
  moduleFileExtensions: [
    'ts',
    'js',
    'mjs',
  ],
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/util/SetupTests.ts',
  globalTeardown: '<rootDir>/test/util/TeardownTests.ts',
  setupFilesAfterEnv: [ 'jest-rdf' ],
  collectCoverage: false,
  // See https://github.com/matthieubosquet/ts-dpop/issues/13
  moduleNameMapper: {
    '^@solid/access-control-policy$': '<rootDir>/node_modules/@solid/access-control-policy/dist/mod.js',
  },
  // Slower machines had problems calling the WebSocket integration callbacks on time
  testTimeout: 90000,

  reporters: ci ? [ 'default', 'github-actions' ] : [ 'default' ],
  ...ci && jestGithubRunnerSpecs(),
};
