# Security Policy

BLA-БЛА is a static, browser-only app. It has no server, accounts or database. The main security-relevant areas are:

- **API keys** stored in the browser's `localStorage` and sent directly to the chosen provider.
- **The optional CORS proxy** (`proxy/cloudflare-worker.js`) that users deploy themselves, which forwards requests (including keys) to an allow-list of provider hosts.
- **Rendering of provider responses** in the page.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting instead: go to the repository's **Security** tab and choose **Report a vulnerability**.

Include what an attacker could do, the steps to reproduce, and the affected file(s) if you know them. This is a small, volunteer-maintained project, so response times aren't guaranteed, but reports will be looked at.

## Supported versions

Only the latest version on `main` (the one deployed to GitHub Pages) receives fixes.
