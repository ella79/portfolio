# Personal landing page

Portfolio and CV for **Emanuela Telescu**, Senior QA Automation Engineer.
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
|-- scripts/verify-contract.mjs  # checks a report, published or on disk, against the contract
|-- scripts/ci-summary.mjs       # turns the Playwright JSON report into the summary CI draws
|-- tests/smoke.spec.ts          # Playwright smoke suite
|-- tests/fixtures/              # one report that satisfies the contract, one that does not
|-- .github/workflows/           # ci.yml, contract.yml, deploy.yml
\-- SECURITY.md, LICENSE.md      # hardening, and all rights reserved
```

## Run it

```bash
npm install
npm run serve          # http://127.0.0.1:8000
npx playwright install chromium
npm test
```

Serve the folder rather than opening the files: the Content Security Policy and
the relative paths behave differently over `file://`. `scripts/serve.mjs` is a
few lines of Node with no dependencies, and it answers an unknown path with
`404.html` and a 404 the way GitHub Pages does.

## Tests

Every check runs twice, on desktop Chromium and on a mobile viewport, and covers
the paths a visitor actually takes: navigation and scroll state, the expandable
timeline and skill bars, the contact form, the project cards, the QA suite runner
and its dashboard, and the not found page.

All of it is hermetic. The runner page reads a report published by another
repository, and the tests serve that report themselves rather than fetching it,
so what is under test is what the page does with the numbers, not whether GitHub
Pages answered today. That is also what makes the interesting cases testable at
all: a run carrying failures, a widget missing mid publish, a report that never
answers, an engine label the suite changed underneath.

## CI

Three jobs, and the shape is deliberate. GitHub draws the graph on the run page
from the `needs` between them.

```
contract ─┐
          ├─→ summary
smoke ────┘
```

`contract` and `smoke` run side by side. `summary` waits for both and writes a
markdown summary onto the run page: totals, a split per project, the slowest
five, and a mermaid chart. It runs even when the suite went red, because that is
exactly when somebody wants to see what fell over without downloading an
artifact. A run that never started is reported as a failure, not as zero
failures out of zero tests.

Runs are serialised per branch: a new push cancels the one already in flight
rather than racing it.

## The report contract

`qa-suite.html` reads the Allure report that
[agentic-playwright-suite](https://github.com/ella79/agentic-playwright-suite)
publishes: a dependency across two repositories with no build step between them,
so it is written down rather than assumed.

`contract/allure-report.contract.json` states exactly what this site consumes,
down to the fields and the two top level suite names. Everything the page does
not touch is free to change without warning.

`scripts/verify-contract.mjs` checks a report against it, from either side:

```bash
node scripts/verify-contract.mjs                      # the published report, weekly, contract.yml
node scripts/verify-contract.mjs --base ./allure-report --expect-version 1
```

The second form is the one that prevents breakage rather than reporting it: the
suite's own pipeline runs it on a freshly generated report and fails the publish
instead of shipping one this page cannot read. The consumer states what it needs,
the provider verifies it. Nothing needs a token, the contract is a public file.

`tests/fixtures/` holds a report that satisfies the contract and one where a
suite was renamed and a duration dropped. CI verifies both on every push: a
checker that cannot fail is not a checker.

## Deployment

A push to `main` triggers `deploy.yml`, which uploads the repository as a Pages
artifact and publishes it. Deployments share a `concurrency` group, so two never
publish at once. Workflows run with `contents: read`; only the publish job is
granted `pages: write` and `id-token: write`.

## Three things to know before editing

**Bump the `?v=` token** on `styles.css` and `main.js` in every page whenever
either file changes. GitHub Pages lets a browser hold them past a deploy, so
without it a visitor keeps the old stylesheet against the new markup and the site
looks unchanged after a successful publish.

**Keep the copyright comment inside `assets/img/linkedin.svg`.** It comes from
Font Awesome Free under CC BY 4.0 and that comment is what satisfies the
attribution. `github.svg` is Simple Icons, CC0, which no longer carries the
LinkedIn mark at all, a fair signal of how closely that one is watched. Both are
CSS masks rather than images, so they take the link's colour instead of arriving
in their own blue or black; a replacement whose cut outs are drawn as white
shapes rather than as real holes will fill in solid under a mask. If either file
goes missing the plain word carries the link.

**`assets/cv/Emanuela-Telescu-CV.pdf` is the source of truth for the CV.** When
it changes, update `cv.html` too so the page and the PDF stay in step.

## Licence

Copyright (c) 2026 Emanuela Telescu. All rights reserved. See `LICENSE.md`.
The design, code and written content of this site are not free to reuse.
