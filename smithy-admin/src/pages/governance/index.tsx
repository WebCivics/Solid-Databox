import React, { useState } from "react";
import { useCreate } from "../../hooks/useCreate";
import { useTranslation } from "react-i18next";

export const GovernancePage = () => {
  const { mutate, isPending } = useCreate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<"role" | "odrl" | "approval" | "resolution">("role");
  const [result, setResult] = useState<unknown>(null);

  const [roleForm, setRoleForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    agent: "https://alice.example/profile#me",
    role: "https://example.org/roles/admin",
    scope: "https://example.org/",
    grantedBy: "https://admin.example/profile#me",
    grantedAt: new Date().toISOString(),
  });

  const [odrlForm, setOdrlForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    assigner: "https://org.example/#us",
    assignee: "https://alice.example/#me",
    action: "read",
    target: "https://org.example/data/financials",
  });

  const [approvalForm, setApprovalForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    requestor: "https://alice.example/#me",
    action: "publish",
    target: "https://org.example/article/1",
    approverRole: "https://org.example/roles/editor",
    status: "pending" as "pending" | "approved" | "rejected",
    reason: "",
  });

  const [resolutionForm, setResolutionForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    title: "Approve Q4 Budget",
    decision: "Allocate $50k for infrastructure",
    votesFor: 5,
    votesAgainst: 2,
    abstain: 1,
    quorum: 6,
    date: new Date().toISOString().split("T")[0],
  });

  const submitRole = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { resource: "governance", values: roleForm, meta: { action: "role-bind" } },
      { onSuccess: (data) => setResult(data.data), onError: (err) => alert(err.message) },
    );
  };

  const submitOdrl = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { resource: "governance", values: odrlForm, meta: { action: "odrl-policy" } },
      { onSuccess: (data) => setResult(data.data), onError: (err) => alert(err.message) },
    );
  };

  const submitApproval = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { resource: "governance", values: approvalForm, meta: { action: "approval-gate" } },
      { onSuccess: (data) => setResult(data.data), onError: (err) => alert(err.message) },
    );
  };

  const submitResolution = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { resource: "governance", values: resolutionForm, meta: { action: "resolution" } },
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
      <h1 className="text-3xl font-bold mb-2">{t("governance.title", "Governance")}</h1>
      <p className="text-slate-400 mb-6">{t("governance.subtitle", "Role bindings, ODRL policies, approval gates, and resolutions.")}</p>

      <div className="flex gap-2 mb-4" role="tablist">
        {tabBtn("role", "Role Binding")}
        {tabBtn("odrl", "ODRL Policy")}
        {tabBtn("approval", "Approval Gate")}
        {tabBtn("resolution", "Resolution")}
      </div>

      {tab === "role" && (
        <form onSubmit={submitRole} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="Role binding form">
          {(Object.keys(roleForm) as (keyof typeof roleForm)[]).map((key) => (
            <div key={key}>
              <label htmlFor={`role-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
              <input
                id={`role-${key}`}
                className="w-full glass-input p-3 rounded-lg font-mono text-xs"
                value={roleForm[key]}
                onChange={(e) => setRoleForm({ ...roleForm, [key]: e.target.value })}
                required
              />
            </div>
          ))}
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Binding..." : "Bind Role"}
          </button>
        </form>
      )}

      {tab === "odrl" && (
        <form onSubmit={submitOdrl} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="ODRL policy form">
          {(Object.keys(odrlForm) as (keyof typeof odrlForm)[]).map((key) => (
            <div key={key}>
              <label htmlFor={`odrl-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
              <input
                id={`odrl-${key}`}
                className="w-full glass-input p-3 rounded-lg font-mono text-xs"
                value={odrlForm[key]}
                onChange={(e) => setOdrlForm({ ...odrlForm, [key]: e.target.value })}
                required
              />
            </div>
          ))}
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Building..." : "Build Policy"}
          </button>
        </form>
      )}

      {tab === "approval" && (
        <form onSubmit={submitApproval} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="Approval gate form">
          {(Object.keys(approvalForm) as (keyof typeof approvalForm)[]).filter((k) => k !== "status").map((key) => (
            <div key={key}>
              <label htmlFor={`approval-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
              <input
                id={`approval-${key}`}
                className="w-full glass-input p-3 rounded-lg font-mono text-xs"
                value={approvalForm[key] as string}
                onChange={(e) => setApprovalForm({ ...approvalForm, [key]: e.target.value })}
                required={key !== "reason"}
              />
            </div>
          ))}
          <div>
            <label htmlFor="approval-status" className="block text-sm text-slate-400 mb-1">status</label>
            <select
              id="approval-status"
              className="w-full glass-input p-3 rounded-lg"
              value={approvalForm.status}
              onChange={(e) => setApprovalForm({ ...approvalForm, status: e.target.value as typeof approvalForm.status })}
            >
              <option value="pending" className="bg-slate-900">pending</option>
              <option value="approved" className="bg-slate-900">approved</option>
              <option value="rejected" className="bg-slate-900">rejected</option>
            </select>
          </div>
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Recording..." : "Record Gate"}
          </button>
        </form>
      )}

      {tab === "resolution" && (
        <form onSubmit={submitResolution} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="Resolution form">
          {(Object.keys(resolutionForm) as (keyof typeof resolutionForm)[]).map((key) => (
            <div key={key}>
              <label htmlFor={`res-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
              <input
                id={`res-${key}`}
                className="w-full glass-input p-3 rounded-lg"
                value={resolutionForm[key]}
                onChange={(e) => setResolutionForm({ ...resolutionForm, [key]: key.startsWith("votes") || key === "quorum" ? Number(e.target.value) : e.target.value })}
                required
              />
            </div>
          ))}
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Recording..." : "Record Resolution"}
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
