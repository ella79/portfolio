# Personal landing page

Single page portfolio and CV for **Emanuela Telescu**, Senior QA Automation Engineer.
Live at <https://ella79.github.io/portfolio/>.

Static HTML, CSS and vanilla JavaScript. No framework, no build step, no runtime
dependencies. The only third party request the page makes is to Google Fonts.

## Layout

```
.
|-- index.html                   # the landing page
|-- cv.html                      # the full CV, and the print source for an A4 PDF
|-- 404.html                     # what GitHub Pages serves for an unknown path
|-- assets/
|   |-- css/styles.css           # design tokens first, then components, then print
|   |-- js/main.js               # nav state, scroll reveals, expandable lists, form
|   |-- img/                     # photo, favicon, social icons
|   \-- cv/                      # the two page PDF the CV button hands over
|-- tests/smoke.spec.ts          # Playwright smoke suite
|-- playwright.config.ts
|-- .github/
|   |-- workflows/ci.yml         # runs the suite on every push and pull request
|   |-- workflows/deploy.yml     # publishes to GitHub Pages
|   \-- dependabot.yml           # keeps the actions current
|-- .gitattributes               # LF in the repository, binaries left alone
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

Fifteen Playwright checks cover the paths a visitor actually takes, and each one
runs twice, on desktop Chromium and on a mobile viewport.

The page loads without JavaScript errors, the nav reaches every section and
highlights the one in view, a reload opens at the top instead of restoring the
last scroll position, the floating contact button appears while the work is
being read and steps aside once Projects is on screen, the CV button hands over
the PDF rather than opening a page, the career timeline expands, the skill bars
fill when they scroll into view, the contact form stays closed until it is asked
for and then validates, the direct contact links point where they claim to, and
an unknown address or anchor lands on the not found page.

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

## Asset versions

`styles.css` and `main.js` are linked with a `?v=` token in `index.html` and
`cv.html`. GitHub Pages lets a browser hold those two files for longer than a
deploy takes, so without the token a visitor keeps the old stylesheet and script
against the new markup, and the site looks unchanged after a successful publish.

**Bump the token whenever either file changes**, in both pages, or the change
will not reach anyone who has visited before.

## The CV

`assets/cv/Emanuela-Telescu-CV.pdf` is the two page CV, kept as the source of
truth outside this repository. The CV button in the header downloads it directly.
When the document changes, replace that file and update `cv.html` so the page and
the PDF stay in step.

`cv.html` holds the same history as a web page and is what the print stylesheet
in `styles.css` is written for, so a clean A4 document can be printed from the
browser if a generated PDF is ever wanted instead.

## Social icons

`assets/img/linkedin.svg` and `assets/img/github.svg` hold the LinkedIn and
GitHub marks. They are not redistributed as part of the licence below; they
remain the trademarks of their owners, used here only to link to the owner's own
profiles.

The two files are not embedded as images. They are CSS masks, and the colour is
painted by the link, so whichever file is dropped in takes the footer palette and
follows the hover instead of arriving in its own blue or black. The same masks
label the contact list. An SVG whose cut outs are drawn as white shapes rather
than as real holes will fill in under a mask; almost every brand SVG uses real
paths and is fine.

If either file is missing the plain word carries the link instead, so the page is
never broken, only plainer.

## Licence

Copyright (c) 2026 Emanuela Telescu. All rights reserved. See `LICENSE`.
The design, code and written content of this site are not free to reuse.
