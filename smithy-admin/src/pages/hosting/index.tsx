import React, { useState } from "react";
import { useCreate } from "../../hooks/useCreate";
import { useTranslation } from "react-i18next";

interface HostingForm {
  apexDomain: string;
  databoxLabel: string;
  originTarget: string;
  wwwEnabled: boolean;
  proxied: boolean;
  cloudflareToken: string;
}

interface HostingPlan {
  databoxHost: string;
  wwwHost?: string;
  devicesHost: string;
  baseUrl: string;
  dnsRecords: { type: string; name: string; content: string; proxied: boolean; ttl: number }[];
  launchCommand: string;
}

interface ApplyResult {
  plan: HostingPlan;
  applied: {
    zoneId: string;
    dnsRecords: { name: string; id: string; alreadyExisted: boolean }[];
    tunnel?: { tunnelId: string; tunnelToken: string };
  };
}

const initialForm: HostingForm = {
  apexDomain: "example.org",
  databoxLabel: "databox",
  originTarget: "203.0.113.10",
  wwwEnabled: true,
  proxied: true,
  cloudflareToken: "",
};

const recordClass = (proxied: boolean) =>
  proxied
    ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
    : "bg-sky-500/15 text-sky-200 border-sky-500/40";

export const HostingPage = () => {
  const { mutate, isPending } = useCreate();
  const { t } = useTranslation();
  const [form, setForm] = useState<HostingForm>(initialForm);
  const [plan, setPlan] = useState<HostingPlan | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult["applied"] | null>(null);
  const [persistResult, setPersistResult] = useState<string | null>(null);
  const [bindResult, setBindResult] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string>("");

  const update = (key: keyof HostingForm, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setActiveAction("plan");
    mutate(
      { resource: "hosting-plans", values: form },
      {
        onSuccess: (data) => {
          setPlan(data.data as HostingPlan);
          setApplyResult(null);
          setPersistResult(null);
          setBindResult(null);
        },
        onError: (error) => alert(t("hosting.planError") + ": " + error.message),
        onSettled: () => setActiveAction(""),
      }
    );
  };

  const apply = () => {
    if (!form.cloudflareToken) {
      alert(t("hosting.cloudflareToken") + " is required.");
      return;
    }
    setActiveAction("apply");
    mutate(
      { resource: "hosting-plans", values: { ...form, cloudflareToken: form.cloudflareToken }, meta: { action: "apply" } },
      {
        onSuccess: (data) => {
          const result = data.data as ApplyResult;
          setPlan(result.plan);
          setApplyResult(result.applied);
        },
        onError: (error) => alert(t("hosting.applyError") + ": " + error.message),
        onSettled: () => setActiveAction(""),
      }
    );
  };

  const persist = () => {
    if (!plan) return;
    setActiveAction("persist");
    mutate(
      { resource: "hosting-plans", values: { ...form, zoneId: applyResult?.zoneId }, meta: { action: "persist" } },
      {
        onSuccess: (data) => setPersistResult(typeof data.data === "string" ? data.data : "Persisted."),
        onError: (error) => alert(t("hosting.persistError") + ": " + error.message),
        onSettled: () => setActiveAction(""),
      }
    );
  };

  const bind = () => {
    if (!plan) return;
    setActiveAction("bind");
    mutate(
      {
        resource: "hosting-plans",
        values: { databoxHost: plan.databoxHost, originTarget: form.originTarget, baseUrl: plan.baseUrl },
        meta: { action: "bind" },
      },
      {
        onSuccess: (data) => setBindResult(typeof data.data === "string" ? data.data : "Bound."),
        onError: (error) => alert(t("hosting.bindError") + ": " + error.message),
        onSettled: () => setActiveAction(""),
      }
    );
  };

  const downloadArtifacts = () => {
    if (!plan) return;
    const config = `tunnel: <tunnel-id>\ncredentials-file: /root/.cloudflared/<tunnel-id>.json\ningress:\n  - hostname: ${plan.databoxHost}\n    service: http://${form.originTarget}:3000\n${plan.wwwHost ? `  - hostname: ${plan.wwwHost}\n    service: http://${form.originTarget}:3000\n` : ""}  - hostname: ${plan.devicesHost}\n    service: http://${form.originTarget}:3000\n  - service: http_status:404\n`;
    const blob = new Blob([config], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cloudflared-config.yml";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main id="main-content" className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl">
      <h1 className="text-3xl font-bold mb-2">{t("hosting.title")}</h1>
      <p className="text-slate-400 mb-8 max-w-3xl">
        {t("hosting.title")} — {t("app.subtitle")}
      </p>

      <form onSubmit={submit} className="glass-panel p-6 rounded-xl shadow-lg grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" aria-label={t("hosting.title")}>
        <div>
          <label htmlFor="apexDomain" className="block text-sm text-slate-400 mb-1">{t("hosting.apexDomain")}</label>
          <input
            id="apexDomain"
            className="w-full glass-input p-3 rounded-lg"
            value={form.apexDomain}
            onChange={(e) => update("apexDomain", e.target.value)}
            placeholder={t("hosting.apexDomainPlaceholder")}
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="databoxLabel" className="block text-sm text-slate-400 mb-1">{t("hosting.databoxLabel")}</label>
          <input
            id="databoxLabel"
            className="w-full glass-input p-3 rounded-lg"
            value={form.databoxLabel}
            onChange={(e) => update("databoxLabel", e.target.value)}
            placeholder={t("hosting.databoxLabelPlaceholder")}
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="originTarget" className="block text-sm text-slate-400 mb-1">{t("hosting.originTarget")}</label>
          <input
            id="originTarget"
            className="w-full glass-input p-3 rounded-lg"
            value={form.originTarget}
            onChange={(e) => update("originTarget", e.target.value)}
            placeholder={t("hosting.originTargetPlaceholder")}
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="cloudflareToken" className="block text-sm text-slate-400 mb-1">{t("hosting.cloudflareToken")}</label>
          <input
            id="cloudflareToken"
            type="password"
            className="w-full glass-input p-3 rounded-lg"
            value={form.cloudflareToken}
            onChange={(e) => update("cloudflareToken", e.target.value)}
            placeholder={t("hosting.cloudflareTokenPlaceholder")}
            aria-describedby="tokenHelp"
          />
          <p id="tokenHelp" className="text-xs text-slate-500 mt-1">Scoped token: Zone:DNS:Edit + Account:Tunnel:Edit</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 glass-input p-3 rounded-lg cursor-pointer" htmlFor="wwwEnabled">
            <input
              id="wwwEnabled"
              type="checkbox"
              checked={form.wwwEnabled}
              onChange={(e) => update("wwwEnabled", e.target.checked)}
            />
            <span className="text-sm text-slate-200">{t("hosting.wwwEnabled")}</span>
          </label>
          <label className="flex items-center gap-3 glass-input p-3 rounded-lg cursor-pointer" htmlFor="proxied">
            <input
              id="proxied"
              type="checkbox"
              checked={form.proxied}
              onChange={(e) => update("proxied", e.target.checked)}
            />
            <span className="text-sm text-slate-200">{t("hosting.proxied")}</span>
          </label>
        </div>
        <div className="lg:col-span-2 flex flex-wrap gap-3 justify-end">
          <button type="submit" disabled={isPending && activeAction === "plan"} className="action-btn px-6 py-3" aria-busy={isPending && activeAction === "plan"}>
            {isPending && activeAction === "plan" ? t("common.loading") : t("hosting.planButton")}
          </button>
        </div>
      </form>

      {plan && (
        <section className="space-y-6" aria-label={t("hosting.dnsRecords")}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-xl">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Databox host</p>
              <p className="font-mono text-[#d4af37] break-all">{plan.databoxHost}</p>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Devices host</p>
              <p className="font-mono text-sky-300 break-all">{plan.devicesHost}</p>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">{t("hosting.baseUrl")}</p>
              <p className="font-mono text-slate-200 break-all">{plan.baseUrl}</p>
            </div>
          </div>

          <div className="glass-panel rounded-xl shadow-lg border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">{t("hosting.dnsRecords")}</h2>
            </div>
            <table className="w-full text-left text-sm" role="table">
              <thead className="bg-white/5 border-b border-white/10 text-slate-300" role="rowgroup">
                <tr role="row">
                  <th scope="col" className="p-4 font-semibold">{t("common.type")}</th>
                  <th scope="col" className="p-4 font-semibold">{t("common.name")}</th>
                  <th scope="col" className="p-4 font-semibold">Content</th>
                  <th scope="col" className="p-4 font-semibold">TTL</th>
                  <th scope="col" className="p-4 font-semibold">Proxy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5" role="rowgroup">
                {plan.dnsRecords.map((record) => (
                  <tr key={`${record.type}:${record.name}`} className="hover:bg-white/5 transition-colors" role="row">
                    <td className="p-4 font-mono text-xs text-slate-300" role="cell">{record.type}</td>
                    <td className="p-4 font-mono text-xs text-white" role="cell">{record.name}</td>
                    <td className="p-4 font-mono text-xs text-slate-400" role="cell">{record.content}</td>
                    <td className="p-4 text-xs text-slate-400" role="cell">{record.ttl === 1 ? "Auto" : record.ttl}</td>
                    <td className="p-4" role="cell">
                      <span className={`px-2 py-1 rounded text-xs font-semibold border ${recordClass(record.proxied)}`}>
                        {record.proxied ? "Proxied" : "DNS only"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-panel p-5 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-3">{t("hosting.launchCommand")}</h2>
            <div className="bg-black/40 border border-white/10 rounded-lg p-4 font-mono text-sm text-slate-200 break-all">
              {plan.launchCommand}
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h2 className="text-xl font-bold text-white">Actions</h2>
            <div className="flex flex-wrap gap-3">
              <button onClick={apply} disabled={!form.cloudflareToken || (isPending && activeAction === "apply")} className="action-btn px-6 py-3" aria-busy={isPending && activeAction === "apply"}>
                {isPending && activeAction === "apply" ? t("common.loading") : t("hosting.applyButton")}
              </button>
              <button onClick={persist} disabled={isPending && activeAction === "persist"} className="action-btn px-6 py-3" aria-busy={isPending && activeAction === "persist"}>
                {isPending && activeAction === "persist" ? t("common.loading") : t("hosting.persistButton")}
              </button>
              <button onClick={bind} disabled={isPending && activeAction === "bind"} className="action-btn px-6 py-3" aria-busy={isPending && activeAction === "bind"}>
                {isPending && activeAction === "bind" ? t("common.loading") : t("hosting.bindButton")}
              </button>
              <button onClick={downloadArtifacts} className="action-btn px-6 py-3">
                {t("hosting.downloadArtifacts")}
              </button>
            </div>

            {applyResult && (
              <div role="status" aria-live="polite" className="text-sm text-emerald-300">
                <p>{t("hosting.applySuccess")}</p>
                <p className="text-xs mt-1">Zone: {applyResult.zoneId}, Records: {applyResult.dnsRecords.length}, Tunnel: {applyResult.tunnel ? "created" : "skipped"}</p>
              </div>
            )}
            {persistResult && (
              <div role="status" aria-live="polite" className="text-sm text-emerald-300">
                <p>{t("hosting.persistSuccess")}</p>
              </div>
            )}
            {bindResult && (
              <div role="status" aria-live="polite" className="text-sm text-emerald-300">
                <p>{t("hosting.bindSuccess")}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
};
