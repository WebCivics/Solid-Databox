import { useEffect, useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { useCreate } from "../../hooks/useCreate";

const statusClass = (module: any) => {
  if (!module.available) return "bg-red-500/10 text-red-200 border-red-500/35";
  if (module.enabled) return "bg-green-500/10 text-green-200 border-green-500/35";
  return "bg-slate-500/10 text-slate-300 border-slate-500/35";
};

const statusLabel = (module: any) => {
  if (!module.available) return "Unavailable";
  return module.enabled ? "Installed, enabled" : "Installed, disabled";
};

const defaultPreview = (module: any) => {
  if (module.defaultConfig?.turtle) return module.defaultConfig.turtle;
  return "<no RDF defaults>";
};

export const VerticalProfilePicker = () => {
  const { result, query } = useList({
    resource: "ipms-vertical-profiles",
    pagination: { pageSize: 20 },
  });
  const { mutate, isPending } = useCreate();
  const profiles = useMemo(() => result?.data ?? [], [result?.data]);
  const meta = result?.meta ?? {};
  const [selectedId, setSelectedId] = useState("");
  const [operationResult, setOperationResult] = useState<any>(null);

  useEffect(() => {
    if (!selectedId && profiles.length > 0) {
      setSelectedId(String(profiles[0].id));
    }
  }, [profiles, selectedId]);

  const selected = useMemo(
    () => profiles.find((profile: any) => profile.id === selectedId) ?? profiles[0],
    [profiles, selectedId]
  );

  const runOperation = (operation: "preview" | "apply") => {
    if (!selected) return;
    mutate(
      {
        resource: "ipms-vertical-profile-applications",
        values: { profileId: selected.id, operation },
      },
      {
        onSuccess: (data) => setOperationResult(data.data),
        onError: (error) => alert(`Vertical profile ${operation} failed: ${error.message}`),
      }
    );
  };

  const controlPlaneAvailable = selected?.controlPlaneAvailable !== false && meta.controlPlaneAvailable !== false;
  const modeReason =
    selected?.degradationReason ??
    meta.degradationReason ??
    "CSS-enhanced mode can preview and apply these declarative defaults.";

  return (
    <section className="glass-panel p-6 rounded-xl shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="lg:w-80 shrink-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Vertical Profile</h2>
              <p className="text-sm text-slate-400 mt-1">
                Choose an ANZSIC-aligned bundle of horizontal IPMS modules for onboarding defaults.
              </p>
            </div>
            <span
              className={`px-2 py-1 rounded text-xs font-semibold border ${
                controlPlaneAvailable
                  ? "bg-violet-500/10 text-violet-200 border-violet-500/30"
                  : "bg-amber-500/10 text-amber-200 border-amber-500/30"
              }`}
            >
              {controlPlaneAvailable ? "CSS-enhanced" : "portable-core"}
            </span>
          </div>

          {(meta.providerMode === "standard-solid" || !controlPlaneAvailable || meta.degraded) && (
            <div className="mb-4 border border-amber-500/30 bg-amber-500/10 rounded-lg px-4 py-3 text-sm text-amber-100">
              <span className="font-semibold">Standard-Solid degradation</span>
              <span className="text-amber-200/80"> - {modeReason}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {profiles.map((profile: any) => (
              <button
                type="button"
                key={profile.id}
                onClick={() => {
                  setSelectedId(profile.id);
                  setOperationResult(null);
                }}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  selected?.id === profile.id
                    ? "border-[#d4af37]/60 bg-[#d4af37]/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{profile.name}</p>
                  <span className="text-xs text-slate-400">{profile.useCases?.join(", ")}</span>
                </div>
                <p className="font-mono text-xs text-slate-500 mt-1">{profile.id}</p>
                <p className="text-xs text-slate-400 mt-2">{profile.description}</p>
                {profile.missingModules?.length > 0 && (
                  <p className="text-xs text-red-200 mt-2">
                    Missing {profile.missingModules.length} module{profile.missingModules.length === 1 ? "" : "s"}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {query.isLoading && <div className="text-slate-500 p-8 text-center">Loading vertical profiles...</div>}
          {!query.isLoading && !selected && (
            <div className="text-slate-500 p-8 text-center">No vertical profiles are exposed by this provider.</div>
          )}

          {selected && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{selected.name}</h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-2xl">{selected.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending || !controlPlaneAvailable}
                    onClick={() => runOperation("preview")}
                    className="action-btn px-4 py-2 text-sm disabled:opacity-40"
                    title={!controlPlaneAvailable ? "Previewing through the provider requires CSS-enhanced mode." : undefined}
                  >
                    Preview defaults
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !controlPlaneAvailable || !selected.canApply}
                    onClick={() => runOperation("apply")}
                    className="action-btn px-4 py-2 text-sm disabled:opacity-40"
                    title={
                      !controlPlaneAvailable
                        ? "Applying defaults requires the CSS-enhanced control plane."
                        : !selected.canApply
                          ? selected.degradationReason
                          : undefined
                    }
                  >
                    Apply defaults
                  </button>
                </div>
              </div>

              {selected.degradationReason && (
                <div className="border border-amber-500/30 bg-amber-500/10 rounded-lg px-4 py-3 text-sm text-amber-100">
                  {selected.degradationReason}
                </div>
              )}

              <div className="overflow-x-auto border border-white/10 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 border-b border-white/10 text-slate-300">
                    <tr>
                      <th className="p-3 font-semibold">Module</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Default</th>
                      <th className="p-3 font-semibold">Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selected.modules?.map((module: any) => (
                      <tr key={module.moduleId} className="align-top">
                        <td className="p-3">
                          <p className="font-mono text-xs text-white">{module.moduleId}</p>
                          <p className="text-xs text-slate-500 mt-1">{module.capabilityMode}</p>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold border ${statusClass(module)}`}>
                            {statusLabel(module)}
                          </span>
                          {module.unavailableReason && (
                            <p className="text-xs text-slate-500 mt-2 max-w-[13rem]">{module.unavailableReason}</p>
                          )}
                        </td>
                        <td className="p-3">
                          <pre className="bg-black/30 border border-white/10 rounded p-2 text-xs text-slate-300 whitespace-pre-wrap break-words max-w-sm">
                            {defaultPreview(module)}
                          </pre>
                        </td>
                        <td className="p-3 text-slate-400 max-w-md">{module.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {operationResult && (
                <div className="border border-green-500/30 bg-green-500/10 rounded-lg px-4 py-3">
                  <p className="text-sm font-semibold text-green-200">
                    {operationResult.persisted ? "Defaults applied" : "Defaults previewed"} for {operationResult.name}.
                  </p>
                  <p className="text-xs text-green-100/70 mt-1">
                    {operationResult.defaults?.length ?? 0} module default record{operationResult.defaults?.length === 1 ? "" : "s"} returned by the provider.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
