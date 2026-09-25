import { useList } from "@refinedev/core";
import { createPosOperationsSnapshot } from "../../data/posOperations";

export const money = (value: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);

export const lineTotal = (line: any) => Number(line.quantity) * Number(line.unitPrice);

export const orderTotal = (lines: any[]) => lines.reduce((total, line) => total + lineTotal(line), 0);

export const usePosSnapshot = () => {
  const { result, query } = useList({
    resource: "pos-operations",
    pagination: { pageSize: 1 },
  });
  const fallback = createPosOperationsSnapshot("local-ui", "portable-core", false);
  return {
    snapshot: result?.data?.[0] ?? fallback,
    meta: result?.meta ?? {},
    query,
  };
};

export const standardIntent = (action: string, snapshot: any) => ({
  "@context": {
    schema: "https://schema.org/",
    odrl: "http://www.w3.org/ns/odrl/2/",
    ipms: "urn:solid-server:databox:ipms#",
    nativeEdge: "urn:solid-server:databox:native-edge#",
  },
  type: "DataboxIpmsOperationalIntent",
  action,
  capabilityMode: snapshot.capabilityMode,
  status: snapshot.controlPlaneAvailable ? "ready-for-css-control-plane" : "pending-standard-solid-resource",
  degradation:
    snapshot.controlPlaneAvailable
      ? "The UI can hand this intent to an opt-in IPMS route when present."
      : "Portable fallback only: write/read the intent as RDF and let a compatible runtime decide whether to execute it.",
});
