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
|-- qa-suite.html                # the QA suite runner, reading the published Allure report
|-- 404.html                     # what GitHub Pages serves for an unknown path
|-- assets/
|   |-- css/styles.css           # design tokens first, then components, then print
|   |-- js/main.js               # nav state, scroll reveals, expandable lists, form
|   |-- js/qa-suite.js           # reads the Allure report and replays the run it recorded
|   |-- img/                     # photo, favicon, social icons
|   \-- cv/                      # the two page PDF the CV button hands over
|-- contract/                    # what qa-suite.html reads out of the suite's Allure report
|-- scripts/serve.mjs            # the static server the tests and previews run on
|-- scripts/verify-contract.mjs  # checks a report, published or on disk, against that contract
|-- scripts/ci-summary.mjs       # turns the Playwright JSON report into the summary CI draws
|-- tests/smoke.spec.ts          # Playwright smoke suite
|-- tests/fixtures/              # two reports, one that satisfies the contract and one that does not
|-- playwright.config.ts
|-- .github/
|   |-- workflows/ci.yml         # runs the suite on every push and pull request
|   |-- workflows/contract.yml   # weekly, checks the published report still fits the contract
|   |-- workflows/deploy.yml     # publishes to GitHub Pages
|   \-- dependabot.yml           # keeps the actions current
|-- .gitattributes               # LF in the repository, binaries left alone
|-- robots.txt, sitemap.xml      # indexing
|-- SECURITY.md                  # what is hardened and how to report a problem
\-- LICENSE.md                   # all rights reserved
```

## Running it locally

```bash
npm run serve
# http://127.0.0.1:8000
```

Serving the folder matters. The Content Security Policy and the relative paths
behave differently over `file://`. The server is `scripts/serve.mjs`, a few
lines of Node with no dependencies, and it answers an unknown path with
`404.html` and a 404 the way GitHub Pages does.

## Tests

The Playwright suite covers the paths a visitor actually takes, and each check
runs twice, on desktop Chromium and on a mobile viewport.

The page loads without JavaScript errors, the nav reaches every section and
highlights the one in view, a reload opens at the top instead of restoring the
last scroll position, the floating contact button appears while the work is
being read and steps aside once Projects is on screen, the CV button hands over
the PDF rather than opening a page, the career timeline expands, the skill bars
fill when they scroll into view, the contact form stays closed until it is asked
for and then validates, the direct contact links point where they claim to, the
project cards carry their repositories and the suite card opens the runner, the
runner turns the published report into suites, totals and a replayed run and
says so when that report cannot be reached, and an unknown address or anchor
lands on the not found page.

```bash
npm install
npx playwright install chromium
npm test
```

CI runs the same suite on every push. Runs are serialised per branch, so a new
push cancels the one already in flight instead of racing it.

### What CI shows

The pipeline is three jobs rather than one, and the shape is deliberate: GitHub
draws the graph on the run page from the `needs` between them, so it can be read
at a glance.

```
contract ─┐
          ├─→ summary
smoke ────┘
```

`contract` and `smoke` are independent and run side by side. `summary` waits for
both and writes the run summary, and it runs even when the suite went red,
because a red run is exactly when somebody wants to see which tests fell over
without downloading an artifact first.

That summary is markdown on the run page: the totals, a split per project since
every check runs on desktop and on mobile, the slowest five, and a mermaid chart
which GitHub renders. Which chart depends on the run. When something broke it is
the split by status, because that is the question. When nothing did, a status
chart would be one slice saying nothing, so it shows what the suite covers
instead.

A run that never started is reported as a failure rather than a pass. That case
is not hypothetical: the first version of this script called an aborted run
"Suite green", because zero failures out of zero tests is technically green.

Every test in the suite is hermetic. The runner page reads a report published by
another repository, and the tests serve that report themselves rather than
fetching it, so what is under test is what the page does with the numbers, not
whether GitHub Pages answered today. That includes the cases a live report will
not produce on demand: a run carrying failures, a widget missing mid publish, a
report that never answers.

## The report contract

`qa-suite.html` reads the Allure report that
[agentic-playwright-suite](https://github.com/ella79/agentic-playwright-suite)
publishes. That is a dependency across two repositories with no build step
between them, so it is written down rather than assumed.

`contract/allure-report.contract.json` states exactly what this site consumes:
which documents, which fields inside them, and which addresses are linked.
Everything the page does not touch is free to change without warning.

`scripts/verify-contract.mjs` checks a report against that contract, and it runs
from either side:

```bash
node scripts/verify-contract.mjs
```

checks the published report, which is what `contract.yml` does weekly. The
cadence is a judgement call, not a rule: a break costs one panel on one page
rather than the site, so a slow schedule with no noise is the right trade.

```bash
node scripts/verify-contract.mjs --base ./allure-report
```

checks a report on disk, which is the direction that actually prevents breakage:
the suite's own pipeline can run it against a freshly generated report before
publishing. The consumer states what it needs, the provider verifies it, which
is what consumer driven contract testing means. Nothing here needs a token, the
contract is a public file in a public repository.

`tests/fixtures/` holds two reports, one that satisfies the contract and one
where a suite has been renamed and a duration dropped. CI runs the verifier
against both on every push: a checker that cannot fail is not a checker.

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

`github.svg` comes from Simple Icons, which is CC0 and asks for nothing in
return. `linkedin.svg` comes from Font Awesome Free, which is CC BY 4.0 and does
ask for attribution; the copyright comment inside the file is what satisfies it,
so **do not strip that comment when editing or minifying the file**. LinkedIn is
no longer carried by Simple Icons, which is a fair signal of how closely that
mark is watched.

The two files are not embedded as images. They are CSS masks, and the colour is
painted by the link, so whichever file is dropped in takes the footer palette and
follows the hover instead of arriving in its own blue or black. The same masks
label the contact list. An SVG whose cut outs are drawn as white shapes rather
than as real holes will fill in under a mask; almost every brand SVG uses real
paths and is fine.

If either file is missing the plain word carries the link instead, so the page is
never broken, only plainer.

## Licence

Copyright (c) 2026 Emanuela Telescu. All rights reserved. See `LICENSE.md`.
The design, code and written content of this site are not free to reuse.
