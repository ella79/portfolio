# Personal landing page

Single page portfolio for **Emanuela Telescu**, Senior QA Automation Engineer.
Published with GitHub Pages at <https://ella79.github.io/portfolio/>.

## Repository layout

```
.
|-- index.html                  # the page itself, no build step required
|-- 404.html                    # custom not-found page
|-- assets/
|   |-- css/styles.css          # all styling, custom properties at the top
|   |-- js/main.js              # scroll effects, expandable lists, form validation
|   \-- img/                    # profile photo and any future images
|-- tests/
|   \-- smoke.spec.ts           # Playwright smoke suite
|-- .github/
|   |-- workflows/ci.yml        # runs on every push and pull request
|   |-- workflows/deploy.yml    # builds and publishes to GitHub Pages
|   \-- dependabot.yml          # keeps the actions up to date
|-- robots.txt
|-- sitemap.xml
|-- SECURITY.md
\-- LICENSE
```

## Working on it locally

No toolchain is needed to view the page. Open `index.html` in a browser, or
serve the folder so that relative paths and the Content Security Policy behave
exactly as they do in production:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

The site ships with a Playwright smoke suite that runs in CI on every push.
It checks that the page renders, that in page navigation reaches each section,
that the project list expands, and that the contact form rejects an empty
submission.

```bash
npm install
npx playwright install --with-deps chromium
npm test
```

## Deployment

Pushing to `main` triggers `deploy.yml`, which uploads the repository as a Pages
artifact and publishes it. Deployments run inside a `concurrency` group, so a
second push waits for the first one to finish instead of racing it.

## Adding a photo

Drop the image into `assets/img/` and replace the contents of the `.avatar`
element in `index.html`:

```html
<div class="avatar">
  <img src="assets/img/photo.jpg" alt="Emanuela Telescu">
</div>
```

## Licence

Copyright (c) 2026 Emanuela Telescu. All rights reserved. See `LICENSE`.
The design, code and written content of this site are not free to reuse.
