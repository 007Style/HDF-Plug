# 🔒 Security

HDF-Plug opens a door on your computer, from a web page, to HoneyDue-Flow. This page says what protects it, what it does not protect against, and how to report a problem. The design record is [`PLAN.md`](../PLAN.md) section 9 and the contract is [`BRIDGE-API.md`](../BRIDGE-API.md).

## What the add-in can and cannot do

It can only: say hello, ask to connect, check whether one person can go into a flow, list your flows and templates (names, not contents), check a start time, and add one person to one flow. It **cannot** list your contacts, read your templates' text, your notes, your settings or your tokens, send mail, or change anything in Outlook. It never writes to Outlook.

## The layers

1. **On by default, switchable off.** Untick **Allow the Outlook add-in to connect** in HoneyDue-Flow and the port closes at once. Until an add-in is approved, the port answers only `hello` and a connect request.
2. **Loopback only, https only.** The listener is bound to `127.0.0.1`. It is not reachable from your network. It uses a certificate made for your computer.
3. **One allowed web address.** Only the add-in page at `https://007style.github.io` is let in. Other web pages get no access and no prompt.
4. **Host check.** A request must name `localhost` or `127.0.0.1` and the right port, which defeats DNS-rebinding tricks.
5. **You approve it once.** A new add-in must be allowed in a dialog drawn by HoneyDue-Flow itself, not by a web page. Only then is a token issued: 256 random bits, kept in the add-in's browser storage. HoneyDue-Flow keeps only a **hash** of it, in a file outside your database and outside your backups. One request at a time; after three refusals or time-outs, no more for 10 minutes.
6. **Smallest possible surface.** See above.
7. **Rate limit.** 60 calls a minute in all, 8 KB bodies at most, and 10-second time-outs.
8. **Private.** The page is static and sends nothing anywhere except to HoneyDue-Flow on your computer. No analytics. HoneyDue-Flow's log records that a call happened and its result code, never an email address or a name.
9. **Revoke.** Settings can revoke any connected add-in, and the add-in's **Disconnect** button forgets its own token.

## The certificate

Outlook on a Mac refuses a plain `http` address, so the add-in must reach HoneyDue-Flow over `https`. HoneyDue-Flow makes **its own certificate for your computer** when you press **Set up**:
- names `localhost` and `127.0.0.1` only; not a certificate authority; for servers only;
- valid 365 days, renewed when under 30 days remain;
- the private key stays in HoneyDue-Flow's data folder, with mode 600, and is never in the database or a backup;
- you approve trust once, in your own login keychain (Mac) or Current User store (Windows). No administrator is needed.

**The limit you accept:** anyone who got that private key could make a server that your computer trusts for `localhost`. The key never leaves your user account, and the certificate only covers `localhost`. **Remove set-up** deletes the certificate and the trust.

## What it does not protect against

- **Another program running as you** can read the HoneyDue-Flow data folder and the add-in's stored token, because it runs with your rights. The Allow dialog stops it from getting a token without you, but it does not stop a program that already has your token. An approved token can check contacts and add a person to a flow until you revoke it.
- **The GitHub Pages account.** Whoever can publish to this repository can change the page. HoneyDue-Flow trusts that address, so keep that account safe. The page holds no data or secrets.
- **Not tested by the author:** the Windows certificate commands, and any Outlook other than new Outlook for Mac.

## Reporting a problem

Open a private security advisory at <https://github.com/007Style/HDF-Plug/security/advisories/new>, or open an issue **without** secrets or personal data in it.
