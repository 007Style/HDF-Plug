# HDF-Plug: Project Plan

Project: **HDF-Plug**, an Outlook add-in for **HoneyDue-Flow (HDF)**.
Target HDF version: 1.1.1 today, the bridge ships in **1.2.0**.
Status: **revision 9. Phase 1 and the panel (Phase 3 on the Mac side) are built and tested against a fake HoneyDue-Flow: reading the person, the four-field check, the flow picker with search, the date and time, the warnings, adding, and every failure state, with 150 tests. HDF 1.2.0 is released (https://github.com/007Style/honeyDue-Flow/releases/tag/v1.2.0). Not yet proven in a real Outlook. Next: you test on Mac new Outlook.**
Companion files: [`RESEARCH.md`](RESEARCH.md) (what was checked and how sure we are), [`BRIDGE-API.md`](BRIDGE-API.md) (the contract between the add-in and HDF).

---

## 1. What we are building

A button in Outlook. While the user is looking at an email, they press **Add to HoneyDue-Flow**. A side panel opens that:

1. Finds the person on that email (the sender on a received email, the recipient on a sent email).
2. Checks that the person is an **Outlook contact with first name, last name, email and company**. If not, the panel does not show the form. It shows a plain message saying why (no greyed button is needed; decided by the user in revision 3).
3. If the person qualifies, lets the user **search for and pick a flow** (a multi-step cadence or a single-step template), pick a **start date and time**, and press **OK**.
4. The person is put into HDF's In Flow, exactly as if they had been added inside HDF.
5. If HDF is not installed, not running, or not set up, the panel says so and nothing else is offered.

## 2. What the research changed in the brief

Three things differ from what was imagined. All are in [`RESEARCH.md`](RESEARCH.md).

| You asked for | What is possible | What we do |
|---|---|---|
| The ribbon button is **greyed out** when the contact does not qualify | Microsoft documents the enable/disable API and manifest switch for **Excel, PowerPoint and Word only**, not Outlook (RESEARCH A2) | The ribbon button is always clickable. It opens a side panel. **The panel shows a plain "cannot be added" message naming the reasons.** One click shows the reason. No greyed control is needed (user decision, revision 3). Spike S1 re-checks this on a live Outlook |
| Add-in reads the contact from Outlook | Office.js has no contacts API (A6) | HDF already reads Outlook contacts through Microsoft Graph (`Contacts.Read`) and already applies the four-field rule. **The add-in asks HDF.** No second sign-in |
| Support old Outlook "if easy" | Same web add-in runs in classic Outlook on Windows (A1) | **Yes, supported at no extra build cost.** Testing cost only |

### 2.1 Your review answers and what they changed (revision 2)

| Your answer | What it means | Effect on the plan |
|---|---|---|
| v1 handles **multi-step cadences and single-step templates** | HDF's "Single Follow-up" is one channel (email, phone call, LinkedIn) plus one template | The picker lists both groups. The bridge `kind` field is used in v1 (sections 3, 5.1; API 2.4 to 2.6) |
| "Source on GitHub. What is GitHub Pages?" | Source and hosting are two different things | Section 11. GitHub Pages is the chosen host (revision 5) |
| "Can't it **auto pair**?" | Yes, with no code typing. The first time, HDF shows one **Allow / Deny** prompt | Sections 8.3, 9; API 2.2. The bridge is now **on by default** |
| Must support Outlook on **PC and Mac** | Mac moves from "if the spike passes" to a **release blocker** | Sections 3, 10, 13, 14. Plan B (4.1) is now more likely to be needed |
| "Just **write to the database**? Put the server **inside the running HDF**? If HDF is not running, add to the database so it picks it up" | The listener **is** inside the running HDF (that was already the plan). Writing to the database from outside is not possible | Sections 4.2 (why), 4.3 (when HDF is not running) |
| "Why host it anywhere? I will install it from my GitHub page" | Outlook always loads the panel from a web address, so the page must be served from somewhere. HDF itself can be that place | Section 4.1 |
| "Stick with the **GitHub hosted site**. No local listener. HDF does not host the page" | One manifest, one page address, one allowed origin. HDF still needs a small API endpoint to receive requests | Sections 4.1, 8.2, 9 |
| "No greyed button needed. Show the reasons when it is clicked" | Matches what Outlook allows (spike S1 confirmed on Mac) | Sections 2, 5 |

### 2.2 What the Phase 0 spike found on Outlook for Mac (revision 3)

Full table in `RESEARCH.md` section D. In short:

| Finding | Effect on the plan |
|---|---|
| The ribbon cannot be greyed (`Office.ribbon` is undefined) | Nothing: the plan already shows the reason in the panel |
| Sender and recipients can be read | Nothing: works as planned |
| **A plain `http://127.0.0.1` or `http://localhost` listener cannot be called** | **HDF's listener must be `https://localhost`** with a certificate the user trusts once. New change H10 |
| An https page can call an https `localhost` listener, including a preflighted POST with a token | The API design holds, only the transport changes |
| The page that calls HDF was itself on `localhost` in this test | **Open: does it still work from a page on a real web address?** (tested in Phase 1, on Mac). The reserve plan is in section 4.1 |
| `honeydue-flow://` link: nothing happened (nothing registered) | The "Open HoneyDue-Flow" button is dropped from v1 |

## 3. Scope

### In v1
- New Outlook on Windows **and Outlook on Mac**: both are required, both are release blockers.
- Classic Outlook on Windows: same code. **Not tested during development** (the author develops on Mac only). It is tested once the build is complete, at the Windows gate in section 14, and is a release blocker. New Outlook on Windows and Outlook on the web: same code, documented as supported, never tested by the author, so listed as "expected to work, not tested".
- Microsoft 365 and Outlook.com mailboxes (Outlook add-ins do not run on Gmail or IMAP accounts, A8; HDF does not support them on Windows either).
- Choose a **flow**: a multi-step **cadence**, or a **single-step template** (an email, a LinkedIn message, or a phone call with or without a script), then a start date and a start time.
- States: HDF not detected, not connected, HDF not signed in to Microsoft 365, contact not eligible (with reason), no flows, already in a flow, success, error.
- Same computer only: Outlook and HDF must be on the same machine.

### Single-step templates (decided: in v1)
HDF has two ways to start a contact: a multi-step **cadence**, or a **single follow-up** (a channel plus one template). Both are offered. In the panel the list has two headed groups, "Multi-step" and "Single step". A phone call may have no script, so the single-step group also holds "Phone call, no script", as HDF's own Add Flow window does. The add-in sends `kind: "cadence"` or `kind: "template"`; HDF runs the same code path as its own Add Flow window for each.

### Out of v1 (stated so nobody assumes them)
- Outlook mobile (HDF is a desktop app, there is nothing local to talk to).
- Adding people who are **not** in Outlook Contacts, or filling in missing fields from the add-in. The add-in never writes to Outlook (HDF itself never does, per `winDriver.ts`).
- Removing, pausing or editing a flow from Outlook.
- Several contacts at once (multi-select).
- Microsoft Marketplace (AppSource) listing. v1 is installed from a manifest file or by an admin.
- Gmail or IMAP accounts.

## 4. Architecture

```mermaid
graph LR
    subgraph Outlook[Outlook, any supported client]
        BTN[Ribbon button: Add to HoneyDue-Flow]
        PANE[Task pane: HDF-Plug page]
        BTN --> PANE
    end

    subgraph Host[Static web host, HTTPS]
        PAGE[HDF-Plug page and manifest assets. No user data]
    end

    subgraph PC[Same computer]
        subgraph HDF[HoneyDue-Flow 1.2.0]
            SRV[Small https listener inside the running app, localhost]
            REN[Renderer: DB and engine]
            SRV -- IPC --> REN
        end
        GRAPH[(Microsoft Graph)]
        REN -- existing token, Contacts.Read --> GRAPH
    end

    PAGE -. loaded into .-> PANE
    PANE -- Office.js: reads from, to, mailbox address --> BTN
    PANE -- HTTPS on localhost with access token --> SRV
```

**Why this shape**
- The page is served from a web address, because Outlook loads add-ins from a URL (RESEARCH A10). It is hosted on GitHub Pages and **not** served by HDF (section 4.1). The page holds **no data and no secrets**.
- All real work happens inside HDF, which owns the database (B1), the Microsoft sign-in (B3) and the rules (B4). The add-in is a thin remote control. That keeps the rules in one place and means the add-in cannot drift out of step with HDF.
- Auth lives in the main process (a small `bridge.json` in the user-data folder holding only a **hash** of each approved token, so it can never end up in an exported backup). Data requests are passed to the renderer, which already has the database (B1).

### 4.1 Where the add-in page is served from: a hosted page only (decided, revision 5)
**Decision:** the page is served from a static web site on **GitHub Pages**. **HDF does not serve any page.** Outlook loads the page from the web address in the manifest (RESEARCH A10), so the page is the one thing that is always reachable, which is what lets it show "HoneyDue-Flow was not detected" when HDF is closed.

What "no local listener" does and does not mean:
- **True:** HDF serves no web page and no add-in files. There is one manifest, one page address, one origin.
- **Still needed:** HDF must still *receive* the page's requests, so a small https API endpoint inside HDF remains (changes H3, H4, H10). The page can only send web requests (RESEARCH A11) and HDF's database is not a file it can reach (4.2). Removing the endpoint would mean a different design, the mailbox idea, which you chose not to pursue.

So the architecture is: **hosted page in the panel, calling `https://localhost:<port>` on the user's own computer.**

**What the hosted page must satisfy** (GitHub Pages is expected to meet these; each is checked in Phase 1 on Mac):
- A **stable address**, for example `https://007style.github.io/HDF-Plug/`. It is written into every installed manifest and into HDF's one allowed origin, so changing it later means a new HDF release and a reinstall for users. A custom domain you own (CNAME to GitHub Pages) would let you move hosts later without any user action.
- Static files only. No scripts on the server, no database, no logins, no cookies.
- Must **not** forbid being shown in a frame. Outlook on the web shows add-ins inside a frame (RESEARCH A11). GitHub Pages is not known to send frame-blocking headers; confirmed in Phase 1 on Mac (a Mac client does not show frame behaviour, so Outlook on the web would be the real check and is untested).
- Ordinary caching, so the panel is fetched once and then reused.
- Holds no data and no secrets. Everything on it is public by design.
- **Traffic is small:** a few hundred KB of static files (estimate, not measured), cached, and only the add-in's own users, not all HDF users.

**What GitHub Pages needs** (Q2): a **public** repository on a free plan, or a paid plan for a private one (my recollection, to be verified). The add-in repository can be public with no harm: it holds the page and docs only. honeyDue-Flow stays private.

**One consequence to accept:** if the user has no internet, the panel cannot load at all, because Outlook fetches it from the web. HDF itself is unaffected.

**Held in reserve, not in v1:** a second manifest pointing at a page served by HDF at `https://localhost`. It would only be built if Phase 1 (Mac) or the Windows gate shows a hosted page cannot call `https://localhost` on a required client. Its cost would be Outlook's generic error when HDF is closed.

### 4.2 Why the add-in cannot write to HDF's database directly
1. **The add-in is sandboxed.** It runs in a web view inside Outlook and has no access to files on the computer. It can only make web requests (RESEARCH A11).
2. **HDF's database is not a file you can open.** It is a SQLite database held in memory inside the HDF window (sql.js), saved as one block of text in the window's browser storage (`Local Storage/` in HDF's data folder). While HDF runs it owns that copy and rewrites the whole block on every save, so an outside edit would be overwritten or would corrupt it. HDF's own README says that data "is not a file you can open directly" (RESEARCH B7).
3. **Adding a person to a flow is more than one table row.** It imports the person from Outlook (that needs HDF's Microsoft token), checks the rules (already in a flow, cadence switched off, four required fields), creates calendar and to-do entries, and refreshes the screen. All of that is HDF's code.
4. **So the plan puts a small listener inside the running HDF**, which is what you proposed. It is not a separate program, service or install. In these documents "bridge" means that listener plus its rules.

### 4.3 When HDF is not running
With HDF closed nothing can answer: nobody can look up the Outlook contact (that needs HDF's token), list HDF's flows, or write to its data. The panel therefore says "not detected". To make that rare:

| Option | In v1? | What it is |
|---|---|---|
| A. **Start HoneyDue-Flow when I sign in** | **Yes** (change H9) | New HDF setting. HDF already hides to the tray when its window is closed, and its scheduler only works while it runs anyway, so this is a good setting on its own merits |
| B. **Open HoneyDue-Flow** button in the panel | **No** (dropped; S7 inconclusive) | Would need HDF to register a `honeydue-flow://` link. The panel just tells the user to open HDF. Can be added later |
| C. **Queue the request** and let HDF take it next time it opens | **No** (Q10) | The add-in cannot check the four fields or read HDF's flow list while HDF is closed, so mistakes would surface later and silently. The flow also could not start until HDF runs, because the scheduler only runs in the app. It can be added later; the API leaves room for it |

## 5. User experience

### 5.1 The panel

```
+------------------------------------------+
| HoneyDue-Flow                      [pin] |
+------------------------------------------+
| Person on this email                     |
|  (o) Jane Doe  <jane@acme.com>           |   shown as a list when a sent email has
|  ( ) Raj Patel <raj@acme.com>            |   more than one recipient
+------------------------------------------+
| Flow  [ search flows...            ]     |
|   Multi-step                             |
|   > Intro, 4 steps, starts with email    |
|     Re-engage, 3 steps                   |
|   Single step                            |
|     Email: Quick check-in                |
|     Phone call: Cold call script         |
|     Phone call, no script                |
| Start  [ 2026-11-20 ]  [ 9:00 AM ]       |
|   (warning line when the time is in the  |
|    past or would be held by HDF's shields|
+------------------------------------------+
|        [ Cancel ]      [ OK, start flow ]|
+------------------------------------------+
```

**Not eligible** (the form is not shown; the panel shows the reason instead):

```
|  Jane Doe can't be added to a flow       |
|  jane@acme.com is not in your Outlook    |
|  contacts.                               |
|                                [ Close ] |
```

The message is ordinary panel text, so it works with a keyboard, a screen reader and every Outlook client.

### 5.2 Which person
- **Received email:** the sender (`from`).
- **Sent email:** the recipients (`to`, then `cc`), excluding the user's own address. One recipient: used. Several: listed with a radio choice and each shows its own eligibility.
- Mail from or to the user alone, or a message with no usable address: "No other person on this email."
- Matching is by email address, case-insensitive, against **any** address on the Outlook contact.

### 5.3 State table (every state the panel can be in)

| # | State | Detected by | Panel shows | Controls |
|---|---|---|---|---|
| 1 | **HDF not detected** | No bridge answers on any port in the range, or the answer is not HDF | "HoneyDue-Flow was not detected on this computer. It must be installed and running before you can use this add-in. If it is installed, open it. It may be hidden in the system tray." plus a Download link and a **Try again** button | none |
| 2 | HDF too old / add-in too old | `/hello` apiVersion not in the supported range | "Update HoneyDue-Flow to 1.2.0 or later" (or "Update the add-in") | none |
| 3 | **Not connected yet** | No token, or the bridge says unauthorized | "Connect this add-in to HoneyDue-Flow." A **Connect** button. After pressing it: "Switch to HoneyDue-Flow and click **Allow**" with a **Cancel** button. No code to type. A denied or expired request shows "Not allowed" or "Timed out" and **Try again** | **Connect**, **Cancel** |
| 4 | Add-in switched off in HDF | `/hello` says `bridgeEnabled: false` | "The Outlook add-in is switched off in HoneyDue-Flow Settings." | none |
| 5 | HDF not connected to Microsoft 365 | `/hello` connection not `connected` | "HoneyDue-Flow is not signed in to Microsoft 365. Sign in from its Settings." | none |
| 6 | No person on the email | Office.js | See 5.2 | none |
| 7 | **Not in Outlook contacts** | `check` returns `not_in_contacts` | Message: "{email} is not in your Outlook contacts, so it can't be added to a flow." | none |
| 8 | **Missing fields** | `check` returns `missing_fields` and the list | Message: "This Outlook contact is missing: last name, company. Add them in Outlook, then reopen this panel." | none |
| 9 | **Already in a flow** | `check` returns `already_in_flow` | Message: "{name} is already in the flow '{cadence}'. A contact can be in only one flow at a time." | none |
| 10 | No flows to choose | `flow-options` returns no cadences and no templates | "There are no flows or templates yet. Create one in HoneyDue-Flow first." | none |
| 11 | Eligible | `check` returns `eligible` | The form in 5.1 | active |
| 12 | Flow chosen is switched off | cadence `active: false` | Item greyed in the list with its `inactiveReason` as the (i) text | not selectable |
| 13 | Submitting | user pressed OK | Spinner, OK disabled (prevents a double click) | disabled |
| 14 | **Success** | `flows` returns ok | "Jane Doe is in 'Intro'. First step: Fri Nov 20, 9:00 AM." | **Done** |
| 15 | Failure | any error | The message HDF returned, plain words, plus **Try again** | active |

Reason texts are held in one table in the add-in and covered by a test, so wording changes in one place.

### 5.4 Names and wording
Ribbon label: **Add to HoneyDue-Flow**. Group label: **HoneyDue-Flow**. Pane title: **HoneyDue-Flow**. Texts avoid jargon ("cadence" appears as "flow" in the pane, to match your wording; the list shows each flow's step count).

## 6. Eligibility rule (the contract)

A person is eligible when **all** hold. They are checked inside HDF, in this order, and the first failure is the one reported:

1. HDF is signed in to Microsoft 365 (otherwise state 5).
2. An Outlook contact (in the default folder or any contact folder, as `fetchContacts` already scans) has the address (otherwise `not_in_contacts`).
3. That contact has a non-empty **first name, last name, company** and **email** (otherwise `missing_fields`, listing which). This is the exact rule in `WinDriver.fetchContacts`; the plan reuses it so there is one definition.
4. The person has no pending step in HDF (otherwise `already_in_flow`), by `assertNotInFlow`.

**Edge case to handle:** HDF imports a contact's **first** non-empty address. If the email in Outlook matches a contact's second address, the person is eligible but HDF would write to the first address. The pane shows "Emails will go to {address}" whenever it differs from the address on the message.

**A person already in HDF's Out Flow** (stopped or finished) is eligible: `resumeContactFlow` already supports this, the same way the In Flow tab's Add Flow does.

## 7. Work stream H: changes in honeyDue-Flow (new version 1.2.0)

The honeyDue-Flow folder is its **own git repository**. All of this goes on a branch there (`feature/outlook-bridge`), following its `AGENTS.md` Feature Gate. HDF-Plug holds only the add-in, the docs and a fake bridge for development.

| # | Change | Files | Notes |
|---|---|---|---|
| H1 | **Pull the add-to-flow steps out of `App.tsx`** (`handleAddFlowSubmit`, lines 392 to 427) into one shared function (the cadence branch **and** the single-follow-up branch) used by the screen **and** the bridge | new `src/engine/addToFlow.ts`; `src/App.tsx` | Pure refactor, "no behavior change", existing tests must pass untouched. Do this first and ship it alone |
| H2 | **Single-address lookup in the driver:** `lookupContactByEmail(email)` returns the Outlook contact or the missing fields | `src/drivers/types.ts`, `winDriver.ts`, `simDriver.ts`, `fakeDriver.ts`; `macDriver` answers "not supported" like it does for tasks | Reuses the four-field rule. Spike S4 decides filter versus cache |
| H3 | **Bridge server** in the main process: **HTTPS** on the loopback address (name `localhost`), port range, endpoints in `BRIDGE-API.md`, request forwarding to the renderer | new `electron/bridge.ts`; `electron/main.ts` | Pure logic kept in `logic.ts` style so it can be tested without Electron |
| H4 | **Connection approval and token store** (`bridge.json`, hashed tokens, revoke) | `electron/bridge.ts` | Never written into the database or into backups |
| H5 | **IPC to the renderer:** `bridge-request` and `bridge-respond` | `electron/main.ts`, `electron/preload.ts`, `src/App.tsx` | Add the names to **both** approved lists (`ELE-33`, `ELE-45` fail otherwise). Add the matching `window.electronAPI` types (`X-STATIC-02`) |
| H6 | **Settings card "Outlook add-in":** on/off switch (default **on**), the **Allow / Deny** prompt shown when an add-in asks to connect (window comes to the front, or a notification if hidden), list of connected add-ins with Revoke, port in use, status | `src/components/modals/SettingsModal.tsx` | Info (i) pop-ups follow F-49 |
| H7 | **Read-only data operations** the bridge needs: list cadences (step count, first channel, `inactive_reason`) **and templates** (name, channel); schedule check using `checkScheduleTime` | `src/engine/addToFlow.ts` (calls existing `getCadences`, `checkScheduleTime`) | Reuses B6, no new rules |
| H8 | **Docs and test plan:** Feature Register row, new case ids (prefix `BRG-` for bridge, `UI-SET-` for the card, `DRV-` for the lookup), manual checklist item for real Outlook, README and DESIGN sections, `npm run testplan:write` and `testplan:check` | `TESTPLAN.md`, `README.md`, `DESIGN.md`, `package.json` version | Per `AGENTS.md` rule 2 |
| H9 | **"Start HoneyDue-Flow when I sign in"** setting (off by default, offered the first time the add-in is used) | `electron/main.ts`, `electron/preload.ts`, Settings card | Uses Electron's login-item feature. HDF has none today (RESEARCH B8). The `honeydue-flow://open` link was dropped from v1 (RESEARCH D) |
| H10 | **Local certificate:** HDF creates a self-signed certificate for `localhost` and `127.0.0.1` (not a CA, key never leaves the user-data folder, never in the database or a backup), asks the user to approve trust once, and renews it before it expires | new `electron/bridgeCert.ts`; Settings card shows status and a "Remove trust" button | Mac: trust in the user's own keychain (one password prompt). Windows: current-user trusted store (one confirmation). The Mac commands are proven in the spike and settled in Phase 1. The Windows commands are written from documentation and first run at the Windows gate (section 14); what happens when the user refuses is settled in Phase 1. Uses the system's own tools, no new dependency if avoidable |

Existing safeguards stay: the Electron window keeps `sandbox`, `contextIsolation` and its CSP (the bridge runs in the main process, B5). The listener is https, so the `http://` allowance in `X-STATIC-01` is not needed; Phase 1 re-checks that rule and `ELE-33`/`ELE-45`.

## 8. Work stream A: the add-in (in `HDF-Plug/`)

### 8.1 Technology
| Part | Choice | Reason |
|---|---|---|
| Language | TypeScript | Same as HDF |
| UI | React 18 + Tailwind CSS | Same as HDF, so the look matches and the team knows it |
| Build | Vite | Same as HDF |
| Outlook API | Office.js (loaded from Microsoft's hosted `office.js`, as Microsoft requires) | Required for an Outlook add-in |
| Manifest | **Add-in-only XML manifest** | Works in new and classic Windows, web **and Mac**. The unified manifest does not support Outlook on Mac (RESEARCH A7) |
| Permission | **ReadItem** | Reads sender and recipients, cannot change mail (RESEARCH A5) |
| Tests | Vitest + Testing Library, fake Office.js, fake bridge | Same tools as HDF |

### 8.2 Folder layout (created in Phase 1, nothing is created now)
```
HDF-Plug/
├── RESEARCH.md
├── PLAN.md
├── BRIDGE-API.md
├── manifest/manifest.xml            Add-in manifest, one file, page address on GitHub Pages
├── src/
│   ├── office/                      Office.js wrappers: current item, sender/recipients, ItemChanged
│   ├── bridge/                      Client for the bridge API, port discovery, token storage
│   ├── state/                       The state machine in section 5.3
│   ├── components/                  Panel, PersonPicker, FlowPicker, DateTime, InfoTip, banners
│   └── texts.ts                     Every message in one table
├── assets/                          Icons 16, 32, 80 px
├── tools/fake-bridge/               A small server that behaves like HDF, for development and tests
├── tests/
├── docs/INSTALL.md                  How a user installs it
└── package.json
```

### 8.3 How the panel behaves
- **Pinnable task pane** (`SupportsPinning`, requirement set 1.5). It stays open while the user clicks through messages. On each `ItemChanged` event it re-reads the item, then re-asks HDF. `item` can be `null` and the code must cope (RESEARCH A4).
- **Port discovery:** the page tries a fixed range of ports (proposed `47615` to `47624`) on `https://localhost`, calling `/v1/hello` with a 1.5 second timeout each, and remembers the working one. It checks that the answer says `app: "HoneyDue-Flow"`.
- **Connecting (auto pair):** the add-in asks HDF to connect, HDF shows **Allow / Deny**, and the user clicks **Allow** once. Nothing is typed. The add-in stores the returned token in the pane's `localStorage`. Spike S5 shows how long it survives in each client; if a client loses it, that client simply asks again (state 3), which is the safe failure.
- **Time handling:** the date and time pickers work in local time. The add-in sends an ISO string, as HDF's own Add Flow modal does. The default is 30 minutes from now, same as HDF.
- **Schedule warning:** the add-in sends the chosen time to `schedule-check` and shows HDF's warning (past, or held by business hours or the weekend shield). It never reimplements the rules.
- **No double submit:** the OK button disables at once, and HDF also refuses a second add (`AlreadyInFlowError`).

## 9. Security

The bridge opens a door on the user's machine, so it is locked in layers. Each item becomes a test.

1. **On by default, switchable off in Settings.** Until an add-in is approved, the port answers only `hello` and a connect request. Nothing else is reachable without a token.
2. **Bound to the loopback address only**, never `0.0.0.0`. **https only**, with a single-purpose certificate (H10).
3. **Origin allow-list.** Exactly one origin is accepted: the GitHub Pages address (a constant in HDF; the CORS header names that origin, never `*`). Other origins get no CORS headers and no connect prompt.
4. **Host header check** (`127.0.0.1:<port>` or `localhost:<port>`) to defeat DNS rebinding.
5. **Approve-once connection + bearer token.** The add-in asks to connect and HDF shows **Allow / Deny**. Only on Allow is a token issued. The token is 256 random bits and only its **hash** is stored. A request from a wrong origin gets no prompt at all. One request at a time; after 3 denials or time-outs further requests are refused for 10 minutes. Why this is safe enough: a web page cannot forge its Origin, which stops other websites; another program on the same computer could forge it, but still cannot get a token without the user clicking Allow.
6. **Smallest possible surface.** The API can only: say hello, ask to connect, check a contact, list flow choices, check a time, and add a flow. It cannot read the contact list, template text, notes, tokens or settings, and cannot send mail.
7. **Local network permission headers.** Browsers that ask permission for a public page to reach the local network need `Access-Control-Allow-Private-Network: true` on the preflight reply. Not needed on Mac in the spike; Windows engines are untested until the Windows gate (section 14).
8. **Privacy.** The page is static and sends nothing anywhere except to the local HDF. No analytics. Logs in HDF record that a request happened, not the email addresses (HDF's rule for logs).
9. **Revoke.** Settings can revoke any connected add-in, and switching the bridge off closes the port at once.

## 10. Test strategy

HDF's rule is that the test plan is the source of truth, and a feature is not done until its cases exist and pass. The same discipline applies here.

**honeyDue-Flow side (Vitest, in its repo, ids `BRG-xx`)**
- Bridge server on `127.0.0.1` with a fake renderer: every endpoint, normal path, failure path, boundaries, "run twice and at the same time".
- Security cases from section 9, one test each: wrong origin, wrong Host, no token, bad token, connect denied, connect timed out, repeated denials lock further requests, a second request while one is waiting, rate limit, bridge off, revoke.
- Eligibility: not in contacts, each missing field alone and together, email in a second address, already in flow, in Out Flow, cadence switched off, not signed in.
- H1 refactor: all existing tests pass untouched.
- No test uses real Microsoft, real tokens or the network (`AGENTS.md` rule 4).

**Add-in side (Vitest + fake Office.js + fake bridge)**
- One test per row of the state table (section 5.3).
- Sender/recipient selection: received, sent, several recipients, self only, none, `null` item, item switch while a request is in flight (a late answer for the old item must be ignored).
- Time zones: run under the same four time zones as HDF.
- Wording table: every state has a text.

**Manual matrix** (cannot be automated; kept as a checklist in `docs/` and mirrored in HDF's section 15.5)

| Client | Required result |
|---|---|
| **Classic Outlook on Windows** | All states, connect, add flow end to end. **Release blocker** (tested by the author) |
| **Outlook on Mac (new Outlook)** | All states, connect, add flow end to end. **Release blocker** (tested by the author) |
| New Outlook on Windows | Same page and API. **Not tested by the author**; documented as supported |
| Outlook on the web | Same page and API. **Not tested by the author**; documented as supported |
| Sent email, received email, reply, forwarded email | Correct person each time |
| HDF closed, HDF in tray, HDF window open | States 1 and 11 |

## 11. Packaging, hosting and install

- **Source and hosting are two different things.** The **source code** lives in the GitHub repository `007Style/HDF-Plug`. **Hosting** is GitHub Pages, which publishes the *finished* page from that repository as a web site (free, https). Pages needs a public repository on a free plan (Q2).
- **Why a page is served at all:** Outlook never keeps an add-in's program on your computer. The manifest holds a web address and Outlook opens that address inside the side panel, like a browser tab (RESEARCH A10). Nothing of HDF's data moves to the web; the page only holds the form (section 4.1).
- **One page, one manifest.** The build publishes the page files to GitHub Pages (a GitHub Action on each tagged release). The manifest points at that address.
- **Page address requirements** are in section 4.1 (stable address, static files only, no frame-blocking headers, ordinary caching).
- **Why GitHub can carry it:** see 4.1. The files are small and cached; only add-in users load them. If it ever outgrew GitHub, the same files move to another static host and the manifest address changes (a custom domain avoids even that).
- **User install (v1):** download `manifest.xml`, then in Outlook open `https://aka.ms/olksideload`, **My add-ins**, **Add a custom add-in**, **Add from File** (confirmed working on Mac in the spike). Written up from real testing in `docs/INSTALL.md` (spike S6). Classic Outlook on Windows can take up to 24 hours to show a sideloaded add-in (Microsoft).
- **Organization install:** an administrator uploads the manifest in the Microsoft 365 admin center (Integrated apps).
- **HDF install:** unchanged. Users update HDF to 1.2.0. The add-in is on by default; the first time the panel opens, the user clicks **Allow** in HDF once.
- **Versioning (decided):** the add-in ships as **v1.0.0** and HoneyDue-Flow as **v1.2.0**. Development builds are tagged `0.x` until the release matrix passes. The bridge has its own `apiVersion` (`1`) so either side can be updated alone; both sides refuse an apiVersion they do not know (state 2).

## 12. Detecting "HDF not installed"

A web page cannot tell "not installed" from "installed but not running". So the panel says what it knows and what to do:

> HoneyDue-Flow was not detected on this computer. It must be installed and running before you can use this add-in. If it is installed, open it. It may be hidden in the system tray. If it is not installed, download it here.

"Running" matters because HDF's scheduler only works while the app is open anyway (README, Known limits). To make this less likely HDF already hides to the tray on window close, not quit.

## 13. Risks

| Risk | Likelihood | Effect | Handling |
|---|---|---|---|
| An Outlook web view blocks the call from the hosted page to HDF | **Mac: plain http blocked, https from a local page works. Windows and a page from a real web address: unknown. Still the biggest unknown.** Chromium-based engines (Windows) have been adding a permission step for public pages that call local addresses (my recollection, unverified) | If blocked, the add-in cannot work on that client | Phase 1 tests it on **Mac** from the real GitHub Pages address before the rest is built. **Windows is tested only at the Windows gate, after the build**, so a Windows-only block would be found late and cost rework. Reserve plan in 4.1 (a page served by HDF) |
| User refuses the certificate approval | Medium | The add-in cannot work on that computer | The panel and Settings explain why it is needed and how to approve it later; nothing else in HDF is affected |
| The user's own address is not the mailbox address (a Gmail alias on an Outlook.com mailbox, seen in the spike) | Medium | The add-in may offer the user as the person, then say "not in contacts" | v1 treats the mailbox address and HDF's signed-in address as "me"; an alias list can come later |
| Outlook cannot grey a ribbon button | **Certain by docs** | Design change already made | Reason is shown in the pane; no greyed control (section 2) |
| HDF's database is in the renderer, so a hidden or crashed window cannot answer | Low | Requests time out | 10 second timeout, state 1 text, the renderer keeps running while hidden (B1) |
| Graph cannot filter contacts by email | Medium | Slower lookup | Use a short-lived cache from the full read HDF already does (S4) |
| Token lost when the pane's storage is cleared | Medium | Click Allow again | State 3 is a normal, friendly state |
| Outlook add-in manifest or API changes | Low | Rework | XML manifest is the long-supported form; keep Office.js use small and behind `src/office/` |
| Two Outlook accounts or a shared mailbox | Low | Wrong or no activation | Documented as a known limit (RESEARCH A9) |
| User changes the contact in Outlook after opening the pane | Medium | Stale state | Re-check on the OK press, return the fresh reason |
| Port range already used | Low | Add-in cannot find HDF | HDF picks the first free port in the range and shows it in Settings |
| Bridge on by default widens HDF's attack surface | Low | A local program could ask to connect | Approve-once prompt, origin check, prompt rate limit (section 9). Switchable off |
| Outlook cannot open `honeydue-flow://` links | Medium | No "Open HoneyDue-Flow" button | The button was dropped; start at sign-in (H9) still helps |
| Windows is untested until the build is complete (decided by the author) | Medium | A Windows-only block (a Chromium engine restricting a public page that calls a local address, my recollection, unverified) found late means rework in the add-in and HDF | Keep every client-specific line behind one small module; write the Windows certificate step from documentation; hold the Windows gate **before** the documentation phase so a failure costs the least. Reserve plan in 4.1 |
| New Outlook on Windows and Outlook on the web cannot be tested by the author | Certain | Unconfirmed support | Listed as "expected to work, not tested by the author"; same page and API as the tested clients |

## 14. Phases

Phase 0 is **closed** (decided by you, revision 6). It answered what documentation could not on Mac (RESEARCH D, D0). Its remaining questions (a page on a real web address calling `https://localhost`, and Windows) are answered by building a thin working slice first (Phase 1), not by another throwaway spike.

| Phase | What | Output | Exit test |
|---|---|---|---|
| **0. Spike** | **Closed.** Round 1 and 1b on Mac. Throwaway code, since deleted | `RESEARCH.md` sections D and D0 | Done |
| **1. Walking skeleton** (the riskiest path, end to end, small) | **HDF:** the H1 refactor shipped alone, then a minimal `bridge` with `hello` and `connect` (the Allow prompt) over https, with the certificate (H3, H4, H10, part of H6) on a branch. **Add-in:** the real project scaffold, a manifest, and a panel that shows states 1 (not detected), 3 (connect) and "connected", **published to GitHub Pages**. Real repository created | You install the manifest, open the panel in Outlook, and it finds the running HDF, shows the Allow prompt, and connects | Works on **Mac (new Outlook)** from the real GitHub Pages address, with the real certificate approval. If Mac blocks it, the plan is revised **now**, with working code to adapt. Windows is not part of this exit test |
| **2. HDF bridge, rest** | H2, H5 to H9 and the remaining endpoints in `BRIDGE-API.md`; Feature Register rows, test cases, docs | HDF 1.2.0 release candidate | `npm run verify` green, `testplan:check` clean, BRG cases `DONE` |
| **3. Add-in, rest** | Section 8: all 15 states, flow picker with search, date and time, success and errors; built against `tools/fake-bridge` first, then the real HDF | Working panel | Add-in tests green; all states work on **Mac (new Outlook)** |
| **3b. Windows gate** | The author installs on **classic Outlook on Windows** and runs the full manual matrix there, with the real GitHub Pages address and the real certificate approval | The Windows result recorded in `RESEARCH.md`, and Windows commands corrected | Classic Outlook on Windows passes the matrix, **or** the plan is revised (4.1 reserve) before Phase 4 starts |
| **4. Documentation** | The public-repository documentation set (section 18), `docs/INSTALL.md` written from the real installs | A stranger can install it from the docs | Documentation checklist (section 18) passes, **before the repository is made public** |
| **5. Hardening and release** | Security cases re-run, rest of the manual matrix, tag HDF **1.2.0** and HDF-Plug **1.0.0** | Release | All acceptance checks (section 16) pass |

**Test devices and timing (revision 6):** the author develops and tests on **Outlook for Mac, new Outlook** only. **Classic Outlook on Windows** is tested once, at the Windows gate (3b), after the add-in is built. New Outlook on Windows and Outlook on the web are not available to the author. They are documented as supported (RESEARCH A1, A3) and run the same page, but will be listed in the README as **"expected to work, not tested by the author"** until someone confirms. This changes the earlier "new Outlook on Windows is a release blocker" (section 10): the release blockers are now the two clients the author can test, Mac new Outlook (throughout) and Windows classic Outlook (at the gate).

The H1 refactor has no dependency on the add-in and can start at once.

## 15. Open decisions

Each has a default so work is not blocked. Reply only where you disagree.

| # | Question | Default |
|---|---|---|
| Q1 | Cadences only, or also single-step templates? | **Decided by you: both** (section 3) |
| Q2 | **GitHub Pages:** may `007Style/HDF-Plug` be a **public** repository? (section 4.1) | **Decided by you: yes**, once documented in your usual verbose style (section 18) |
| Q12 | Run another throwaway spike round, or build a thin slice first? | **Decided by you: no more spikes.** Phase 1 is a thin working slice (section 14) |
| Q13 | **Licence** for the public `HDF-Plug` repository (section 18) | **Needed from you.** Default: the same proprietary, all-rights-reserved terms as HoneyDue-Flow, since the add-in only works with it |
| Q11 | Hosted page, HDF-served page, or both? | **Decided by you: hosted page on GitHub, HDF serves nothing** (section 4.1) |
| Q3 | Auto connect? | **Decided by you.** Implemented as one **Allow** click in HDF the first time, bridge on by default (sections 8.3, 9). Reply only if you want it fully silent with no click; the cost is that any local program could then add contacts to flows |
| Q4 | Outlook on Mac? | **Decided by you: required** |
| Q5 | The panel calls them **"flows"** (your wording) although HDF's tab says **Cadences**. Keep "flow" in the add-in? | Yes |
| Q6 | A person in **Out Flow** may be re-added from Outlook (HDF allows it in its own screen). Allow? | Yes |
| Q7 | Where should the HDF-Plug code live in git? | `HDF-Plug` is now a local git repository (since revision 3). It is pushed to a new **`007Style/HDF-Plug`** at the start of Phase 1; HDF changes go on a branch of the existing `honeyDue-Flow` repository |
| Q8 | Offer "Start HoneyDue-Flow when I sign in" (H9), off by default? | Yes, offered the first time the add-in is used |
| Q9 | Phone call with no script: list it as its own entry in the single-step group? | Yes, as HDF's own Add Flow window allows it |
| Q10 | Queue requests while HDF is closed (option C, section 4.3)? | No in v1 |

## 16. Acceptance checklist (traced to your request)

| Your requirement | Verified by |
|---|---|
| Installable as an Outlook add-in | Phase 4 install guide, checked by a clean install on Mac and at the Windows gate |
| New Outlook supported | Manual matrix: new Outlook on **Mac** (release blocker, tested). New Outlook on Windows: documented, untested by the author |
| Old Outlook supported if easy | Manual matrix: **classic Outlook on Windows** (release blocker, tested) |
| A button while viewing an email | Ribbon button visible on a read message, new Outlook |
| Works for a **sent** and a **received** email | Add-in tests + matrix row 5 |
| Needs first name, last name, email, company in the Outlook contact | `BRG` eligibility cases |
| Not in contacts → panel says why, no form | State 7 test + matrix |
| Missing fields → panel names them, no form | State 8 test + matrix |
| Eligible → pick a flow from HDF's own list | State 11 test; list comes from HDF live |
| Search bar for flows | Add-in test |
| Date and time pickers | Add-in test, four time zones |
| OK puts the contact in HDF and the flow runs | `BRG` end-to-end test on the real engine with the simulator driver; matrix row 1 |
| HDF not installed/configured → clear message | States 1 to 5 tests |
| Multi-step cadences **and** single-step templates can be chosen | Add-in test + `BRG` flow cases for both `kind`s |
| Works on PC **and Mac** | Classic Outlook on Windows and new Outlook on Mac, both release blockers |
| Public repository is documented to the author's standard | Documentation checklist (section 18), a gate before the repository is made public |
| Connects automatically (no typing) | State 3 test + `BRG-P` cases; matrix |
| No code written until the plan is complete | You approved the plan and said we know enough to start (revision 6). Only throwaway spike code existed at that point (now deleted) |

## 17. What happens next

1. **Q2 and Q12 are decided** (public repository; no more spikes). This plan is revision 7 (revision 6 plus the build notes below).

   **Built in HDF so far (commits `1caf4bc` and `8034bea`, 1,504 tests green, all four time zones, coverage above its floors):** H1 (shared add-to-flow function), H3 for `hello` and `connect`, H4 (hashed tokens), H10 (own certificate per install) and the Settings card of H6. **Decisions taken while building (all follow your earlier rules):**
   - **The certificate is made when the user presses Set up in Settings, not silently at start-up.** The system's trust prompt then appears at a moment the user chose and understands. Until then the port is closed and the add-in shows state 1; its text must say "open HoneyDue-Flow, Settings, Outlook Add-in, press Set up" when it can tell nothing answers.
   - **The Allow / Deny question is a system dialog from HDF's main process**, with Deny as the default and Escape. A web page can neither fake it nor press it.
   - **A request with no `Origin` header can call `hello` only.** That lets a person or a tool check that HDF is listening, and still keeps every other endpoint locked to the add-in's page.
   - **`hello` and `OPTIONS` still answer while the bridge is switched off**; everything else says `bridge_off`.
   - **The certificate lasts 365 days** and is replaced when fewer than 30 remain; the old one is un-trusted first.
   - **Not built yet:** `contacts/check`, `flow-options`, `schedule/check`, `flows`, the driver lookup `lookupContactByEmail` (H2) and the login item (H9).
2. **Phase 1 starts**, in two repositories:
   - **`HDF-Plug`:** create `007Style/HDF-Plug` on GitHub, scaffold the add-in project, publish a minimal panel to GitHub Pages.
   - **`honeyDue-Flow`:** a branch `feature/outlook-bridge` from the tagged `v1.1.1`. H1 first (alone), then the minimal bridge and certificate.
3. You test the slice on **Mac (new Outlook)** only. The result is recorded in `RESEARCH.md`. A block on Mac revises the plan before Phase 2. Windows classic is tested later, at the Windows gate (Phase 3b).
4. Every HDF change follows its `AGENTS.md` Feature Gate: Feature Register row, test cases with ids and status `TODO`, tests in the same change, `testplan:write` then `testplan:check`, IPC names in both approved lists.
5. The spike folder has been deleted (done, before the repository was made public). The git history was **deliberately left as it is** (decided by the user on 2026-11-18): it still holds the old spike code and the author's Outlook.com mailbox address, which is already public on the author's GitHub profile. No keys, tokens or certificates are in the history (checked).

## 18. Documentation for the public repository

`HDF-Plug` becomes public only after this set exists and passes the checklist below. It follows the style of your other repositories, read from `honeyDue-Flow/README.md` on 2026-11-18: centred header with an emoji title and a tagline, the line "From the minds of IBM Bob & Daneyand", shields.io badges, a one-line "private by design" promise, quick links, an ASCII picture of the idea, an emoji-headed section per topic, a numbered table of contents, tables, Mermaid diagrams, a "Known limits" section, a "Documentation map", a licence section and a centred footer.

| File | Content |
|---|---|
| `README.md` | The full tour, in the HDF README's structure: what it is, download and install (both clients, step by step), a first session, every state of the panel and what it means, how it talks to HDF, the certificate approval and why, privacy (what is and is not sent, and to whom), architecture (Mermaid), project layout, building from source, testing, releasing, troubleshooting, known limits, documentation map, licence |
| `docs/INSTALL.md` | Install and remove, per client, written from the real installs (RESEARCH S6), with the 24-hour note for classic Outlook |
| `docs/TROUBLESHOOTING.md` | Each panel message, its cause and the fix |
| `docs/SECURITY.md` | The nine layers in section 9 in plain words, the certificate and its limits, and how to report a problem |
| `docs/ARCHITECTURE.md` | The design in section 4, including why a hosted page and a local endpoint |
| `PLAN.md`, `BRIDGE-API.md`, `RESEARCH.md` | The existing documents, tidied for readers and kept as the design record |
| `AGENTS.md` | Rules for AI assistants that change this repository, like the other repositories |
| `LICENSE` | **To be decided by you** (Q13). The HDF licence is proprietary; a public repository of a proprietary add-in needs an explicit choice |

**Checklist before the repository is made public (a gate, not a suggestion):**
- Every file above exists, and every link in them resolves.
- No spike code, certificates, keys, tokens, personal addresses or machine paths in the repository or its history.
- Every claim in the README is either tested or marked "not tested by the author".
- The licence is chosen and stated in the README (Q13).
- The tagline, header, badges and footer match the style of `honeyDue-Flow/README.md`.

Q13 is added to the open decisions below.
