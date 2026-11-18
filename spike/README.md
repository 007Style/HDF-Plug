# Phase 0 spike (THROWAWAY)

Purpose: answer S1 to S7 in `../RESEARCH.md` section C on a real Outlook. Nothing here ships. It is deleted after the results are recorded.

It needs only Node (no `npm install`). It makes **no change to honeyDue-Flow** and sends no mail. The pane only reads the sender/recipients of the open email.

## What it runs
| Piece | Address | Stands in for |
|---|---|---|
| Fake bridge (plain http) | `http://127.0.0.1:47615` | HDF's future listener |
| Test pane pages (https) | `https://localhost:47630` | Plan B (HDF serves the page) |

## Steps (do this on the Mac first, then the Windows PC)

1. **Start it** (leave the window open):
   ```
   cd HDF-Plug/spike
   node server.mjs
   ```
2. **Certificate.** `certs/` is created on the first machine by:
   ```
   mkdir -p certs && openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
     -keyout certs/localhost-key.pem -out certs/localhost.pem -subj "/CN=localhost" \
     -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -addext "basicConstraints=critical,CA:FALSE" \
     -addext "keyUsage=digitalSignature,keyEncipherment" -addext "extendedKeyUsage=serverAuth"
   ```
   Trust it (it is a 30-day test certificate that only covers localhost):
   - **Mac:** `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/localhost.pem`
   - **Windows (PowerShell):** `certutil -user -addstore Root certs\localhost.pem`
   Check: opening `https://localhost:47630/ping` in Safari/Edge shows JSON with no warning.
3. **Manifest:** `node make-manifest.mjs` writes `manifest.xml`.
4. **Install in Outlook** (menu names vary by version; note what you actually clicked, it feeds `docs/INSTALL.md`, S6):
   - Open an email. Choose **Get Add-ins** (or **Apps**) -> **My add-ins** -> under **Custom add-ins** choose **Add a custom add-in -> Add from file** -> pick `manifest.xml`.
   - Outlook on the web: same, from `https://aka.ms/olksideload`.
5. **Use it:** open an email, find the **HDF Spike** button (ribbon, or the **...** overflow menu), click it. The pane runs all tests by itself.
6. **Copy the report** with the **Copy report** button (or select the text) and send it to me. Do this for:
   - a **received** email and a **sent** email
   - each Outlook you have (new Outlook Mac, new Outlook Windows, classic Windows, web)
7. **S5 (saved data):** quit Outlook completely, reopen, open the pane again. The "pane loads so far" count should keep going up.
8. **S7:** click the `honeydue-flow://open` link and the `window.open()` button. Say what happened.
9. Stop the server with Ctrl+C. Remove the add-in (My add-ins -> HDF Spike -> Remove) and the certificate when done.
