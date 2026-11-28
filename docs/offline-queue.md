# The offline write queue

How the web client keeps a mutation the API never received, and what it
guarantees when the connection comes back.

**Audience:** anyone changing `apps/webClient/src/infrastructure/offline-queue*`.
**Code:** `offline-queue.model.ts` (rules), `offline-queue.ts` (storage and
replay), `api.config.ts` (the interceptor that fills it).
**Tests:** `__tests__/offline-queue.model.spec.ts`,
`__tests__/offline-queue.spec.ts`.

---

## Why it exists

A mutation that fails because the device is offline must not disappear: the user
pressed save, the modal closed, and the amounts are real. The queue keeps the
request until the API confirms it.

Two things make that harder than storing a request:

- **The API applies writes in arrival order.** Two edits of one transaction
  replayed out of order leave the older amount as the one that sticks.
- **A retry can duplicate work.** An import that committed before the response
  was lost would insert its rows twice on replay.

Everything below exists to answer those two.

---

## The row

| Field | Written | Meaning |
|---|---|---|
| `id` | on enqueue | Identity of the row, for the mid-flush merge |
| `sequence` | on enqueue | Enqueue order. Assigned once, never reused, global across both stores |
| `resourceKey` | **derived on read** | What the write touches: method + URL + id from the body |
| `idempotencyKey` | on enqueue | Makes a resend safe: the API answers from its receipt |
| `timeout` | on enqueue | Deadline of the original request, replayed as-is |
| `state` | **derived on read** | `waiting` while a deadline is in the future, `ready` otherwise |
| `nextAttemptAt` | on scheduling | The only persisted deadline. `state` follows from it |
| `retryCount` | on retry | Attempts that spent the budget. A `429` does not |
| `owner` | on enqueue | Account that queued the row |

Only inputs are persisted. `resourceKey` and `state` are computed by
`hydrateQueue`, so a stored value can never disagree with the request it
describes — a stale key written by an older build once split two edits of one
transaction into separate groups.

`withDeadline(write, nextAttemptAt, now)` is the single place that writes
`state` and `nextAttemptAt`; `isDue(write)` reads `state` and nothing else.

---

## Storage: two keys

| Key | Holds | Read by |
|---|---|---|
| `offline_queue` | Rows an older bundle can replay faithfully: method, URL, body | Any build |
| `offline_queue:replay` | Rows that need this bundle: `idempotencyKey` or `timeout` | This build only |

Both are JSON arrays of rows. The split exists because tabs on one origin share
`localStorage` but not their JavaScript: a tab still running the previous bundle
drains the shared array on reconnect and sends method, URL and body, dropping an
`Idempotency-Key` it does not know about. Keeping keyed rows in a key it never
reads means it cannot duplicate an import; keeping the shared queue an array
means it can still append and drain its own writes without erasing ours.

Rows without a sequence — what an older bundle appends — are numbered above the
highest sequence found in **either** key, in array order.

---

## Replay rules

A flush walks rows by `sequence` and, for each one:

1. Skips it if an earlier write of the same `resourceKey` has not landed in this
   pass, whatever its own deadline says.
2. Sends it only if it is `ready`.
3. On success, releases the successors of that resource in the same pass, in
   order.

A row in flight is never persisted: if the tab dies mid-send it reloads as
`ready`, and the idempotency key keeps the outcome single.

### What happens to a rejection

| Outcome | Decision |
|---|---|
| `429` | Stay queued, wait for `Retry-After` (no cap), spend no budget |
| Other `4xx` | Drop — the answer cannot change |
| Timeout without an idempotency key | Drop — unknown outcome, a resend could duplicate |
| Timeout with an idempotency key | Retry, spend budget |
| Anything else | Retry with exponential backoff, spend budget |

The budget is five attempts. Between attempts the row waits
`1s, 2s, 4s…` capped at 30 s; a `Retry-After` longer than that is honoured in
the row and the wake-up is capped separately at `2³¹−1 ms`.

When the interceptor has to queue a write again mid-flush, the next flush backs
off from one second again — an `online` event that fires early with nothing due
does not reset that streak, only a send that lands does.

---

## Account scoping

A queued write is a `POST` the API still has to apply, so replaying it after a
sign-out would write the previous user's records into whoever the browser is
authenticated as. The queue fails closed:

- nothing is replayed before the account is known — a page load starts with no
  user, and `auth.user` arrives after the `online` event;
- a row is replayed only into the account that queued it;
- a keyed row with no recorded account is never replayed — it cannot be
  attributed, and a resend writes rows.

`clearQueue()` runs on logout and on session expiry: it removes both keys and
seals the queue until the next sign-in. Rows are dropped, never replayed into
another account.

---

## Guarantees and non-guarantees

**Guaranteed, covered by the specs**

- Two edits of one resource replay in the order they were made, including when
  the newer one has the earlier deadline.
- A throttled write survives more retries than the budget and clears once
  accepted.
- A write that the storage rejects is reported to the caller: the interceptor
  answers `_offline` only after `enqueueRequest` returned `true`.
- A credential body never reaches storage.

**Not guaranteed**

- Delivery. The queue is client-side state: a user who clears site data loses
  what had not been sent.
- A permanent `4xx` (a deleted transaction, a forbidden edit) drops the row
  silently; the user is not told.
- Cross-tab merging beyond appends: two tabs flushing at once can each send a
  row the other also sends. The idempotency key covers the keyed rows; plain
  writes rely on the API being idempotent per action.
