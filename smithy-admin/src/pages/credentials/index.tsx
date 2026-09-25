import React, { useState } from "react";
import { useCreate } from "../../hooks/useCreate";
import { useTranslation } from "react-i18next";

export const CredentialsPage = () => {
  const { mutate, isPending } = useCreate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<"issue" | "verify" | "revoke">("issue");
  const [result, setResult] = useState<unknown>(null);

  const [issueForm, setIssueForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    issuer: "https://org.example/#us",
    subject: "https://alice.example/#me",
    claim: "holds valid WWCC",
    expires: "2026-12-31T00:00:00Z",
  });

  const [verifyForm, setVerifyForm] = useState({
    credential: "",
    expectedIssuer: "https://org.example/#us",
    now: new Date().toISOString(),
  });

  const [revokeForm, setRevokeForm] = useState({
    id: "urn:uuid:" + crypto.randomUUID(),
    revokedBy: "https://admin.example/#me",
    revokedAt: new Date().toISOString(),
    reason: "Key compromise",
  });

  const submitIssue = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { resource: "credentials", values: issueForm, meta: { action: "issue" } },
      { onSuccess: (data) => setResult(data.data), onError: (err) => alert(err.message) },
    );
  };

  const submitVerify = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const credential = JSON.parse(verifyForm.credential);
      mutate(
        { resource: "credentials", values: { credential, expectedIssuer: verifyForm.expectedIssuer, now: verifyForm.now }, meta: { action: "verify" } },
        { onSuccess: (data) => setResult(data.data), onError: (err) => alert(err.message) },
      );
    } catch {
      alert("Credential must be valid JSON.");
    }
  };

  const submitRevoke = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { resource: "credentials", values: revokeForm, meta: { action: "revoke" } },
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
      <h1 className="text-3xl font-bold mb-2">{t("credentials.title", "Credentials")}</h1>
      <p className="text-slate-400 mb-6">{t("credentials.subtitle", "Issue, verify, and revoke verifiable credentials.")}</p>

      <div className="flex gap-2 mb-4" role="tablist">
        {tabBtn("issue", "Issue")}
        {tabBtn("verify", "Verify")}
        {tabBtn("revoke", "Revoke")}
      </div>

      {tab === "issue" && (
        <form onSubmit={submitIssue} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="Issue credential form">
          {(Object.keys(issueForm) as (keyof typeof issueForm)[]).map((key) => (
            <div key={key}>
              <label htmlFor={`issue-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
              <input
                id={`issue-${key}`}
                className="w-full glass-input p-3 rounded-lg font-mono text-xs"
                value={issueForm[key]}
                onChange={(e) => setIssueForm({ ...issueForm, [key]: e.target.value })}
                required
              />
            </div>
          ))}
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Issuing..." : "Issue Credential"}
          </button>
        </form>
      )}

      {tab === "verify" && (
        <form onSubmit={submitVerify} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="Verify credential form">
          <div>
            <label htmlFor="verify-credential" className="block text-sm text-slate-400 mb-1">Credential (JSON)</label>
            <textarea
              id="verify-credential"
              className="w-full glass-input p-3 rounded-lg font-mono text-xs h-48"
              value={verifyForm.credential}
              onChange={(e) => setVerifyForm({ ...verifyForm, credential: e.target.value })}
              placeholder='{"@context":["https://www.w3.org/2018/credentials/v1"],...}'
              required
            />
          </div>
          <div>
            <label htmlFor="verify-issuer" className="block text-sm text-slate-400 mb-1">Expected issuer (optional)</label>
            <input
              id="verify-issuer"
              className="w-full glass-input p-3 rounded-lg font-mono text-xs"
              value={verifyForm.expectedIssuer}
              onChange={(e) => setVerifyForm({ ...verifyForm, expectedIssuer: e.target.value })}
            />
          </div>
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Verifying..." : "Verify Credential"}
          </button>
        </form>
      )}

      {tab === "revoke" && (
        <form onSubmit={submitRevoke} className="glass-panel p-6 rounded-xl shadow-lg flex flex-col gap-4" aria-label="Revoke credential form">
          {(Object.keys(revokeForm) as (keyof typeof revokeForm)[]).map((key) => (
            <div key={key}>
              <label htmlFor={`revoke-${key}`} className="block text-sm text-slate-400 mb-1">{key}</label>
              <input
                id={`revoke-${key}`}
                className="w-full glass-input p-3 rounded-lg font-mono text-xs"
                value={revokeForm[key]}
                onChange={(e) => setRevokeForm({ ...revokeForm, [key]: e.target.value })}
                required
              />
            </div>
          ))}
          <button type="submit" disabled={isPending} className="action-btn self-start px-6 py-3" aria-busy={isPending}>
            {isPending ? "Revoking..." : "Revoke Credential"}
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
