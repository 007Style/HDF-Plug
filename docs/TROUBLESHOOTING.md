# 🩺 Troubleshooting

Find the words you see in the panel. Every message the panel can show is in [`src/texts.ts`](../src/texts.ts).

## Finding and connecting

| What you see | Cause | Fix |
|---|---|---|
| **HoneyDue-Flow was not detected** | HoneyDue-Flow is not running, or not installed, or **Set up** was never pressed, or another program holds the port | Open HoneyDue-Flow (it may be hidden in the tray). Open **Settings, Outlook Add-in** and press **Set up**. Press **Try again** in the panel. If it persists, run `curl -sk https://localhost:47615/v1/hello` in Terminal: a working HoneyDue-Flow answers with `"app":"HoneyDue-Flow"` |
| Same message after **Set up** | The certificate was not approved, or was removed | Press **Set up** again and approve. Check that nothing else uses ports 47615 to 47624 (`lsof -nP -iTCP:47615 -sTCP:LISTEN` on a Mac) |
| **Update HoneyDue-Flow to 1.2.0 or later** | HoneyDue-Flow is older than the add-in needs | Update HoneyDue-Flow |
| **This add-in is out of date** | HoneyDue-Flow is newer than this add-in | Remove and add the manifest again, then reopen the panel |
| **The Outlook add-in is switched off** | **Allow the Outlook add-in to connect** is unticked | Tick it in HoneyDue-Flow's Settings |
| **Connect to HoneyDue-Flow** | No saved connection, or it was revoked | Press **Connect**, then **Allow** in HoneyDue-Flow |
| **Not allowed** / **Timed out** | Deny was pressed, or no answer came within 60 seconds | Press **Try again**, then click **Allow** in HoneyDue-Flow |
| **Too many requests were refused** | Three refusals in a row | Wait the time shown |
| **HoneyDue-Flow is not signed in to Microsoft 365** | The Microsoft sign-in in HoneyDue-Flow has lapsed | Sign in again in HoneyDue-Flow's Settings |

## The person on the email

| What you see | Cause | Fix |
|---|---|---|
| **No other person on this email** | The email is only between you and yourself, or no usable address | Open another email |
| **Open an email message...** | Something other than an email is selected (for example an appointment) | Open an email |
| **Put the person you are writing to on the To line** | You opened the panel in a message being written, and the To line has nobody on it (yourself does not count, and Cc and Bcc are not read) | Address the message, then press **Check again** |
| **There are N people on the To line** | When writing a message the panel works with one person only | Leave one person on the To line, then press **Check again**. To add someone else, open an email they sent or received |
| **{email} is not in your Outlook contacts** | No Outlook contact holds that address | Add the person to your Outlook contacts with first name, last name and company, then press **Check again** |
| **This Outlook contact is missing: ...** | The contact lacks a first name, last name or company | Add them in Outlook, then **Check again** |
| **{name} is already in the flow '...'** | The person has a pending step. HoneyDue-Flow allows one flow at a time | Stop the flow in HoneyDue-Flow first. The panel can be right even when the name is not the one on the email: it names the Outlook contact that holds the address. The line "Read from ... email: address" says which address was used |
| **HoneyDue-Flow could not read your Outlook contacts** | Microsoft Graph failed just now | Try again in a moment |

## The form

| What you see | Cause | Fix |
|---|---|---|
| **OK, start flow** is greyed and **Choose a flow to continue** | No flow is chosen | Choose a flow (or clear the search box and choose one) |
| A flow is greyed with a reason | It is switched off (usually a deleted template) | Fix it in HoneyDue-Flow |
| **There are no flows or templates yet** | HoneyDue-Flow has none | Create one in HoneyDue-Flow |
| **This time has already passed** | The start is in the past | Pick a later time, or go on: the first step runs within about a minute |
| HoneyDue-Flow's own words about a shield | Business hours or the weekend shield would hold the email | Pick another time, or go on |
| **HoneyDue-Flow is busy** | Its window did not answer within 25 seconds | Try again |
| Success, plus a warning about the calendar | The person **is** in the flow, but HoneyDue-Flow could not update the calendar | See the message; no need to add them again |

## Outlook

| What you see | Fix |
|---|---|
| The button is not in the ribbon | Open an email. The add-in does not show in folder lists or for contacts. Classic Outlook can take up to 24 hours to show a new add-in. It does not run on Gmail or IMAP mailboxes |
| The button never greys out | By design: Outlook cannot grey out a button on a Mac. The reason is shown in the panel |
| **Add from URL** is greyed out | Use **Add from File** |
| The panel still looks the way it did before an update | The page is kept for up to about 10 minutes (GitHub Pages' own setting). Quit Outlook fully, wait a few minutes, and open it again |
| The panel closes when you click another email | Press the **pin** icon in the panel's bar. The panel then stays open and follows each email. Pinning is kept separately for reading and for writing a message |
| Asked to **Connect** again | The panel's saved connection was cleared, or revoked in HoneyDue-Flow. Press **Connect**, then **Allow** |

## Still stuck

HoneyDue-Flow's log has a line for every call the add-in makes, with its result and no names or addresses. On a Mac it is in `~/Library/Application Support/honeydue-flow/logs/honeydue-flow.log`. Search it for `BRIDGE`. Open an issue at <https://github.com/007Style/HDF-Plug/issues> with those lines.
