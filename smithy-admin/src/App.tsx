import { Refine } from "@refinedev/core";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import routerProvider from "@refinedev/react-router";

import { dataProvider } from "./providers/dataProvider";
import { demoDataProvider } from "./providers/demoDataProvider";
import { standardSolidDataProvider } from "./providers/standardSolidDataProvider";
import { Layout } from "./components/layout";
import { ProgramsList } from "./pages/programs/list";
import { ProgramCreate } from "./pages/programs/create";
import { MappingsSimulator } from "./pages/mappings/create";
import { MappingBuilder } from "./pages/mappings/builder";
import { EventDispatcher } from "./pages/events/create";
import { SetupPage } from "./pages/setup";
import { DataPortabilityRegistry } from "./pages/data-portability";
import { ModulesPage } from "./pages/modules";
import { HostingPage } from "./pages/hosting";
import { ReceiptsPage } from "./pages/receipts";
import { PosTerminalPage } from "./pages/pos";
import { WaiterOrdersPage } from "./pages/waiter";
import { CustomerSelfOrderPage } from "./pages/pos/customer";
import { PromotionDisplayPage } from "./pages/pos/display";
import { GovernancePage } from "./pages/governance";
import { AgencyStructurePage } from "./pages/agency-structure";
import { CredentialsPage } from "./pages/credentials";
import { MembersPage } from "./pages/members";
import { OperationsPage } from "./pages/operations";
import { CorrectionsList } from "./pages/corrections/list";
import { CorrectionShow } from "./pages/corrections/show";
import { AccessRequestsList } from "./pages/access-requests/list";
import { AccessRequestShow } from "./pages/access-requests/show";
import { ConsumerLedgerList } from "./pages/consumer-ledger/list";
import { ConsumerLedgerShow } from "./pages/consumer-ledger/show";
import { TaxPage } from "./pages/tax";
import { ConcessionsPage } from "./pages/concessions";
import { DiscountsPage } from "./pages/discounts";
import { DonationsPage } from "./pages/donations";
import { WebsiteMakerPage } from "./pages/website-maker";
import "./index.css";

function App() {
  // Static demo build (VITE_DEMO=true) uses an in-memory data provider + hash
  // routing so it runs on GitHub Pages with no backend. VITE_PROVIDER_MODE can
  // opt into standard-solid portable-core mode without using the CSS IPMS control
  // plane. The default dev/live build is unchanged.
  const isDemo = import.meta.env.VITE_DEMO === "true";
  const providerMode = import.meta.env.VITE_PROVIDER_MODE;
  const Router = isDemo ? HashRouter : BrowserRouter;
  const activeDataProvider = isDemo
    ? demoDataProvider
    : providerMode === "standard-solid"
      ? standardSolidDataProvider
      : dataProvider;

  return (
    <Router>
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="aria-live-region" />
      <Refine
        dataProvider={activeDataProvider as any}
        routerProvider={routerProvider}
        // Refine reports provider names, its version and a resource count to
        // telemetry.refine.dev on load. A data-privacy demo must not send
        // anything anywhere the operator did not ask for.
        options={{ disableTelemetry: true }}
        resources={[
          {
            name: "programs",
            list: "/programs",
            create: "/programs/create",
          },
          {
            name: "mappings",
            create: "/mappings",
          },
          {
            name: "events",
            create: "/events",
          },
          {
            name: "setup",
            create: "/setup",
          },
          {
            name: "data-portability",
            list: "/data-portability",
          },
          {
            name: "ipms-modules",
            list: "/ipms/modules",
          },
          {
            name: "website-maker",
            create: "/website-maker",
          },
          {
            name: "ipms-vertical-profiles",
            list: "/setup",
          },
          {
            name: "ipms-vertical-profile-applications",
            create: "/setup",
          },
          {
            name: "hosting-plans",
            create: "/hosting",
          },
          {
            name: "governance",
            create: "/governance",
          },
          {
            name: "agency-structure",
            list: "/agency-structure",
          },
          {
            name: "credentials",
            create: "/credentials",
          },
          {
            name: "members",
            create: "/members",
          },
          {
            name: "operations",
            create: "/operations",
          },
          {
            name: "receipt-documents",
            create: "/receipts",
          },
          {
            name: "pos-operations",
            list: "/pos",
          },
          {
            name: "corrections",
            list: "/corrections",
            show: "/corrections/show/:id",
          },
          {
            name: "access-requests",
            list: "/access-requests",
            show: "/access-requests/show/:id",
          },
          {
            name: "consumer-ledger",
            list: "/consumer-ledger",
            show: "/consumer-ledger/show/:id",
          },
          { name: "tax", create: "/tax" },
          { name: "concessions", create: "/concessions" },
          { name: "discounts", create: "/discounts" },
          { name: "donations", create: "/donations" },
        ]}
      >
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<ProgramsList />} />
            <Route path="/programs">
              <Route index element={<ProgramsList />} />
              <Route path="create" element={<ProgramCreate />} />
            </Route>
            <Route path="/mappings" element={<MappingsSimulator />} />
            <Route path="/mappings/builder" element={<MappingBuilder />} />
            <Route path="/events" element={<EventDispatcher />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/data-portability" element={<DataPortabilityRegistry />} />
            <Route path="/ipms/modules" element={<ModulesPage />} />
            <Route path="/website-maker" element={<WebsiteMakerPage />} />
            <Route path="/hosting" element={<HostingPage />} />
            <Route path="/governance" element={<GovernancePage />} />
            <Route path="/agency-structure" element={<AgencyStructurePage />} />
            <Route path="/credentials" element={<CredentialsPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/receipts" element={<ReceiptsPage />} />
            <Route path="/pos" element={<PosTerminalPage />} />
            <Route path="/waiter" element={<WaiterOrdersPage />} />
            <Route path="/pos/customer" element={<CustomerSelfOrderPage />} />
            <Route path="/pos/display" element={<PromotionDisplayPage />} />
            <Route path="/corrections">
              <Route index element={<CorrectionsList />} />
              <Route path="show/:id" element={<CorrectionShow />} />
            </Route>
            <Route path="/access-requests">
              <Route index element={<AccessRequestsList />} />
              <Route path="show/:id" element={<AccessRequestShow />} />
            </Route>
            <Route path="/consumer-ledger">
              <Route index element={<ConsumerLedgerList />} />
              <Route path="show/:id" element={<ConsumerLedgerShow />} />
            </Route>
            <Route path="/tax" element={<TaxPage />} />
            <Route path="/concessions" element={<ConcessionsPage />} />
            <Route path="/discounts" element={<DiscountsPage />} />
            <Route path="/donations" element={<DonationsPage />} />
          </Route>
        </Routes>
      </Refine>
    </Router>
  );
}

export default App;
