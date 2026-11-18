# Rules for AI assistants working on HDF-Plug

Read [`PLAN.md`](PLAN.md), [`BRIDGE-API.md`](BRIDGE-API.md) and [`RESEARCH.md`](RESEARCH.md) first. This repository is public.

## Must hold

1. **No secrets or personal data, ever.** No tokens, keys, certificates, real email addresses or names, and no absolute machine paths. This repository is public and its history stays.
2. **The add-in is thin.** It holds no contacts, flows or business rules. Rules live in HoneyDue-Flow. If a rule seems to be needed here, it belongs in HoneyDue-Flow and the contract in `BRIDGE-API.md`.
3. **`BRIDGE-API.md` is the contract.** Change it first, with its revision line, then the code on both sides. The `apiVersion` is bumped only with a new `/vN` path.
4. **Office.js is touched only in `src/office/host.ts`.** Everything else takes plain values.
5. **Every message is in `src/texts.ts`.** A test checks each is non-empty.
6. **A stale answer must never be shown.** Anything asked of HoneyDue-Flow is dropped if the user has moved on (`src/state/session.ts`).
7. **Never claim what was not tested.** The README marks anything not proven in a real Outlook as such. Windows and other Outlooks are "not tested by the author".

## Tests

- Names start with an id: `PLG-` plus a letter for the area (`C` client, `D` data calls, `U` panel states, `F` form, `N` not eligible, `E` email, `S` session, `P` people, `W` time, `I` install, `T` words, `M` manifest).
- Tests never touch the network except the local fake in `tools/fake-bridge/`, and never use real tokens or mail.
- Dates are built with local-time constructors.
- Before a change is done: `npm run verify` (type check and all tests) passes, and `npm run build` works. After a fix, break the code on purpose once to see the test fail.

## Publishing

Pushing to `main` publishes the page to GitHub Pages after the tests pass. A bad change goes live, so run `npm run verify` and `npm run build` first. The page address is written into every installed manifest and into HoneyDue-Flow, so do not change it.

## Commits

Use the identity `Daneyand Singley <11618382+007Style@users.noreply.github.com>`.
