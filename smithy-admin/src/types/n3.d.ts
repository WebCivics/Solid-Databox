declare module 'n3' {
  export interface Quad {
    subject: Term;
    predicate: Term;
    object: Term;
    graph: Term;
  }

  export interface Term {
    termType: string;
    value: string;
    equals?: (other: Term) => boolean;
  }

  export type NamedNode = Term;
  export type Literal = Term & { language?: string; datatype?: Term };
  export type BlankNode = Term;
  export type Variable = Term;
  export type DefaultGraph = Term;

  export class DataFactory {
    static namedNode(value: string): NamedNode;
    static literal(value: string, languageOrDatatype?: string | Term): Literal;
    static blankNode(value?: string): BlankNode;
    static variable(value: string): Variable;
    static defaultGraph(): DefaultGraph;
    static quad(subject: Term, predicate: Term, object: Term, graph?: Term): Quad;
  }

  export class Parser {
    constructor(options?: { baseIRI?: string; format?: string });
    parse(input: string, callback?: (error: Error | null, quad: Quad | null, prefixes: Record<string, string>) => void): Quad[];
    parseAsync(input: string, options?: Record<string, unknown>): Promise<Quad[]>;
  }

  export class Writer {
    constructor(options?: { format?: string; prefixes?: Record<string, string> });
    addQuad(quad: Quad): void;
    end(callback?: (error: Error | null, result: string) => void): void;
    end(): Promise<string>;
  }

  export class Store {
    constructor(quads?: Quad[]);
    addQuad(quad: Quad): void;
    getQuads(subject?: Term | null, predicate?: Term | null, object?: Term | null, graph?: Term | null): Quad[];
    removeQuad(quad: Quad): void;
    countQuads(subject?: Term | null, predicate?: Term | null, object?: Term | null, graph?: Term | null): number;
  }

  export function fromRdf(input: string, options?: Record<string, unknown>): Quad[];
  export function toRdf(quads: Quad[], options?: Record<string, unknown>): string;
}
