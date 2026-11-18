# 📥 Installing and removing HDF-Plug

HDF-Plug needs two things on the **same computer**: **HoneyDue-Flow 1.2.0 or later**, and the add-in in **Outlook**. This page is written from a real install on **new Outlook for Mac**. Anything not done on a real machine is marked.

## 1. HoneyDue-Flow

1. Download HoneyDue-Flow from its [releases page](https://github.com/007Style/honeyDue-Flow/releases) (the repository is private, so you need to be invited).
2. Mac: open the `.dmg` and drag **HoneyDue-Flow** into **Applications**. Control-click it and choose **Open** the first time, because it is not signed. Windows: unzip it and run `HoneyDue-Flow.exe`.
3. Sign in with Microsoft in **Settings**. The add-in reads your Outlook contacts through this sign-in.
4. In **Settings**, find the **Outlook Add-in** card, make sure **Allow the Outlook add-in to connect** is ticked, and press **Set up**. Your computer asks for your approval, once, for a small certificate. [Why](../README.md#-the-certificate-and-why-it-is-needed).

Until **Set up** is done the add-in cannot reach HoneyDue-Flow, and its panel says **"HoneyDue-Flow was not detected"**.

## 2. The add-in in Outlook

1. Open **<https://007style.github.io/HDF-Plug/manifest.xml>** and save the file, or open <https://007style.github.io/HDF-Plug/> in a browser and use the **Download manifest.xml** link. Keep the name `manifest.xml`.
2. In Outlook, open <https://aka.ms/olksideload>.
3. Choose **My add-ins**, then under **Custom Addins** choose **Add a custom add-in**, then **Add from File**, and pick the file. Accept the warning that the add-in did not come from the store.

> **Add from URL** is greyed out on new Outlook for Mac (the author's), so the file is the way that is known to work. On another Outlook, **Add from URL** with the address above may be offered. It has not been tried.

## 3. First use

1. Open an email (not a folder view) and press **Add to HoneyDue-Flow** in the ribbon.
2. The panel says **Connect to HoneyDue-Flow**. Press **Connect**, then press **Allow** in the HoneyDue-Flow window. This is done once.
3. The panel now shows the person on the email. If they are in your Outlook contacts with a first name, last name, email and company, choose a flow, a start date and time, and press **OK, start flow**.

## 4. Per client

| Client | Status | Notes |
|---|---|---|
| 🍎 New Outlook for Mac | ✅ Used by the author | The whole path works: connect, check, pick a flow, add |
| 🪟 Classic Outlook for Windows | 🧪 Not tested yet | Microsoft says a sideloaded add-in can take **up to 24 hours** to appear. Tested once, at the Windows gate |
| 🪟 New Outlook for Windows | ❔ Expected to work, not tested by the author | |
| 🌐 Outlook on the web | ❔ Expected to work, not tested by the author | |
| 📱 Phone and tablet | ❌ Not supported | HoneyDue-Flow runs on your computer, so the add-in must too |
| ✉️ Gmail, Yahoo or other IMAP mailboxes | ❌ Not supported | Outlook does not run add-ins for them |
| 🏢 A company mailbox | ❔ Not tested | An administrator can upload the manifest in the Microsoft 365 admin center (**Integrated apps**) so everyone gets it |

## 5. Where it appears

The button is in the ribbon for **an email you have open or selected**. It does **not** appear in the People or Contacts view, in the calendar for a contact, or in a folder list. Microsoft's add-in rules only start an add-in on messages and appointments.

## 6. Removing it

- **In Outlook:** open <https://aka.ms/olksideload>, **My add-ins**, find *HoneyDue-Flow* under Custom Addins, and remove it.
- **In HoneyDue-Flow:** **Settings, Outlook Add-in**. Revoke the connection, then **Remove set-up** to take the certificate out of your computer's trust store and delete it.
- To stop the connection without removing anything, untick **Allow the Outlook add-in to connect**. The port closes at once.
