# HDF-Plug: Research Findings

Status: complete for planning. Date: 2026-11-16.

This file records **what was checked, where, and how sure we are**. `PLAN.md` depends on it. Each finding is marked:

- **DOCUMENTED**: stated in Microsoft's Office Add-ins documentation (source repo `OfficeDev/office-js-docs-pr` and `office-js-docs-reference`, read directly on the date above).
- **CODE**: read in the honeyDue-Flow 1.1.0 source.
- **UNVERIFIED**: reasoned, not proven. Each one is a task in the Phase 0 spike (see `PLAN.md` section 14).

---

## A. Outlook platform findings

### A1. Old (classic) Outlook support is nearly free. DOCUMENTED
An Outlook add-in is a **web add-in**: a manifest plus a web page that Outlook shows in a task pane. The same add-in "works across web, desktop (Outlook on Windows new and classic, and Mac) and mobile". So supporting classic Outlook on Windows costs almost nothing extra: it is the same manifest and the same page.

- COM and VSTO add-ins are **not** supported in new Outlook on Windows. We do not build one.
- Classic Outlook on Windows with a Microsoft 365 subscription (or Office 2021+ retail) "will continue to support the development of new and existing Outlook web add-ins".
- Source: `outlook/outlook-add-ins-overview.md`, `outlook/one-outlook.md`.

### A2. A ribbon button CANNOT be greyed out in Outlook. DOCUMENTED. This changes the brief.
The programmatic enable/disable API (`Office.ribbon.requestUpdate`, RibbonApi 1.1 to 1.3) and the manifest `<Enabled>` element are documented for **Excel, PowerPoint and Word only**. The `<Enabled>` reference page states: "This element is only valid in Excel, PowerPoint, and Word".

Consequences:
- The ribbon button in Outlook is always clickable.
- The grey-out and the "(i)" explanation must live **inside the task pane** that the button opens. The pane opens on one click and shows the state at once.
- Sources: `design/disable-add-in-commands.md`, `requirement-sets/common/ribbon-api-requirement-sets.md`, `manifest/enabled.md`.
- Spike S1 re-checks this against a live Outlook build, in case the docs lag.

### A3. Where the button can appear. DOCUMENTED
- Add-in commands (ribbon buttons) are supported in Outlook on the web, new Outlook on Windows, classic Outlook on Windows (2016+), Outlook on Mac, Android and iOS.
- A custom ribbon **tab** only works in classic Outlook on Windows. In new Outlook, web and Mac the button goes into a **custom group on a built-in tab**. We cannot choose the exact spot, and the user can pin it.
- The button can appear while **reading** a message (message read surface). That is the surface we need.
- Source: `design/add-in-commands.md`, `develop/create-addin-commands.md` ("Outlook support notes").

### A4. A pinnable task pane gives live updates. DOCUMENTED
- A task pane can be **pinned**, so it stays open as the user clicks from message to message.
- The add-in is told about each change with the `Office.EventType.ItemChanged` event, registered with `Office.context.mailbox.addHandlerAsync`. After the event, `Office.context.mailbox.item` is the new message, and it can be `null`.
- Pinning works in: modern Outlook on the web, **new Outlook on Windows**, classic Outlook 2016+ (builds listed in the source), Outlook on Mac 16.13+. Not in Outlook.com.
- Source: `outlook/pinnable-taskpane.md`.

### A5. Sent versus received mail. DOCUMENTED (API shape)
In read mode the add-in can read `item.from`, `item.to`, `item.cc` (each has a display name and email address) and the signed-in mailbox address `Office.context.mailbox.userProfile.emailAddress`. "Sent" is therefore decided by comparing `from` with the mailbox address. The "restricted" permission is not enough; the manifest asks for **ReadItem** (can read item properties, cannot change anything).
- Source: `outlook/understanding-outlook-add-in-permissions.md`.
- The exact property types are confirmed in spike S1.

### A6. The add-in cannot read Outlook Contacts through Office.js. DOCUMENTED (by omission)
The Outlook JavaScript API gives message and appointment data. Contacts are reached through **Microsoft Graph** (`/me/contacts`, `/me/contactFolders`). The docs' own "data sync" scenario points to Graph for contacts.
- Source: `outlook/microsoft-graph.md`, `outlook/one-outlook.md`.

Two ways to reach Graph exist:
1. The add-in signs in itself using **nested app authentication (NAA)** with its own Entra app registration. NAA is supported in Outlook.
2. **HoneyDue-Flow asks Graph instead.** HDF is already signed in with `Contacts.Read` (CODE, see B3). The add-in only passes an email address to HDF.

`PLAN.md` chooses option 2 (no second sign-in, no Entra registration, no tokens inside the add-in).

### A7. Manifest type. DOCUMENTED
- The **unified manifest for Microsoft 365** is supported in new Outlook on Windows and classic Outlook on Windows (2307+), but **not in Outlook on Mac**, and not for mailboxes on on-premises Exchange.
- The older **add-in-only XML manifest** works in all of them.
- So the plan uses the **XML manifest** (widest reach, one file).
- Source: `develop/unified-manifest-overview.md`.

### A8. Accounts. DOCUMENTED
Add-ins run on Microsoft 365 business mailboxes and Outlook.com (personal Microsoft) accounts. They are **not supported on Gmail, Yahoo or other IMAP accounts** in new Outlook on Windows, classic Windows, or the web. This matches HDF, which only supports Microsoft 365 / Outlook on Windows.
- Source: `outlook/outlook-add-ins-overview.md`.

### A9. When the add-in does not activate. DOCUMENTED
Not activated on: IRM or encrypted items on mobile, delivery reports and NDRs, `.msg`/`.eml` attachments or files opened from disk, group mailboxes, archive mailboxes, public folders. Shared mailboxes and delegate folders need extra manifest flags. These are rare for our use and are listed as "known limits" in the plan.
- Source: `outlook/outlook-add-ins-overview.md`.

### A10. Hosting. DOCUMENTED
Outlook add-ins hold no code on the user's machine: Outlook reads the manifest and loads the page from a **URL**. The page must be served over HTTPS. "Outlook add-ins require a network connection to run."
- Source: `outlook/outlook-add-ins-overview.md`.
- A Windows-only note exists about a "loopback exemption" for add-ins served from `localhost` (`CheckNetIsolation.exe LoopbackExempt`). Whether it also affects a public page calling `localhost` is UNVERIFIED (spike S2).

---

### A11. The add-in runs in a sandbox and in different web engines per platform. DOCUMENTED
- Windows desktop Outlook uses **Microsoft Edge (Chromium) with WebView2**. Mac uses **Safari's engine, WKWebView**. Source: `concepts/browsers-used-by-office-web-add-ins.md`.
- On Mac the add-in page is "hosted inside a sandboxed WebKit runtime host process"; in web clients it runs in an iframe with the HTML5 sandbox attribute. The page "can do almost anything a regular web page can do" but must follow the **same-origin policy**. Source: `concepts/privacy-and-security.md`.
- Consequences: (1) the add-in **cannot read or write files** on the computer, so it cannot touch HDF's data files; (2) a call from the hosted page to a program on the same computer is a **cross-origin** web request, so the receiving side must answer with the right CORS headers (planned in `BRIDGE-API.md` section 1); (3) Safari/WKWebView is the stricter engine for calls from an `https://` page to plain `http://127.0.0.1`. **Confirmed by the spike: it refuses them (section D).**

## B. HoneyDue-Flow 1.1.0 findings (CODE)

### B1. Where the data lives
All contacts, templates, cadences and flows are in an embedded SQLite database (`sql.js`, WebAssembly) held **in the renderer process** and saved to `localStorage` (`DB_STORAGE_KEY = 'honeydue_flow_db_v1'`, `src/db/index.ts`). The scheduler and engine also run in the renderer. The Electron main process **cannot read the database**.
- Consequence: a local server in the main process must forward each request to the renderer over IPC, and the renderer calls the existing functions.
- The app lives in the tray when its window is closed, and `backgroundThrottling` is off, so the renderer keeps running while the window is hidden (`electron/main.ts`). The add-in can therefore reach it as long as HDF is running.

### B2. There is no local API today
`electron/main.ts` registers only `ipcMain.handle` channels (mail, calendar, backup, OAuth, logs). The only HTTP server is a short-lived loopback listener used for the Microsoft sign-in (`electron/logic.ts`, `server.listen(0, '127.0.0.1')`). The add-in bridge is a **new** feature.

### B3. HDF already reads Outlook contacts and knows the four required fields
`WinDriver.fetchContacts()` (`src/drivers/winDriver.ts`) reads every contact folder through Graph with `$select=id,givenName,surname,displayName,companyName,emailAddresses,...`. It already applies the exact rule the user described: a contact needs **first name, last name, company and email**; otherwise it is "skipped" and the missing fields are recorded (`missing = ['first name','last name','company','email']`). Microsoft sign-in already requests `Contacts.Read`.
- The add-in's eligibility check should reuse this rule, not copy it. One new driver method that looks up one address is enough.
- UNVERIFIED (spike S4): whether Graph accepts a filter by email address on contacts (`emailAddresses/any(...)`). If not, the fallback is a short-lived cache built from the full read the driver already does.

### B4. How a contact is put into a flow today
`handleAddFlowSubmit` in `src/App.tsx` (lines 392 to 427) does, for a cadence:
1. `resumeContactFlow(contactId, cadenceId, 1, scheduledDatetime)` (`src/db/index.ts`), which checks the cadence exists, is not switched off (`inactive_reason`), and the contact is not already in a flow (`assertNotInFlow`, throws `AlreadyInFlowError`);
2. `syncCalendarNow()`, `reloadData()`, then a toast.

An Outlook contact becomes a local contact through `syncExternalContacts` (status `unassigned`, source `outlook`).
- The add-in path must run the **same** steps. The plan therefore pulls these steps out of `App.tsx` into one shared function (a pure refactor, "no behavior change", per `AGENTS.md`).

### B5. Rules the HDF change must follow (`AGENTS.md`, `TESTPLAN.md`)
Any change under `src/` or `electron/` needs: a Feature Register row (section 17), new test cases with ids and status `TODO` in the right suite table, tests in the same change, `npm run testplan:write` then `npm run testplan:check`, and a manual-checklist line for anything automation cannot reach (section 15.5). Also:
- `ELE-33` and `ELE-45` fail unless the bridge names and IPC channels are added to the approved lists in **both** `electron/main.ts` and `electron/preload.ts`.
- `X-STATIC-01` allows `http://` only for `localhost` and `127.0.0.1`. A bridge on `127.0.0.1` passes.
- `X-STATIC-02` requires every `window.electronAPI.<name>` used in `src` to exist in `preload.ts`.
- The Content Security Policy (`csp.ts`) limits what the **page** may connect to. The bridge server runs in the main process, so it does not need a CSP change.
- No test may touch the network; the bridge is tested on `127.0.0.1` with a fake renderer.

### B6. Schedule warnings already exist
`ScheduleShieldWarning` and `checkScheduleTime` (`src/engine/safetyGovernor.ts`) warn when a chosen time is in the past or will be held by business hours or the weekend shield. The add-in should show the same warning, so the bridge exposes the result rather than the add-in re-implementing the rules.

### B7. HDF's database cannot be edited from outside. CODE + README
- `src/db/index.ts`: the SQLite database lives in memory in the renderer (sql.js). `saveDatabase()` exports the **whole** database and writes it as one JSON array into `localStorage` under `honeydue_flow_db_v1`. `loadDatabase()` reads that value once at start.
- On disk it is inside Electron's `Local Storage/` LevelDB files (confirmed present on this Mac under `~/Library/Application Support/honeydue-flow/Local Storage/leveldb`). The README says it "is not a file you can open directly" and that copying the folder is "not a supported way to move your data".
- Consequences: while HDF runs, any outside change to those files is overwritten by the next save; while HDF is closed, writing into LevelDB by hand would mean re-encoding the entire database as that JSON text, with no support or safety net. Adding a person to a flow also needs Outlook data and HDF's rules (B3, B4). So the add-in talks to the **running** HDF instead of to its data.

### B8. HDF cannot start at login, and has no web-link handler today. CODE
No `setLoginItemSettings`/`openAtLogin` and no `setAsDefaultProtocolClient` exist in `electron/` or `src/`. HDF does hide to the tray when its window is closed and keeps its scheduler running (B1). Both a "start at sign-in" setting and a `honeydue-flow://open` link are therefore new work (PLAN change H9).

### B9. Working-tree state of honeyDue-Flow on 2026-11-16. CODE
Uncommitted changes exist in `src/db/backupFormat.ts`, `src/db/index.ts`, `src/drivers/types.ts` and `src/types/index.ts`: a "follow-up expired" reminder feature (`ExpiryState`, `expiry_reminder_enabled`, labelled 1.1.1). `package.json` still says 1.1.0. These are not part of HDF-Plug. Phase 1 must start from a committed state.
- The git remote is `https://github.com/007Style/honeyDue-Flow.git`; an anonymous request to its API returns 404, so the repository appears to be **private** (it could not be confirmed from here).

---

## C. What we could not establish from documentation (all go to Phase 0)

| # | Unknown | Why it matters |
|---|---|---|
| S1 | Whether any Outlook build can now disable a ribbon button, and exact types of `from`/`to` on a read item | Decides the "greyed button" design (A2). **ANSWERED for Mac (section D)** |
| S2 | Whether a task pane served from public HTTPS can call a local server, in each client: new Outlook Windows (WebView2), new Outlook Mac (WKWebView), classic Windows, OWA | The whole design depends on this call. Mixed-content, private-network and loopback rules differ per engine. **Mac: plain http fails, https works from a local origin. Still open: a page from a truly public origin, and every Windows client (section D)** |
| S3 | Whether `https://localhost` with a locally trusted certificate is needed instead of plain `http://127.0.0.1` | Decides how much install friction there is. **ANSWERED for Mac: yes, https is needed (section D)** |
| S4 | Whether Graph filters contacts by email address | Decides driver method design |
| S5 | Whether `localStorage` in the task pane survives restarts in each client | Decides how often the user must re-pair. **Partly: survives closing the pane; a full Outlook quit is still untested** |
| S6 | The exact install menu steps in each client (sideload from file), and whether new Outlook on Windows needs a tenant setting | Written into `docs/INSTALL.md` from real testing |
| S7 | Whether Outlook's side panel on each client may open a custom link `honeydue-flow://open` (via `Office.context.ui.openBrowserWindow` or a plain link) | Decides whether the "Open HoneyDue-Flow" button in the panel can exist. **Inconclusive, and dropped from v1 (section D)** |

---

## D. Phase 0 spike results (real Outlook, not documentation)

Client: **Outlook for Mac 16.115.1108.0**, Safari engine (WebKit). Run 2026-11-16, two reports (a received and a sent-style message). The spike code was throwaway and has been deleted; the results below are the record.

| # | Test | Result | Meaning |
|---|---|---|---|
| S1 | `Office.ribbon` | `undefined` | A ribbon button cannot be greyed on Mac. Confirms the "message on click" design |
| S1 | Mailbox API sets 1.1 to 1.13 | all supported | Pinning and `ItemChanged` are available |
| S1 | `from` / `to` | `from` is an object with name and email; `to` is an array of objects with email | Sender and recipients can be read as planned |
| S2a-c | Page on `https://localhost:47630` calls `http://127.0.0.1:47615` or `http://localhost:47615` | **All fail** ("Load failed"), with or without credentials headers | **A plain-http listener cannot be used on Mac** |
| S3 | Page calls its own `https://localhost:47630` | **Works** (4 to 11 ms) with a certificate the user trusted | The https route works |
| S2d/e | Page on `https://localhost:47630` calls `https://127.0.0.1:47630`, including a preflighted POST with `Authorization` | **Works** | Cross-origin https calls with CORS work in this engine. **Not yet proven for a page from a truly public origin** (the page here was itself local) |
| S5 | `localStorage` counter | Kept counting across loads (2, then 4; the count rises on every page load and every press of "Run all tests", so it is not a pure load count). "First seen" stayed 23:14:55 across both reports | Storage survives closing and reopening the pane. A full Outlook quit has not been tested yet |
| S7 | Click on `honeydue-flow://open` | Nothing visible happened | **Inconclusive.** No program on the machine is registered for that link yet (that is HDF change H9), so nothing could answer. Decision: the "Open HoneyDue-Flow" button is **dropped from v1**; the panel simply says to open HDF |

### D0. Round 1b: the clean http-versus-https test (2026-11-18, Outlook for Mac 16.115)
One fake HDF listener, one port (47615), one handler. Only the scheme changed.

| Test | Result |
|---|---|
| T1a GET `http://127.0.0.1:47615` | **FAIL** (Load failed) |
| T1b GET `https://127.0.0.1:47615` | OK, 13 ms |
| T1c GET `http://localhost:47615` | **FAIL** |
| T1d GET `https://localhost:47615` | OK, 7 ms |
| T1e POST `http://127.0.0.1:47615` with `Authorization` | **FAIL** |
| T1f POST `https://127.0.0.1:47615` with `Authorization` | OK, 5 ms |
| T1g POST `https://localhost:47615` with `Authorization` | OK, 4 ms |

**Conclusion (Mac): plain http is blocked and https works, on the same port with the same code.** HDF's listener must be https, so HDF needs a certificate the Mac trusts.

Still not shown by this test:
- The page was served from `https://localhost:47630`, so it was itself a local page. A page from a real web address (GitHub Pages) has not been tested.
- The certificate was trusted on this Mac before the test. What happens with an **untrusted** self-signed certificate was not tested; I expect the call to fail, which is why the one-time approval (H10) is in the plan.
- Windows (new and classic) has not been tested.

### D1. Consequences
1. HDF's listener must speak **https** on `localhost`, with a certificate the computer trusts. The user has to approve that trust once on each computer.
2. **The page must come from a web address, not from HDF.** If HDF served it, then with HDF closed Outlook could not load the page and would show its own generic error, so the "HoneyDue-Flow was not detected" message could not appear. Decision (PLAN 4.1): hosted page on GitHub Pages. Whether a page from a real web address may call `https://localhost` is **not yet proven** (round 2).
3. Tested only on Mac. Windows (WebView2, a Chromium engine with its own rules for public pages calling local addresses) is unknown.
4. In the second report the sender and recipient were both a Gmail address while the mailbox was an Outlook.com address. "Which address is me" cannot rely on the mailbox address alone (PLAN risks).

## E. GitHub Pages, checked 2026-11-18

The repository was made public and Pages was switched on with the Actions source. Checked with `curl` on the live address `https://007style.github.io/HDF-Plug/`:

| Check | Result |
|---|---|
| Page, `commands.html`, `manifest.xml`, the built JS and the three icons | All answer `200` (one icon answered `503` once, right after the first publish, then `200`) |
| `X-Frame-Options` or `Content-Security-Policy` headers (which would stop Outlook on the web from showing the page in a frame) | **Neither is sent** |
| Caching | `cache-control: max-age=600` |
| Built asset paths | Under `/HDF-Plug/`, as the manifest expects |

Still **not** checked: that Outlook can load this page and that it can call `https://localhost` from there. That is the Phase 1 exit test, on Mac.

## Install from a web address (found 2026-11-18)

- **New Outlook for Mac, the author's mailbox:** **Add from URL** is **greyed out** in My add-ins, Custom Addins. **Add from File** works. The cause is not known: it may be the Outlook version, the account type or an administrator's policy. Not yet checked: whether the same mailbox in Outlook on the web has it, and whether a personal Outlook.com account does.
- The install page therefore keeps the manifest file as a working fallback, and says so.

## First real run on Mac new Outlook (2026-11-18)

Proven in a real Outlook, against HDF 1.2.0 (from HDF's own log):

- The page from GitHub Pages found HDF on `https://localhost:47615` with the certificate HDF made at **Set up** and the Mac trusted. This was the biggest open question and it works.
- Connect, then Allow, issued a token; the panel showed **Connected**.
- Office.js read the person from the open email, and `POST /v1/contacts/check` was answered (two calls, 200) from the real Outlook address book through Microsoft Graph.
- A person not in Outlook Contacts gets the "not in your Outlook contacts" panel, with no form.
- Before Set up, the panel correctly said "HoneyDue-Flow was not detected".
- A leftover spike server on port 47615 made the panel say "not detected" even with HDF running. The panel skips a non-HDF answer, so the cause was that HDF was not yet listening. Ports 47615 to 47624 should be checked for other programs when "not detected" persists.
- **Add from URL** is greyed out on this Mac (see above); **Add from File** works.

Still unproven: adding a person who is in Contacts with all four fields (the form, the flow list, OK, In Flow); whether the saved connection survives a full Outlook quit; the unknown-sender case where the sender is the user's own second address (the test email was from the user's own Gmail address while the mailbox is Outlook.com).

## Add to a flow works end to end on Mac new Outlook (2026-11-18)

From HDF's log, in one session: `contacts/check`, `flow-options`, `schedule/check` and `POST /v1/flows` all answered 200 for a person on a **sent** email, and the user confirmed the person appeared in a flow.

- The panel also worked with several recipients on a sent email.
- A first attempt looked stuck: the screen read "No flow matches that search" with OK greyed. The log shows no `schedule/check` call at that point, so no flow had been chosen yet and OK was greyed by design ("Choose a flow to continue"). The cause of the "no match" text was not confirmed; it appears when the search box holds text that matches nothing.
- **Not yet checked:** whether the connection survives a full quit of Outlook; the person then showing as "already in a flow" after Done; the not-in-contacts case on a received email.
- **Asked for, cannot be built as asked:** a button on a contact in the People view. Microsoft's add-in documentation says add-ins activate only when reading or composing a message or appointment, not on other item types.
