@echo off
rem HDF-Plug Phase 0 spike launcher for Windows. Double-click this file.
rem THROWAWAY: part of the spike, deleted after the results are recorded.
cd /d "%~dp0"
echo.
echo == HDF-Plug spike

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed. Install it from https://nodejs.org and double-click this file again.
  pause
  exit /b 1
)

if not exist certs\localhost.pem (
  where openssl >nul 2>&1
  if errorlevel 1 (
    echo ERROR: no certificate found and openssl is not installed.
    echo Copy the "certs" folder from the Mac's HDF-Plug\spike folder into this folder, then run this again.
    pause
    exit /b 1
  )
  mkdir certs 2>nul
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -keyout certs\localhost-key.pem -out certs\localhost.pem -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -addext "basicConstraints=critical,CA:FALSE" -addext "keyUsage=digitalSignature,keyEncipherment" -addext "extendedKeyUsage=serverAuth"
  if errorlevel 1 (
    echo ERROR: could not create the certificate.
    pause
    exit /b 1
  )
)

echo.
echo == Trusting the test certificate (Windows will ask you to confirm; choose Yes)
certutil -user -addstore Root certs\localhost.pem
if errorlevel 1 (
  echo ERROR: the certificate was not trusted. Run this again and choose Yes.
  pause
  exit /b 1
)

node make-manifest.mjs
if errorlevel 1 (
  echo ERROR: could not create manifest.xml.
  pause
  exit /b 1
)

echo.
echo == Next: install the add-in in Outlook
echo 1. A browser page (aka.ms/olksideload) is opening. Sign in if asked.
echo 2. The "Add-Ins for Outlook" box appears after a few seconds. Click "My add-ins".
echo 3. At the bottom, under "Custom Addins", click "Add a custom add-in", then "Add from File".
echo 4. Choose manifest.xml from this folder and accept the warning.
echo    (Classic Outlook can take up to 24 hours to show a sideloaded add-in. New Outlook is quicker.)
echo 5. Open an email in Outlook, find "HDF Spike" in the toolbar (or under "..."), click it.
echo 6. Press "Copy report" in the side panel and paste the text into the chat.
echo.
echo Leave this window open while testing. Close it to stop.
echo.
explorer /select,"%~dp0manifest.xml"
start "" "https://aka.ms/olksideload"
node server.mjs
pause
