# Open [VERIFY] markers: answer sheet

Questions only. Every marker below sits in a draft, and the build refuses to publish a non-draft article that still has one (see `src/lib/feed.ts`). Each entry is one marker, not one grep line, and entries are ordered by publish date.

Give your answers outside the tracker, for example in chat. This repo and its issues are public, and the confidentiality gate never scans issue or PR comments. Do not write answers into this file. Only the final, non-sensitive prose goes into `src/content`, where the gate checks it.

Marker text is quoted word for word from the source line. Delete this sheet once every marker is resolved. `tests/verify-sheet.test.mjs` keeps it in step with `src/content` while it exists.

## 1. 2026-11-20 · p06

- File: `src/content/social/p06.md`
- Line: 13
- Date: 2026-11-20
- Marker: `[VERIFY: the itch, e.g. events scattered across group chats.]`
- Question: What was the itch that made you start the events calendar, in a sentence?

## 2. 2026-11-20 · p06

- File: `src/content/social/p06.md`
- Line: 17
- Date: 2026-11-20
- Marker: `[VERIFY: when you moved]`
- Question: In which month and year did you move from Dublin to Innsbruck?

## 3. 2026-11-24 · observability-with-an-ai-incident-responder

- File: `src/content/posts/observability-with-an-ai-incident-responder.md`
- Line: 58
- Date: 2026-11-24
- Marker: `[VERIFY: how the test works, e.g. feeds each rule the condition it should catch and checks an alert comes out.]`
- Question: How does the test that every alert rule can fire work? Does it feed each rule the condition it should catch and check that an alert comes out?

## 4. 2026-11-24 · observability-with-an-ai-incident-responder

- File: `src/content/posts/observability-with-an-ai-incident-responder.md`
- Line: 72 (marker 1 of 2 on this line)
- Date: 2026-11-24
- Marker: `[VERIFY: confirm from real use]`
- Question: From real use, which of these is it good at: correlating an error spike with the deploy before it, spotting that a synthetic login failure is really a TLS or upstream issue, summarising a noisy log stream? Keep only the ones you have seen.

## 5. 2026-11-24 · observability-with-an-ai-incident-responder

- File: `src/content/posts/observability-with-an-ai-incident-responder.md`
- Line: 72 (marker 2 of 2 on this line)
- Date: 2026-11-24
- Marker: `[VERIFY: one real, non-sensitive incident it triaged well]`
- Question: What is one real incident, safe to describe publicly, that it triaged well?

## 6. 2026-11-24 · observability-with-an-ai-incident-responder

- File: `src/content/posts/observability-with-an-ai-incident-responder.md`
- Line: 74
- Date: 2026-11-24
- Marker: `[VERIFY: an example of a wrong or unhelpful diagnosis]`
- Question: What is one example of a wrong or unhelpful diagnosis it gave?

## 7. 2026-11-24 · observability-with-an-ai-incident-responder

- File: `src/content/posts/observability-with-an-ai-incident-responder.md`
- Line: 78
- Date: 2026-11-24
- Marker: `[VERIFY: were any actually broken when the test landed?]`
- Question: Were any of the early alert rules actually broken when the "every alert can fire" test first landed?

## 8. 2026-11-24 · observability-with-an-ai-incident-responder

- File: `src/content/posts/observability-with-an-ai-incident-responder.md`
- Line: 80
- Date: 2026-11-24
- Marker: `[VERIFY: final number of alert rules]`
- Question: What is the final number of alert rules?

## 9. 2026-12-01 · wordpress-to-wagtail-without-breaking-the-business

- File: `src/content/posts/wordpress-to-wagtail-without-breaking-the-business.md`
- Line: 37
- Date: 2026-12-01
- Marker: `[VERIFY: client permission to describe the project, even anonymised]`
- Question: Do you have the client owner's permission to describe this project in the article, even anonymised?

## 10. 2026-12-01 · wordpress-to-wagtail-without-breaking-the-business

- File: `src/content/posts/wordpress-to-wagtail-without-breaking-the-business.md`
- Line: 56
- Date: 2026-12-01
- Marker: `[VERIFY: did the owner start quoting in the new system before cutover?]`
- Question: Did the owner start quoting in the new system before the public site cut over?

## 11. 2026-12-08 · replacing-filemaker-with-django

- File: `src/content/posts/replacing-filemaker-with-django.md`
- Line: 37
- Date: 2026-12-08
- Marker: `[VERIFY: client permission to describe, even anonymised]`
- Question: Do you have the client owner's permission to describe this project in the article, even anonymised?

## 12. 2026-12-08 · replacing-filemaker-with-django

- File: `src/content/posts/replacing-filemaker-with-django.md`
- Line: 83
- Date: 2026-12-08
- Marker: `[VERIFY: confirm this happened, or replace with the real lesson]`
- Question: Did you start from the legacy export's columns and keep its record-per-role habit for longer than you should have? If not, what was the real lesson?

## 13. 2027-01-05 · pricing-is-a-workflow-not-a-spreadsheet

- File: `src/content/posts/pricing-is-a-workflow-not-a-spreadsheet.md`
- Line: 74
- Date: 2027-01-05
- Marker: `[VERIFY: is automatic sending still off for the digest, so each one waits for approval?]`
- Question: Is automatic sending of the weekly digest still off, so each digest waits for approval?

## 14. 2027-01-05 · pricing-is-a-workflow-not-a-spreadsheet

- File: `src/content/posts/pricing-is-a-workflow-not-a-spreadsheet.md`
- Line: 82
- Date: 2027-01-05
- Marker: `[VERIFY: is the pipeline dashboard in regular use yet, or still being adopted?]`
- Question: Is the pipeline dashboard in regular use yet, or still being adopted?

## 15. 2027-01-12 · a-second-brain-needs-a-schema

- File: `src/content/posts/a-second-brain-needs-a-schema.md`
- Line: 70 (marker 1 of 2 on this line)
- Date: 2027-01-12
- Marker: `[VERIFY: is the Telegram trigger leg live end to end, with a real voice note and bot reply?]`
- Question: Is the Telegram trigger leg live end to end, with a real voice note in and a bot reply out?

## 16. 2027-01-12 · a-second-brain-needs-a-schema

- File: `src/content/posts/a-second-brain-needs-a-schema.md`
- Line: 70 (marker 2 of 2 on this line)
- Date: 2027-01-12
- Marker: `[VERIFY: rough count of Concepts in the vault today, if Pearse is happy to share it]`
- Question: Roughly how many Concepts are in the vault today, and are you happy to publish the number?

## 17. 2027-01-19 · verifiable-and-erasable

- File: `src/content/posts/verifiable-and-erasable.md`
- Line: 42
- Date: 2027-01-19
- Marker: `[VERIFY: the Hub glossary and the certificate model disagree on whether certificates carry CME/DFP credit; this post says only "contact hours" and avoids the credit claim. Confirm before publishing.]`
- Question: Does a certificate carry CME/DFP credit, or only contact hours? The glossary and the certificate model disagree; the post now says only "contact hours".

## 18. 2027-01-19 · verifiable-and-erasable

- File: `src/content/posts/verifiable-and-erasable.md`
- Line: 64
- Date: 2027-01-19
- Marker: `[VERIFY: confirm Pearse is happy to cite Art. 17(3)(b) publicly as the basis.]`
- Question: Are you happy to cite Art. 17(3)(b) publicly as the legal basis for keeping the licence number, attended days and threshold?

## 19. 2027-01-19 · verifiable-and-erasable

- File: `src/content/posts/verifiable-and-erasable.md`
- Line: 76
- Date: 2027-01-19
- Marker: `[VERIFY: was this caught in testing or after a real erasure? Wording assumes testing.]`
- Question: Was the order-sync bug caught in testing or after a real erasure? The wording assumes testing.

## 20. 2027-01-21 · p15

- File: `src/content/social/p15.md`
- Line: 15
- Date: 2027-01-21
- Marker: `[VERIFY: caught in testing or after a real erasure? Copy assumes testing.]`
- Question: Was the order-sync bug caught in testing or after a real erasure? The copy assumes testing.

## 21. 2027-01-26 · i-was-the-event-guy

- File: `src/content/posts/i-was-the-event-guy.md`
- Line: 39
- Date: 2027-01-26
- Marker: `[VERIFY: the raw essay spells it both Freerides.org and Freeride.org; which is right?]`
- Question: Which spelling is right, Freerides.org or Freeride.org?

## 22. 2027-02-04 · p17

- File: `src/content/social/p17.md`
- Line: 16
- Date: 2027-02-04
- Marker: `[VERIFY: the one habit from racing you still use at work, e.g. walking the course before you ride it, or changing one thing at a time]`
- Question: What is the one habit from racing that you still use at work?
