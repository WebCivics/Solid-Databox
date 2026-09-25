export type UiFieldType =
  | 'TextInput'
  | 'TextArea'
  | 'Boolean'
  | 'Choice'
  | 'Integer'
  | 'Decimal'
  | 'Float'
  | 'Number'
  | 'Date'
  | 'DateTime'
  | 'Time'
  | 'Color'
  | 'Telephone'
  | 'Email'
  | 'Url'
  | 'Group';

export interface UiField {
  type: UiFieldType;
  label?: string;
  comment?: string;
  property?: string;
  required?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  placeholder?: string;
  default?: unknown;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  from?: string[];
  autocomplete?: string;
  heading?: string;
  parts?: UiField[];
}

export interface UiFormSpec {
  type: 'Form';
  label?: string;
  comment?: string;
  parts: UiField[];
  shapeIri?: string;
}

export interface UiFormValue {
  [property: string]: unknown;
}
