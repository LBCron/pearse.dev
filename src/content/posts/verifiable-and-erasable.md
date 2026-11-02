---
title: "Verifiable and erasable: certificates under GDPR"
description: "How MTS Hub keeps attendance certificates publicly verifiable while honouring erasure: snapshot what the credential needs, scrub who it names."
pubDate: 2027-01-19
tags: [django, privacy, architecture]
project: "mts-hub"
series: mts-hub
seriesOrder: 4
draft: true
social:
  linkedin: |
    A certificate has to be checkable by a stranger for years. The person on it has the right to be forgotten. Both are true.

    MTS Hub, the Django platform I run, issues attendance certificates for hands-on surgical training. Each one has a public verification page: no login, open to anyone with the link.

    So what happens when that person asks to be erased?

    Deleting the certificate destroys a credential that may need re-evidencing years later. Keeping the name leaves it on a public page forever. Neither is acceptable.

    The answer was to decide, field by field, which promise each piece of data serves.

    The name serves identity. It is scrubbed, on the live row and on every history snapshot.

    The attendance count, the threshold that applied and the certificate number serve the credential. They stay, under the GDPR exemption for records kept to meet a legal obligation.

    That snapshot pays twice: because the certificate carries its own attendance, the raw check-in records can be deleted on a short schedule.

    Two things went wrong on the way. One of them brought an erased person back to life.

    The write-up:

    https://pearse.dev/writing/verifiable-and-erasable/
  short: "A certificate must be verifiable for years; its holder can ask to be forgotten. How MTS Hub does both: snapshot the credential, scrub the name, everywhere it was copied. https://pearse.dev/writing/verifiable-and-erasable/"
---

A certificate has to be checkable by a stranger for years, its holder has the right to be forgotten, and the design work is deciding which field serves which of those promises.

MTS Hub is the Django operations platform I run for MTS – The Wetlab Company. Among other things it issues certificates for hands-on surgical training courses, each with a public verification page. It also has a GDPR module: a PII inventory, erasure and anonymisation. This post is about how those two coexist.

## What a certificate claims

A certificate in Hub attests verified hands-on attendance, nothing more. Issuance is gated: the participant must have checked in on a required number of distinct days.

At issue, the certificate **snapshots** what it claims: the holder's name, their professional licence number, contact hours [VERIFY: the Hub glossary and the certificate model disagree on whether certificates carry CME/DFP credit; this post says only "contact hours" and avoids the credit claim. Confirm before publishing.], the number of days they attended and the threshold that applied. Later edits to the course's certificate settings never rewrite an issued document.

Numbers are human-readable and run per year. Revoking or reissuing never reuses one: a reissue supersedes the old certificate, which then verifies as "superseded", and mints a fresh number. A partial unique constraint allows at most one valid certificate per contact and course, which is also what makes bulk issuance safe to re-run.

## What is verifiable

The verification page is addressed by an unguessable ID, needs no login and is kept out of search engines. It shows what a checker needs: the holder's name, the course, contact hours, topic, organiser and status.

It deliberately does not show the licence number. It does not show signature images either: those files are only served to a logged-in session, and putting people's handwritten signatures on a public URL is not a side effect worth having. Signatory names appear only when the printed certificate carries them.

## What is deleted

Erasure has one entry point, and it picks the path. A contact with no history is hard-deleted. A contact with real history, bookings or certificates, is anonymised in place, because those records point at the contact with a foreign key that refuses deletion.

Anonymising scrubs the name, email, phone, institution, specialty, licence number, notes and the whole postal address. It clears free-text and special-category fields on the person's bookings, anonymises their magic-link login and withdraws consent. The consent record keeps which policy version they walked away from, because that names a document, not a person.

The country field caused an argument. It is the one people want to keep "for statistics". I rejected that: on a small table of specialists, country plus specialty plus course history re-identifies someone. It goes with the rest.

## The decision: scrub the name, keep the credential

Deleting the certificate was the simple option, and I rejected it. A certificate is evidence a doctor may need to produce years later, and its value is the record itself.

So the certificate splits. `holder_name` serves identity, and it is what the public page renders indefinitely. It is scrubbed to the anonymised placeholder. The licence number, attended days and threshold serve the credential, and they stay under the GDPR exemption for records kept to meet a legal obligation. [VERIFY: confirm Pearse is happy to cite Art. 17(3)(b) publicly as the basis.] The licence number was never on the public page, so retaining it exposes nothing new.

The snapshot pays a second time. Because a certificate carries its own attendance count, it stands with no check-in row behind it. That lets check-ins be pruned after two years. The pruning job writes an anonymous per-course attendance rollup in the same transaction, before it deletes anything.

Verifiability lives in a small, deliberate snapshot. Everything else is free to go.

## What went wrong

Two things, both about copies.

First, history. Certificates and bookings keep an append-only edit history, so the erased name was still one click away in the admin's history view. The fix scrubs the history snapshots too, with a bulk update that does not itself append a fresh history row carrying the old values.

Second, the sync. Hub reconciles orders from the company's WooCommerce shop, keyed on email. After an anonymisation, the next reconcile found an order whose billing email matched no contact, recreated the person in full and moved the retained booking onto the copy. The fix is a tombstone: the erased address is retired in the same transaction as the anonymisation, stored only as a hash, and every import checks it before creating anyone. A member of staff re-adding the person by hand still wins. [VERIFY: was this caught in testing or after a real erasure? Wording assumes testing.]

Erasure is a fan-out problem. Every copy of a person is a place it can fail, including the copy a sync job will make tomorrow.


Verifiable and erasable are not in conflict. They are two different fields.
