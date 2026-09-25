//
// Standard-Solid provider mode. This intentionally does not call the CSS IPMS
// control plane; it reads portable module manifests/state from ordinary Solid
// resources and reports enhanced operations as unavailable.

import type { BaseKey } from "@refinedev/core";
import { createPosOperationsSnapshot } from "../data/posOperations";

const MANIFEST_INDEX_URL = import.meta.env.VITE_SOLID_CMS_MANIFEST_INDEX_URL ?? "";
const SOLID_BEARER_TOKEN = import.meta.env.VITE_SOLID_BEARER_TOKEN ?? "";

const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
const DCTERMS_NS = "http://purl.org/dc/terms/";
const SCHEMA_NS = "https://schema.org/";
const CMS_NS = "urn:solid-server:databox:ipms#";
const LDP_NS = "http://www.w3.org/ns/ldp#";
const SOLID_NS = "http://www.w3.org/ns/solid/terms#";
const XSD_NS = "http://www.w3.org/2001/XMLSchema#";

const RDF_TYPE = `${RDF_NS}type`;
const RDF_FIRST = `${RDF_NS}first`;
const RDF_REST = `${RDF_NS}rest`;
const RDF_NIL = `${RDF_NS}nil`;
const RDF_VALUE = `${RDF_NS}value`;
const CMS_MODULE = `${CMS_NS}Module`;
const CMS_VERTICAL_PROFILE = `${CMS_NS}VerticalProfile`;
const SOLID_TYPE_REGISTRATION = `${SOLID_NS}TypeRegistration`;

const INDEX_PREDICATES = new Set([
  `${CMS_NS}manifest`,
  `${CMS_NS}manifestUrl`,
  `${CMS_NS}moduleManifest`,
  `${CMS_NS}moduleManifestUrl`,
  `${LDP_NS}contains`,
  `${RDFS_NS}seeAlso`,
  `${SOLID_NS}instance`,
]);

const providerMeta = {
  providerMode: "standard-solid",
  capabilityMode: "portable-core",
  controlPlaneAvailable: false,
};

type RdfTerm =
  | { termType: "NamedNode"; value: string }
  | { termType: "BlankNode"; value: string }
  | { termType: "Literal"; value: string; datatype?: string; language?: string }
  | { termType: "List"; items: RdfTerm[] };

type RdfTriple = {
  subject: RdfTerm;
  predicate: RdfTerm;
  object: RdfTerm;
};

const list = (data: unknown[], meta = {}) => ({
  data,
  total: data.length,
  meta: { ...providerMeta, ...meta },
});

const enhancedError = (operation: string) =>
  new Error(
    `${operation} requires the CSS-enhanced IPMS control plane. ` +
      "The active provider is standard-Solid portable-core mode."
  );

const fetchSolidResource = async (url: string) => {
  const headers = new Headers({
    Accept:
      "text/turtle, application/ld+json;q=0.9, application/json;q=0.8, */*;q=0.1",
  });
  if (SOLID_BEARER_TOKEN) {
    headers.set("Authorization", `Bearer ${SOLID_BEARER_TOKEN}`);
  }

  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Solid resource fetch failed for ${url}: HTTP ${response.status}`);
  }
  return {
    url,
    contentType: response.headers.get("Content-Type") ?? "",
    text,
  };
};

const hasJsonMediaType = (resource: { contentType?: string }) => resource.contentType?.includes("json") ?? false;

const parseJsonResource = (resource: { url: string; text: string }) => {
  try {
    return JSON.parse(resource.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Solid JSON manifest resource ${resource.url} could not be parsed: ${message}`);
  }
};

const parseJsonIfPossible = (resource: { url: string; contentType?: string; text: string }) => {
  const trimmed = resource.text.trimStart();
  const mayBeJson = hasJsonMediaType(resource) || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!mayBeJson) return undefined;
  try {
    return JSON.parse(resource.text);
  } catch {
    if (hasJsonMediaType(resource) || trimmed.startsWith("{")) {
      return parseJsonResource(resource);
    }
    return undefined;
  }
};

const asArray = (value: unknown) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const graphItems = (json: any) => {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.modules)) return json.modules;
  if (Array.isArray(json.manifests)) return json.manifests;
  if (Array.isArray(json["@graph"])) return json["@graph"];
  return [];
};

const graphVerticalProfiles = (json: any) => {
  if (Array.isArray(json?.verticalProfiles)) return json.verticalProfiles;
  const items = graphItems(json).filter((item: any) => {
    const types = asArray(item.type ?? item["@type"] ?? item["rdf:type"]);
    return types.some((type: any) => compactValue(type) === "DataboxVerticalProfile" || compactValue(type) === CMS_VERTICAL_PROFILE || compactValue(type) === "ipms:VerticalProfile");
  });
  return items.length > 0 ? items : json?.id || json?.["@id"] ? [json] : [];
};

const absoluteUrl = (value: string, baseUrl: string) => {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

const compactId = (item: any, fallbackUrl?: string) =>
  item.id ?? item["@id"] ?? item.moduleId ?? item.identifier ?? fallbackUrl;

const compactValue = (value: any): any => {
  if (Array.isArray(value)) return value.map(compactValue);
  if (value && typeof value === "object") return value["@value"] ?? value["@id"] ?? value.value ?? value;
  return value;
};

const normalizeAdminUi = (adminUi: any) => {
  const value = compactValue(adminUi);
  if (!value || typeof value !== "object") return value;
  return {
    navLabel: compactValue(value.navLabel ?? value.adminNavLabel ?? value["ipms:adminNavLabel"]),
    path: compactValue(value.path ?? value.adminPath ?? value["ipms:adminPath"]),
  };
};

const normalizeManifest = (item: any, sourceUrl: string, state?: any) => {
  const adminUi = normalizeAdminUi(item.adminUi ?? item.admin ?? item["ipms:adminUi"]);
  const enabled = state?.enabled ?? compactValue(item.enabled ?? item["ipms:enabled"]);
  const routes = compactValue(
    item.routes ?? item["ipms:routes"] ?? item.route ?? item["ipms:route"] ?? item.routeList ?? item["ipms:routeList"]
  );
  const capabilities = compactValue(
    item.capabilities ??
      item["ipms:capabilities"] ??
      item.capability ??
      item["ipms:capability"] ??
      item.capabilityList ??
      item["ipms:capabilityList"]
  );

  return {
    ...item,
    id: compactId(item, sourceUrl) ?? sourceUrl,
    name: compactValue(
      item.name ??
        item["schema:name"] ??
        item.title ??
        item["dcterms:title"] ??
        item.label ??
        item["rdfs:label"] ??
        compactId(item, sourceUrl) ??
        sourceUrl
    ),
    version: compactValue(item.version ?? item["schema:softwareVersion"] ?? ""),
    description: compactValue(item.description ?? item["dcterms:description"] ?? item["schema:description"] ?? ""),
    capabilities: asArray(capabilities),
    routes: asArray(routes),
    adminUi,
    enabled: enabled === true || enabled === "true",
    capabilityMode: compactValue(item.capabilityMode ?? item["ipms:capabilityMode"] ?? "portable-core"),
    controlPlaneAvailable: false,
    degraded: true,
    degradationReason:
      "Read from ordinary Solid resources. CSS-enhanced module operations are unavailable in standard-Solid mode.",
    sourceUrl,
    stateUrl: state?.sourceUrl ?? item.stateUrl ?? item["ipms:stateUrl"],
    stateTurtle: state?.turtle,
  };
};

const normalizeVerticalProfile = (item: any, sourceUrl: string, moduleById = new Map()) => {
  const modules = asArray(item.modules ?? item["ipms:modules"] ?? item.moduleList ?? item["ipms:moduleList"]).map((module: any) => {
    const moduleId = compactValue(module.moduleId ?? module["ipms:moduleId"] ?? module.id ?? module);
    const manifest: any = moduleById.get(moduleId);
    return {
      ...module,
      moduleId,
      required: compactValue(module.required ?? module["ipms:required"]) !== false && compactValue(module.required ?? module["ipms:required"]) !== "false",
      enabledByDefault:
        compactValue(module.enabledByDefault ?? module["ipms:enabledByDefault"]) !== false &&
        compactValue(module.enabledByDefault ?? module["ipms:enabledByDefault"]) !== "false",
      rationale: compactValue(module.rationale ?? module["ipms:rationale"] ?? ""),
      defaultConfig: module.defaultConfig ?? module["ipms:defaultConfig"],
      available: Boolean(manifest),
      enabled: Boolean(manifest?.enabled),
      capabilityMode: manifest?.capabilityMode ?? "unavailable",
      ...(manifest ? { manifest } : {
        unavailableReason:
          "This horizontal module was not discovered through the configured Solid IPMS Type Index.",
      }),
    };
  });
  const missingModules = modules.filter((module: any) => !module.available).map((module: any) => module.moduleId);
  return {
    ...item,
    id: compactValue(item.id ?? item["@id"] ?? item.identifier ?? item["schema:identifier"] ?? sourceUrl),
    name: compactValue(item.name ?? item.title ?? item["dcterms:title"] ?? item["schema:name"] ?? sourceUrl),
    version: compactValue(item.version ?? item["schema:softwareVersion"] ?? ""),
    description: compactValue(item.description ?? item["dcterms:description"] ?? item["schema:description"] ?? ""),
    useCases: asArray(compactValue(item.useCases ?? item["ipms:useCaseList"] ?? item.useCaseList)),
    modules,
    missingModules,
    unavailableModules: missingModules,
    capabilityMode: "portable-core",
    controlPlaneAvailable: false,
    canApply: false,
    degraded: true,
    degradationReason:
      "Portable-core mode can inspect declarative vertical profile RDF, but applying defaults requires the CSS-enhanced IPMS control plane.",
    sourceUrl,
  };
};

const parseState = async (stateUrl: string | undefined, baseUrl: string) => {
  if (!stateUrl) return undefined;
  const url = absoluteUrl(stateUrl, baseUrl);
  const resource = await fetchSolidResource(url);
  const json = parseJsonIfPossible(resource);
  if (json !== undefined) {
    return {
      sourceUrl: url,
      enabled: compactValue(json.enabled ?? json["ipms:enabled"]),
      turtle: resource.text,
    };
  }

  const graph = parseTurtle(resource.text, url);
  return {
    sourceUrl: url,
    enabled: rdfBooleanValue(firstObjectForAnySubject(graph, `${CMS_NS}enabled`)),
    turtle: resource.text,
  };
};

const readManifestResource = (resource: { url: string; contentType?: string; text: string }) => {
  const json = parseJsonIfPossible(resource);
  if (json !== undefined) {
    const items = graphItems(json);
    return items.length > 0 ? items : [json];
  }

  return parseRdfManifests(resource.text, resource.url);
};

const readManifestObject = async (entry: any, indexUrl: string, index: number) => {
  if (typeof entry === "string") {
    const manifestUrl = absoluteUrl(entry, indexUrl);
    const resource = await fetchSolidResource(manifestUrl);
    const manifests = readManifestResource(resource);
    return Promise.all(
      manifests.map(async (manifest: any) => {
        const state = await parseState(manifest.stateUrl ?? manifest["ipms:stateUrl"], manifestUrl);
        return normalizeManifest(manifest, manifestUrl, state);
      })
    );
  }

  const manifestUrl = compactValue(entry.manifestUrl ?? entry["ipms:manifestUrl"] ?? entry.url);
  if (manifestUrl) {
    const url = absoluteUrl(manifestUrl, indexUrl);
    const resource = await fetchSolidResource(url);
    const manifests = readManifestResource(resource);
    return Promise.all(
      manifests.map(async (manifest: any) => {
        const merged = { ...manifest, ...entry };
        const state = await parseState(entry.stateUrl ?? merged.stateUrl ?? merged["ipms:stateUrl"], url);
        return normalizeManifest(merged, url, state);
      })
    );
  }

  const state = await parseState(entry.stateUrl ?? entry["ipms:stateUrl"], indexUrl);
  return [normalizeManifest(entry, `${indexUrl}#module-${index}`, state)];
};

const getIpmsModules = async () => {
  if (!MANIFEST_INDEX_URL) {
    return list([], {
      degraded: true,
      degradationReason: "Set VITE_SOLID_CMS_MANIFEST_INDEX_URL to read portable IPMS module manifests from a Solid resource.",
    });
  }

  const index = await fetchSolidResource(MANIFEST_INDEX_URL);
  const json = parseJsonIfPossible(index);
  const modules =
    json !== undefined
      ? (await Promise.all(graphItems(json).map((entry: any, index: number) => readManifestObject(entry, MANIFEST_INDEX_URL, index)))).flat()
      : await getRdfIndexedModules(index);

  return list(modules, {
    degraded: true,
    manifestIndexUrl: MANIFEST_INDEX_URL,
    degradationReason:
      modules.length === 0
        ? "The configured Solid manifest index did not contain any module entries."
        : "Portable-core mode: manifests were discovered via ordinary Solid resources; CSS-enhanced actions are unavailable.",
  });
};

const getIpmsVerticalProfiles = async () => {
  if (!MANIFEST_INDEX_URL) {
    return list([], {
      degraded: true,
      degradationReason: "Set VITE_SOLID_CMS_MANIFEST_INDEX_URL to read portable IPMS vertical profiles from a Solid Type Index.",
    });
  }

  const modules = await getIpmsModules();
  const moduleById = new Map((modules.data ?? []).map((module: any) => [module.id, module]));
  const index = await fetchSolidResource(MANIFEST_INDEX_URL);
  const json = parseJsonIfPossible(index);
  const profiles =
    json !== undefined
      ? (
          await Promise.all(
            graphVerticalProfiles(json).map((entry: any, index: number) =>
              readVerticalProfileObject(entry, MANIFEST_INDEX_URL, index, moduleById)
            )
          )
        ).flat()
      : await getRdfIndexedVerticalProfiles(index, moduleById);

  return list(profiles, {
    degraded: true,
    manifestIndexUrl: MANIFEST_INDEX_URL,
    degradationReason:
      profiles.length === 0
        ? "The configured Solid Type Index did not contain any ipms:VerticalProfile entries."
        : "Portable-core mode: vertical profiles were discovered as ordinary Solid/RDF resources; applying defaults is unavailable.",
  });
};

const getRdfIndexedModules = async (index: { url: string; text: string }) => {
  const inlineManifests = parseRdfManifests(index.text, index.url);
  if (inlineManifests.length > 0) {
    return Promise.all(
      inlineManifests.map(async (manifest) => {
        const state = await parseState(manifest.stateUrl ?? manifest["ipms:stateUrl"], index.url);
        return normalizeManifest(manifest, manifest["@id"] ?? index.url, state);
      })
    );
  }

  const manifestUrls = rdfManifestUrls(index.text, index.url);
  const nested = await Promise.all(manifestUrls.map((url, position) => readManifestObject(url, index.url, position)));
  return nested.flat();
};

const readVerticalProfileObject = async (entry: any, indexUrl: string, index: number, moduleById: Map<any, any>) => {
  if (typeof entry === "string") {
    const url = absoluteUrl(entry, indexUrl);
    const resource = await fetchSolidResource(url);
    return readVerticalProfileResource(resource).map((profile: any) => normalizeVerticalProfile(profile, url, moduleById));
  }

  const profileUrl = compactValue(entry.profileUrl ?? entry.verticalProfileUrl ?? entry["ipms:verticalProfileUrl"] ?? entry.url);
  if (profileUrl) {
    const url = absoluteUrl(profileUrl, indexUrl);
    const resource = await fetchSolidResource(url);
    return readVerticalProfileResource(resource).map((profile: any) => normalizeVerticalProfile({ ...profile, ...entry }, url, moduleById));
  }

  return [normalizeVerticalProfile(entry, `${indexUrl}#vertical-profile-${index}`, moduleById)];
};

const readVerticalProfileResource = (resource: { url: string; contentType?: string; text: string }) => {
  const json = parseJsonIfPossible(resource);
  if (json !== undefined) {
    const items = graphVerticalProfiles(json);
    return items.length > 0 ? items : [json];
  }
  return parseRdfVerticalProfiles(resource.text, resource.url);
};

const getRdfIndexedVerticalProfiles = async (
  index: { url: string; text: string },
  moduleById: Map<any, any>
) => {
  const inlineProfiles = parseRdfVerticalProfiles(index.text, index.url);
  if (inlineProfiles.length > 0) {
    return inlineProfiles.map((profile) => normalizeVerticalProfile(profile, profile["@id"] ?? index.url, moduleById));
  }

  const urls = rdfResourceUrlsForClass(index.text, index.url, CMS_VERTICAL_PROFILE);
  const nested = await Promise.all(urls.map((url, position) => readVerticalProfileObject(url, index.url, position, moduleById)));
  return nested.flat();
};

const rdfManifestUrls = (turtle: string, baseUrl: string) => {
  const graph = parseTurtle(turtle, baseUrl);
  const directUrls = graph.triples
    .filter((triple) => triple.predicate.termType === "NamedNode" && INDEX_PREDICATES.has(triple.predicate.value))
    .flatMap((triple) => rdfUrlValues(triple.object, graph, baseUrl));

  const typeRegistrationUrls = subjectsWithType(graph, SOLID_TYPE_REGISTRATION).flatMap((registration) => {
    const forClass = objects(graph, registration, `${SOLID_NS}forClass`);
    if (!forClass.some((value) => value.termType === "NamedNode" && value.value === CMS_MODULE)) {
      return [];
    }
    return objects(graph, registration, `${SOLID_NS}instance`).flatMap((value) => rdfUrlValues(value, graph, baseUrl));
  });

  return [...new Set([...directUrls, ...typeRegistrationUrls])];
};

const rdfResourceUrlsForClass = (turtle: string, baseUrl: string, classIri: string) => {
  const graph = parseTurtle(turtle, baseUrl);
  return [
    ...new Set(
      subjectsWithType(graph, SOLID_TYPE_REGISTRATION).flatMap((registration) => {
        const forClass = objects(graph, registration, `${SOLID_NS}forClass`);
        if (!forClass.some((value) => value.termType === "NamedNode" && value.value === classIri)) {
          return [];
        }
        return objects(graph, registration, `${SOLID_NS}instance`).flatMap((value) => rdfUrlValues(value, graph, baseUrl));
      })
    ),
  ];
};

const parseRdfManifests = (turtle: string, baseUrl: string) => {
  const graph = parseTurtle(turtle, baseUrl);
  return subjectsWithType(graph, CMS_MODULE).map((subject) => manifestFromSubject(graph, subject, baseUrl));
};

const parseRdfVerticalProfiles = (turtle: string, baseUrl: string) => {
  const graph = parseTurtle(turtle, baseUrl);
  return subjectsWithType(graph, CMS_VERTICAL_PROFILE).map((subject) => verticalProfileFromSubject(graph, subject, baseUrl));
};

const manifestFromSubject = (graph: ReturnType<typeof parseTurtle>, subject: RdfTerm, baseUrl: string) => {
  const subjectUrl = subject.termType === "NamedNode" ? subject.value : baseUrl;
  const adminUi = parseRdfAdminUi(graph, firstObject(graph, subject, [`${CMS_NS}adminUi`]));
  const manifest: any = {
    "@id": subjectUrl,
    id: requiredRdfValue(graph, subject, [`${SCHEMA_NS}identifier`], "id"),
    name: requiredRdfValue(graph, subject, [`${DCTERMS_NS}title`, `${SCHEMA_NS}name`, `${RDFS_NS}label`], "name"),
    version: requiredRdfValue(graph, subject, [`${SCHEMA_NS}softwareVersion`], "version"),
    description: requiredRdfValue(graph, subject, [`${DCTERMS_NS}description`, `${SCHEMA_NS}description`], "description"),
    capabilities: requiredRdfList(graph, subject, [`${CMS_NS}capabilityList`, `${CMS_NS}capabilities`, `${CMS_NS}capability`], "capabilities"),
    routes: requiredRdfList(graph, subject, [`${CMS_NS}routeList`, `${CMS_NS}routes`, `${CMS_NS}route`], "routes"),
    configShape: rdfNamedValue(firstObject(graph, subject, [`${CMS_NS}configShape`])),
    stateUrl: rdfNamedValue(firstObject(graph, subject, [`${CMS_NS}stateUrl`])),
    enabled: rdfBooleanValue(firstObject(graph, subject, [`${CMS_NS}enabled`])),
    capabilityMode: rdfStringValue(firstObject(graph, subject, [`${CMS_NS}capabilityMode`])),
  };
  if (adminUi) {
    manifest.adminUi = adminUi;
  }
  return manifest;
};

const parseRdfAdminUi = (graph: ReturnType<typeof parseTurtle>, node: RdfTerm | undefined) => {
  if (!node) return undefined;
  return {
    navLabel: requiredRdfValue(graph, node, [`${CMS_NS}adminNavLabel`], "adminUi navLabel"),
    path: requiredRdfValue(graph, node, [`${CMS_NS}adminPath`], "adminUi path"),
  };
};

const verticalProfileFromSubject = (graph: ReturnType<typeof parseTurtle>, subject: RdfTerm, baseUrl: string) => {
  const subjectUrl = subject.termType === "NamedNode" ? subject.value : baseUrl;
  return {
    "@id": subjectUrl,
    id: requiredRdfValue(graph, subject, [`${SCHEMA_NS}identifier`], "vertical profile id"),
    name: requiredRdfValue(graph, subject, [`${DCTERMS_NS}title`, `${SCHEMA_NS}name`, `${RDFS_NS}label`], "vertical profile name"),
    version: requiredRdfValue(graph, subject, [`${SCHEMA_NS}softwareVersion`], "vertical profile version"),
    description: requiredRdfValue(graph, subject, [`${DCTERMS_NS}description`, `${SCHEMA_NS}description`], "vertical profile description"),
    useCases: requiredRdfList(graph, subject, [`${CMS_NS}useCaseList`], "vertical profile useCases"),
    modules: requiredRdfTermList(graph, subject, [`${CMS_NS}moduleList`], "vertical profile modules").map((node, index) =>
      verticalProfileModuleFromNode(graph, node, index)
    ),
  };
};

const verticalProfileModuleFromNode = (graph: ReturnType<typeof parseTurtle>, node: RdfTerm, index: number) => {
  const config = firstObject(graph, node, [`${CMS_NS}defaultConfig`]);
  return {
    moduleId: requiredRdfValue(graph, node, [`${CMS_NS}moduleId`], `vertical profile module ${index} id`),
    required: requiredRdfBoolean(graph, node, [`${CMS_NS}required`], `vertical profile module ${index} required`),
    enabledByDefault: requiredRdfBoolean(
      graph,
      node,
      [`${CMS_NS}enabledByDefault`],
      `vertical profile module ${index} enabledByDefault`
    ),
    rationale: requiredRdfValue(graph, node, [`${CMS_NS}rationale`], `vertical profile module ${index} rationale`),
    ...(config
      ? {
          defaultConfig: {
            contentType: requiredRdfValue(graph, config, [`${CMS_NS}contentType`], `vertical profile module ${index} defaultConfig contentType`),
            turtle: requiredRdfValue(graph, config, [RDF_VALUE], `vertical profile module ${index} defaultConfig turtle`),
          },
        }
      : {}),
  };
};

const requiredRdfBoolean = (graph: ReturnType<typeof parseTurtle>, subject: RdfTerm, predicates: string[], field: string) => {
  const value = rdfBooleanValue(firstObject(graph, subject, predicates));
  if (value === undefined) {
    throw new Error(`IPMS ${field} boolean is required.`);
  }
  return value;
};

const requiredRdfValue = (graph: ReturnType<typeof parseTurtle>, subject: RdfTerm, predicates: string[], field: string) => {
  const value = rdfStringValue(firstObject(graph, subject, predicates));
  if (!value) {
    throw new Error(`IPMS module manifest ${field} is required.`);
  }
  return value;
};

const requiredRdfList = (graph: ReturnType<typeof parseTurtle>, subject: RdfTerm, predicates: string[], field: string) => {
  const values = objects(graph, subject, predicates);
  if (values.length === 0) {
    throw new Error(`IPMS module manifest ${field} list is required.`);
  }
  return values.flatMap((value) => rdfListValues(value, graph, field));
};

const requiredRdfTermList = (graph: ReturnType<typeof parseTurtle>, subject: RdfTerm, predicates: string[], field: string) => {
  const values = objects(graph, subject, predicates);
  if (values.length === 0) {
    throw new Error(`IPMS ${field} list is required.`);
  }
  return values.flatMap((value) => rdfListTerms(value, graph, field));
};

const firstObject = (graph: ReturnType<typeof parseTurtle>, subject: RdfTerm | undefined, predicates: string[]) =>
  objects(graph, subject, predicates)[0];

const firstObjectForAnySubject = (graph: ReturnType<typeof parseTurtle>, predicate: string) =>
  graph.triples.find((triple) => triple.predicate.termType === "NamedNode" && triple.predicate.value === predicate)?.object;

const objects = (graph: ReturnType<typeof parseTurtle>, subject: RdfTerm | undefined, predicates: string | string[]) => {
  if (!subject) return [];
  const predicateSet = new Set(Array.isArray(predicates) ? predicates : [predicates]);
  return graph.triples
    .filter((triple) => sameTerm(triple.subject, subject) && triple.predicate.termType === "NamedNode" && predicateSet.has(triple.predicate.value))
    .map((triple) => triple.object);
};

const subjectsWithType = (graph: ReturnType<typeof parseTurtle>, typeIri: string) =>
  graph.triples
    .filter(
      (triple) =>
        triple.predicate.termType === "NamedNode" &&
        triple.predicate.value === RDF_TYPE &&
        triple.object.termType === "NamedNode" &&
        triple.object.value === typeIri
    )
    .map((triple) => triple.subject)
    .filter((subject, index, subjects) => subjects.findIndex((candidate) => sameTerm(candidate, subject)) === index);

const rdfStringValue = (term: RdfTerm | undefined) => {
  if (!term) return undefined;
  if (term.termType === "Literal" || term.termType === "NamedNode") return term.value;
  return undefined;
};

const rdfNamedValue = (term: RdfTerm | undefined) => (term?.termType === "NamedNode" ? term.value : undefined);

const rdfBooleanValue = (term: RdfTerm | undefined) => {
  if (!term) return undefined;
  if (term.termType === "Literal") {
    return term.value.toLowerCase() === "true" ? true : term.value.toLowerCase() === "false" ? false : undefined;
  }
  if (term.termType === "NamedNode") {
    return term.value.toLowerCase() === "true" ? true : term.value.toLowerCase() === "false" ? false : undefined;
  }
  return undefined;
};

const rdfUrlValues = (term: RdfTerm, graph: ReturnType<typeof parseTurtle>, baseUrl: string): string[] => {
  if (term.termType === "NamedNode") return [absoluteUrl(term.value, baseUrl)];
  if (term.termType === "Literal") return [absoluteUrl(term.value, baseUrl)];
  if (term.termType === "List") return term.items.flatMap((item) => rdfUrlValues(item, graph, baseUrl));
  return rdfListValues(term, graph, "manifest index").map((value) => absoluteUrl(value, baseUrl));
};

const rdfListValues = (term: RdfTerm, graph: ReturnType<typeof parseTurtle>, field: string) => {
  if (term.termType === "List") {
    return term.items.map((item) => {
      const value = rdfStringValue(item);
      if (!value) throw new Error(`IPMS module manifest ${field} list entries must be literals or IRIs.`);
      return value;
    });
  }
  if (term.termType === "Literal" || term.termType === "NamedNode") return [term.value];
  if (term.termType === "BlankNode") return rdfLinkedListValues(term, graph, field);
  return [];
};

const rdfListTerms = (term: RdfTerm, graph: ReturnType<typeof parseTurtle>, field: string): RdfTerm[] => {
  if (term.termType === "List") return term.items;
  if (term.termType === "BlankNode") return rdfLinkedListTerms(term, graph, field);
  return [term];
};

const rdfLinkedListValues = (head: RdfTerm, graph: ReturnType<typeof parseTurtle>, field: string) => {
  const values: string[] = [];
  const seen = new Set<string>();
  let current = head;

  while (!(current.termType === "NamedNode" && current.value === RDF_NIL)) {
    const key = termKey(current);
    if (seen.has(key)) {
      throw new Error(`IPMS module manifest ${field} list must not contain a cycle.`);
    }
    seen.add(key);

    const first = objects(graph, current, RDF_FIRST);
    const rest = objects(graph, current, RDF_REST);
    if (first.length !== 1 || rest.length !== 1) {
      throw new Error(`IPMS module manifest ${field} list must be a well-formed RDF list.`);
    }
    const value = rdfStringValue(first[0]);
    if (!value) {
      throw new Error(`IPMS module manifest ${field} list entries must be literals or IRIs.`);
    }
    values.push(value);
    current = rest[0];
  }

  return values;
};

const rdfLinkedListTerms = (head: RdfTerm, graph: ReturnType<typeof parseTurtle>, field: string) => {
  const values: RdfTerm[] = [];
  const seen = new Set<string>();
  let current = head;

  while (!(current.termType === "NamedNode" && current.value === RDF_NIL)) {
    const key = termKey(current);
    if (seen.has(key)) {
      throw new Error(`IPMS module manifest ${field} list must not contain a cycle.`);
    }
    seen.add(key);

    const first = objects(graph, current, RDF_FIRST);
    const rest = objects(graph, current, RDF_REST);
    if (first.length !== 1 || rest.length !== 1) {
      throw new Error(`IPMS module manifest ${field} list must be a well-formed RDF list.`);
    }
    values.push(first[0]);
    current = rest[0];
  }

  return values;
};

const sameTerm = (left: RdfTerm, right: RdfTerm) =>
  left.termType === right.termType &&
  ("value" in left && "value" in right ? left.value === right.value : false);
const termKey = (term: RdfTerm) => `${term.termType}:${"value" in term ? term.value : "[list]"}`;

const parseTurtle = (turtle: string, baseUrl: string) => {
  const tokens = tokenizeTurtle(turtle);
  const parser = new TurtleParser(tokens, baseUrl);
  return parser.parse();
};

class TurtleParser {
  private readonly prefixes: Record<string, string> = {
    ipms: CMS_NS,
    dcterms: DCTERMS_NS,
    ldp: LDP_NS,
    rdf: RDF_NS,
    rdfs: RDFS_NS,
    schema: SCHEMA_NS,
    solid: SOLID_NS,
    xsd: XSD_NS,
  };
  private readonly triples: RdfTriple[] = [];
  private blankNodeCounter = 0;
  private offset = 0;

  private readonly tokens: string[];
  private readonly baseUrl: string;

  public constructor(
    tokens: string[],
    baseUrl: string
  ) {
    this.tokens = tokens;
    this.baseUrl = baseUrl;
  }

  public parse() {
    while (!this.done()) {
      if (this.peek() === "@prefix" || this.peek()?.toUpperCase() === "PREFIX") {
        this.parsePrefix();
      } else {
        this.parseStatement();
      }
    }
    return { triples: this.triples };
  }

  private parsePrefix() {
    this.read();
    const prefixed = this.read();
    const iri = this.readIri();
    this.expect(".");
    this.prefixes[prefixed.slice(0, -1)] = iri;
  }

  private parseStatement() {
    const subject = this.readResource();
    this.parsePredicateObjectList(subject, ["."]);
    this.expect(".");
  }

  private parsePredicateObjectList(subject: RdfTerm, endTokens: string[]) {
    while (!this.done() && !endTokens.includes(this.peek() ?? "")) {
      const predicate = this.readPredicate();
      this.parseObjectList(subject, predicate);
      if (this.peek() === ";") {
        while (this.peek() === ";") this.read();
        if (endTokens.includes(this.peek() ?? "") || this.peek() === ".") return;
      } else {
        return;
      }
    }
  }

  private parseObjectList(subject: RdfTerm, predicate: RdfTerm) {
    while (true) {
      this.triples.push({ subject, predicate, object: this.readObject() });
      if (this.peek() !== ",") return;
      this.read();
    }
  }

  private readPredicate() {
    const token = this.peek();
    if (token === "a") {
      this.read();
      return namedNode(RDF_TYPE);
    }
    return this.readResource();
  }

  private readObject(): RdfTerm {
    const token = this.peek();
    if (token === "[") return this.readBlankNode();
    if (token === "(") return this.readList();
    if (token?.startsWith('"')) return this.readLiteral();
    if (token === "true" || token === "false") {
      this.read();
      return { termType: "Literal", value: token, datatype: `${XSD_NS}boolean` };
    }
    return this.readResource();
  }

  private readBlankNode(): RdfTerm {
    this.expect("[");
    const node = { termType: "BlankNode", value: `b${++this.blankNodeCounter}` } as RdfTerm;
    if (this.peek() !== "]") {
      this.parsePredicateObjectList(node, ["]"]);
    }
    this.expect("]");
    return node;
  }

  private readList(): RdfTerm {
    this.expect("(");
    const items: RdfTerm[] = [];
    while (this.peek() !== ")") {
      items.push(this.readObject());
    }
    this.expect(")");
    return { termType: "List", items };
  }

  private readLiteral(): RdfTerm {
    const token = this.read();
    const literal: RdfTerm = { termType: "Literal", value: unquote(token) };
    if (this.peek() === "^^") {
      this.read();
      literal.datatype = (this.readResource() as { value: string }).value;
    } else if (this.peek()?.startsWith("@") && this.peek() !== "@prefix") {
      literal.language = this.read().slice(1);
    }
    return literal;
  }

  private readResource(): RdfTerm {
    const token = this.read();
    if (token.startsWith("_:")) {
      return { termType: "BlankNode", value: token.slice(2) };
    }
    if (token.startsWith("<")) {
      return namedNode(absoluteUrl(token.slice(1, -1), this.baseUrl));
    }
    if (token.includes(":")) {
      const separator = token.indexOf(":");
      const prefix = token.slice(0, separator);
      const local = token.slice(separator + 1);
      const namespace = this.prefixes[prefix];
      if (namespace) return namedNode(`${namespace}${local}`);
    }
    return namedNode(absoluteUrl(token, this.baseUrl));
  }

  private readIri() {
    const token = this.read();
    if (!token.startsWith("<")) {
      throw new Error(`Expected IRI in Turtle prefix declaration, got ${token}.`);
    }
    return token.slice(1, -1);
  }

  private expect(token: string) {
    const actual = this.read();
    if (actual !== token) {
      throw new Error(`Expected Turtle token ${token}, got ${actual}.`);
    }
  }

  private read() {
    const token = this.tokens[this.offset++];
    if (token === undefined) {
      throw new Error("Unexpected end of Turtle resource.");
    }
    return token;
  }

  private peek() {
    return this.tokens[this.offset];
  }

  private done() {
    return this.offset >= this.tokens.length;
  }
}

const namedNode = (value: string): RdfTerm => ({ termType: "NamedNode", value });

const tokenizeTurtle = (text: string) => {
  const tokens: string[] = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "#") {
      while (index < text.length && text[index] !== "\n") index += 1;
      continue;
    }
    if ("[]();,.".includes(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }
    if (char === "<") {
      const end = text.indexOf(">", index + 1);
      if (end === -1) throw new Error("Unterminated Turtle IRI.");
      tokens.push(text.slice(index, end + 1));
      index = end + 1;
      continue;
    }
    if (char === '"') {
      const { token, next } = readQuotedToken(text, index);
      tokens.push(token);
      index = next;
      continue;
    }
    if (char === "^" && text[index + 1] === "^") {
      tokens.push("^^");
      index += 2;
      continue;
    }

    let end = index;
    while (end < text.length && !/\s/.test(text[end]) && !"[]();,.<>\"".includes(text[end])) {
      end += 1;
    }
    tokens.push(text.slice(index, end));
    index = end;
  }

  return tokens.filter(Boolean);
};

const readQuotedToken = (text: string, start: number) => {
  let index = start + 1;
  let escaped = false;
  while (index < text.length) {
    const char = text[index];
    if (!escaped && char === '"') {
      return { token: text.slice(start, index + 1), next: index + 1 };
    }
    escaped = !escaped && char === "\\";
    if (char !== "\\") escaped = false;
    index += 1;
  }
  throw new Error("Unterminated Turtle string literal.");
};

const unquote = (token: string) =>
  token
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");

export const standardSolidDataProvider = {
  getList: async ({ resource }: { resource: string }) => {
    if (resource === "ipms-modules") {
      return getIpmsModules();
    }
    if (resource === "ipms-vertical-profiles") {
      return getIpmsVerticalProfiles();
    }
    if (resource === "pos-operations") {
      const snapshot = createPosOperationsSnapshot("standard-solid", "portable-core", false);
      return list([snapshot], {
        degraded: true,
        degradationReason: snapshot.degradationReason,
      });
    }
    return list([], {
      degraded: true,
      degradationReason: `${resource} is not implemented by the standard-Solid provider.`,
    });
  },

  getOne: async ({ resource, id }: { resource: string; id: BaseKey }) => {
    if (resource === "ipms-modules") {
      const modules = await getIpmsModules();
      const record = modules.data.find((module: any) => module.id === id);
      if (!record) throw new Error(`IPMS module ${id} was not found in the configured Solid manifest index.`);
      return { data: record, meta: modules.meta };
    }
    if (resource === "ipms-vertical-profiles") {
      const profiles = await getIpmsVerticalProfiles();
      const record = profiles.data.find((profile: any) => profile.id === id);
      if (!record) throw new Error(`IPMS vertical profile ${id} was not found in the configured Solid Type Index.`);
      return { data: record, meta: profiles.meta };
    }
    throw enhancedError(`Reading ${resource}`);
  },

  create: async ({ resource }: { resource: string }) => {
    if (resource === "hosting-plans") {
      throw enhancedError("Generating a hosting plan");
    }
    if (resource === "receipt-documents") {
      throw enhancedError("Generating a receipt document");
    }
    if (resource === "ipms-vertical-profile-applications") {
      throw enhancedError("Applying or previewing vertical profile defaults");
    }
    throw enhancedError(`Creating ${resource}`);
  },

  update: async ({ resource }: { resource: string }) => {
    if (resource === "ipms-modules") {
      throw enhancedError("Changing module enabled state");
    }
    throw enhancedError(`Updating ${resource}`);
  },

  deleteOne: async ({ resource }: { resource: string }) => {
    throw enhancedError(`Deleting ${resource}`);
  },

  getApiUrl: () => MANIFEST_INDEX_URL || "solid://portable-core",
};
