import React, { useState } from "react";
import { useCreate } from "../../hooks/useCreate";
import { useTranslation } from "react-i18next";

export const MembersPage = () => {
  const { mutate, isPending } = useCreate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<"provision" | "lifecycle" | "notify">("provision");
  const [result, setResult] = useState<unknown>(null);

  const [provisionForm, setProvisionForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    owner: "https://alice.example/profile#me",
    organisation: "https://org.example/#us",
    podUrl: "https://alice.example/",
    inboxUrl: "https://alice.example/inbox/",
    outboxUrl: "https://alice.example/outbox/",
    role: "https://org.example/roles/member",
    issuedAt: new Date().toISOString(),
  });

  const [lifecycleForm, setLifecycleForm] = useState({
    webId: "https://alice.example/profile#me",
    organisation: "https://org.example/#us",
    action: "suspend" as "suspend" | "reactivate" | "revoke",
    decidedBy: "https://admin.example/profile#me",
    decidedAt: new Date().toISOString(),
    reason: "Policy violation",
  });

  const [notifyForm, setNotifyForm] = useState({
    organisation: "https://org.example/#us",
    member: "https://alice.example/profile#me",
    memberInbox: "https://alice.example/inbox/",
    organisationInbox: "https://org.example/inbox/",
    interactionType: "inform" as "offer" | "request" | "acknowledge" | "inform",
    summary: "Your membership has been approved.",
    published: new Date().toISOString(),
  });

  const submitProvision = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { resource: "members", values: provisionForm, meta: { action: "provision" } },
      { onSuccess: (data) => setResult(data.data), onError: (err) => alert(err.message) },
    );
  };

  const submitLifecycle = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { resource: "members", values: lifecycleForm, meta: { action: "lifecycle" } },
      { onSuccess: (data) => setResult(data.data), onError: (err) => alert(err.message) },
    );
  };

  const submitNotify = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { resource: "members", values: notifyForm, meta: { action: "notify" } },
      { onSuccess: (data) => setResult(data.data), onError: (err) => alert(err.message) },
    );
  };

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === id ? "bg-[#d4af37]/15 text-[#d4af37]" : "text-slate-400 hover:text-slate-200"}`}
    >
      {label}
    </button>
  );

  return (
    <main id="main-content" className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">{t("members.title", "Members")}</h1>
      <p className="text-slate-400 mb-6">{t("members.subtitle", "Provision member pods, manage lifecycle, and send notifications via LDN.")}</p>

      <div className="flex gap-2 mb-4" role="tablist">
        {tabBtn("provision", "Provision Pod")}
        {tabBtn("lifecycle", "Lifecycle")}
        {tabBtn("notify", "Notify")}
      </div>

      {tab === "provision" && (
        <form onSubmit={submitProvision} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="Member pod provisioning form">
          {(Object.keys(provisionForm) as (keyof typeof provisionForm)[]).map((key) => (
            <div key={key}>
              <label htmlFor={`prov-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
              <input
                id={`prov-${key}`}
                className="w-full glass-input p-3 rounded-lg font-mono text-xs"
                value={provisionForm[key]}
                onChange={(e) => setProvisionForm({ ...provisionForm, [key]: e.target.value })}
                required
              />
            </div>
          ))}
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Provisioning..." : "Provision Pod"}
          </button>
        </form>
      )}

      {tab === "lifecycle" && (
        <form onSubmit={submitLifecycle} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="Member lifecycle form">
          {(Object.keys(lifecycleForm) as (keyof typeof lifecycleForm)[]).filter((k) => k !== "action").map((key) => (
            <div key={key}>
              <label htmlFor={`life-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
              <input
                id={`life-${key}`}
                className="w-full glass-input p-3 rounded-lg font-mono text-xs"
                value={lifecycleForm[key] as string}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, [key]: e.target.value })}
                required
              />
            </div>
          ))}
          <div>
            <label htmlFor="life-action" className="block text-sm text-slate-400 mb-1">action</label>
            <select
              id="life-action"
              className="w-full glass-input p-3 rounded-lg"
              value={lifecycleForm.action}
              onChange={(e) => setLifecycleForm({ ...lifecycleForm, action: e.target.value as typeof lifecycleForm.action })}
            >
              <option value="suspend" className="bg-slate-900">suspend</option>
              <option value="reactivate" className="bg-slate-900">reactivate</option>
              <option value="revoke" className="bg-slate-900">revoke</option>
            </select>
          </div>
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Recording..." : "Record Change"}
          </button>
        </form>
      )}

      {tab === "notify" && (
        <form onSubmit={submitNotify} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="Member notification form">
          {(Object.keys(notifyForm) as (keyof typeof notifyForm)[]).filter((k) => k !== "interactionType").map((key) => (
            <div key={key}>
              <label htmlFor={`notify-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
              <input
                id={`notify-${key}`}
                className="w-full glass-input p-3 rounded-lg font-mono text-xs"
                value={notifyForm[key]}
                onChange={(e) => setNotifyForm({ ...notifyForm, [key]: e.target.value })}
                required
              />
            </div>
          ))}
          <div>
            <label htmlFor="notify-type" className="block text-sm text-slate-400 mb-1">interactionType</label>
            <select
              id="notify-type"
              className="w-full glass-input p-3 rounded-lg"
              value={notifyForm.interactionType}
              onChange={(e) => setNotifyForm({ ...notifyForm, interactionType: e.target.value as typeof notifyForm.interactionType })}
            >
              <option value="offer" className="bg-slate-900">offer</option>
              <option value="request" className="bg-slate-900">request</option>
              <option value="acknowledge" className="bg-slate-900">acknowledge</option>
              <option value="inform" className="bg-slate-900">inform</option>
            </select>
          </div>
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Sending..." : "Send Notification"}
          </button>
        </form>
      )}

      {result !== null && (
        <div className="mt-6 glass-panel p-6 rounded-xl" role="status" aria-live="polite">
          <h3 className="text-lg font-bold text-[#d4af37] mb-3">Result</h3>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </main>
  );
};
