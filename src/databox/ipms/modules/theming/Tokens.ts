import type { BlankNode, Literal, NamedNode, Quad, Term } from '@rdfjs/types';
import { DataFactory, Parser, Writer } from 'n3';
import { DC, IPMS, RDF } from '../../../../util/Vocabularies';

const VALUE = '$value';
const TYPE = '$type';
const DESCRIPTION = '$description';
const THEME_TYPE = 'DataboxTheme';
const SCHEMA = 'https://schema.org/';
const DTCG = 'https://www.w3.org/community/design-tokens/';
const DEFAULT_SELECTOR = ':root';

const TERMS = {
  theme: namedNode(`${IPMS.namespace}Theme`),
  token: namedNode(`${IPMS.namespace}token`),
  tokenPath: namedNode(`${IPMS.namespace}tokenPath`),
  tokenType: namedNode(`${IPMS.namespace}tokenType`),
  tokenValue: namedNode(`${IPMS.namespace}tokenValue`),
  tokenDescription: namedNode(`${IPMS.namespace}tokenDescription`),
  identifier: namedNode(`${SCHEMA}identifier`),
  softwareVersion: namedNode(`${SCHEMA}softwareVersion`),
};

export interface PortableThemePackage {
  readonly '@context': Record<string, string>;
  readonly type: typeof THEME_TYPE;
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly tokens: DesignTokenTree;
  readonly portability: {
    readonly canonicalFormat: 'W3C DTCG design-token JSON';
    readonly cssOutput: 'CSS custom properties';
    readonly smithyOutput: 'Tailwind-compatible Smithy token projection';
    readonly nonPortableRuntimeWork: readonly string[];
  };
}

export type DesignTokenTree = Record<string, unknown>;

export interface ThemeRdfOptions {
  readonly subjectIri?: string;
  readonly baseIri?: string;
}

export interface CssCompileOptions {
  readonly selector?: string;
  readonly prefix?: string;
}

export interface SmithyCompatibleThemeTokens {
  readonly cssVariables: Record<string, string>;
  readonly tailwindTheme: {
    readonly extend: {
      readonly colors: Record<string, string>;
      readonly spacing: Record<string, string>;
      readonly borderRadius: Record<string, string>;
      readonly boxShadow: Record<string, string>;
      readonly fontFamily: Record<string, string[]>;
      readonly transitionDuration: Record<string, string>;
    };
  };
}

interface FlattenedToken {
  readonly path: readonly string[];
  readonly type?: string;
  readonly description?: string;
  readonly value: unknown;
  readonly cssName: string;
  readonly cssValue: string;
}

/**
 * Validate and canonicalize a portable, declarative theme package.
 *
 * The token body stays standards-native DTCG JSON. CSS and Smithy outputs are derived artifacts so the theme can
 * travel through ordinary JSON or RDF without depending on CSS-private runtime state.
 */
export function validateThemePackage(input: unknown): PortableThemePackage {
  const record = requireRecord(input, 'Theme package');
  const tokens = requireRecord(record.tokens, 'Theme package tokens');
  const theme: PortableThemePackage = {
    '@context': {
      ipms: IPMS.namespace,
      dcterms: DC.namespace,
      dtcg: DTCG,
      schema: SCHEMA,
    },
    type: requireExact(record.type, THEME_TYPE, 'Theme package type'),
    id: requireSafeId(record.id, 'Theme package id'),
    name: requireString(record.name, 'Theme package name'),
    version: requireString(record.version, 'Theme package version'),
    ...record.description === undefined ?
        {} :
        { description: requireString(record.description, 'Theme package description') },
    tokens,
    portability: portableThemePortability(),
  };

  flattenTokens(theme.tokens, { prefix: '' });
  return theme;
}

export function themeToPortableJson(input: unknown): string {
  return `${JSON.stringify(validateThemePackage(input), null, 2)}\n`;
}

export function parseThemePortableJson(input: string): PortableThemePackage {
  try {
    return validateThemePackage(JSON.parse(input));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Theme package JSON could not be parsed: ${message}`);
  }
}

/**
 * Compile W3C Design Tokens (DTCG) into CSS custom properties (theming; see
 * `databox/solid-ipms-plan.md`, §12.5). A theme package ships DTCG token JSON - a nested tree whose leaves
 * carry a `$value` (and optional `$type`/`$description` meta) - and this flattens it to a public CSS variable
 * block. The output is pure, deterministic, and rejects values that could break out into arbitrary CSS.
 */
export function tokensToCss(tokens: DesignTokenTree, options: CssCompileOptions = {}): string {
  const declarations = flattenTokens(tokens, options)
    .map((token): string => `  --${token.cssName}: ${token.cssValue};`)
    .join('\n');
  return `${validateSelector(options.selector ?? DEFAULT_SELECTOR)} {\n${declarations}\n}\n`;
}

export function themeToCss(theme: unknown, options: CssCompileOptions = {}): string {
  return tokensToCss(validateThemePackage(theme).tokens, options);
}

export function themeToForgeTokens(theme: unknown, options: CssCompileOptions = {}): SmithyCompatibleThemeTokens {
  const flattened = flattenTokens(validateThemePackage(theme).tokens, options);
  const cssVariables: Record<string, string> = {};
  const colors: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const borderRadius: Record<string, string> = {};
  const boxShadow: Record<string, string> = {};
  const fontFamily: Record<string, string[]> = {};
  const transitionDuration: Record<string, string> = {};

  for (const token of flattened) {
    const cssVariable = `--${token.cssName}`;
    const tokenReference = `var(${cssVariable})`;
    cssVariables[cssVariable] = token.cssValue;
    const key = tailwindKey(token.path);
    const group = token.path[0];
    if (token.type === 'color' || group === 'color' || group === 'colors') {
      colors[key] = tokenReference;
    } else if (token.type === 'dimension' && (group === 'space' || group === 'spacing')) {
      spacing[key] = tokenReference;
    } else if (group === 'radius' || group === 'radii') {
      borderRadius[key] = tokenReference;
    } else if (token.type === 'shadow' || group === 'shadow' || group === 'shadows') {
      boxShadow[key] = tokenReference;
    } else if (token.type === 'fontFamily' || group === 'font') {
      fontFamily[key] = [ tokenReference ];
    } else if (token.type === 'duration' || group === 'motion') {
      transitionDuration[key] = tokenReference;
    }
  }

  return {
    cssVariables,
    tailwindTheme: {
      extend: {
        colors,
        spacing,
        borderRadius,
        boxShadow,
        fontFamily,
        transitionDuration,
      },
    },
  };
}

export async function serializeThemeToTurtle(input: unknown, options: ThemeRdfOptions = {}): Promise<string> {
  const theme = validateThemePackage(input);
  const subject = namedNode(options.subjectIri ?? defaultThemeSubject(theme.id));
  const quads: Quad[] = [
    rdfQuad(subject, RDF.terms.type, TERMS.theme),
    rdfQuad(subject, TERMS.identifier, literal(theme.id)),
    rdfQuad(subject, DC.terms.title, literal(theme.name)),
    rdfQuad(subject, TERMS.softwareVersion, literal(theme.version)),
  ];
  if (theme.description !== undefined) {
    quads.push(rdfQuad(subject, DC.terms.description, literal(theme.description)));
  }
  for (const token of flattenTokens(theme.tokens, { prefix: '' })) {
    const tokenNode = blankNode();
    quads.push(
      rdfQuad(subject, TERMS.token, tokenNode),
      rdfQuad(tokenNode, TERMS.tokenPath, literal(token.path.join('.'))),
      rdfQuad(tokenNode, TERMS.tokenValue, literal(JSON.stringify(token.value))),
    );
    if (token.type !== undefined) {
      quads.push(rdfQuad(tokenNode, TERMS.tokenType, literal(token.type)));
    }
    if (token.description !== undefined) {
      quads.push(rdfQuad(tokenNode, TERMS.tokenDescription, literal(token.description)));
    }
  }
  return serializeTurtle(quads);
}

export function parseThemeRdf(turtle: string, options: ThemeRdfOptions = {}): PortableThemePackage {
  let quads: Quad[];
  try {
    quads = new Parser({ baseIRI: options.baseIri }).parse(turtle);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Theme package RDF could not be parsed: ${message}`);
  }

  const subject = options.subjectIri ? namedNode(options.subjectIri) : findThemeSubject(quads);
  const tokens: DesignTokenTree = {};
  for (const tokenNode of objects(quads, subject, TERMS.token)) {
    const path = requiredLiteral(quads, tokenNode, TERMS.tokenPath, 'token path').split('.');
    const valueLiteral = requiredLiteral(quads, tokenNode, TERMS.tokenValue, 'token value');
    const tokenType = optionalLiteral(quads, tokenNode, TERMS.tokenType, 'token type');
    const description = optionalLiteral(quads, tokenNode, TERMS.tokenDescription, 'token description');
    setToken(tokens, path, {
      [VALUE]: parseTokenJsonValue(valueLiteral, path.join('.')),
      ...tokenType === undefined ? {} : { [TYPE]: tokenType },
      ...description === undefined ? {} : { [DESCRIPTION]: description },
    });
  }

  const description = optionalLiteral(quads, subject, DC.terms.description, 'description');
  return validateThemePackage({
    type: THEME_TYPE,
    id: requiredLiteral(quads, subject, TERMS.identifier, 'id'),
    name: requiredLiteral(quads, subject, DC.terms.title, 'name'),
    version: requiredLiteral(quads, subject, TERMS.softwareVersion, 'version'),
    ...description === undefined ? {} : { description },
    tokens,
  });
}

function flattenTokens(tokens: DesignTokenTree, options: CssCompileOptions): FlattenedToken[] {
  const flattened: FlattenedToken[] = [];
  collect(tokens, [], flattened, undefined, options.prefix ?? '');
  return flattened;
}

function collect(
  node: DesignTokenTree,
  path: readonly string[],
  out: FlattenedToken[],
  inheritedType: string | undefined,
  prefix: string,
): void {
  const groupType = typeof node[TYPE] === 'string' ? requireTokenType(node[TYPE], path, TYPE) : inheritedType;
  for (const [ key, value ] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    requireTokenName(key, [ ...path, key ].join('.'));
    const child = requireRecord(value, `Theme token ${[ ...path, key ].join('.')} node`);
    if (VALUE in child) {
      const tokenType = child[TYPE] === undefined ? groupType : requireTokenType(child[TYPE], path, key);
      const description = child[DESCRIPTION] === undefined ?
        undefined :
          requireString(child[DESCRIPTION], `Theme token ${[ ...path, key ].join('.')} description`);
      const tokenPath = [ ...path, key ];
      out.push({
        path: tokenPath,
        type: tokenType,
        description,
        value: child[VALUE],
        cssName: cssTokenName(tokenPath, prefix),
        cssValue: compileTokenValue(child[VALUE], tokenType, tokenPath, prefix),
      });
    } else {
      collect(child, [ ...path, key ], out, groupType, prefix);
    }
  }
}

function compileTokenValue(value: unknown, type: string | undefined, path: readonly string[], prefix: string): string {
  if (typeof value === 'string' && isTokenReference(value)) {
    return `var(--${cssTokenName(value.slice(1, -1).split('.'), prefix)})`;
  }
  switch (type) {
    case 'color':
      return requireCssColor(value, path);
    case 'dimension':
      return requireCssLength(value, path);
    case 'fontFamily':
      return requireFontFamily(value, path);
    case 'fontWeight':
      return requireFontWeight(value, path);
    case 'duration':
      return requireDuration(value, path);
    case 'cubicBezier':
      return requireCubicBezier(value, path);
    case 'shadow':
      return requireShadow(value, path);
    case 'number':
      return requireCssNumber(value, path);
    case undefined:
    case 'string':
      return requireSafeCssAtom(value, path);
    default:
      throw new Error(`Theme token ${path.join('.')} has unsupported token type ${type}.`);
  }
}

function requireCssColor(value: unknown, path: readonly string[]): string {
  const color = requireSafeCssString(value, path);
  if (/^(?:#[\dA-Fa-f]{3,8}|rgb\([\d%.,\s]+\)|rgba\([\d%.,\s]+\)|hsl\([\d%.,\s]+\)|hsla\([\d%.,\s]+\)|[A-Za-z]+)$/u
    .test(color)) {
    return color;
  }
  throw new Error(`Theme token ${path.join('.')} must be a safe CSS color.`);
}

function requireCssLength(value: unknown, path: readonly string[]): string {
  if (value === 0) {
    return '0';
  }
  const length = requireSafeCssString(value, path);
  if (/^-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|vh|vw|vmin|vmax|ch|ex|lh|rlh|svh|svw|dvh|dvw|s|ms)$/u
    .test(length)) {
    return length;
  }
  throw new Error(`Theme token ${path.join('.')} must be a safe CSS length.`);
}

function requireFontFamily(value: unknown, path: readonly string[]): string {
  const family = requireSafeCssString(value, path);
  if (/^[\w\s"',.-]+$/u.test(family)) {
    return family;
  }
  throw new Error(`Theme token ${path.join('.')} must be a safe font-family list.`);
}

function requireFontWeight(value: unknown, path: readonly string[]): string {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1000) {
    return String(value);
  }
  const weight = requireSafeCssString(value, path);
  if (/^(?:normal|bold|lighter|bolder|[1-9]00)$/u.test(weight)) {
    return weight;
  }
  throw new Error(`Theme token ${path.join('.')} must be a safe font-weight.`);
}

function requireDuration(value: unknown, path: readonly string[]): string {
  const duration = requireSafeCssString(value, path);
  if (/^(?:\d+|\d*\.\d+)(?:ms|s)$/u.test(duration)) {
    return duration;
  }
  throw new Error(`Theme token ${path.join('.')} must be a safe CSS duration.`);
}

function requireCubicBezier(value: unknown, path: readonly string[]): string {
  if (Array.isArray(value) && value.length === 4 && value.every((entry): boolean => typeof entry === 'number')) {
    return `cubic-bezier(${value.map(String).join(', ')})`;
  }
  const bezier = requireSafeCssString(value, path);
  if (/^cubic-bezier\(-?(?:\d+|\d*\.\d+),\s*-?(?:\d+|\d*\.\d+),\s*-?(?:\d+|\d*\.\d+),\s*-?(?:\d+|\d*\.\d+)\)$/u
    .test(bezier)) {
    return bezier;
  }
  throw new Error(`Theme token ${path.join('.')} must be a safe cubic-bezier value.`);
}

function requireShadow(value: unknown, path: readonly string[]): string {
  if (Array.isArray(value)) {
    return value.map((entry, index): string => requireShadowObject(entry, [ ...path, String(index) ])).join(', ');
  }
  return requireShadowObject(value, path);
}

function requireShadowObject(value: unknown, path: readonly string[]): string {
  const shadow = requireRecord(value, `Theme token ${path.join('.')} shadow`);
  const parts = [
    requireCssLength(shadow.offsetX, [ ...path, 'offsetX' ]),
    requireCssLength(shadow.offsetY, [ ...path, 'offsetY' ]),
    requireCssLength(shadow.blur, [ ...path, 'blur' ]),
    ...shadow.spread === undefined ? [] : [ requireCssLength(shadow.spread, [ ...path, 'spread' ]) ],
    requireCssColor(shadow.color, [ ...path, 'color' ]),
  ];
  return parts.join(' ');
}

function requireCssNumber(value: unknown, path: readonly string[]): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  throw new Error(`Theme token ${path.join('.')} must be a finite number.`);
}

function requireSafeCssAtom(value: unknown, path: readonly string[]): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return requireSafeCssString(value, path);
}

function requireSafeCssString(value: unknown, path: readonly string[]): string {
  const checked = requireString(value, `Theme token ${path.join('.')} value`);
  if (/[;{}]/u.test(checked) ||
    checked.includes('/*') ||
    checked.includes('*/') ||
    hasControlCharacter(checked) ||
    /\b(?:url|expression|import)\s*\(/iu.test(checked) ||
    /<\/?script/iu.test(checked)) {
    throw new Error(`Theme token ${path.join('.')} contains an unsafe CSS value.`);
  }
  return checked;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;
    if (codePoint <= 31 || codePoint === 127) {
      return true;
    }
  }
  return false;
}

function validateSelector(selector: string): string {
  if (!/^:[A-Za-z-]+$|^\.[A-Za-z][\w-]*$|^#[A-Za-z][\w-]*$/u.test(selector)) {
    throw new Error('Theme CSS selector must be :root, a pseudo-root selector, a class, or an id.');
  }
  return selector;
}

function isTokenReference(value: string): boolean {
  return /^\{[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+\}$/u.test(value);
}

function cssTokenName(path: readonly string[], prefix: string): string {
  const safePath = path.map((part): string => requireTokenName(part, path.join('.'))).join('-');
  return prefix.length === 0 ? safePath : `${requireTokenName(prefix, 'CSS token prefix')}-${safePath}`;
}

function tailwindKey(path: readonly string[]): string {
  const keyPath = path.length > 1 ? path.slice(1) : path;
  return keyPath.join('-');
}

function setToken(tokens: DesignTokenTree, path: readonly string[], token: Record<string, unknown>): void {
  if (path.length === 0) {
    throw new Error('Theme token path must not be empty.');
  }
  let current = tokens;
  for (const [ index, part ] of path.entries()) {
    requireTokenName(part, path.join('.'));
    if (index === path.length - 1) {
      if (current[part] !== undefined) {
        throw new Error(`Theme token ${path.join('.')} is duplicated.`);
      }
      current[part] = token;
    } else {
      if (current[part] === undefined) {
        current[part] = {};
      }
      current = requireRecord(current[part], `Theme token ${path.slice(0, index + 1).join('.')} group`);
    }
  }
}

function parseTokenJsonValue(value: string, path: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Theme token ${path} RDF value must be JSON: ${message}`);
  }
}

function findThemeSubject(quads: readonly Quad[]): NamedNode {
  const subjects = quads
    .filter((quad): boolean => termEquals(quad.predicate, RDF.terms.type) && termEquals(quad.object, TERMS.theme))
    .map((quad): Term => quad.subject);
  const unique = uniqueTerms(subjects);
  if (unique.length === 0) {
    throw new Error('Theme package RDF must contain one rdf:type ipms:Theme subject.');
  }
  if (unique.length > 1) {
    throw new Error('Theme package RDF must contain exactly one rdf:type ipms:Theme subject.');
  }
  if (unique[0].termType !== 'NamedNode') {
    throw new Error('Theme package RDF subject must be a named node.');
  }
  return unique[0];
}

function requiredLiteral(quads: readonly Quad[], subject: Term, predicate: Term, field: string): string {
  const values = objects(quads, subject, predicate);
  if (values.length === 0) {
    throw new Error(`Theme package RDF ${field} is required.`);
  }
  if (values.length > 1) {
    throw new Error(`Theme package RDF ${field} must have exactly one value.`);
  }
  if (values[0].termType !== 'Literal') {
    throw new Error(`Theme package RDF ${field} must be a literal.`);
  }
  return values[0].value;
}

function optionalLiteral(quads: readonly Quad[], subject: Term, predicate: Term, field: string): string | undefined {
  const values = objects(quads, subject, predicate);
  if (values.length === 0) {
    return;
  }
  if (values.length > 1) {
    throw new Error(`Theme package RDF ${field} must have at most one value.`);
  }
  if (values[0].termType !== 'Literal') {
    throw new Error(`Theme package RDF ${field} must be a literal.`);
  }
  return values[0].value;
}

function objects(quads: readonly Quad[], subject: Term, predicate: Term): Term[] {
  return quads
    .filter((quad): boolean => termEquals(quad.subject, subject) && termEquals(quad.predicate, predicate))
    .map((quad): Term => quad.object);
}

function uniqueTerms(terms: readonly Term[]): Term[] {
  const seen = new Set<string>();
  return terms.filter((term): boolean => {
    const key = `${term.termType}:${term.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function termEquals(left: Term, right: Term): boolean {
  return left.termType === right.termType && left.value === right.value;
}

function portableThemePortability(): PortableThemePackage['portability'] {
  return {
    canonicalFormat: 'W3C DTCG design-token JSON',
    cssOutput: 'CSS custom properties',
    smithyOutput: 'Tailwind-compatible Smithy token projection',
    nonPortableRuntimeWork: [
      'generated CSS files',
      'control-plane preview state',
      'runtime-specific asset pipelines',
    ],
  };
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value;
}

function requireSafeId(value: unknown, field: string): string {
  const id = requireString(value, field);
  if (!/^[\w.:-]+$/u.test(id)) {
    throw new Error(`${field} must be a safe id.`);
  }
  return id;
}

function requireTokenName(value: unknown, field: string): string {
  const name = requireString(value, `Theme token ${field} name`);
  if (!/^[A-Za-z][\w-]*$/u.test(name)) {
    throw new Error(`Theme token ${field} name must be safe for CSS custom properties.`);
  }
  return name;
}

function requireTokenType(value: unknown, path: readonly string[], field: string): string {
  const type = requireString(value, `Theme token ${[ ...path, field ].join('.')} type`);
  if (!/^[A-Za-z][\w-]*$/u.test(type)) {
    throw new Error(`Theme token ${[ ...path, field ].join('.')} type must be a safe identifier.`);
  }
  return type;
}

function requireExact<T extends string>(value: unknown, expected: T, field: string): T {
  if (value !== expected) {
    throw new Error(`${field} must be ${expected}.`);
  }
  return expected;
}

function defaultThemeSubject(id: string): string {
  return `urn:solid-server:databox:ipms:theme:${encodeURIComponent(id)}`;
}

function blankNode(): BlankNode {
  return DataFactory.blankNode();
}

function literal(value: string): Literal {
  return DataFactory.literal(value);
}

function namedNode(value: string): NamedNode {
  return DataFactory.namedNode(value);
}

function rdfQuad(subject: Quad['subject'], predicate: Quad['predicate'], object: Quad['object']): Quad {
  return DataFactory.quad(subject, predicate, object);
}

async function serializeTurtle(quads: Quad[]): Promise<string> {
  const writer = new Writer({
    prefixes: {
      ipms: IPMS.namespace,
      dcterms: DC.namespace,
      rdf: RDF.namespace,
      schema: SCHEMA,
    },
  });
  writer.addQuads(quads);
  return new Promise((resolve, reject): void => {
    writer.end((error, result): void => {
      if (error) {
        reject(error);
      } else {
        resolve(typeof result === 'string' ? result : '');
      }
    });
  });
}
