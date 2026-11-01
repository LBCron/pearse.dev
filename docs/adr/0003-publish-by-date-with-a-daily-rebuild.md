---
status: accepted
date: 2026-10-24
---

# Publish by publication date at build time, with a daily rebuild

An article is published when it is not a draft and its publication date (UTC) has passed at build time. A scheduled workflow rebuilds and redeploys the site every morning so a scheduled article goes live on its date without a commit. We rejected deploying on a per-article timer because GitHub Pages has no such thing, and rejected client-side date checks because the page would still exist and be indexable.

## Consequences

- The social feed lists scheduled articles before their page exists, with a `published` flag, so the scheduler must never post a link whose flag is false.
- A rebuild at 06:00 UTC means an article dated today is live from roughly then, not from midnight.
- GitHub disables scheduled workflows after 60 days with no repository activity, which would stop the daily rebuild silently. `.github/workflows/keepalive.yml` re-enables the deploy workflow weekly, with no commit. That works only if the enable call resets GitHub's inactivity counter, which GitHub does not document. The fallback is a push to `master` at least every 60 days.
