# MIT License

## Copyright notices

Original Community Solid Server code:

Copyright © 2019–2025 Inrupt Inc. and imec

Databox-specific design, code, documentation, vocabularies, fixtures and modifications:

Copyright © 2026 Timothy Charles Holborn

- <https://www.linkedin.com/in/ubiquitous/>
- <timothy.holborn@gmail.com>

## License exception — QualiaDB integration

Everything under [`src/databox/modules/qualia/`](src/databox/modules/qualia/) is **not**
MIT-licensed. Two instruments apply (see that directory's
[`LICENSE.md`](src/databox/modules/qualia/LICENSE.md)):

- the **QualiaDB / `wasm-webcivics` engine binary** is under a proprietary
  field-of-use freeware license —
  [`QUALIA-WEBCIVICS-LICENSE.txt`](src/databox/modules/qualia/QUALIA-WEBCIVICS-LICENSE.txt)
  — digest-pinned (SHA-256 `68987faa…2ad`, release 0.0.39) and licensed solely for use
  inside the Web Civics Databox ecosystem;
- the **bridge source code** is **CC BY-NC-ND 4.0**.

The engine is loaded at runtime by digest pin — it is never vendored into this
MIT-licensed tree.

## License terms

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
