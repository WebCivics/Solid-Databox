import { useMemo, useState } from "react";
import { CapabilityStrip, StatusBadge } from "./shared";
import { money, orderTotal, standardIntent, usePosSnapshot } from "./operations";

type DisplaySlide = {
  id: string;
  kind: "transaction-summary" | "app-install" | "solid-vault-connect" | "loyalty" | "receipt-qr" | "advertising";
  title: string;
  body: string;
  durationSeconds: number;
  actionUrl?: string;
  sourceResource?: string;
  qrPayloadKind?: string;
};

const slideTone = (kind: DisplaySlide["kind"]) => {
  const tones: Record<DisplaySlide["kind"], string> = {
    "transaction-summary": "green",
    "app-install": "sky",
    "solid-vault-connect": "violet",
    loyalty: "amber",
    "receipt-qr": "green",
    advertising: "slate",
  };
  return tones[kind];
};

export const PromotionDisplayPage = () => {
  const { snapshot } = usePosSnapshot();
  const [activePromoId, setActivePromoId] = useState("promo-morning");
  const [activeOrderId, setActiveOrderId] = useState(snapshot.customerDisplay.activeOrderId);
  const [customerName, setCustomerName] = useState(snapshot.customerDisplay.loyaltyName);
  const [playlistMode, setPlaylistMode] = useState("slidy-compatible");
  const [loopPlaylist, setLoopPlaylist] = useState(true);
  const activePromo = snapshot.promotions.find((promo: any) => promo.id === activePromoId);
  const activeOrder = snapshot.orders.find((order: any) => order.id === activeOrderId) ?? snapshot.orders[0];
  const activeTotal = orderTotal(activeOrder?.lines ?? []);

  const playlistSlides: DisplaySlide[] = useMemo(() => [
    {
      id: `${snapshot.customerDisplay.screenUrl}#transaction-summary`,
      kind: "transaction-summary",
      title: activeOrder ? `Order ${activeOrder.id}` : "Current order",
      body: `${money(activeTotal)} / ${(activeOrder?.lines ?? []).length} line items / ${activeOrder?.status ?? "open"}`,
      durationSeconds: 7,
      sourceResource: activeOrder?.solidResource ?? `https://databox.example/pods/org/orders/${activeOrder?.id}.ttl#order`,
    },
    {
      id: `${snapshot.customerDisplay.screenUrl}#app-install`,
      kind: "app-install",
      title: "Install the shop app",
      body: "Download the shop app for self-ordering, pickup updates, offers, and receipts.",
      durationSeconds: 8,
      actionUrl: "https://databox.example/app/install",
      qrPayloadKind: "shop-app-install",
    },
    {
      id: `${snapshot.customerDisplay.screenUrl}#solid-vault-connect`,
      kind: "solid-vault-connect",
      title: "Connect your Solid vault",
      body: "Share only scoped preference, loyalty, dietary, and receipt data with this shop.",
      durationSeconds: 8,
      actionUrl: "https://databox.example/solid/connect?surface=customer-display",
      qrPayloadKind: "solid-vault-connect",
    },
    {
      id: `${snapshot.customerDisplay.screenUrl}#loyalty`,
      kind: "loyalty",
      title: customerName ? `Corner Club for ${customerName}` : "Corner Club",
      body: "Loyalty prompts can be driven from customer-owned Solid profile state without exposing the full profile.",
      durationSeconds: 7,
      actionUrl: "https://databox.example/loyalty",
    },
    {
      id: `${snapshot.customerDisplay.screenUrl}#receipt-qr`,
      kind: "receipt-qr",
      title: "Digital receipt",
      body: `Receipt target: ${snapshot.customerDisplay.receiptTarget}`,
      durationSeconds: 7,
      actionUrl: snapshot.customerDisplay.receiptTarget,
      qrPayloadKind: "digital-receipt",
    },
    {
      id: `${snapshot.customerDisplay.screenUrl}#${activePromo?.id ?? "promotion"}`,
      kind: "advertising",
      title: activePromo?.displayCopy ?? "Featured offer",
      body: activePromo?.eligibility ?? "Promotion state is persisted as standard schema:Offer RDF.",
      durationSeconds: 8,
      sourceResource: activePromo?.standardSolidRule,
    },
    {
      id: `${snapshot.customerDisplay.screenUrl}#customer-self-order`,
      kind: "advertising",
      title: "Order from your table",
      body: "Connect to the shop Wi-Fi, scan the table QR, and create a Solid-backed order session.",
      durationSeconds: 8,
      actionUrl: "https://databox.example/table/start",
    },
  ], [activeOrder, activePromo, activeTotal, customerName, snapshot]);

  const [activeSlideId, setActiveSlideId] = useState(playlistSlides[0]?.id);
  const activeSlide = playlistSlides.find((slide) => slide.id === activeSlideId) ?? playlistSlides[0];
  const totalDuration = playlistSlides.reduce((sum, slide) => sum + slide.durationSeconds, 0);

  const publishIntent = useMemo(() => ({
    ...standardIntent("publish-customer-display-playlist", snapshot),
    displayResource: snapshot.customerDisplay.screenUrl,
    playlist: {
      "@context": {
        schema: "https://schema.org/",
        ipms: "urn:solid-server:databox:ipms#",
        pos: "urn:solid-server:databox:ipms:pos#",
      },
      type: "schema:PresentationDigitalDocument",
      mode: playlistMode,
      loop: loopPlaylist,
      totalDurationSeconds: totalDuration,
      slides: playlistSlides.map((slide, index) => ({
        type: "schema:CreativeWork",
        id: slide.id,
        position: index + 1,
        genre: slide.kind,
        headline: slide.title,
        text: slide.body,
        timeRequired: `PT${slide.durationSeconds}S`,
        startsAt: `PT${playlistSlides.slice(0, index).reduce((sum, item) => sum + item.durationSeconds, 0)}S`,
        actionUrl: slide.actionUrl,
        sourceResource: slide.sourceResource,
        qrPayloadKind: slide.qrPayloadKind,
      })),
    },
    frame: {
      type: "DataboxCustomerDisplayPlaylist",
      customer: {
        displayName: customerName,
        withheld: ["legal identity", "payment instrument", "full loyalty profile"],
      },
      order: {
        id: activeOrder?.id,
        total: activeTotal,
        receiptTarget: snapshot.customerDisplay.receiptTarget,
      },
    },
    enhancedFallback:
      snapshot.realTimeAvailable
        ? "Can be pushed to an attached display channel when the opt-in control plane is present."
        : "Persist this playlist as RDF; attached displays poll or subscribe through standard Solid notifications.",
  }), [activeOrder, activeTotal, customerName, loopPlaylist, playlistMode, playlistSlides, snapshot, totalDuration]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[92rem]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold mb-2">Promotion Display</h1>
          <p className="text-slate-400 max-w-3xl">Timed customer display playlist: transaction, app install, Solid vault connection, loyalty, receipt QR, and advertising slides.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="green">schema:PresentationDigitalDocument</StatusBadge>
          <StatusBadge tone="green">schema:Offer</StatusBadge>
          <StatusBadge tone={snapshot.realTimeAvailable ? "sky" : "amber"}>display channel</StatusBadge>
        </div>
      </div>

      <CapabilityStrip snapshot={snapshot} />

      <div className="grid grid-cols-1 xl:grid-cols-[24rem_1fr_28rem] gap-5">
        <aside className="space-y-5">
          <section className="glass-panel rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-4">Playlist Controls</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Mode</label>
                <select className="w-full glass-input p-3 rounded-lg" value={playlistMode} onChange={(event) => setPlaylistMode(event.target.value)}>
                  <option value="slidy-compatible" className="bg-slate-900">Slidy compatible</option>
                  <option value="reveal-compatible" className="bg-slate-900">Reveal compatible</option>
                  <option value="portable-web" className="bg-slate-900">Portable web</option>
                </select>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                <span>Loop unattended</span>
                <input type="checkbox" checked={loopPlaylist} onChange={(event) => setLoopPlaylist(event.target.checked)} />
              </label>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Promotion</label>
                <select className="w-full glass-input p-3 rounded-lg" value={activePromoId} onChange={(event) => setActivePromoId(event.target.value)}>
                  {snapshot.promotions.map((promo: any) => (
                    <option key={promo.id} value={promo.id} className="bg-slate-900">{promo.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Order</label>
                <select className="w-full glass-input p-3 rounded-lg" value={activeOrderId} onChange={(event) => setActiveOrderId(event.target.value)}>
                  {snapshot.orders.map((order: any) => (
                    <option key={order.id} value={order.id} className="bg-slate-900">{order.id} / {order.tableId}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Display name</label>
                <input className="w-full glass-input p-3 rounded-lg" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-3">Schedule</h2>
            <div className="space-y-2">
              {playlistSlides.map((slide) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`w-full text-left rounded-lg border p-3 ${activeSlide?.id === slide.id ? "border-sky-400 bg-sky-500/15" : "border-white/10 bg-white/5"}`}
                  onClick={() => setActiveSlideId(slide.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{slide.title}</span>
                    <StatusBadge tone={slideTone(slide.kind)}>{slide.durationSeconds}s</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{slide.kind}</p>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="glass-panel rounded-xl p-5">
          <div className="aspect-[16/9] min-h-[28rem] bg-[#07111f] border border-white/10 rounded-lg overflow-hidden grid grid-rows-[1fr_auto]">
            <div className="p-8 flex flex-col justify-between bg-[linear-gradient(135deg,rgba(20,184,166,0.18),rgba(212,175,55,0.12),rgba(2,6,23,0.4))]">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-sm uppercase tracking-wider text-sky-200">{playlistMode}</p>
                  <h2 className="text-5xl font-bold text-white mt-2">{activeSlide?.title}</h2>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-300">Duration</p>
                  <p className="text-3xl font-bold text-[#d4af37]">{activeSlide?.durationSeconds}s</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_16rem] gap-5 items-end">
                <div>
                  <StatusBadge tone={slideTone(activeSlide?.kind ?? "advertising")}>{activeSlide?.kind}</StatusBadge>
                  <p className="text-4xl font-bold text-white leading-tight mt-4">{activeSlide?.body}</p>
                  {activeSlide?.actionUrl && <p className="text-sm text-slate-300 mt-4">QR/action: {activeSlide.actionUrl}</p>}
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Current total</p>
                  <p className="text-4xl font-bold text-white">{money(activeTotal)}</p>
                  <p className="text-xs text-slate-400 mt-3">Identity minimised; payment details never shown.</p>
                </div>
              </div>
            </div>
            <div className="bg-black/45 border-t border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(activeOrder?.lines ?? []).map((line: any) => (
                  <StatusBadge key={`${line.itemId}:${line.name}`} tone="slate">{line.quantity} x {line.name}</StatusBadge>
                ))}
              </div>
              <StatusBadge tone={snapshot.nativeEdgeAvailable ? "green" : "amber"}>
                {snapshot.nativeEdgeAvailable ? "display attached" : "preview only"}
              </StatusBadge>
            </div>
          </div>
        </main>

        <aside className="space-y-5">
          <section className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-xl font-bold text-white">Publish</h2>
              <StatusBadge tone={snapshot.realTimeAvailable ? "sky" : "amber"}>
                {snapshot.realTimeAvailable ? "push-ready" : "poll/intent"}
              </StatusBadge>
            </div>
            <button
              type="button"
              className="action-btn w-full py-3 mb-4"
              disabled={snapshot.nativeEdgeAvailable === false}
              title={snapshot.nativeEdgeAvailable === false ? "Native/customer display connector is unavailable in this proof." : undefined}
            >
              Push Playlist
            </button>
            <p className="text-sm text-slate-400">
              {snapshot.nativeEdgeAvailable
                ? "Attached displays can consume the playlist directly."
                : "The playlist below remains portable RDF/JSON-shaped state for a Solid-backed display runtime."}
            </p>
          </section>

          <section className="glass-panel rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-3">Playlist Intent</h2>
            <pre className="bg-black/40 border border-white/10 rounded-lg p-4 text-xs text-slate-200 overflow-x-auto max-h-[34rem]">
              {JSON.stringify(publishIntent, null, 2)}
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
};
