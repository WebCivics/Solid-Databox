import { describe, it, expect } from 'vitest';
import { parseUiShape, serializeFormValuesToTurtle } from '../parseUiShape';

const SAMPLE_SHAPE = `
@prefix ui: <http://www.w3.org/ns/ui#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<#MyForm> a ui:Form ;
  rdfs:label "My Configuration" ;
  rdfs:comment "Configure your module." ;
  ui:parts (
    [
      a ui:TextInput ;
      ui:label "Name" ;
      ui:property "urn:test:name" ;
      ui:required "true" ;
      ui:placeholder "Enter name" ;
      ui:default "Default Name" ;
    ]
    [
      a ui:Boolean ;
      ui:label "Enabled" ;
      ui:property "urn:test:enabled" ;
      ui:default "true" ;
    ]
    [
      a ui:Integer ;
      ui:label "Port" ;
      ui:property "urn:test:port" ;
      ui:min "1" ;
      ui:max "65535" ;
      ui:default "8080" ;
    ]
    [
      a ui:Choice ;
      ui:label "Mode" ;
      ui:property "urn:test:mode" ;
      ui:from ( <#option-a> <#option-b> ) ;
    ]
  ) .
`;

describe('parseUiShape', () => {
  it('parses a ui:Form with label and comment', () => {
    const spec = parseUiShape(SAMPLE_SHAPE);
    expect(spec.type).toBe('Form');
    expect(spec.label).toBe('My Configuration');
    expect(spec.comment).toBe('Configure your module.');
  });

  it('parses all 4 fields', () => {
    const spec = parseUiShape(SAMPLE_SHAPE);
    expect(spec.parts).toHaveLength(4);
  });

  it('parses TextInput field with properties', () => {
    const spec = parseUiShape(SAMPLE_SHAPE);
    const nameField = spec.parts[0];
    expect(nameField.type).toBe('TextInput');
    expect(nameField.label).toBe('Name');
    expect(nameField.property).toBe('urn:test:name');
    expect(nameField.required).toBe(true);
    expect(nameField.placeholder).toBe('Enter name');
    expect(nameField.default).toBe('Default Name');
  });

  it('parses Boolean field with default', () => {
    const spec = parseUiShape(SAMPLE_SHAPE);
    const boolField = spec.parts[1];
    expect(boolField.type).toBe('Boolean');
    expect(boolField.default).toBe(true);
  });

  it('parses Integer field with min/max', () => {
    const spec = parseUiShape(SAMPLE_SHAPE);
    const intField = spec.parts[2];
    expect(intField.type).toBe('Integer');
    expect(intField.min).toBe(1);
    expect(intField.max).toBe(65535);
    expect(intField.default).toBe(8080);
  });

  it('parses Choice field with options', () => {
    const spec = parseUiShape(SAMPLE_SHAPE);
    const choiceField = spec.parts[3];
    expect(choiceField.type).toBe('Choice');
    expect(choiceField.from).toBeDefined();
    expect(choiceField.from!.length).toBeGreaterThanOrEqual(1);
  });

  it('throws when no ui:Form is found', () => {
    expect(() => parseUiShape('@prefix ex: <http://example.org/> . ex:a ex:b ex:c .'))
      .toThrow('No ui:Form found');
  });

  it('uses shapeIri to select a specific form', () => {
    const turtle = `
      @prefix ui: <http://www.w3.org/ns/ui#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      <#Form1> a ui:Form ; rdfs:label "Form One" ; ui:parts () .
      <#Form2> a ui:Form ; rdfs:label "Form Two" ; ui:parts () .
    `;
    const spec = parseUiShape(turtle, '#Form2');
    expect(spec.label).toBe('Form Two');
  });
});

describe('serializeFormValuesToTurtle', () => {
  it('serializes string values as URI references', () => {
    const turtle = serializeFormValuesToTurtle(
      { 'urn:test:name': 'Alice' },
      'urn:test:subject',
    );
    expect(turtle).toContain('<urn:test:subject>');
    expect(turtle).toContain('<urn:test:name>');
    expect(turtle).toContain('<Alice>');
  });

  it('serializes boolean values as typed literals', () => {
    const turtle = serializeFormValuesToTurtle(
      { 'urn:test:enabled': true },
      'urn:test:subject',
    );
    expect(turtle).toContain('"true"^^<http://www.w3.org/2001/XMLSchema#boolean>');
  });

  it('serializes integer values as typed literals', () => {
    const turtle = serializeFormValuesToTurtle(
      { 'urn:test:port': 8080 },
      'urn:test:subject',
    );
    expect(turtle).toContain('"8080"^^<http://www.w3.org/2001/XMLSchema#integer>');
  });

  it('serializes decimal values as typed literals', () => {
    const turtle = serializeFormValuesToTurtle(
      { 'urn:test:price': 9.99 },
      'urn:test:subject',
    );
    expect(turtle).toContain('"9.99"^^<http://www.w3.org/2001/XMLSchema#decimal>');
  });

  it('skips undefined, null, and empty string values', () => {
    const turtle = serializeFormValuesToTurtle(
      { 'urn:test:a': undefined, 'urn:test:b': null, 'urn:test:c': '', 'urn:test:d': 'value' },
      'urn:test:subject',
    );
    expect(turtle).not.toContain('urn:test:a');
    expect(turtle).not.toContain('urn:test:b');
    expect(turtle).not.toContain('urn:test:c');
    expect(turtle).toContain('urn:test:d');
  });
});
