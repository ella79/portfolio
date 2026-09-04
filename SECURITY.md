# Security policy

## Scope

This repository publishes a static website. There is no backend, no database,
no authentication and no user data storage. Nothing about a visitor is recorded:
no analytics, no cookies, no local storage. The contact form does not submit
anything to a server. It validates the input in the browser and then hands the
message to the visitor's own email client through a `mailto:` link.

## Hardening in place

- A restrictive Content Security Policy is declared in every page. Scripts and
  styles load only from this origin, fonts only from Google Fonts, and
  `form-action` is set to `none` so nothing can be posted anywhere.
- `default-src 'none'` is the starting point, so anything not listed above is
  refused rather than allowed by omission.
- No third party analytics, trackers or advertising scripts.
- No inline scripts or inline event handlers, so the policy needs no
  `unsafe-inline` escape hatch.
- External links use `rel="noopener noreferrer"`, and the referrer policy is
  `strict-origin-when-cross-origin`.
- HTTPS is enforced by GitHub Pages.
- Workflows run with `permissions: contents: read` by default. Only the
  deployment job is granted `pages: write` and `id-token: write`, and it
  authenticates with a short lived OIDC token rather than a stored secret.
- Deployments are serialised through a `concurrency` group, so two runs can
  never publish at the same time.
- Dependabot keeps GitHub Actions pinned to maintained versions.

## What is deliberately not claimed

A published web page is readable by anyone who opens it, so its markup, styles
and images can always be saved locally. The licence, not a technical control,
is what governs reuse. Write access to this repository is limited to its owner;
copies made elsewhere are a licence matter and are handled as one.

## Reporting

If you find a problem with this site, please report it by email to
emanuela.telescu@yahoo.com rather than by opening a public issue.
