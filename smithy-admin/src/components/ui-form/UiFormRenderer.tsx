import React, { useState, useEffect, useCallback } from 'react';
import type { UiField, UiFormSpec, UiFormValue } from './types';
import { parseUiShape, serializeFormValuesToTurtle } from './parseUiShape';
import {
  TextInput, TextArea, BooleanField, ChoiceField, NumberField,
  DateField, EmailField, UrlField, TelephoneField, ColorField,
} from './fields';

export interface UiFormRendererProps {
  shapeTurtle: string;
  shapeIri?: string;
  initialValues?: UiFormValue;
  onSubmit: (values: UiFormValue, turtle: string) => void;
  submitLabel?: string;
}

export const UiFormRenderer: React.FC<UiFormRendererProps> = ({
  shapeTurtle,
  shapeIri,
  initialValues = {},
  onSubmit,
  submitLabel = 'Save Configuration',
}) => {
  const [spec, setSpec] = useState<UiFormSpec | null>(null);
  const [values, setValues] = useState<UiFormValue>(initialValues);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const parsed = parseUiShape(shapeTurtle, shapeIri);
      setSpec(parsed);
      const defaults: UiFormValue = {};
      for (const part of parsed.parts) {
        if (part.property && part.default !== undefined) {
          defaults[part.property] = part.default;
        }
      }
      setValues({ ...defaults, ...initialValues });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse ui# shape');
    }
  }, [shapeTurtle, shapeIri]);

  const handleChange = useCallback((property: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [property]: value }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseIri = spec?.shapeIri ?? 'urn:databox:module-config';
    const turtle = serializeFormValuesToTurtle(values, baseIri);
    onSubmit(values, turtle);
  };

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
        <p className="font-medium">Form shape error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!spec) {
    return <div className="text-slate-400 p-4">Loading form...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {spec.label && (
        <div>
          <h2 className="text-xl font-bold text-[#d4af37]">{spec.label}</h2>
          {spec.comment && <p className="text-sm text-slate-400 mt-1">{spec.comment}</p>}
        </div>
      )}
      {spec.parts.map((field, index) => (
        <FieldRenderer
          key={`${field.property ?? index}`}
          field={field}
          value={field.property ? values[field.property] : undefined}
          onChange={(value) => field.property && handleChange(field.property, value)}
        />
      ))}
      <button
        type="submit"
        className="px-6 py-2.5 rounded-lg bg-[#d4af37] text-slate-900 font-semibold hover:bg-[#d4af37]/90 transition-colors"
      >
        {submitLabel}
      </button>
    </form>
  );
};

const FieldRenderer: React.FC<{
  field: UiField;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ field, value, onChange }) => {
  if (field.hidden) return null;

  const commonProps = {
    label: field.label,
    required: field.required,
    placeholder: field.placeholder,
    value,
    onChange,
    readOnly: field.readOnly,
  };

  switch (field.type) {
    case 'TextInput':
      return <TextInput {...commonProps} minLength={field.minLength} maxLength={field.maxLength} pattern={field.pattern} autocomplete={field.autocomplete} />;
    case 'TextArea':
      return <TextArea {...commonProps} minLength={field.minLength} maxLength={field.maxLength} />;
    case 'Boolean':
      return <BooleanField {...commonProps} />;
    case 'Choice':
      return <ChoiceField {...commonProps} from={field.from} />;
    case 'Integer':
      return <NumberField {...commonProps} min={field.min} max={field.max} isInteger />;
    case 'Number':
    case 'Decimal':
    case 'Float':
      return <NumberField {...commonProps} min={field.min} max={field.max} />;
    case 'Date':
      return <DateField {...commonProps} />;
    case 'DateTime':
      return <DateField {...commonProps} isDateTime />;
    case 'Email':
      return <EmailField {...commonProps} />;
    case 'Url':
      return <UrlField {...commonProps} />;
    case 'Telephone':
      return <TelephoneField {...commonProps} />;
    case 'Color':
      return <ColorField {...commonProps} />;
    case 'Group':
      if (field.heading) {
        return (
          <fieldset className="border border-white/10 rounded-lg p-5 space-y-4">
            <legend className="text-sm font-bold text-slate-300 uppercase tracking-wider px-2">{field.heading}</legend>
            {(field.parts ?? []).map((subField, i) => (
              <FieldRenderer
                key={`${subField.property ?? i}`}
                field={subField}
                value={subField.property ? (value as Record<string, unknown>)?.[subField.property] : undefined}
                onChange={(v) => {
                  const groupValue = (value as Record<string, unknown>) ?? {};
                  if (subField.property) {
                    onChange({ ...groupValue, [subField.property]: v });
                  }
                }}
              />
            ))}
          </fieldset>
        );
      }
      return null;
    default:
      return <TextInput {...commonProps} />;
  }
};
