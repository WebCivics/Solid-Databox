import { useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { useCreate } from "../../hooks/useCreate";
import { PLATFORM_ONTOLOGIES } from "../setup/platformData";

// Common data classes a portability request can target. In production these
// would be derived from each platform's published SHACL/RDF mappings; here we
// offer a representative default set the requester can trim.
const SCOPE_OPTIONS = [
  "identity:core",
  "financial:transaction_ledger",
  "financial:payment_instruments",
  "behavioral:location_history",
  "behavioral:search_history",
  "social:graph_connections",
  "ugc:media_files",
  "derived:advertising_profile",
  "health:biometrics",
];

const REGULATORY_OPTIONS = [
  "CDR (Consumer Data Right)",
  "Privacy Act 1988, APP 12",
  "GDPR Art. 20 (Data Portability)",
];

const PERSONA_DEFAULTS = {
  organisation: {
    requesterId: "urn:uuid:org-smithy-0001",
    regulatoryBasis: "CDR (Consumer Data Right)",
  },
  "natural-person": {
    requesterId: "urn:uuid:9999-0000-1111-2222",
    regulatoryBasis: "Privacy Act 1988, APP 12",
  },
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
    sent: "bg-blue-500/20 text-blue-300 border-blue-500/50",
    acknowledged: "bg-indigo-500/20 text-indigo-300 border-indigo-500/50",
    fulfilled: "bg-green-500/20 text-green-300 border-green-500/50",
    refused: "bg-red-500/20 text-red-300 border-red-500/50",
  };
  const cls = map[status] || "bg-slate-500/20 text-slate-300 border-slate-500/50";
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
};

export const DataPortabilityRegistry = () => {
  const { mutate, isPending: isCreating } = useCreate();
  const { result: outbound, query: outboundQuery } = useList({
    resource: "outbound-requests",
    pagination: { pageSize: 100 },
  });
  const { refetch } = outboundQuery;

  // Requester context (top control bar) ------------------------------------
  const [persona, setPersona] = useState<"organisation" | "natural-person">("organisation");
  const [requesterId, setRequesterId] = useState(PERSONA_DEFAULTS.organisation.requesterId);
  const [regulatoryBasis, setRegulatoryBasis] = useState(PERSONA_DEFAULTS.organisation.regulatoryBasis);

  const switchPersona = (p: "organisation" | "natural-person") => {
    setPersona(p);
    setRequesterId(PERSONA_DEFAULTS[p].requesterId);
    setRegulatoryBasis(PERSONA_DEFAULTS[p].regulatoryBasis);
  };

  // Browse / filter ---------------------------------------------------------
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(PLATFORM_ONTOLOGIES.map((p) => p.category))).sort()],
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PLATFORM_ONTOLOGIES.filter((p) => {
      const inCat = activeCategory === "All" || p.category === activeCategory;
      const inSearch = !q || p.name.toLowerCase().includes(q);
      return inCat && inSearch;
    });
  }, [search, activeCategory]);

  // Request composer (modal) ------------------------------------------------
  const [requestTarget, setRequestTarget] = useState<any>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(SCOPE_OPTIONS.slice(0, 3));
  const [lastCreated, setLastCreated] = useState<any>(null);

  const openRequest = (platform: any) => {
    setLastCreated(null);
    setSelectedScopes(SCOPE_OPTIONS.slice(0, 3));
    setRequestTarget(platform);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const submitRequest = () => {
    if (!requestTarget || selectedScopes.length === 0) return;
    mutate(
      {
        resource: "outbound-requests",
        values: {
          platformId: requestTarget.id,
          platformName: requestTarget.name,
          category: requestTarget.category,
          persona,
          requesterId,
          scope: selectedScopes,
          regulatoryBasis,
          status: "pending",
        },
      },
      {
        onSuccess: (data) => {
          setLastCreated(data.data);
          setRequestTarget(null);
          refetch();
        },
        onError: (err) => alert("Request failed: " + err.message),
      }
    );
  };

  const requests = outbound?.data || [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold mb-2">Data Portability Registry</h1>
      <p className="text-slate-400 mb-8 max-w-4xl">
        A directory of {PLATFORM_ONTOLOGIES.length} platforms across {categories.length - 1} sectors.
        Acting as an organisation or as a natural person, you can request your own data back from any
        platform — the Databox pulls the platform's SHACL/RDF mappings and issues a portability request
        under the selected regulatory basis.
      </p>

      {lastCreated && (
        <div className="mb-6 glass-panel p-4 rounded-xl border border-green-500/30 bg-green-500/5 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-green-200">
            Outbound request <span className="font-mono">{lastCreated.id}</span> to{" "}
            <span className="font-semibold">{lastCreated.platformName}</span> lodged. Due{" "}
            {new Date(lastCreated.dueDate).toLocaleDateString()}.
          </p>
        </div>
      )}

      {/* Requester context ------------------------------------------------ */}
      <div className="glass-panel p-6 rounded-xl shadow-lg mb-6">
        <h2 className="text-sm font-bold text-[#d4af37] uppercase tracking-wider mb-4">Requesting as</h2>
        <div className="flex flex-col lg:flex-row gap-6">
          <div>
            <label className="block text-xs text-slate-400 mb-2">Persona</label>
            <div className="flex rounded-lg overflow-hidden border border-white/10 w-fit">
              {(["organisation", "natural-person"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => switchPersona(p)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    persona === p ? "bg-[#d4af37] text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {p === "organisation" ? "Organisation" : "Natural person"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-2">Requester identity (URN)</label>
            <input
              className="w-full glass-input p-2.5 rounded-lg font-mono text-sm"
              value={requesterId}
              onChange={(e) => setRequesterId(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-2">Regulatory basis</label>
            <select
              className="w-full glass-input p-2.5 rounded-lg text-sm text-white appearance-none"
              value={regulatoryBasis}
              onChange={(e) => setRegulatoryBasis(e.target.value)}
            >
              {REGULATORY_OPTIONS.map((r) => (
                <option key={r} value={r} className="bg-slate-900">
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        {persona === "natural-person" && (
          <p className="text-xs text-slate-500 mt-4 italic">
            * In production a natural person initiates this from their own Databox agent; the admin
            surface can lodge it on their behalf.
          </p>
        )}
      </div>

      {/* Browse controls -------------------------------------------------- */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-center">
        <input
          className="glass-input p-3 rounded-lg w-full md:w-80"
          placeholder="Search platforms…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                activeCategory === cat
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                  : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 md:ml-auto shrink-0">{filtered.length} shown</span>
      </div>

      {/* Platform grid ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-3 p-4 rounded-lg glass-input hover:bg-white/5 transition-all"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{p.category}</span>
            </div>
            <span className="text-sm text-white font-semibold">{p.name}</span>
            <button
              onClick={() => openRequest(p)}
              className="mt-auto text-xs font-semibold text-[#d4af37] hover:text-white border border-[#d4af37]/40 hover:border-white/40 rounded-lg py-2 transition-colors"
            >
              Request my data →
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-slate-500 py-12">No platforms match your filter.</div>
        )}
      </div>

      {/* My outbound requests --------------------------------------------- */}
      <div className="glass-panel rounded-xl shadow-lg border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">My Outbound Requests</h2>
          <p className="text-sm text-slate-400 mt-1">
            Portability requests you have lodged with third-party platforms.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 border-b border-white/10 text-slate-300">
            <tr>
              <th className="p-4 font-semibold">Request ID</th>
              <th className="p-4 font-semibold">Platform</th>
              <th className="p-4 font-semibold">As</th>
              <th className="p-4 font-semibold">Scope</th>
              <th className="p-4 font-semibold">Basis</th>
              <th className="p-4 font-semibold">Due</th>
              <th className="p-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 font-mono text-xs text-slate-400">{r.id}</td>
                <td className="p-4 text-white font-medium">
                  {r.platformName}
                  <span className="block text-xs text-slate-500">{r.category}</span>
                </td>
                <td className="p-4 text-xs text-slate-300">
                  {r.persona === "organisation" ? "Organisation" : "Natural person"}
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {r.scope.map((s: string) => (
                      <span key={s} className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono">{s}</span>
                    ))}
                  </div>
                </td>
                <td className="p-4 text-xs text-slate-400">{r.regulatoryBasis}</td>
                <td className="p-4 text-xs text-slate-400">{new Date(r.dueDate).toLocaleDateString()}</td>
                <td className="p-4">{statusBadge(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && (
          <div className="p-8 text-center text-slate-500">No outbound requests lodged yet.</div>
        )}
      </div>

      {/* Request composer modal ------------------------------------------- */}
      {requestTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setRequestTarget(null)}
        >
          <div
            className="glass-panel rounded-xl shadow-2xl border border-white/10 w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-1">Request data from {requestTarget.name}</h2>
            <p className="text-sm text-slate-400 mb-5">
              Lodging as{" "}
              <span className="text-[#d4af37] font-semibold">
                {persona === "organisation" ? "an organisation" : "a natural person"}
              </span>{" "}
              under <span className="text-white">{regulatoryBasis}</span>.
            </p>

            <div className="mb-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Requester</p>
              <p className="font-mono text-sm text-slate-300 bg-black/30 p-2 rounded break-all">{requesterId}</p>
            </div>

            <label className="block text-sm text-slate-300 mb-3">Requested data scope</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {SCOPE_OPTIONS.map((scope) => {
                const on = selectedScopes.includes(scope);
                return (
                  <button
                    key={scope}
                    onClick={() => toggleScope(scope)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-left text-xs font-mono transition-all border ${
                      on ? "bg-blue-500/20 border-blue-500/50 text-white" : "glass-input border-transparent text-slate-400"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        on ? "bg-blue-500 border-blue-500" : "border-slate-500"
                      }`}
                    >
                      {on && (
                        <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {scope}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRequestTarget(null)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                disabled={isCreating || selectedScopes.length === 0}
                className="action-btn px-6 py-2 disabled:opacity-50"
              >
                {isCreating ? "Lodging…" : "Lodge Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
