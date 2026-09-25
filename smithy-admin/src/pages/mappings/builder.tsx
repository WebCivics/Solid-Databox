import { useState } from "react";

interface SourceColumn {
  name: string;
  dataType?: string;
  nullable?: boolean;
}

interface FieldMappingRow {
  predicate: string;
  sourceColumn: string;
  constantValue: string;
  languageTag: string;
  datatype: string;
  isUri: boolean;
}

const SCHEMA_PREFIX = "https://schema.org/";

export const MappingBuilder = () => {
  const [sourceType, setSourceType] = useState<"odbc" | "ldap">("odbc");
  const [connectionString, setConnectionString] = useState("");
  const [query, setQuery] = useState("");
  const [ldapUrl, setLdapUrl] = useState("");
  const [ldapBindDn, setLdapBindDn] = useState("");
  const [ldapSearchBase, setLdapSearchBase] = useState("");
  const [columns, setColumns] = useState<SourceColumn[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [mappingName, setMappingName] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("urn:source:{id}");
  const [rdfClass, setRdfClass] = useState(`${SCHEMA_PREFIX}Thing`);
  const [fieldMappings, setFieldMappings] = useState<FieldMappingRow[]>([]);
  const [previewRdf, setPreviewRdf] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savedMapping, setSavedMapping] = useState<string | null>(null);

  const ipmsApiUrl = import.meta.env.VITE_CMS_API_URL ?? "";
  const ipmsToken = import.meta.env.VITE_CMS_TOKEN ?? "";

  const browseSchema = async () => {
    setSchemaLoading(true);
    setSchemaError(null);
    setColumns([]);
    try {
      if (sourceType === "odbc") {
        const res = await fetch(`${ipmsApiUrl}/.databox/ipms/connectors/odbc/schema`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ipmsToken}`,
          },
          body: JSON.stringify({ connectionString }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "Failed to browse schema" }));
          throw new Error(err.message ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        setColumns(data.tables?.flatMap((t: { columns?: SourceColumn[]; name: string }) =>
          (t.columns ?? []).map((c: SourceColumn) => c)
        ) ?? []);
      } else {
        const res = await fetch(`${ipmsApiUrl}/.databox/ipms/connectors/ldap/schema`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ipmsToken}`,
          },
          body: JSON.stringify({ url: ldapUrl, bindDn: ldapBindDn, searchBase: ldapSearchBase }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "Failed to browse schema" }));
          throw new Error(err.message ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        setColumns(data.attributes ?? []);
      }
    } catch (e: unknown) {
      setSchemaError(e instanceof Error ? e.message : String(e));
    } finally {
      setSchemaLoading(false);
    }
  };

  const addFieldMapping = () => {
    setFieldMappings([...fieldMappings, {
      predicate: "",
      sourceColumn: "",
      constantValue: "",
      languageTag: "",
      datatype: "",
      isUri: false,
    }]);
  };

  const updateFieldMapping = (index: number, field: keyof FieldMappingRow, value: string | boolean) => {
    setFieldMappings(fieldMappings.map((m, i) =>
      i === index ? { ...m, [field]: value } : m
    ));
  };

  const removeFieldMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const buildMappingDefinition = () => ({
    id: mappingName.replace(/\s+/g, "-").toLowerCase() || "mapping",
    name: mappingName || "Unnamed Mapping",
    sourceType,
    triplesMaps: [{
      id: "TriplesMap1",
      subjectTemplate,
      classes: rdfClass ? [rdfClass] : [],
      fields: fieldMappings
        .filter((f) => f.predicate && (f.sourceColumn || f.constantValue))
        .map((f) => ({
          predicate: f.predicate,
          sourceColumn: f.sourceColumn || undefined,
          constantValue: f.constantValue || undefined,
          languageTag: f.languageTag || undefined,
          datatype: f.datatype || undefined,
          isUri: f.isUri,
        })),
    }],
  });

  const preview = async () => {
    setPreviewLoading(true);
    setPreviewRdf(null);
    try {
      const mapping = buildMappingDefinition();
      const body = sourceType === "odbc"
        ? { type: "odbc", odbc: { connectionString, query }, mappingTurtle: JSON.stringify(mapping) }
        : { type: "ldap", ldap: { url: ldapUrl, bindDn: ldapBindDn, searchBase: ldapSearchBase }, mappingTurtle: JSON.stringify(mapping) };

      const res = await fetch(`${ipmsApiUrl}/.databox/ipms/connectors/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ipmsToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Preview failed" }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPreviewRdf(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setPreviewRdf(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const saveMapping = async () => {
    try {
      const mapping = buildMappingDefinition();
      const res = await fetch(`${ipmsApiUrl}/.databox/ipms/connectors/mappings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ipmsToken}`,
        },
        body: JSON.stringify(mapping),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setSavedMapping(data.id ?? "Saved");
    } catch (e: unknown) {
      setSavedMapping(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">R2RML/RML Mapping Builder</h1>
      <p className="text-slate-400 mb-8">
        Connect to an enterprise data source, browse its schema, and map fields to RDF predicates.
      </p>

      {/* Source Configuration */}
      <div className="glass-panel p-6 rounded-xl shadow-lg mb-6">
        <h2 className="text-xl font-bold text-white mb-4">1. Connect to Source</h2>

        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={sourceType === "odbc"}
              onChange={() => setSourceType("odbc")}
              className="accent-[#d4af37]"
            />
            <span className="text-slate-300">ODBC</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={sourceType === "ldap"}
              onChange={() => setSourceType("ldap")}
              className="accent-[#d4af37]"
            />
            <span className="text-slate-300">LDAP</span>
          </label>
        </div>

        {sourceType === "odbc" ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Connection String</label>
              <input
                className="w-full glass-input p-3 rounded-lg font-mono text-sm"
                placeholder="DSN=MyDSN;UID=user;PWD=pass"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Query (for preview)</label>
              <textarea
                className="w-full glass-input p-3 rounded-lg font-mono text-sm"
                rows={3}
                placeholder="SELECT * FROM organizations"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">LDAP URL</label>
              <input
                className="w-full glass-input p-3 rounded-lg font-mono text-sm"
                placeholder="ldap://host:389"
                value={ldapUrl}
                onChange={(e) => setLdapUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bind DN</label>
              <input
                className="w-full glass-input p-3 rounded-lg font-mono text-sm"
                placeholder="cn=admin,dc=example,dc=com"
                value={ldapBindDn}
                onChange={(e) => setLdapBindDn(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Search Base</label>
              <input
                className="w-full glass-input p-3 rounded-lg font-mono text-sm"
                placeholder="dc=example,dc=com"
                value={ldapSearchBase}
                onChange={(e) => setLdapSearchBase(e.target.value)}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={browseSchema}
          disabled={schemaLoading || (sourceType === "odbc" ? !connectionString : !ldapUrl)}
          className="action-btn mt-4 self-start"
        >
          {schemaLoading ? "Browsing..." : "Browse Schema"}
        </button>

        {schemaError && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {schemaError}
          </div>
        )}

        {columns.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-400 mb-2">Available columns/attributes:</p>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => (
                <span
                  key={col.name}
                  className="px-2 py-1 rounded text-xs font-mono bg-white/5 border border-white/10 text-slate-300"
                >
                  {col.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mapping Definition */}
      <div className="glass-panel p-6 rounded-xl shadow-lg mb-6">
        <h2 className="text-xl font-bold text-white mb-4">2. Define Mapping</h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Mapping Name</label>
            <input
              className="w-full glass-input p-3 rounded-lg"
              placeholder="Organization Mapping"
              value={mappingName}
              onChange={(e) => setMappingName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Subject IRI Template</label>
            <input
              className="w-full glass-input p-3 rounded-lg font-mono text-sm"
              placeholder="urn:source:{id}"
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              Use <code className="text-[#d4af37]">{"{column}"}</code> placeholders for row values.
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">RDF Class (rdf:type)</label>
            <input
              className="w-full glass-input p-3 rounded-lg font-mono text-sm"
              placeholder={`${SCHEMA_PREFIX}Organization`}
              value={rdfClass}
              onChange={(e) => setRdfClass(e.target.value)}
            />
          </div>
        </div>

        {/* Field Mappings */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-200">Field Mappings</h3>
            <button
              type="button"
              onClick={addFieldMapping}
              className="px-3 py-1.5 text-xs rounded-md border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            >
              + Add Field
            </button>
          </div>

          {fieldMappings.length === 0 && (
            <p className="text-sm text-slate-500 italic">No field mappings yet. Click "Add Field" to start.</p>
          )}

          {fieldMappings.map((fm, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-center">
              <input
                className="col-span-4 glass-input p-2 rounded text-xs font-mono"
                placeholder="predicate (e.g. https://schema.org/name)"
                value={fm.predicate}
                onChange={(e) => updateFieldMapping(index, "predicate", e.target.value)}
              />
              {columns.length > 0 ? (
                <select
                  className="col-span-3 glass-input p-2 rounded text-xs"
                  value={fm.sourceColumn}
                  onChange={(e) => updateFieldMapping(index, "sourceColumn", e.target.value)}
                >
                  <option value="">— column —</option>
                  {columns.map((col) => (
                    <option key={col.name} value={col.name} className="bg-slate-900">
                      {col.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="col-span-3 glass-input p-2 rounded text-xs"
                  placeholder="source column"
                  value={fm.sourceColumn}
                  onChange={(e) => updateFieldMapping(index, "sourceColumn", e.target.value)}
                />
              )}
              <input
                className="col-span-2 glass-input p-2 rounded text-xs"
                placeholder="constant"
                value={fm.constantValue}
                onChange={(e) => updateFieldMapping(index, "constantValue", e.target.value)}
              />
              <input
                className="col-span-1 glass-input p-2 rounded text-xs"
                placeholder="lang"
                value={fm.languageTag}
                onChange={(e) => updateFieldMapping(index, "languageTag", e.target.value)}
              />
              <label className="col-span-1 flex items-center gap-1 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={fm.isUri}
                  onChange={(e) => updateFieldMapping(index, "isUri", e.target.checked)}
                  className="accent-[#d4af37]"
                />
                URI
              </label>
              <button
                type="button"
                onClick={() => removeFieldMapping(index)}
                className="col-span-1 text-red-400 hover:text-red-300 text-lg"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview & Save */}
      <div className="glass-panel p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4">3. Preview & Save</h2>

        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={preview}
            disabled={previewLoading}
            className="action-btn"
          >
            {previewLoading ? "Generating..." : "Preview RDF"}
          </button>
          <button
            type="button"
            onClick={saveMapping}
            className="px-4 py-2 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 transition-colors"
          >
            Save Mapping
          </button>
        </div>

        {previewRdf && (
          <div>
            <p className="text-sm text-slate-400 mb-2">RDF Preview (JSON-LD):</p>
            <pre className="bg-black/30 p-4 rounded-lg font-mono text-xs text-slate-300 max-h-80 overflow-y-auto border border-white/10">
              {previewRdf}
            </pre>
          </div>
        )}

        {savedMapping && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            Mapping saved: {savedMapping}
          </div>
        )}
      </div>
    </div>
  );
};
