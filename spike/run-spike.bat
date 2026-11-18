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
echo == The spike server is running
echo.
echo If the HDF Spike add-in is ALREADY installed in Outlook, you are ready:
echo   open an email, click HDF Spike (close and reopen the panel to load the latest page),
echo   press "Copy report", and paste it into the chat. Nothing to do in a browser.
echo.
echo Only on a machine where it is NOT installed yet (first time):
echo   1. Open https://aka.ms/olksideload in a browser and sign in if asked.
echo   2. My add-ins - Custom Addins - Add a custom add-in - Add from File.
echo   3. Choose manifest.xml from this folder (spike\manifest.xml).
echo   (Classic Outlook can take up to 24 hours to show a sideloaded add-in.)
echo.
echo Leave this window open while testing. Close it to stop.
echo.
node server.mjs
pause
