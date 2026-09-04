# Personal landing page

Single page portfolio and CV for **Emanuela Telescu**, Senior QA Automation Engineer.
Live at <https://ella79.github.io/portfolio/>.

Static HTML, CSS and vanilla JavaScript. No framework, no build step, no runtime
dependencies. The only third party request the page makes is to Google Fonts.

## Layout

```
.
|-- index.html                   # the landing page
|-- cv.html                      # the full CV, and the source the PDF is printed from
|-- 404.html                     # what GitHub Pages serves for an unknown path
|-- assets/
|   |-- css/styles.css           # design tokens first, then components, then print
|   |-- js/main.js               # nav state, scroll reveals, expandable lists, form
|   |-- img/                     # photo, logo mark, favicon
|   \-- cv/                      # the downloadable PDF
|-- tests/smoke.spec.ts          # Playwright smoke suite
|-- playwright.config.ts
|-- .github/
|   |-- workflows/ci.yml         # runs the suite on every push and pull request
|   |-- workflows/deploy.yml     # publishes to GitHub Pages
|   \-- dependabot.yml           # keeps the actions current
|-- robots.txt, sitemap.xml      # indexing
|-- SECURITY.md                  # what is hardened and how to report a problem
\-- LICENSE                      # all rights reserved
```

## Running it locally

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Serving the folder matters. The Content Security Policy and the relative paths
behave differently over `file://`.

## Tests

Nine Playwright checks cover the paths a visitor actually takes. The page loads
without JavaScript errors, the nav reaches every section and highlights the one
in view, the career timeline expands, the skill bars fill when they scroll into
view, the contact form stays closed until it is asked for and then validates,
the direct contact links point where they claim to, and the CV page serves its
PDF with a 200.

```bash
npm install
npx playwright install --with-deps chromium
npm test
```

CI runs the same suite on every push. Runs are serialised per branch, so a new
push cancels the one already in flight instead of racing it.

## Deployment

A push to `main` triggers `deploy.yml`, which uploads the repository as a Pages
artifact and publishes it. Deployments share a `concurrency` group, so two of
them never publish at the same time and an in flight publish is never cancelled
half way through. Workflows run with `contents: read`; only the publish job is
granted `pages: write` and `id-token: write`.

## The PDF

`assets/cv/Emanuela-Telescu-CV.pdf` is the two page CV kept as the source of
truth outside this repository. When it changes, replace that file and update
`cv.html` so the page and the document stay in step.

`styles.css` also carries a print stylesheet, so `cv.html` prints to a clean A4
document on its own if a browser generated PDF is ever wanted instead.

## Licence

Copyright (c) 2026 Emanuela Telescu. All rights reserved. See `LICENSE`.
The design, code and written content of this site are not free to reuse.
