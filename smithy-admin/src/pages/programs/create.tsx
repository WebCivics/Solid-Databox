import React, { useState } from "react";
import { useCreate } from "../../hooks/useCreate";
import { buildSyntheticProfile, BASELINE_PROFILE } from "../../data/institutionProfile";

type Mode = "scaffold" | "authored";

export const ProgramCreate = () => {
  const { mutate, isPending: isLoading } = useCreate();
  const [mode, setMode] = useState<Mode>("scaffold");
  const [formData, setFormData] = useState({
    profileId: "prog-synthetic-" + crypto.randomUUID().slice(0, 8),
    programUri: "https://synthetic-corp.example/program",
    databoxBaseUrl: "http://localhost:3000/databox/relationships/",
    orgName: "New Synthetic Corp",
    orgUrl: "https://synthetic-corp.example",
    jurisdiction: "AU",
    contact: "mailto:privacy@synthetic-corp.example",
  });
  const [profileJson, setProfileJson] = useState(() => JSON.stringify(BASELINE_PROFILE, null, 2));
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [k]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    let profile: unknown;
    if (mode === "authored") {
      try {
        profile = JSON.parse(profileJson);
      } catch (parseError: any) {
        setError(`Profile JSON is not valid JSON: ${parseError.message}`);
        return;
      }
    } else {
      profile = buildSyntheticProfile({
        profileId: formData.profileId,
        legalName: formData.orgName,
        jurisdiction: formData.jurisdiction,
        contact: formData.contact,
        orgUrl: formData.orgUrl,
      });
    }

    mutate(
      {
        resource: "programs",
        values: {
          profile,
          programUri: formData.programUri,
          databoxBaseUrl: formData.databoxBaseUrl,
        },
      },
      {
        onSuccess: (data) => setResult(data.data),
        // The Smithy fails closed and returns every schema violation at once.
        onError: (err: any) => setError(err?.message ?? "Registration failed."),
      }
    );
  };

  const tab = (id: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        mode === id ? "bg-[#d4af37]/15 text-[#d4af37]" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Onboard Organization</h1>
      <p className="text-slate-400 mb-6">
        Register an institution profile into the Databox Smithy. The Smithy validates the profile
        fail-closed against <span className="font-mono text-xs">dbx-institution-profile/1.0.0</span>.
      </p>

      <div className="flex gap-2 mb-4">
        {tab("scaffold", "Scaffold synthetic profile")}
        {tab("authored", "Paste authored profile")}
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4">
        {mode === "scaffold" && (
          <div className="text-xs text-slate-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            Generates a <strong>synthetic</strong> starter profile from the loyalty baseline: the record
            classes, purposes, retention and policy attestation are the template's, not this
            organisation's. It is labelled <span className="font-mono">synthetic: true</span> and makes no
            legal-compliance claim. Author a real profile for production use.
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1">Profile ID</label>
          <input className="w-full glass-input p-3 rounded-lg" value={formData.profileId} onChange={set("profileId")} required />
        </div>

        {mode === "scaffold" && (
          <>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Organization Legal Name</label>
              <input className="w-full glass-input p-3 rounded-lg" value={formData.orgName} onChange={set("orgName")} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Jurisdiction</label>
                <input className="w-full glass-input p-3 rounded-lg" value={formData.jurisdiction} onChange={set("jurisdiction")} required />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Accountability Contact</label>
                <input className="w-full glass-input p-3 rounded-lg" value={formData.contact} onChange={set("contact")} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Organization Website (URL)</label>
              <input className="w-full glass-input p-3 rounded-lg" value={formData.orgUrl} onChange={set("orgUrl")} required />
              <p className="text-xs text-slate-500 mt-1">Sets the program tenancy origin and token audience.</p>
            </div>
          </>
        )}

        {mode === "authored" && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Institution Profile (JSON)</label>
            <textarea
              className="w-full glass-input p-3 rounded-lg font-mono text-xs h-72"
              value={profileJson}
              onChange={(e) => setProfileJson(e.target.value)}
              spellCheck={false}
            />
            <p className="text-xs text-slate-500 mt-1">
              Pre-filled with the validated baseline. The Profile ID field above is not applied here —
              set <span className="font-mono">profileId</span> inside the JSON.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1">Program URI</label>
          <input className="w-full glass-input p-3 rounded-lg" value={formData.programUri} onChange={set("programUri")} required />
          <p className="text-xs text-slate-500 mt-1">The canonical identifier of the program relationship.</p>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Target Databox Base URL</label>
          <input className="w-full glass-input p-3 rounded-lg" value={formData.databoxBaseUrl} onChange={set("databoxBaseUrl")} required />
          <p className="text-xs text-slate-500 mt-1">Must be under the running CSS server's base URL.</p>
        </div>

        <button type="submit" disabled={isLoading} className="action-btn mt-2 self-start">
          {isLoading ? "Registering..." : "Register Program"}
        </button>
      </form>

      {error && (
        <div className="mt-6 glass-panel p-6 rounded-xl border border-red-500/30">
          <h3 className="text-lg font-bold text-red-400 mb-2">Registration rejected</h3>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono">{error}</pre>
        </div>
      )}

      {result?.programUri && (
        <div className="mt-8 glass-panel p-6 rounded-xl">
          <h3 className="text-xl font-bold text-[#d4af37] mb-4">Registration Successful</h3>
          <p className="text-sm font-semibold text-slate-300">Program URI:</p>
          <div className="bg-black/30 p-4 rounded-lg font-mono text-sm break-all mb-4 border border-white/10">
            {result.programUri}
          </div>
          <p className="text-sm text-slate-400">
            Registered as <strong>{result.principalLegalName}</strong>. It now appears in Programs List and
            can be used in the Mappings Simulator.
          </p>
        </div>
      )}
    </div>
  );
};
