import {
  parseThemePortableJson,
  parseThemeRdf,
  serializeThemeToTurtle,
  themeToCss,
  themeToForgeTokens,
  themeToPortableJson,
  tokensToCss,
  validateThemePackage,
} from '../../../../../../src/databox/ipms/modules/theming/Tokens';

const VALUE = '$value';
const TYPE = '$type';
const DESCRIPTION = '$description';

const theme = {
  type: 'DataboxTheme',
  id: 'corner-cafe.default',
  name: 'Corner Cafe Default',
  version: '1.0.0',
  description: 'Portable public website theme.',
  tokens: {
    color: {
      [TYPE]: 'color',
      primary: { [VALUE]: '#d4af37', [DESCRIPTION]: 'Brand gold' },
      accent: { [VALUE]: '{color.primary}' },
    },
    space: { sm: { [VALUE]: '8px', [TYPE]: 'dimension' }},
    radius: { card: { [VALUE]: '6px', [TYPE]: 'dimension' }},
    shadow: {
      card: {
        [TYPE]: 'shadow',
        [VALUE]: {
          offsetX: 0,
          offsetY: '2px',
          blur: '8px',
          color: 'rgba(15, 23, 42, 0.18)',
        },
      },
    },
    font: { body: { [VALUE]: '"Inter", sans-serif', [TYPE]: 'fontFamily' }},
    motion: { fast: { [VALUE]: '120ms', [TYPE]: 'duration' }},
  },
};

describe('tokensToCss', (): void => {
  it('flattens nested DTCG tokens into custom properties, skipping meta keys.', (): void => {
    const css = tokensToCss({
      color: {
        [TYPE]: 'color',
        primary: { [VALUE]: '#d4af37' },
        surface: { deep: { [VALUE]: '#020617' }},
      },
      space: { sm: { [VALUE]: '8px', [TYPE]: 'dimension' }},
    });
    expect(css).toBe(
      ':root {\n' +
      '  --color-primary: #d4af37;\n' +
      '  --color-surface-deep: #020617;\n' +
      '  --space-sm: 8px;\n' +
      '}\n',
    );
  });

  it('rejects token values that could break out into arbitrary CSS.', (): void => {
    expect((): string => tokensToCss({
      color: {
        primary: { [VALUE]: 'red; background:url(https://evil.example/x)', [TYPE]: 'color' },
      },
    })).toThrow('unsafe CSS value');
  });
});

describe('portable theme packages', (): void => {
  it('normalizes theme packages as portable JSON and compiles CSS custom properties.', (): void => {
    const portable = validateThemePackage(theme);
    expect(portable.portability).toMatchObject({
      canonicalFormat: 'W3C DTCG design-token JSON',
      cssOutput: 'CSS custom properties',
    });

    expect(themeToCss(theme)).toBe(
      ':root {\n' +
      '  --color-primary: #d4af37;\n' +
      '  --color-accent: var(--color-primary);\n' +
      '  --space-sm: 8px;\n' +
      '  --radius-card: 6px;\n' +
      '  --shadow-card: 0 2px 8px rgba(15, 23, 42, 0.18);\n' +
      '  --font-body: "Inter", sans-serif;\n' +
      '  --motion-fast: 120ms;\n' +
      '}\n',
    );

    const json = themeToPortableJson(theme);
    expect(parseThemePortableJson(json)).toMatchObject({
      type: 'DataboxTheme',
      id: 'corner-cafe.default',
      tokens: {
        color: {
          primary: { [VALUE]: '#d4af37' },
        },
      },
    });
  });

  it('projects Smithy-compatible Tailwind token references.', (): void => {
    const smithy = themeToForgeTokens(theme);

    expect(smithy.cssVariables['--color-primary']).toBe('#d4af37');
    expect(smithy.tailwindTheme.extend.colors.primary).toBe('var(--color-primary)');
    expect(smithy.tailwindTheme.extend.spacing.sm).toBe('var(--space-sm)');
    expect(smithy.tailwindTheme.extend.borderRadius.card).toBe('var(--radius-card)');
    expect(smithy.tailwindTheme.extend.boxShadow.card).toBe('var(--shadow-card)');
    expect(smithy.tailwindTheme.extend.fontFamily.body).toStrictEqual([ 'var(--font-body)' ]);
    expect(smithy.tailwindTheme.extend.transitionDuration.fast).toBe('var(--motion-fast)');
  });

  it('round-trips portable themes through RDF Turtle.', async(): Promise<void> => {
    const turtle = await serializeThemeToTurtle(theme, {
      subjectIri: 'https://www.example.org/.well-known/databox-ipms/themes/corner.ttl#theme',
    });

    expect(turtle).toContain('ipms:Theme');
    expect(turtle).toContain('ipms:tokenPath "color.primary"');

    const parsed = parseThemeRdf(turtle, {
      baseIri: 'https://www.example.org/.well-known/databox-ipms/themes/corner.ttl',
      subjectIri: 'https://www.example.org/.well-known/databox-ipms/themes/corner.ttl#theme',
    });
    expect(parsed).toMatchObject({
      type: 'DataboxTheme',
      id: 'corner-cafe.default',
      name: 'Corner Cafe Default',
      tokens: {
        color: {
          primary: {
            [VALUE]: '#d4af37',
            [TYPE]: 'color',
            [DESCRIPTION]: 'Brand gold',
          },
        },
      },
    });
    expect(themeToCss(parsed)).toContain('--color-accent: var(--color-primary);');
  });
});
