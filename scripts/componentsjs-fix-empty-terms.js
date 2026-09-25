#!/usr/bin/env node
/**
 * CIV-C26 — post-generation repair for an upstream componentsjs-generator bug: the emitted
 * `context.jsonld` produces entries keyed by an EMPTY string where a parameter's name could not
 * be resolved (e.g. `"": {"@id": "...#Class_paramName"}`). The strict RDF parser in
 * `componentsjs-compile-config` then fails with "The empty term is not allowed". The parameter
 * name is recoverable from the `@id` fragment (`{Class}_{paramName}`), so we rename the empty
 * key to the real parameter name. Runs over generated components AND node_modules dependencies
 * (the bug exists in published artifacts too).
 */
const fs = require('node:fs');
const path = require('node:path');

function* jsonldFiles(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* jsonldFiles(p);
    } else if (entry.name.endsWith('.jsonld')) {
      yield p;
    }
  }
}

function fixNode(node) {
  let n = 0;
  const stack = [ node ];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      stack.push(...cur);
    } else if (cur && typeof cur === 'object') {
      for (const key of Object.keys(cur)) {
        const val = cur[key];
        if (key === '') {
          const frag = typeof val === 'object' && val !== null ? String(val['@id'] ?? '').split('#').pop() : '';
          const name = frag.includes('_') ? frag.slice(frag.indexOf('_') + 1) : '';
          if (name) {
            cur[name] = val;
            n++;
          }
          delete cur[''];
        } else {
          stack.push(val);
        }
      }
    }
  }
  return n;
}

let fixed = 0;
let files = 0;
for (const root of [ 'dist/components', 'node_modules' ]) {
  for (const file of jsonldFiles(root)) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const n = fixNode(data);
    if (n > 0) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      fixed += n;
      files++;
    }
  }
}
if (fixed > 0) {
  console.log(`componentsjs empty-term repair: renamed ${fixed} empty params across ${files} files`);
}

/**
 * Second repair — a Union* combiner declared `extends UnionHandler<T>` (a generic the generator cannot
 * express) loses its component-level supertype, so it cannot bind to a `T`-typed parameter. The union IS
 * a `T` (it composes `T` handlers); restore `extends` to the element component. Keyed on
 * `UnionPermissionReader` → `PermissionReader` (the only such case the databox authorization chain hits).
 */
const UNION_EXTENDS = {
  'UnionPermissionReader.jsonld': 'css:dist/components/authorization/PermissionReader.jsonld#PermissionReader',
};
for (const file of jsonldFiles('dist/components')) {
  const base = path.basename(file);
  const ext = UNION_EXTENDS[base];
  if (!ext) {
    continue;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  const comps = Array.isArray(data.components) ? data.components : [];
  for (const comp of comps) {
    if (comp && !comp.extends) {
      comp.extends = ext;
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      console.log(`componentsjs union-extends repair: ${base} now extends ${ext.split('#').pop()}`);
    }
  }
}
