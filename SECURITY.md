# Security policy

## Scope

This repository publishes a static website. There is no backend, no database,
no authentication and no user data storage. The contact form does not submit
anything to a server. It validates the input in the browser and then hands the
message to the visitor's own email client through a `mailto:` link.

## Hardening in place

- A restrictive Content Security Policy is declared in `index.html`. Scripts and
  styles load only from this origin, fonts only from Google Fonts, and
  `form-action` is set to `none` so nothing can be posted anywhere.
- No third party analytics, trackers or advertising scripts.
- No inline scripts or inline event handlers, so the policy needs no
  `unsafe-inline` escape hatch.
- External links use `rel="noopener noreferrer"`.
- HTTPS is enforced by GitHub Pages.
- Workflows run with `permissions: contents: read` by default, and only the
  deployment job is granted the tokens it needs.
- Deployments are serialised through a `concurrency` group, so two runs can
  never publish at the same time.
- Dependabot keeps GitHub Actions pinned to maintained versions.

## Reporting

If you find a problem with this site, please report it by email to
emanuela.telescu@yahoo.com rather than by opening a public issue.
