# Social scheduler workflow (n8n)

`social-scheduler.json` is the Scheduler from ADR 0004 as an n8n 1.x workflow export. It reads the social feed, asks for Approval in Telegram, posts approved copy to LinkedIn, cross-posts the short copy to Bluesky and Mastodon when their credentials are set up, and keeps the Posting record. Nothing is posted without a tap on Approve.

| File | What it is |
|------|------------|
| `social-scheduler.json` | The workflow. Credentials are referenced by name only; it holds no tokens and no chat id. |
| `select.mjs` | The tested reference for the logic in the **Decide** and **Record result** Code nodes: selection, the LinkedIn, Bluesky and Mastodon payloads, the Posting record. |
| `../../tests/scheduler.test.mjs` | Tests for `select.mjs` and for the workflow file. They also run the two embedded nodes with n8n's globals stubbed. |
| `../../tests/crosspost.test.mjs` | Tests for the Bluesky and Mastodon payloads, the skip rules and the per-network rows. |

## How it runs

```
Daily schedule (07:00, 09:00) ─┐
                               ├─ Fetch social feed ─ Decide ─ Route action ─┬─ ack     ─ Answer button
Telegram update ───────────────┘                                            ├─ offer   ─ Send offer (Approve / Skip)
  (messages and button taps)                                                ├─ notify  ─ Send message
                                                                            ├─ dryrun  ─ Log dry-run payload ─ Send message
                                                                            ├─ post     ─ Post to LinkedIn ──────────────────────────────────────────┐
                                                                            ├─ bluesky  ─ Bluesky session ─ Post to Bluesky ─ End session ─ Mark ────┤
                                                                            └─ mastodon ─ Post to Mastodon ─ Mark Mastodon result ───────────────────┴─ Record result ─ Send message
```

1. **Daily, 07:00 Europe/Vienna** (the workflow's timezone), it fetches `https://pearse.dev/social.json` and selects the entries dated today that may be posted: articles with `published: true`, and standalone posts with `status: approved`. It drops anything in the Posting record and anything already offered, then sends each one to Telegram with the full LinkedIn and short copy and two buttons. A run with nothing to offer sends nothing, with one exception: on the **last daily run** (the hour of the last rule, `LAST_DAILY_HOUR` in `select.mjs`; a run delayed past that hour still counts), each article dated today that is still not `published: true` gets one plain warning naming its id and date, pointing at the **Deploy to GitHub Pages** workflow and saying that `/reoffer <id>` offers it once it is live. The rebuild failing, running late or being disabled therefore does not look like a quiet day. The warning is a notify only: no buttons, nothing marked offered, nothing in the Posting record, nothing posted. Standalone posts, `/run`, `/reoffer` and button taps never warn, and neither does a run that cannot read the feed (it reports that instead). An entry that cannot be offered (an id too long for Telegram's 64-byte button data, LinkedIn copy over 3,000 characters, no `LINKEDIN_AUTHOR_URN`) is reported in the chat and not marked offered, and the other entries are still offered. **A missed day is not caught up**: a run selects only entries dated today, so if n8n was down all day, use `/reoffer <id>` for each item.
2. **A second run at 09:00** repeats the selection. Anything offered at 07:00 is not offered again, so it only picks up an article that became published in between. The site's daily rebuild runs at 06:00 UTC, which is 07:00 in Vienna in winter and 08:00 in summer, so at 07:00 today's article usually still shows `published: false`. Remove the 09:00 rule from **Daily schedule** if the rebuild moves earlier, and change `LAST_DAILY_HOUR` in `select.mjs` to the new largest hour, then re-paste `select.mjs` into both Code nodes. The test 'the Daily schedule cron rules are daily on the hour, and the last hour matches the constant' in `tests/scheduler.test.mjs` pins the two together: it fails on a rule that is not `0 H * * *` or when the largest H differs from the constant.
3. **Approve** (`approve:<id>`) fetches the feed again and re-checks the entry: still in the feed, eligible (an article must be `published: true`), not dated after today, and not in the Posting record. It then posts the LinkedIn copy, and the short copy to each cross-post network that is on (see Settings), and replies once per network with the post reference and link. A `published: false` article is refused at every step and never posted. A network that is off is named in a note such as `skipped: no Bluesky credential (BLUESKY_CREDENTIAL is unset)`; that is not an error. Approve only posts to networks that have no row yet, so tapping it again after one network failed retries that network alone.
4. **Skip** (`skip:<id>`) adds a `skipped` row to the Posting record, so the item is never offered again.
5. **Before each network's call, Approve writes a `pending` row for that network**, so a second tap on the same button is refused. Each network's result decides only its own row, so one network failing never blocks the others:
   - **2xx**: the row becomes `posted`, with the post reference (LinkedIn URN, Bluesky `at://` URI, Mastodon status URL).
   - **4xx**: the network refused the post, so nothing was posted there. The row is dropped and the reply (HTTP status and the first 500 characters of the body) says to fix the cause and tap Approve again.
   - **No response, a network error or 5xx**: the post may have gone out. The row becomes `unknown` and the reply says to check that network first. It never suggests a blind retry. If the post is not there, `/reoffer <id>`.
   - **Bluesky login failed** (createSession did not answer 2xx): nothing was posted to Bluesky. The row is dropped and the reply says to check the `bluesky-app-password` credential, then tap Approve again.

   No network node retries automatically.
6. **Other errors go back to the same chat**: a feed that cannot be read, a configuration problem (as long as `TELEGRAM_CHAT_ID` itself is valid), and any unexpected error in Decide. A failed "Answer button" (for example a stale tap) does not stop the run.

**The chat must be a private 1:1 chat with the bot.** Only updates from `TELEGRAM_CHAT_ID` are acted on, and only from a private chat. Group chats are ignored even when their id matches, because there any member could tap Approve. With `TELEGRAM_USER_ID` set, the sender's `from.id` must match as well. Button taps and messages from anywhere else are ignored.

### Telegram commands

| Command | What it does |
|---------|--------------|
| `/run` | Runs today's selection now. Same rules as the daily run, so it is a no-op if everything was offered already ("Nothing new to offer"). |
| `/reoffer <id>` | Offers one item again: one that was skipped, recorded `unknown` (after you checked it is not on that network), left `pending`, or offered and never answered (a lost or deleted message). Its rows other than `posted` and its offer are removed first, so the new offer lists only the networks still to post. An item posted on every network that is on is refused, except in a dry run, which starts over. The item must still be eligible and dated today or earlier. |
| `/help` | Lists the commands. |

## Settings

Set these as **n8n variables** (Settings > Variables), or, on an instance without variables, as **environment variables** of the n8n process. The Code nodes read `$vars` first and fall back to `$env`. Environment access must not be blocked (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`) if you use that route.

| Name | Required | Meaning |
|------|----------|---------|
| `TELEGRAM_CHAT_ID` | yes | Your private chat with the bot (digits only): it gets the prompts, and only its taps count. Step 3 of `../setup/credentials.sh` prints it. |
| `TELEGRAM_USER_ID` | no | Your Telegram user id. When set, only taps and commands sent by this user count. In a private chat it equals the chat id. |
| `LINKEDIN_AUTHOR_URN` | yes | `urn:li:person:<sub>`, the `author` of every post. Step 2 of the wizard prints it. |
| `DRY_RUN` | no | **Defaults to dry run.** Only the exact value `false` (any case) posts for real. |
| `SCHEDULER_TODAY` | no | `YYYY-MM-DD`: pretend today is this date. Honoured in dry runs only, ignored when `DRY_RUN=false`. |
| `BLUESKY_CREDENTIAL` | no | Set to `bluesky-app-password` to cross-post to Bluesky. Unset (or any other value) skips Bluesky with a note. |
| `MASTODON_CREDENTIAL` | no | Set to `mastodon-token` to cross-post to Mastodon. Needs `MASTODON_INSTANCE_URL` too. |
| `MASTODON_INSTANCE_URL` | with Mastodon | Your instance, `https://<host>` with no path (a trailing slash is ignored). Unset or malformed skips Mastodon with a note. |

A cross-post setting never stops the run: a missing or wrong value only turns that network off, and the note says why. The variable names the credential rather than holding a secret, because n8n nodes pick credentials by name and the Code nodes cannot see whether one exists.

Credentials (created by `../setup/credentials.sh` steps 4 to 6, see `../README.md`):

| Credential name | n8n type | Used by |
|-----------------|----------|---------|
| `telegram-pearse-dev` | Telegram API | Telegram update, Answer button, Send offer, Send message |
| `linkedin-member` | Header Auth (`Authorization: Bearer …`) | Post to LinkedIn |
| `bluesky-app-password` | Custom Auth (`{"body": {"identifier": …, "password": …}}`, an app password) | Bluesky session (optional) |
| `mastodon-token` | Header Auth (`Authorization: Bearer …`, scope `write:statuses`) | Post to Mastodon (optional) |

After `credentials.sh renew-token` the `linkedin-member` credential gets a new id: open **Post to LinkedIn** and select it again.

## The LinkedIn call

`POST https://api.linkedin.com/v2/ugcPosts` with headers `X-Restli-Protocol-Version: 2.0.0` and `Content-Type: application/json`, authenticated by `linkedin-member`. The body comes from `buildLinkedInPayload` in `select.mjs`:

- **Article**: `shareMediaCategory: ARTICLE`, with `media[0].originalUrl` the article URL and `media[0].title` its title, so LinkedIn renders the link card.
- **Standalone post**: `shareMediaCategory: NONE`, text only.
- Both: `author` is `LINKEDIN_AUTHOR_URN`, `lifecycleState: PUBLISHED`, `visibility` `PUBLIC`, and `shareCommentary.text` the entry's `social.linkedin`.

The post URN comes from the response body's `id`, or the `x-restli-id` header.

## The Bluesky and Mastodon calls

Both get the entry's `social.short` copy. Short copy that already contains the link is kept as it is when it fits. Otherwise the link is moved to the end (`<copy>\n\n<url>`) and only the copy is cut, at a grapheme boundary with `…`, never the URL. Standalone posts have no URL, so they are the copy alone.

- **Bluesky** (limit 300 graphemes): `POST https://bsky.social/xrpc/com.atproto.server.createSession` with the `bluesky-app-password` credential, then `POST https://bsky.social/xrpc/com.atproto.repo.createRecord` with that session's `accessJwt` and `{repo: <did>, collection: "app.bsky.feed.post", record}`. The record is `{$type, text, createdAt, facets}` from `buildBlueskyRecord`: one link facet per occurrence of the URL, with UTF-8 **byte** offsets (not character offsets). Standalone posts have no facet. **End Bluesky session** then calls `deleteSession` straight away, before **Mark Bluesky result**, **Record result** or **Send message** run, so the refresh token left in the execution data is revoked even if a later node fails. **Mark Bluesky result** reads the createRecord response from **Post to Bluesky**, not the deleteSession one. The reference stored is the record's `at://` URI.
- **Mastodon** (limit 500 characters): `POST {MASTODON_INSTANCE_URL}/api/v1/statuses` with the `mastodon-token` credential and `{status, visibility: "public"}` from `buildMastodonStatus`. The `Idempotency-Key` header is `pearse.dev:mastodon:<id>`, so the instance drops a repeat of the same request. The reference stored is the status URL.

## The Posting record

Stored in the workflow's **static data** (`$getWorkflowStaticData('global')`):

```json
{
  "live":   { "record": [{ "id": "p01", "network": "linkedin", "postedAt": "2026-11-03T06:04:12.000Z", "postUrn": "urn:li:share:…", "status": "posted" },
                         { "id": "p01", "network": "bluesky",  "postedAt": "2026-11-03T06:04:13.000Z", "uri": "at://did:plc:…/app.bsky.feed.post/…", "status": "posted" },
                         { "id": "p01", "network": "mastodon", "postedAt": "2026-11-03T06:04:13.000Z", "url": "https://<your instance>/@you/…", "status": "unknown" }],
              "offered": { "p01": "2026-11-03T06:00:01.000Z" } },
  "dryRun": { "record": [], "offered": {} }
}
```

- `record` is the Posting record, one row per item and network: `{id, network, postedAt, <ref>, status: 'posted'|'skipped'|'pending'|'unknown'}`, where `network` is `linkedin`, `bluesky` or `mastodon` and the reference field is `postUrn`, `uri` or `url` respectively. `pending` exists only while that network's call is in flight, and `unknown` means the call gave no clear answer (see Approve above). For anything other than `posted`, `postedAt` is the time of that decision and the reference is null. Rows are keyed by feed `id` (the article slug, or the standalone id such as `p01`) plus `network`; a row with no `network` (written before cross-posting existed) counts as LinkedIn. Skip writes a single `skipped` row, and that blocks every network.
- `offered` remembers what was sent for Approval, so a second run the same day is a no-op.
- Dry runs use their own `dryRun` copy, so testing never blocks or fakes a live post. Switching `DRY_RUN` to `false` starts from the untouched `live` record.

**Why static data and not an n8n Data Table.** Static data needs no setup and the export imports as is: both triggers live in this one workflow, so the daily run and the button taps share it. A Data Table would have to be created by hand first and its instance-specific id selected in every node that uses it, and Data Tables are newer than much of n8n 1.x. The trade-offs, acceptable at a handful of posts a week:

- Static data is saved only for **production executions**: the workflow must be active, started by its triggers. Clicking "Execute workflow" in the editor does not persist it. Test through Telegram (`/run`) on the active workflow.
- n8n saves static data when an execution ends. A second Approve tap that arrives after the first execution has finished sees the `pending` or `posted` row and is refused. Two taps whose executions overlap, within the second or so of the network calls, can still both post. LinkedIn usually rejects the identical second post as a duplicate (a 4xx), and Mastodon drops it by its `Idempotency-Key`; Bluesky has no such check, so it could post twice.
- To read or repair the record, open a recent execution of **Decide** (its code can be changed temporarily to `return [{ json: $getWorkflowStaticData('global') }]`), or use `/reoffer`.

## Import (Pearse)

> **Prerequisite before `DRY_RUN=false`: a live import and a dry run.** The Bluesky login is untested against a real n8n. **Bluesky session** relies on n8n merging the `bluesky-app-password` Custom Auth credential's `body` (`identifier`, `password`) into the createSession request body; the tests stub n8n and cannot show that it does. Import the workflow, run the dry run below, then with Bluesky on and `DRY_RUN` still `true`, execute **Bluesky session** once in the editor and check it answers 200 with an `accessJwt`. If it answers 400 or 401, the merge did not happen: keep Bluesky off and fix the node first. Never paste the app password into the node, because it would then be in the exported JSON. Until that check passes, leave `BLUESKY_CREDENTIAL` unset.

This export could not be imported into a live n8n from the agent that wrote it; do this once:

1. Run `../setup/credentials.sh` (issue #13) so `telegram-pearse-dev` and `linkedin-member` exist in n8n, plus `bluesky-app-password` and `mastodon-token` if you want those networks (steps 5 and 6, both optional).
2. In n8n: **Workflows > Import from File**, choose `automation/n8n/social-scheduler.json`.
3. **Check the feed read first.** Execute **Fetch social feed** once in the editor. Its output should hold the feed text in `body`, which is what Decide reads (it also accepts `body.feed`, `data` or `feed`). If the text sits under another key, Decide replies "Could not read the social feed: the feed is not a JSON array" on every run. Then adjust `parseFeedResponse` in `select.mjs` and both Code nodes.
4. Open **Telegram update**, **Answer button**, **Send offer**, **Send message**, **Post to LinkedIn**, **Bluesky session** and **Post to Mastodon**. If n8n did not match a credential by name, select it from the list. Save. A network you skipped can keep its unmatched credential: it is never called while its variable is unset.
5. Add the variables `TELEGRAM_CHAT_ID`, `LINKEDIN_AUTHOR_URN` and `DRY_RUN=true` (or the environment variables, see Settings), and for each cross-post network you set up, `BLUESKY_CREDENTIAL` or `MASTODON_CREDENTIAL` with `MASTODON_INSTANCE_URL`. Step 7 of the wizard prints the list.
6. Activate the workflow. The Telegram Trigger registers the bot's webhook, so n8n must be reachable over public HTTPS, and only one active workflow can use this bot's trigger.

## Test with a dry run

1. Keep `DRY_RUN=true`. Set `SCHEDULER_TODAY` to a date with an entry in the live feed (open `https://pearse.dev/social.json` and pick an article with `published: true`, or an approved standalone post).
2. Send `/run` to the bot. Each item arrives as `DRY RUN: Approve this post for <date>?`, a `Posts to: LinkedIn, Bluesky, Mastodon` line naming the networks that are on, the full copy and the two buttons.
3. Tap **Approve**. With both cross-post credentials named there are three replies, one per network, each with the URL, the headers and the exact JSON body:

   ```
   DRY RUN: would POST https://api.linkedin.com/v2/ugcPosts
   X-Restli-Protocol-Version: 2.0.0 …  { "author": "urn:li:person:…", … }

   DRY RUN: would POST https://bsky.social/xrpc/com.atproto.server.createSession with the bluesky-app-password credential, then
   POST https://bsky.social/xrpc/com.atproto.repo.createRecord
   Authorization: Bearer <accessJwt of that session> …
   { "repo": "<did of that session>", "collection": "app.bsky.feed.post",
     "record": { "$type": "app.bsky.feed.post", "text": "…", "createdAt": "…",
                 "facets": [{ "index": { "byteStart": 12, "byteEnd": 52 }, "features": [{ "$type": "app.bsky.richtext.facet#link", "uri": "https://pearse.dev/writing/…/" }] }] } }

   DRY RUN: would POST https://<your instance>/api/v1/statuses
   Authorization: <mastodon-token credential>
   Idempotency-Key: pearse.dev:mastodon:<id> …
   { "status": "…", "visibility": "public" }
   ```

   A network that is off is reported instead, for example `DRY RUN: <id>: skipped: no Bluesky credential (BLUESKY_CREDENTIAL is unset)`. Each body is also the output of **Log dry-run payload** in the execution view, tagged with its network, and on n8n's stdout when `CODE_ENABLE_STDOUT=true`.
4. Send `/run` again: `Nothing new to offer`. Tap **Approve** again: `already posted`. Tap **Skip** on another item, then `/run`: it is not offered.
5. `/reoffer <id>` brings an item back for another try (in a dry run, even one marked posted).
6. When satisfied: delete `SCHEDULER_TODAY`, set `DRY_RUN=false`.

## Changing the logic

Edit `select.mjs`, run `node --test tests/scheduler.test.mjs`, then paste the whole file into the top of the **Decide** and **Record result** Code nodes with every leading `export ` removed, keeping the shim below it. Re-export the workflow over `social-scheduler.json`. The test `Code nodes embed select.mjs verbatim` fails until both copies match, and the confidentiality test fails if an export picks up a token or chat id.
