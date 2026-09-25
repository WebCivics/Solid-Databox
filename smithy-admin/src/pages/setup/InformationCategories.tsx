import { useMemo, useState } from "react";
import {
  INFO_CATEGORIES,
  GROUPS,
  SECTORS,
  DIRECTION_LABELS,
  applicableCategories,
  vocabFor,
  type Direction,
} from "../../data/informationCategories";

type Mode = "au" | "multi" | "standards";

const MODES: { id: Mode; label: string }[] = [
  { id: "au", label: "AU" },
  { id: "multi", label: "Multi-jurisdiction" },
  { id: "standards", label: "Standards" },
];

const directionStyle = {
  push: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  record: "bg-slate-500/15 text-slate-300 border-slate-500/40",
  pull: "bg-blue-500/15 text-blue-300 border-blue-500/40",
};

const Basis = ({ cat, mode }: { cat: any; mode: Mode }) => {
  if (mode === "standards") {
    const v = vocabFor(cat.rightType);
    const chip = (href: string | undefined, label: string, cls: string) =>
      href ? (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          title={href}
          onClick={(e) => e.stopPropagation()}
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition hover:brightness-125 ${cls}`}
        >
          {label}
        </a>
      ) : null;
    return (
      <span className="flex flex-wrap items-center gap-1" title={v.note || ""}>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30">
          {cat.rightType}
        </span>
        {chip(v.dpv, "DPV", "bg-purple-500/15 text-purple-300 border-purple-500/30")}
        {chip(v.gdpr, "GDPR", "bg-indigo-500/15 text-indigo-300 border-indigo-500/30")}
        {chip(v.odrl, "ODRL", "bg-teal-500/15 text-teal-300 border-teal-500/30")}
        {!v.dpv && !v.gdpr && !v.odrl && (
          <span className="text-[10px] text-slate-600 italic">no standard mapping</span>
        )}
      </span>
    );
  }
  const au = (cat.basis.au || []).map((b: string) => (
    <span key={b} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
      {b}
    </span>
  ));
  const eu =
    mode === "multi"
      ? (cat.basis.eu || []).map((b: string) => (
          <span key={b} className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            {b}
          </span>
        ))
      : [];
  const all = [...au, ...eu];
  if (all.length === 0) {
    return <span className="text-[10px] text-slate-600 italic">no statutory basis mapped</span>;
  }
  return <>{all}</>;
};

const CategoryCard = ({ cat, checked, mode, onToggle }: { cat: any; checked: boolean; mode: Mode; onToggle: () => void }) => {
  const dir = DIRECTION_LABELS[cat.direction as Direction];
  return (
    <div
      onClick={onToggle}
      title={dir.hint}
      className={`flex flex-col gap-2 p-3 rounded-lg cursor-pointer transition-all border ${
        checked ? "bg-[#d4af37]/15 border-[#d4af37]/50" : "glass-input border-transparent hover:bg-white/5"
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border shrink-0 ${
            checked ? "bg-[#d4af37] border-[#d4af37]" : "border-slate-500"
          }`}
        >
          {checked && (
            <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <span className={`text-sm font-medium ${checked ? "text-white" : "text-slate-200"}`}>{cat.name}</span>
          <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-6">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${directionStyle[cat.direction as Direction]}`}>
          {dir.label}
        </span>
        {cat.portability && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            portable
          </span>
        )}
        {cat.sensitive && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            sensitive
          </span>
        )}
        <Basis cat={cat} mode={mode} />
      </div>
    </div>
  );
};

export const InformationCategories = ({ industry, selected, setSelected }: any) => {
  const [mode, setMode] = useState<Mode>("au");
  const [showAllSectors, setShowAllSectors] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map((g) => [g.id, true]))
  );

  const applicable = useMemo(() => applicableCategories(industry), [industry]);
  const matchingSectors = useMemo(
    () => SECTORS.filter((s) => s.divisions.includes(industry)).map((s) => s.id),
    [industry]
  );

  const toggle = (id: string) =>
    setSelected((prev: string[]) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev: string[]) => {
      const set = new Set(prev);
      ids.forEach((id) => (on ? set.add(id) : set.delete(id)));
      return Array.from(set);
    });

  const toggleGroup = (id: string) => setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  // Categories to show for a given group, honouring industry + sector visibility.
  const groupCategories = (groupId: string) => {
    if (groupId !== "sector") return applicable.filter((c) => c.group === groupId);
    return INFO_CATEGORIES.filter(
      (c) => c.group === "sector" && (showAllSectors || (c.sector != null && matchingSectors.includes(c.sector)))
    );
  };

  const selectedCount = selected.length;

  return (
    <div className="glass-panel p-6 rounded-xl shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-white">Information & Data You Provide</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            The categories of information this organisation is obliged to make available to a person —
            proactive disclosures, transaction records, and data-rights / portability outputs. Tailored to
            your industry; {selectedCount} selected.
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-white/10 shrink-0 w-fit">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${
                mode === m.id ? "bg-[#d4af37] text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-5 italic">
        {mode === "au" && "Showing Australian statutory bases (Privacy Act / APPs, CDR, Australian Consumer Law)."}
        {mode === "multi" && "Showing Australian and EU (GDPR and related) bases side-by-side."}
        {mode === "standards" && "Jurisdiction-agnostic right-types mapped to W3C DPV, its GDPR extension, and ODRL — click a chip to resolve the concept. Hover for mapping notes."}
      </p>

      <div className="flex flex-col gap-4">
        {GROUPS.map((group) => {
          const cats = groupCategories(group.id);
          if (cats.length === 0) return null;
          const ids = cats.map((c) => c.id);
          const selInGroup = ids.filter((id) => selected.includes(id)).length;
          const open = openGroups[group.id];
          const allOn = selInGroup === ids.length;

          return (
            <div key={group.id} className="rounded-lg border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between bg-white/5 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <span className="text-sm font-bold text-white">{group.name}</span>
                    <span className="text-xs text-slate-500 ml-2">{group.blurb}</span>
                  </div>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400">
                    {selInGroup}/{ids.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMany(ids, !allOn)}
                    className="text-xs font-semibold text-[#d4af37] hover:text-white"
                  >
                    {allOn ? "Clear" : "Select all"}
                  </button>
                </div>
              </div>

              {open && (
                <div className="p-4">
                  {group.id === "sector" && (
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-slate-400">
                        {matchingSectors.length > 0
                          ? "Showing categories for your industry."
                          : "No sector-specific categories map to this industry."}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAllSectors((v) => !v)}
                        className="text-xs font-semibold text-slate-400 hover:text-white"
                      >
                        {showAllSectors ? "Show only my sector" : "Show all sectors"}
                      </button>
                    </div>
                  )}

                  {group.id === "sector" ? (
                    SECTORS.filter((s) => showAllSectors || matchingSectors.includes(s.id)).map((sector) => {
                      const sectorCats = cats.filter((c) => c.sector === sector.id);
                      if (sectorCats.length === 0) return null;
                      const isMine = matchingSectors.includes(sector.id);
                      return (
                        <div key={sector.id} className="mb-4 last:mb-0">
                          <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isMine ? "text-[#d4af37]" : "text-slate-500"}`}>
                            {sector.name}
                            {isMine && <span className="ml-2 text-[10px] font-normal text-[#d4af37]/70">your industry</span>}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {sectorCats.map((cat) => (
                              <CategoryCard key={cat.id} cat={cat} mode={mode} checked={selected.includes(cat.id)} onToggle={() => toggle(cat.id)} />
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {cats.map((cat) => (
                        <CategoryCard key={cat.id} cat={cat} mode={mode} checked={selected.includes(cat.id)} onToggle={() => toggle(cat.id)} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-600 mt-5 italic">
        Statutory references are indicative pointers for classification, not legal advice or exhaustive citations.
      </p>
    </div>
  );
};
