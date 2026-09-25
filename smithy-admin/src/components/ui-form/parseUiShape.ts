import { Parser } from 'n3';
import type { Quad } from 'n3';
import type { UiField, UiFormSpec, UiFieldType } from './types';

const UI = 'http://www.w3.org/ns/ui#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';

/**
 * Parses a Turtle `ui#` shape into a UiFormSpec.
 * Reads `ui:Form` subjects with `ui:parts` (rdf:List) containing field descriptions.
 */
export function parseUiShape(turtle: string, shapeIri?: string): UiFormSpec {
  const parser = new Parser();
  const quads: Quad[] = parser.parse(turtle) as unknown as Quad[];

  const forms = quads.filter(
    (q) =>
      q.predicate.value === `${RDF}type` &&
      q.object.value === `${UI}Form`,
  );

  if (forms.length === 0) {
    throw new Error('No ui:Form found in the provided Turtle.');
  }

  const formSubject = shapeIri
    ? forms.find((f) => f.subject.value === shapeIri)?.subject ?? forms[0].subject
    : forms[0].subject;

  const label = getLiteral(quads, formSubject.value, `${RDFS}label`);
  const comment = getLiteral(quads, formSubject.value, `${RDFS}comment`);
  const partsList = getListHead(quads, formSubject.value, `${UI}parts`);

  const parts: UiField[] = [];
  let current = partsList;
  while (current) {
    // Get rdf:first of the current list cell — that's the field subject
    const firstQuad = quads.find(
      (q) => q.subject.value === current!.value && q.predicate.value === `${RDF}first`,
    );
    if (firstQuad) {
      const field = parseField(quads, firstQuad.object.value);
      if (field) {
        parts.push(field);
      }
    }
    // Move to rdf:rest to get the next list cell
    current = getNextInList(quads, current.value);
  }

  return {
    type: 'Form',
    label,
    comment,
    parts,
    shapeIri: formSubject.value,
  };
}

function parseField(quads: Quad[], subject: string): UiField | null {
  const typeQuad = quads.find(
    (q) => q.subject.value === subject && q.predicate.value === `${RDF}type`,
  );
  if (!typeQuad) return null;

  const fieldType = typeQuad.object.value.replace(`${UI}`, '') as UiFieldType;
  if (!isValidFieldType(fieldType)) return null;

  const field: UiField = { type: fieldType };

  const label = getLiteral(quads, subject, `${UI}label`);
  if (label) field.label = label;

  const comment = getLiteral(quads, subject, `${UI}comment`);
  if (comment) field.comment = comment;

  const property = getLiteral(quads, subject, `${UI}property`);
  if (property) field.property = property;

  const required = getLiteral(quads, subject, `${UI}required`);
  if (required === 'true') field.required = true;

  const readOnly = getLiteral(quads, subject, `${UI}readOnly`);
  if (readOnly === 'true') field.readOnly = true;

  const hidden = getLiteral(quads, subject, `${UI}hidden`);
  if (hidden === 'true') field.hidden = true;

  const placeholder = getLiteral(quads, subject, `${UI}placeholder`);
  if (placeholder) field.placeholder = placeholder;

  const defaultValue = getLiteral(quads, subject, `${UI}default`);
  if (defaultValue !== undefined) {
    field.default = parseDefaultValue(defaultValue, fieldType);
  }

  const min = getLiteral(quads, subject, `${UI}min`);
  if (min) field.min = Number(min);

  const max = getLiteral(quads, subject, `${UI}max`);
  if (max) field.max = Number(max);

  const minLength = getLiteral(quads, subject, `${UI}minLength`);
  if (minLength) field.minLength = Number(minLength);

  const maxLength = getLiteral(quads, subject, `${UI}maxLength`);
  if (maxLength) field.maxLength = Number(maxLength);

  const pattern = getLiteral(quads, subject, `${UI}pattern`);
  if (pattern) field.pattern = pattern;

  const autocomplete = getLiteral(quads, subject, `${UI}autocomplete`);
  if (autocomplete) field.autocomplete = autocomplete;

  const heading = getLiteral(quads, subject, `${UI}heading`);
  if (heading) field.heading = heading;

  if (fieldType === 'Choice') {
    const fromList = getListHead(quads, subject, `${UI}from`);
    const options: string[] = [];
    let current = fromList;
    while (current) {
      const firstQuad = quads.find(
        (q) => q.subject.value === current!.value && q.predicate.value === `${RDF}first`,
      );
      if (firstQuad) {
        const value = getLiteral(quads, firstQuad.object.value, `${RDF}value`)
          ?? firstQuad.object.value.split('#').pop()
          ?? firstQuad.object.value.split('/').pop()
          ?? firstQuad.object.value;
        options.push(value);
      }
      current = getNextInList(quads, current.value);
    }
    if (options.length > 0) field.from = options;
  }

  if (fieldType === 'Group') {
    const partsList = getListHead(quads, subject, `${UI}parts`);
    const subParts: UiField[] = [];
    let current = partsList;
    while (current) {
      const firstQuad = quads.find(
        (q) => q.subject.value === current!.value && q.predicate.value === `${RDF}first`,
      );
      if (firstQuad) {
        const subField = parseField(quads, firstQuad.object.value);
        if (subField) subParts.push(subField);
      }
      current = getNextInList(quads, current.value);
    }
    if (subParts.length > 0) field.parts = subParts;
  }

  return field;
}

function parseDefaultValue(value: string, fieldType: UiFieldType): unknown {
  if (fieldType === 'Boolean') return value === 'true';
  if (fieldType === 'Integer' || fieldType === 'Number' || fieldType === 'Decimal' || fieldType === 'Float') {
    return Number(value);
  }
  return value;
}

function getLiteral(
  quads: Quad[],
  subject: string,
  predicate: string,
): string | undefined {
  const quad = quads.find(
    (q) => q.subject.value === subject && q.predicate.value === predicate,
  );
  return quad?.object.value;
}

function getListHead(
  quads: Quad[],
  subject: string,
  predicate: string,
): { value: string } | null {
  const quad = quads.find(
    (q) => q.subject.value === subject && q.predicate.value === predicate,
  );
  if (!quad) return null;
  return { value: quad.object.value };
}

function getNextInList(
  quads: Quad[],
  listNode: string,
): { value: string } | null {
  if (listNode === `${RDF}nil`) return null;
  const restQuad = quads.find(
    (q) => q.subject.value === listNode && q.predicate.value === `${RDF}rest`,
  );
  if (!restQuad || restQuad.object.value === `${RDF}nil`) return null;
  return { value: restQuad.object.value };
}

function isValidFieldType(type: string): type is UiFieldType {
  const valid: string[] = [
    'TextInput', 'TextArea', 'Boolean', 'Choice', 'Integer',
    'Decimal', 'Float', 'Number', 'Date', 'DateTime', 'Time',
    'Color', 'Telephone', 'Email', 'Url', 'Group',
  ];
  return valid.includes(type);
}

/**
 * Serializes form values back to Turtle for submission to the IPMS config endpoint.
 */
export function serializeFormValuesToTurtle(
  values: Record<string, unknown>,
  baseIri: string,
): string {
  const lines: string[] = [];
  const subject = baseIri;

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    const object = typeof value === 'boolean'
      ? `"${value}"^^<http://www.w3.org/2001/XMLSchema#boolean>`
      : typeof value === 'number'
        ? `"${value}"^^<http://www.w3.org/2001/XMLSchema#${Number.isInteger(value) ? 'integer' : 'decimal'}>`
        : `<${value}>`;
    lines.push(`<${subject}> <${key}> ${object} .`);
  }

  return lines.join('\n');
}
