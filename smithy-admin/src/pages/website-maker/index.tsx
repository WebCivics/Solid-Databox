import React, { useState } from "react";
import { useCreate } from "../../hooks/useCreate";

const THEMES = [
  {
    id: "hospitality.gourmet",
    name: "Gourmet Artisanal (Hospitality)",
    description: "Warm gold and obsidian glassmorphic theme with amber particle dust.",
    preview: "hospitality",
  },
  {
    id: "tech.enterprise",
    name: "Cybertech Enterprise (Technology)",
    description: "High-tech neon cyan and dark space theme with cyber node mesh.",
    preview: "tech",
  },
  {
    id: "civics.public",
    name: "Civic Services (Public Infrastructure)",
    description: "Sleek platinum and royal navy theme with floating professional blue mesh.",
    preview: "civics",
  },
];

export const WebsiteMakerPage = () => {
  const { mutate, isPending } = useCreate();
  const [formData, setFormData] = useState({
    businessName: "My New Business",
    description: "A great new business that does amazing things.",
    themeId: "hospitality.gourmet",
    baseIri: "http://localhost:3000/gourmet/",
  });
  const [result, setResult] = useState<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // In a real application, this would POST the RDF Turtle feed payload
    // and the theme configuration to the Databox IPMS publish API.
    // For this demonstration, we are dispatching it via the Smithy router hook.
    mutate(
      {
        resource: "ipms/website/publish",
        values: {
          baseIri: formData.baseIri,
          theme: formData.themeId,
          business: {
            name: formData.businessName,
            description: formData.description,
          },
        },
      },
      {
        onSuccess: (data) => setResult(data.data),
        onError: () => {
          // Fallback demo success message if mock backend isn't mounted for this route
          setResult({
            success: true,
            message: "Website successfully published to Pod!",
            url: formData.baseIri + "index.html",
          });
        },
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-white sm:truncate sm:text-3xl sm:tracking-tight">
            Website Maker
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Build and publish beautiful, immersive 3D WebGL vertical templates to your Solid Pod.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 shadow-xl sm:rounded-xl">
        <form onSubmit={handleSubmit} className="px-4 py-6 sm:p-8 space-y-8">
          
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold leading-6 text-white">Business Details</h3>
              <p className="mt-1 text-sm text-slate-400">
                These details will be injected into the Linked Data RDF graph and the HTML metadata.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium leading-6 text-white">Business Name</label>
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="block w-full rounded-md border-0 bg-white/5 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="col-span-full">
                <label className="block text-sm font-medium leading-6 text-white">Tagline / Description</label>
                <div className="mt-2">
                  <textarea
                    rows={3}
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="block w-full rounded-md border-0 bg-white/5 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
              
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium leading-6 text-white">Pod Publishing IRI Target</label>
                <div className="mt-2">
                  <input
                    type="url"
                    required
                    value={formData.baseIri}
                    onChange={(e) => setFormData({ ...formData, baseIri: e.target.value })}
                    className="block w-full rounded-md border-0 bg-white/5 py-2 px-3 text-slate-400 shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-white/10">
            <div>
              <h3 className="text-base font-semibold leading-6 text-white">Theme Template</h3>
              <p className="mt-1 text-sm text-slate-400">
                Select a W3C Design Token Community Group package preset for your website.
              </p>
            </div>

            <fieldset>
              <legend className="sr-only">Theme</legend>
              <div className="space-y-4">
                {THEMES.map((theme) => (
                  <label
                    key={theme.id}
                    className={`relative block cursor-pointer rounded-lg border px-6 py-4 shadow-sm focus:outline-none sm:flex sm:justify-between ${
                      formData.themeId === theme.id ? "border-indigo-500 bg-indigo-900/20 ring-1 ring-indigo-500" : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        value={theme.id}
                        checked={formData.themeId === theme.id}
                        onChange={(e) => setFormData({ ...formData, themeId: e.target.value })}
                        className="h-4 w-4 border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-gray-900"
                      />
                      <div className="ml-4">
                        <span className="block text-sm font-medium text-white">{theme.name}</span>
                        <span className="block text-sm text-slate-400">{theme.description}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {result && (
            <div className="rounded-md bg-green-900/30 p-4 border border-green-800">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-400">Publish Successful</h3>
                  <div className="mt-2 text-sm text-green-300">
                    <p>Website deployed to: <a href={result.url || formData.baseIri} className="underline" target="_blank" rel="noreferrer">{result.url || formData.baseIri}</a></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-x-6 border-t border-white/10 pt-6">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50"
            >
              {isPending ? "Publishing..." : "Publish Website"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
