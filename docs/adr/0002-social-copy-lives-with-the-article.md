---
status: accepted
date: 2026-10-24
---

# Social copy lives in the article's frontmatter

Every article carries its own LinkedIn and short social copy in frontmatter, and the build emits them as the social feed. The alternative, keeping social copy in the scheduler or a spreadsheet, was rejected because the copy would drift from the article it promotes and could not be reviewed in the same pull request. The site is the single source of truth for what gets posted; the scheduler is a consumer.

Standalone posts, which have no article, follow the same rule: they are content in the repository with the same approval and verify-marker rules, not entries typed into the scheduler.

Articles have a build-time guard too: the feed builder throws for any non-draft article, whatever its pubDate, whose title, description, body or social copy still has a `[VERIFY` marker.
