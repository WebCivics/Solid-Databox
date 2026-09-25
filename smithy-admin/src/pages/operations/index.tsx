import React, { useState } from "react";
import { useCreate } from "../../hooks/useCreate";
import { useTranslation } from "react-i18next";

type Tab = "consent" | "delegation" | "emergency" | "household" | "inventory" | "loyalty" | "orgnetwork" | "pricing" | "a11y" | "business" | "consumer" | "i18n" | "integration" | "theming";

export const OperationsPage = () => {
  const { mutate, isPending } = useCreate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("consent");
  const [result, setResult] = useState<unknown>(null);

  const submit = (resource: string, action: string, values: Record<string, unknown>) => {
    mutate(
      { resource, values, meta: { action } },
      { onSuccess: (data) => setResult(data.data), onError: (err) => alert(err.message) },
    );
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => { setTab(id); setResult(null); }}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${tab === id ? "bg-[#d4af37]/15 text-[#d4af37]" : "text-slate-400 hover:text-slate-200"}`}
    >
      {label}
    </button>
  );

  const renderResult = () => result !== null && (
    <div className="mt-6 glass-panel p-6 rounded-xl" role="status" aria-live="polite">
      <h3 className="text-lg font-bold text-[#d4af37] mb-3">Result</h3>
      <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono">{JSON.stringify(result, null, 2)}</pre>
    </div>
  );

  return (
    <main id="main-content" className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">{t("operations.title", "Operations")}</h1>
      <p className="text-slate-400 mb-6">{t("operations.subtitle", "Phase 3 operational horizontals: consent, delegation, emergency, inventory, loyalty, pricing, and more.")}</p>

      <div className="flex gap-1 mb-4 overflow-x-auto pb-2" role="tablist">
        {tabBtn("consent", "Consent")}
        {tabBtn("delegation", "Delegation")}
        {tabBtn("emergency", "Emergency")}
        {tabBtn("household", "Household")}
        {tabBtn("inventory", "Inventory")}
        {tabBtn("loyalty", "Loyalty")}
        {tabBtn("orgnetwork", "Org Networks")}
        {tabBtn("pricing", "Pricing")}
        {tabBtn("a11y", "Accessibility")}
        {tabBtn("business", "Business Hours")}
        {tabBtn("consumer", "Consumer Rights")}
        {tabBtn("i18n", "i18n")}
        {tabBtn("integration", "Integration")}
        {tabBtn("theming", "Theming")}
      </div>

      {tab === "consent" && <ConsentForm submit={submit} isPending={isPending} />}
      {tab === "delegation" && <DelegationForm submit={submit} isPending={isPending} />}
      {tab === "emergency" && <EmergencyForm submit={submit} isPending={isPending} />}
      {tab === "household" && <HouseholdForm submit={submit} isPending={isPending} />}
      {tab === "inventory" && <InventoryForm submit={submit} isPending={isPending} />}
      {tab === "loyalty" && <LoyaltyForm submit={submit} isPending={isPending} />}
      {tab === "orgnetwork" && <OrgNetworkForm submit={submit} isPending={isPending} />}
      {tab === "pricing" && <PricingForm submit={submit} isPending={isPending} />}
      {tab === "a11y" && <A11yForm submit={submit} isPending={isPending} />}
      {tab === "business" && <BusinessForm submit={submit} isPending={isPending} />}
      {tab === "consumer" && <ConsumerForm submit={submit} isPending={isPending} />}
      {tab === "i18n" && <I18nForm submit={submit} isPending={isPending} />}
      {tab === "integration" && <IntegrationForm submit={submit} isPending={isPending} />}
      {tab === "theming" && <ThemingForm submit={submit} isPending={isPending} />}

      {renderResult()}
    </main>
  );
};

interface FormProps {
  submit: (resource: string, action: string, values: Record<string, unknown>) => void;
  isPending: boolean;
}

const FormShell: React.FC<{ title: string; onSubmit: (e: React.FormEvent) => void; isPending: boolean; btnLabel: string; children: React.ReactNode }> =
  ({ title, onSubmit, isPending, btnLabel, children }) => (
    <form onSubmit={onSubmit} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label={`${title} form`}>
      {children}
      <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
        {isPending ? "Processing..." : btnLabel}
      </button>
    </form>
  );

const ConsentForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    dataSubject: "https://alice.example/profile#me",
    controller: "https://org.example/#us",
    purpose: "marketing",
    dataCategories: "email,phone",
    legalBasis: "consent",
    granted: "true",
    timestamp: new Date().toISOString(),
  });
  return (
    <FormShell title="Consent" isPending={isPending} btnLabel="Build Consent"
      onSubmit={(e) => { e.preventDefault(); submit("consent", "build", { ...form, dataCategories: form.dataCategories.split(","), granted: form.granted === "true" }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`consent-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          {key === "granted" ? (
            <select id={`consent-${key}`} className="w-full glass-input p-3 rounded-lg" value={form.granted} onChange={(e) => setForm({ ...form, granted: e.target.value })}>
              <option value="true" className="bg-slate-900">true</option>
              <option value="false" className="bg-slate-900">false</option>
            </select>
          ) : (
            <input id={`consent-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
          )}
        </div>
      ))}
    </FormShell>
  );
};

const DelegationForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    principal: "https://alice.example/profile#me",
    delegate: "https://bob.example/profile#me",
    scope: "read,share",
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
  return (
    <FormShell title="Delegation" isPending={isPending} btnLabel="Build Delegation"
      onSubmit={(e) => { e.preventDefault(); submit("delegation", "build", { ...form, scope: form.scope.split(",") }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`del-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          <input id={`del-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
        </div>
      ))}
    </FormShell>
  );
};

const EmergencyForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    resource: "https://org.example/health/records",
    emergencyRoles: "doctor,nurse",
    requesterRole: "doctor",
    declaredEmergency: "true",
    requestedAt: new Date().toISOString(),
    reason: "Patient emergency - unconscious",
  });
  return (
    <FormShell title="Emergency" isPending={isPending} btnLabel="Evaluate Break-Glass"
      onSubmit={(e) => { e.preventDefault(); submit("emergency", "break-glass", {
        policy: { resource: form.resource, emergencyRoles: form.emergencyRoles.split(",") },
        request: { requesterRole: form.requesterRole, declaredEmergency: form.declaredEmergency === "true", requestedAt: form.requestedAt, reason: form.reason },
      }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`emrg-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          {key === "declaredEmergency" ? (
            <select id={`emrg-${key}`} className="w-full glass-input p-3 rounded-lg" value={form.declaredEmergency} onChange={(e) => setForm({ ...form, declaredEmergency: e.target.value })}>
              <option value="true" className="bg-slate-900">true</option>
              <option value="false" className="bg-slate-900">false</option>
            </select>
          ) : (
            <input id={`emrg-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
          )}
        </div>
      ))}
    </FormShell>
  );
};

const HouseholdForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    name: "Smith Household",
    members: "https://alice.example/#me,https://bob.example/#me",
  });
  return (
    <FormShell title="Household" isPending={isPending} btnLabel="Build Household"
      onSubmit={(e) => { e.preventDefault(); submit("household", "build", { ...form, members: form.members.split(",") }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`hh-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          <input id={`hh-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
        </div>
      ))}
    </FormShell>
  );
};

const InventoryForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    product: "https://shop.example/products/widget",
    sku: "WGT-001",
    onHand: "100",
    reserved: "20",
    requested: "50",
    checkedAt: new Date().toISOString(),
  });
  return (
    <FormShell title="Inventory" isPending={isPending} btnLabel="Check Stock"
      onSubmit={(e) => { e.preventDefault(); submit("inventory", "check", {
        onHand: Number(form.onHand), reserved: Number(form.reserved), requested: Number(form.requested),
      }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`inv-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          <input id={`inv-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
        </div>
      ))}
    </FormShell>
  );
};

const LoyaltyForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    balance: "500",
    spendAmount: "120.00",
    earnRatePer: "0.1",
    redeemPoints: "200",
    redeemValuePer: "0.05",
  });
  return (
    <FormShell title="Loyalty" isPending={isPending} btnLabel="Apply Loyalty"
      onSubmit={(e) => { e.preventDefault(); submit("loyalty", "apply", {
        balance: Number(form.balance), spendAmount: Number(form.spendAmount), earnRatePer: Number(form.earnRatePer),
        redeemPoints: Number(form.redeemPoints), redeemValuePer: Number(form.redeemValuePer),
      }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`loy-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          <input id={`loy-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
        </div>
      ))}
    </FormShell>
  );
};

const OrgNetworkForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    org: "https://org.example/chapter1",
    name: "Chapter 1",
    parent: "https://org.example/#us",
  });
  return (
    <FormShell title="Org Network" isPending={isPending} btnLabel="Build Org Unit"
      onSubmit={(e) => { e.preventDefault(); submit("orgnetwork", "unit", form); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`org-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          <input id={`org-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
        </div>
      ))}
    </FormShell>
  );
};

const PricingForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    quantity: "100",
    moq: "10",
    tiers: '[{"minQuantity":1,"unitPrice":5.00},{"minQuantity":50,"unitPrice":4.00},{"minQuantity":100,"unitPrice":3.50}]',
  });
  return (
    <FormShell title="Pricing" isPending={isPending} btnLabel="Compute Wholesale"
      onSubmit={(e) => { e.preventDefault(); submit("pricing", "wholesale", {
        quantity: Number(form.quantity), moq: Number(form.moq), tiers: JSON.parse(form.tiers),
      }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`price-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          {key === "tiers" ? (
            <textarea id={`price-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" rows={4} value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
          ) : (
            <input id={`price-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
          )}
        </div>
      ))}
    </FormShell>
  );
};

const A11yForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    media: '[{"type":"image","alt":"Product photo"}]',
    controls: '[{"kind":"button","label":"Submit"}]',
  });
  return (
    <FormShell title="Accessibility" isPending={isPending} btnLabel="Run Audit"
      onSubmit={(e) => { e.preventDefault(); submit("a11y", "audit", {
        media: JSON.parse(form.media), controls: JSON.parse(form.controls),
      }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`a11y-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          <textarea id={`a11y-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" rows={4} value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
        </div>
      ))}
    </FormShell>
  );
};

const BusinessForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    hours: '[{"day":"Mo","opens":"09:00","closes":"17:00"},{"day":"Tu","opens":"09:00","closes":"17:00"}]',
  });
  return (
    <FormShell title="Business Hours" isPending={isPending} btnLabel="Build Hours"
      onSubmit={(e) => { e.preventDefault(); submit("business", "hours-build", {
        id: form.id, hours: JSON.parse(form.hours),
      }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`biz-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          {key === "hours" ? (
            <textarea id={`biz-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" rows={4} value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
          ) : (
            <input id={`biz-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
          )}
        </div>
      ))}
    </FormShell>
  );
};

const ConsumerForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    dataSubject: "https://alice.example/profile#me",
    controller: "https://org.example/#us",
    scope: "order_history,payment_records",
    submittedAt: new Date().toISOString(),
    dueDays: "30",
  });
  return (
    <FormShell title="Consumer Rights" isPending={isPending} btnLabel="Submit Access Request"
      onSubmit={(e) => { e.preventDefault(); submit("consumer", "access-request", {
        ...form, scope: form.scope.split(","), dueDays: Number(form.dueDays),
      }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`cons-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          <input id={`cons-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
        </div>
      ))}
    </FormShell>
  );
};

const I18nForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    acceptLanguage: "en-US,en;q=0.9,fr;q=0.6",
    available: "en-US,fr-FR,de-DE",
    defaultLocale: "en-US",
  });
  return (
    <FormShell title="i18n" isPending={isPending} btnLabel="Negotiate Locale"
      onSubmit={(e) => { e.preventDefault(); submit("i18n", "negotiate", {
        acceptLanguage: form.acceptLanguage, available: form.available.split(","), defaultLocale: form.defaultLocale,
      }); }}>
      {Object.entries(form).map(([key, val]) => (
        <div key={key}>
          <label htmlFor={`i18n-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
          <input id={`i18n-${key}`} className="w-full glass-input p-3 rounded-lg font-mono text-xs" value={val} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />
        </div>
      ))}
    </FormShell>
  );
};

const IntegrationForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    manifest: '{"id":"erp-sync","name":"ERP Sync","version":"1.0.0","description":"ERP to pod sync","source":{"kind":"odbc","sourceRef":"urn:source:erp"},"modes":["import-snapshot"],"mapping":{"language":"r2rml","contentType":"text/turtle","turtle":"@prefix rr: <http://www.w3.org/ns/r2rml#>. <#TM> a rr:TriplesMap; rr:logicalTable [rr:tableName \"customers\"]."},"target":{"podBaseIri":"https://pod.example/data/"}}',
  });
  return (
    <FormShell title="Integration" isPending={isPending} btnLabel="Validate Manifest"
      onSubmit={(e) => { e.preventDefault(); submit("integration", "manifest-validate", JSON.parse(form.manifest)); }}>
      <div>
        <label htmlFor="int-manifest" className="block text-sm text-slate-400 mb-1">manifest (JSON)</label>
        <textarea id="int-manifest" className="w-full glass-input p-3 rounded-lg font-mono text-xs" rows={8} value={form.manifest} onChange={(e) => setForm({ ...form, manifest: e.target.value })} required />
      </div>
    </FormShell>
  );
};

const ThemingForm: React.FC<FormProps> = ({ submit, isPending }) => {
  const [form, setForm] = useState({
    theme: '{"type":"DataboxTheme","id":"default-light","name":"Default Light","version":"1.0.0","tokens":{"color":{"primary":{"$value":"#d4af37","$type":"color"},"bg":{"$value":"#ffffff","$type":"color"}},"space":{"md":{"$value":"1rem","$type":"dimension"}}}}',
  });
  return (
    <FormShell title="Theming" isPending={isPending} btnLabel="Validate Theme"
      onSubmit={(e) => { e.preventDefault(); submit("theming", "validate", JSON.parse(form.theme)); }}>
      <div>
        <label htmlFor="theme-input" className="block text-sm text-slate-400 mb-1">theme package (JSON)</label>
        <textarea id="theme-input" className="w-full glass-input p-3 rounded-lg font-mono text-xs" rows={8} value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} required />
      </div>
    </FormShell>
  );
};
