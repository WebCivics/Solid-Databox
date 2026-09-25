import React from 'react';

interface BaseFieldProps {
  label?: string;
  required?: boolean;
  placeholder?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
}

const inputClass = 'w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]/50 transition-colors';
const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';

export const TextInput: React.FC<BaseFieldProps & { minLength?: number; maxLength?: number; pattern?: string; autocomplete?: string }> = ({
  label, required, placeholder, value, onChange, readOnly, minLength, maxLength, pattern, autocomplete,
}) => (
  <div>
    {label && <label className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</label>}
    <input
      type="text"
      className={inputClass}
      placeholder={placeholder}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      minLength={minLength}
      maxLength={maxLength}
      pattern={pattern}
      autoComplete={autocomplete}
    />
  </div>
);

export const TextArea: React.FC<BaseFieldProps & { minLength?: number; maxLength?: number }> = ({
  label, required, placeholder, value, onChange, readOnly, minLength, maxLength,
}) => (
  <div>
    {label && <label className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</label>}
    <textarea
      className={`${inputClass} min-h-[100px] resize-y`}
      placeholder={placeholder}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      minLength={minLength}
      maxLength={maxLength}
    />
  </div>
);

export const BooleanField: React.FC<BaseFieldProps> = ({ label, required, value, onChange, readOnly }) => (
  <div className="flex items-center gap-3">
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        className="w-5 h-5 rounded border-white/20 bg-white/5 text-[#d4af37] focus:ring-[#d4af37]/30"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={readOnly}
      />
      {label && <span className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</span>}
    </label>
  </div>
);

export const ChoiceField: React.FC<BaseFieldProps & { from?: string[] }> = ({ label, required, placeholder, value, onChange, readOnly, from }) => (
  <div>
    {label && <label className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</label>}
    <select
      className={inputClass}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={readOnly}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {(from ?? []).map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

export const NumberField: React.FC<BaseFieldProps & { min?: number; max?: number; isInteger?: boolean }> = ({
  label, required, placeholder, value, onChange, readOnly, min, max, isInteger,
}) => (
  <div>
    {label && <label className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</label>}
    <input
      type="number"
      className={inputClass}
      placeholder={placeholder}
      value={value !== undefined ? String(value) : ''}
      onChange={(e) => onChange(isInteger ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
      readOnly={readOnly}
      min={min}
      max={max}
      step={isInteger ? 1 : 'any'}
    />
  </div>
);

export const DateField: React.FC<BaseFieldProps & { isDateTime?: boolean }> = ({ label, required, value, onChange, readOnly, isDateTime }) => (
  <div>
    {label && <label className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</label>}
    <input
      type={isDateTime ? 'datetime-local' : 'date'}
      className={inputClass}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
    />
  </div>
);

export const EmailField: React.FC<BaseFieldProps> = ({ label, required, placeholder, value, onChange, readOnly }) => (
  <div>
    {label && <label className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</label>}
    <input
      type="email"
      className={inputClass}
      placeholder={placeholder}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
    />
  </div>
);

export const UrlField: React.FC<BaseFieldProps> = ({ label, required, placeholder, value, onChange, readOnly }) => (
  <div>
    {label && <label className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</label>}
    <input
      type="url"
      className={inputClass}
      placeholder={placeholder}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
    />
  </div>
);

export const TelephoneField: React.FC<BaseFieldProps> = ({ label, required, placeholder, value, onChange, readOnly }) => (
  <div>
    {label && <label className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</label>}
    <input
      type="tel"
      className={inputClass}
      placeholder={placeholder}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
    />
  </div>
);

export const ColorField: React.FC<BaseFieldProps> = ({ label, required, value, onChange, readOnly }) => (
  <div>
    {label && <label className={labelClass}>{label}{required && <span className="text-[#d4af37]"> *</span>}</label>}
    <input
      type="color"
      className="w-full h-10 rounded-lg bg-white/5 border border-white/10 cursor-pointer"
      value={(value as string) ?? '#000000'}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
    />
  </div>
);
