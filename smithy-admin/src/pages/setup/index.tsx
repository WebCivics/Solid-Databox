import React, { useMemo, useState, useEffect } from "react";
import { useCreate } from "../../hooks/useCreate";
import { InformationCategories } from "./InformationCategories";
import { INFO_CATEGORIES, recommendCategories, vocabFor } from "../../data/informationCategories";
import { AgencyStructureBuilder } from "./AgencyStructureBuilder";
import type { Node, Edge } from "@xyflow/react";

const ANZSIC_DIVISIONS = [
  { id: "A", name: "Agriculture, Forestry and Fishing" },
  { id: "B", name: "Mining" },
  { id: "C", name: "Manufacturing" },
  { id: "D", name: "Electricity, Gas, Water and Waste Services" },
  { id: "E", name: "Construction" },
  { id: "F", name: "Wholesale Trade" },
  { id: "G", name: "Retail Trade" },
  { id: "H", name: "Accommodation and Food Services" },
  { id: "I", name: "Transport, Postal and Warehousing" },
  { id: "J", name: "Information Media and Telecommunications" },
  { id: "K", name: "Financial and Insurance Services" },
  { id: "L", name: "Rental, Hiring and Real Estate Services" },
  { id: "M", name: "Professional, Scientific and Technical Services" },
  { id: "N", name: "Administrative and Support Services" },
  { id: "O", name: "Public Administration and Safety" },
  { id: "P", name: "Education and Training" },
  { id: "Q", name: "Health Care and Social Assistance" },
  { id: "R", name: "Arts and Recreation Services" },
  { id: "S", name: "Other Services" },
];

const COMPLIANCE_FRAMEWORKS = [
  { id: "dpv-legal:eu:gdpr", name: "GDPR (European Union)", desc: "General Data Protection Regulation" },
  { id: "dpv-legal:au:privacy-act", name: "Privacy Act 1988 (Australia)", desc: "Australian Privacy Principles" },
  { id: "dpv-legal:au:cdr", name: "Consumer Data Right (Australia)", desc: "Open Banking & Energy Portability" },
  { id: "dpv-legal:us:ccpa", name: "CCPA (California, US)", desc: "California Consumer Privacy Act" },
];

export const SetupPage = () => {
  const { mutate, isPending: isLoading } = useCreate();
  const [formData, setFormData] = useState({
    profileId: "urn:uuid:" + crypto.randomUUID(),
    databoxBaseUrl: "http://localhost:3000/",
    orgName: "New Enterprise",
    orgUrl: "https://enterprise.example",
    industry: "G",
  });
  
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(["dpv-legal:eu:gdpr", "dpv-legal:au:privacy-act"]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(recommendCategories("G"));
  const [agencyNodes, setAgencyNodes] = useState<Node[]>([]);
  const [agencyEdges, setAgencyEdges] = useState<Edge[]>([]);
  const [result, setResult] = useState<any>(null);

  const ontologyMappings = useMemo(
    () => selectedCategories.flatMap((id) => {
      const category = INFO_CATEGORIES.find((candidate) => candidate.id === id);
      if (!category) return [];
      const vocabulary = vocabFor(category.rightType);
      return [ vocabulary.dpv, vocabulary.gdpr, vocabulary.odrl ].filter(
        (term): term is string => typeof term === "string"
      );
    }),
    [selectedCategories]
  );

  useEffect(() => {
    setSelectedCategories(recommendCategories(formData.industry));
  }, [formData.industry]);

  const toggleFramework = (id: string) => {
    if (selectedFrameworks.includes(id)) {
      setSelectedFrameworks(selectedFrameworks.filter(f => f !== id));
    } else {
      setSelectedFrameworks([...selectedFrameworks, id]);
    }
  };

  const generateRdfPayload = () => {
    const dynamicGraph: any[] = [];
    const members: any[] = [];
    let creators: any = undefined;
    
    agencyNodes.forEach(node => {
      if (node.id === 'org') return; 

      if (node.type === 'person') {
        dynamicGraph.push({
          "@id": `#${node.id}`,
          "@type": "foaf:Person",
          "foaf:account": node.data.webId || "https://example.com/profile#me"
        });
      } else if (node.type === 'software') {
        const softwareNode: any = {
          "@id": `#${node.id}`,
          "@type": ["schema:SoftwareApplication", "as:Application"],
          "schema:name": node.data.name || "Software",
        };
        // Check if org points to software as creator
        const createdByOrg = agencyEdges.find(e => e.source === 'org' && e.target === node.id);
        if (createdByOrg) {
          softwareNode["schema:creator"] = { "@id": "#organization" };
        }
        dynamicGraph.push(softwareNode);
      }
    });

    agencyEdges.forEach(edge => {
      const sourceIsOrg = edge.source === 'org';
      const targetIsOrg = edge.target === 'org';
      
      const personId = sourceIsOrg && edge.target.startsWith('person') ? edge.target : 
                       targetIsOrg && edge.source.startsWith('person') ? edge.source : null;
                       
      if (personId) {
        const node = agencyNodes.find(n => n.id === personId);
        if (!members.find(m => m["@id"] === `#${personId}`)) {
          members.push({
            "@id": `#${personId}`,
            "org:role": node?.data.role || "Steward"
          });
        }
      }
      
      if (sourceIsOrg && edge.target.startsWith('software')) {
        if (!creators) creators = [];
        creators.push({ "@id": `#${edge.target}` });
      }
    });

    const orgNode = {
      "@id": "#organization",
      "@type": ["foaf:Organization", "schema:Organization"],
      "schema:name": formData.orgName,
      "schema:url": formData.orgUrl,
      "schema:knowsAbout": `https://w3id.org/anzsic/2006/role/${formData.industry}`,
      "schema:member": members.length > 0 ? members : undefined,
      "schema:owns": creators, // if org creates the software, it owns it
      "odrl:hasPolicy": {
        "@type": "odrl:Set",
        "odrl:uid": "urn:uuid:" + crypto.randomUUID(),
        "odrl:permission": [{
          "odrl:action": "odrl:use",
          "odrl:assigner": { "@id": "#organization" }
        }],
        "odrl:prohibition": [{
          "odrl:action": "odrl:commercialize",
          "odrl:assigner": { "@id": "#organization" }
        }]
      },
      "dpv:hasApplicableLaw": selectedFrameworks,
      "capabilities": selectedCategories,
      "informationCategories": selectedCategories
        .map((id) => {
          const c = INFO_CATEGORIES.find((x) => x.id === id);
          return c && {
            id: c.id,
            name: c.name,
            group: c.group,
            direction: c.direction,
            portability: !!c.portability,
            sensitive: !!c.sensitive,
            rightType: c.rightType,
            basis: c.basis,
            standards: vocabFor(c.rightType),
          };
        })
        .filter(Boolean),
      "ontologyMappings": ontologyMappings
    };

    return {
      "@context": {
        "schema": "https://schema.org/",
        "foaf": "http://xmlns.com/foaf/0.1/",
        "org": "http://www.w3.org/ns/org#",
        "as": "https://www.w3.org/ns/activitystreams#",
        "dpv": "http://w3.org/ns/dpv#",
        "dpv-legal": "http://w3.org/ns/dpv/legal/",
        "odrl": "http://www.w3.org/ns/odrl/2/"
      },
      "@graph": [
        ...dynamicGraph,
        orgNode
      ]
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      {
        resource: "programs",
        values: {
          profileId: formData.profileId,
          databoxBaseUrl: formData.databoxBaseUrl,
          profile: generateRdfPayload(),
        },
      },
      {
        onSuccess: (data) => setResult(data.data),
        onError: (err) => alert("Setup failed: " + err.message),
      }
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl">
      <h1 className="text-3xl font-bold mb-2">Organization Setup</h1>
      <p className="text-slate-400 mb-8">Deploy a cryptographically-bound Organization WebID to your Solid Pod, defining legal stewards and compliance frameworks.</p>

      <form onSubmit={handleSubmit} className="flex flex-col xl:flex-row gap-8">
        
        {/* Left Column: Form Fields */}
        <div className="flex-1 space-y-8">
          
          <div className="glass-panel p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold text-white mb-2 border-b border-white/10 pb-2">Business Identity</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Organization Name</label>
                <input
                  className="w-full glass-input p-3 rounded-lg"
                  value={formData.orgName}
                  onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-slate-400 mb-1">Organization Website (URL)</label>
                  <input
                    className="w-full glass-input p-3 rounded-lg"
                    value={formData.orgUrl}
                    onChange={(e) => setFormData({ ...formData, orgUrl: e.target.value })}
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-[#d4af37] mb-1 font-semibold">Industry Segment</label>
                  <select
                    className="w-full glass-input p-3 rounded-lg text-white appearance-none"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  >
                    {ANZSIC_DIVISIONS.map(div => (
                      <option key={div.id} value={div.id} className="bg-slate-900">
                        {div.id} - {div.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Target Databox Base URL</label>
                <input
                  className="w-full glass-input p-3 rounded-lg text-slate-500"
                  value={formData.databoxBaseUrl}
                  onChange={(e) => setFormData({ ...formData, databoxBaseUrl: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold text-white mb-1">Agency Structure</h2>
            <p className="text-sm text-slate-400 mb-4 pb-2 border-b border-white/10">Drag and drop entities to map your semantic relationships.</p>
            <AgencyStructureBuilder 
              orgName={formData.orgName} 
              onChange={(nodes, edges) => { setAgencyNodes(nodes); setAgencyEdges(edges); }} 
            />
          </div>

          <div className="glass-panel p-6 rounded-xl shadow-lg border border-indigo-500/30">
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Regulatory & Compliance Posture
            </h2>
            <p className="text-sm text-slate-400 mb-4 pb-2 border-b border-white/10">Map your organization to strict jurisdictional frameworks via DPV vocabularies.</p>
            
            <div className="space-y-3">
              {COMPLIANCE_FRAMEWORKS.map(fw => (
                <label key={fw.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={selectedFrameworks.includes(fw.id)}
                      onChange={() => toggleFramework(fw.id)}
                      className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-600 rounded focus:ring-indigo-600 focus:ring-offset-gray-900"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">{fw.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{fw.id}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Live Preview & Submission */}
        <div className="flex-1 flex flex-col gap-8">
          
          <div className="glass-panel p-6 rounded-xl shadow-lg flex-1 flex flex-col max-h-[1000px]">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              Live Semantic Graph Preview
            </h2>
            <p className="text-sm text-slate-400 mb-4">This exact JSON-LD payload will be minted to the Databox Pod, establishing a legally binding trust chain.</p>
            
            <div className="flex-1 bg-black/60 rounded-lg border border-white/10 p-4 overflow-y-auto">
              <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap break-all">
                {JSON.stringify(generateRdfPayload(), null, 2)}
              </pre>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={isLoading} className="action-btn text-lg px-8 py-4 shadow-[0_0_20px_rgba(79,70,229,0.4)]">
              {isLoading ? "Minting Graph..." : "Mint Organization Graph"}
            </button>
          </div>

          {result && result.programUri && (
            <div className="glass-panel p-6 rounded-xl border border-green-500/30 bg-green-500/5 shadow-xl">
              <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Setup Provisioned Successfully
              </h3>
              <p className="text-sm font-semibold text-slate-300">Program Context URI:</p>
              <div className="bg-black/40 p-4 rounded-lg font-mono text-sm break-all mb-4 border border-white/10 mt-2">
                {result.programUri}
              </div>
              <p className="text-sm text-slate-400">Your organization graph and legal stewardship bindings have been securely minted to the databox ledger.</p>
            </div>
          )}

        </div>
      </form>

      <div className="mt-12 opacity-50 pointer-events-none">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Advanced Tools (Locked)</h3>
        {/* Full-width: expansive information & data categories taxonomy. */}
        <div className="mt-4">
          <InformationCategories industry={formData.industry} selected={selectedCategories} setSelected={setSelectedCategories} />
        </div>
      </div>
    </div>
  );
};
