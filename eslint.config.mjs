import opinionated from 'opinionated-eslint-config';

export default opinionated().append({
  // Don't lint generated/runtime output. The nested forge-admin app is self-linted
  // with oxlint, and local agent/runtime folders are not source of truth.
  ignores: [
    '.agents/**',
    '.claude/**',
    'coverage/**',
    'dist/**',
    'test/assets/*',
    'componentsjs-error-state.json',
    '.data/**',
    'forge-admin/**',
    'docs/**',
    'templates/scripts/**',
    '**/*.min.js',
    'work-files/**',
    '**/use-cases.json',
  ],
}, {
  files: [ '**/*.ts', '**/*.mts', '**/*.cts', '**/*.tsx' ],
  rules: {
    // Unicorn/no-nested-ternary requires parentheses around nested ternary,
    // but @stylistic/no-extra-parens removes them — the two rules conflict.
    // Nested ternary is readable when formatted with proper indentation.
    'unicorn/no-nested-ternary': 'off',
    // Allow arrow functions used as inline arguments (callbacks, map/filter/reduce)
    // to omit explicit return types — TypeScript infers them from context.
    // Standalone function declarations and expressions still require return types.
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      {
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
        allowIIFEs: true,
      },
    ],
    // Allow domain-specific property names that cannot be camelCase:
    // - Numeric keys (GS1 application identifiers, fixed-length codes)
    // - JSON-LD keywords (@id, @type, @context)
    // - RDF prefixed names (solid:*, dpv:*, etc.)
    // - Kebab-case module identifiers (device-auth, allergy-profile, etc.)
    // - HTTP header names (x-apikey, content-type, etc.)
    // - Dotted names (mcp.server)
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'default',
        format: [ 'camelCase' ],
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
      },
      {
        selector: 'import',
        format: null,
      },
      {
        selector: 'variable',
        format: [ 'camelCase', 'UPPER_CASE' ],
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
      },
      {
        selector: 'typeLike',
        format: [ 'PascalCase' ],
      },
      {
        selector: [ 'typeParameter' ],
        format: [ 'PascalCase' ],
        prefix: [ 'T' ],
      },
      {
        selector: [ 'objectLiteralProperty' ],
        format: null,
      },
      {
        selector: [ 'property' ],
        format: null,
      },
      {
        selector: [ 'parameter' ],
        format: [ 'camelCase' ],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'forbid',
      },
    ],
    // Allow unused function parameters that are prefixed with underscore
    'unused-imports/no-unused-vars': [
      'error',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
  },
}, {
  files: [ 'test/**/*.ts' ],
  rules: {
    // Test titles are descriptive sentences; requiring a trailing period
    // is a style preference that doesn't affect correctness.
    'jest/valid-title': 'off',
    // Return types on test callbacks (jest hooks, matchers, mocks) add noise
    // without improving type safety — the test runner infers them.
    '@typescript-eslint/explicit-function-return-type': 'off',
    'func-style': 'off',
    // Tests use console for debug output during integration tests.
    'no-console': 'off',
    // Test files may reference deprecated APIs for compatibility testing.
    '@typescript-eslint/no-deprecated': 'off',
    // @jest/globals is a dev dependency used in test files.
    'import/no-extraneous-dependencies': 'off',
    // Test assertion helpers may use uppercase constants.
    '@typescript-eslint/naming-convention': 'off',
    // Tests may use `new` for side-effect assertions.
    'no-new': 'off',
    // Inline comments in test assertions are acceptable.
    'line-comment-position': 'off',
    // Test helper functions can be defined inline.
    'unicorn/consistent-function-scoping': 'off',
    // Test throw assertions don't always need explicit messages.
    'jest/require-to-throw-message': 'off',
  },
}, {
  files: [
    'scripts/**/*.mjs',
    'scripts/**/*.js',
    'src/databox/ipms/sidecars/ConnectorSidecar.ts',
  ],
  rules: {
    // Scripts are CLI tools where console output and sync file I/O are expected.
    'no-console': 'off',
    'no-sync': 'off',
    '@typescript-eslint/no-sync': 'off',
    'unicorn/no-process-exit': 'off',
    'unicorn/filename-case': 'off',
    'no-plusplus': 'off',
    // Avoid conflict with @stylistic/no-extra-parens on nested ternary.
    'unicorn/no-nested-ternary': 'off',
  },
});
