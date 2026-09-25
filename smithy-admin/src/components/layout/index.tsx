import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useList } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../../i18n";

const baseSections = [
  {
    titleKey: "nav.programs",
    links: [
      { to: "/programs", labelKey: "nav.programs" },
      { to: "/programs/create", labelKey: "setup.title" },
      { to: "/mappings", labelKey: "nav.mappings" },
      { to: "/mappings/builder", labelKey: "nav.mappings" },
      { to: "/events", labelKey: "nav.events" },
      { to: "/setup", labelKey: "nav.setup" },
      { to: "/data-portability", labelKey: "nav.dataPortability" },
    ],
  },
  {
    titleKey: "modules.title",
    links: [
      { to: "/ipms/modules", labelKey: "nav.modules" },
      { to: "/hosting", labelKey: "nav.hosting" },
      { to: "/governance", labelKey: "nav.governance" },
      { to: "/agency-structure", labelKey: "Agency Structure" },
      { to: "/credentials", labelKey: "nav.credentials" },
      { to: "/members", labelKey: "nav.members" },
      { to: "/operations", labelKey: "nav.operations" },
      { to: "/pos", labelKey: "nav.pos" },
      { to: "/waiter", labelKey: "nav.waiter" },
      { to: "/pos/customer", labelKey: "nav.customerOrder" },
      { to: "/pos/display", labelKey: "nav.display" },
    ],
  },
  {
    titleKey: "accessRequests.title",
    links: [
      { to: "/access-requests", labelKey: "nav.accessRequests" },
      { to: "/corrections", labelKey: "nav.corrections" },
      { to: "/consumer-ledger", labelKey: "nav.consumerLedger" },
    ],
  },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `p-3 rounded-lg font-medium transition-all duration-300 ${
    isActive
      ? "bg-[#d4af37]/15 text-[#d4af37] border-l-4 border-[#d4af37]"
      : "text-slate-400 hover:bg-white/5 hover:text-white"
  }`;

const NavItem = ({ to, labelKey }: { to: string; labelKey: string }) => {
  const { t } = useTranslation();
  return (
    <NavLink to={to} className={navClass}>
      {t(labelKey)}
    </NavLink>
  );
};

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  const changeLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("databox-lang", code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full flex items-center gap-2 p-3 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-300"
        aria-label="Select language"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
      >
        <span className="text-lg">{current.flag}</span>
        <span className="flex-1 text-start">{current.label}</span>
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul
          className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto glass-panel border border-white/10 rounded-lg shadow-xl z-50"
          role="listbox"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  lang.code === i18n.language
                    ? "bg-[#d4af37]/15 text-[#d4af37]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
                role="option"
                aria-selected={lang.code === i18n.language}
                onClick={() => changeLang(lang.code)}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="flex-1 text-start">{lang.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { result } = useList({
    resource: "ipms-modules",
    pagination: { pageSize: 100 },
  });

  const ipmsLinks = [
    ...baseSections[1].links,
    ...((result?.data ?? [])
      .filter((module: any) => module.enabled && module.adminUi?.path)
      .map((module: any) => ({ to: module.adminUi.path, labelKey: module.adminUi.navLabel }))
      .filter((link: { to: string }, index: number, links: { to: string }[]) =>
        links.findIndex((candidate) => candidate.to === link.to) === index)),
  ];
  const sections = [
    baseSections[0],
    { ...baseSections[1], links: ipmsLinks },
    baseSections[2],
  ];

  return (
    <div className="flex h-screen w-full bg-[#020617] text-[#f8fafc]">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 glass-panel border-r border-white/5 p-6 z-10 flex flex-col max-h-screen">
        <h2 className="text-[#d4af37] text-2xl font-bold mb-8 text-center">Admin</h2>
        <nav className="flex flex-col gap-2 overflow-y-auto pr-1">
          {sections.map((section, index) => (
            <React.Fragment key={section.titleKey}>
              {index > 0 && (
                <div className="mt-6 mb-2 px-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t(section.titleKey)}</h3>
                </div>
              )}
              {section.links.map((link) => <NavItem key={`${section.titleKey}:${link.to}`} {...link} />)}
            </React.Fragment>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-white/5">
          <LanguageSelector />
        </div>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 overflow-y-auto p-10"
        style={{
          background: "radial-gradient(circle at top right, rgba(212, 175, 55, 0.05) 0%, transparent 40%)",
        }}
      >
        <Outlet />
        {children}
      </div>
    </div>
  );
};
