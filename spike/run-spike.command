#!/bin/bash
# HDF-Plug Phase 0 spike launcher for macOS. Double-click this file in Finder.
# THROWAWAY: part of the spike, deleted after the results are recorded.
cd "$(dirname "$0")" || exit 1

say() { printf '\n== %s\n' "$1"; }
die() { printf '\nERROR: %s\n' "$1"; printf 'Press Return to close.'; read -r _; exit 1; }

say "HDF-Plug spike"

# 1. Node
command -v node >/dev/null 2>&1 || die "Node.js is not installed. Install it from https://nodejs.org then double-click this file again."
echo "Node $(node -v)"

# 2. Test certificate (30 days, only valid for localhost)
if [ ! -f certs/localhost.pem ] || [ ! -f certs/localhost-key.pem ] || ! openssl x509 -checkend 86400 -noout -in certs/localhost.pem >/dev/null 2>&1; then
  say "Creating a test certificate for localhost"
  mkdir -p certs
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
    -keyout certs/localhost-key.pem -out certs/localhost.pem -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    -addext "basicConstraints=critical,CA:FALSE" \
    -addext "keyUsage=digitalSignature,keyEncipherment" \
    -addext "extendedKeyUsage=serverAuth" >/dev/null 2>&1 || die "Could not create the certificate."
fi

# 4. Manifest
node make-manifest.mjs || die "Could not create manifest.xml."

# 5. Ports must be free
for p in 47615 47630; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then
    die "Port $p is already in use. Close the other spike window (or whatever uses that port) and try again."
  fi
done

# 6. Start the server
node server.mjs &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM
sleep 1.5
kill -0 $SERVER_PID 2>/dev/null || die "The server did not start."

# 7. Trust the test certificate if the Mac does not already (asks for your Mac password once; your user account only)
if ! curl -s --max-time 5 https://localhost:47630/ping | grep -q planB; then
  say "Trusting the test certificate (a Mac password prompt will appear)"
  security add-trusted-cert -r trustRoot -p ssl -k "$HOME/Library/Keychains/login.keychain-db" certs/localhost.pem \
    || die "The certificate was not trusted. Run this file again and enter your Mac password when asked."
  sleep 1
  curl -s --max-time 5 https://localhost:47630/ping | grep -q planB \
    && echo "Self-check passed: https://localhost:47630 is reachable and trusted." \
    || echo "WARNING: self-check still failing. Safari at https://localhost:47630/ping should show text, not a warning."
else
  echo "Self-check passed: https://localhost:47630 is reachable and trusted."
fi

say "Next: install the add-in in Outlook"
cat <<'EOF'
1. A Finder window is showing manifest.xml. A browser page (aka.ms/olksideload) is opening.
2. In the browser page, sign in if asked. The "Add-Ins for Outlook" box appears after a few seconds.
3. Click "My add-ins". At the bottom, under "Custom Addins", click "Add a custom add-in", then "Add from File".
4. Choose manifest.xml (the file Finder is showing) and accept the warning.
5. In Outlook, open an email and look for "HDF Spike" in the toolbar (it may be under the "..." menu). Click it.
6. Press "Copy report" in the side panel and paste the text into the chat.

Leave this window open while testing. Press Ctrl+C or close the window to stop.
EOF
open -R manifest.xml 2>/dev/null
open "https://aka.ms/olksideload" 2>/dev/null

wait $SERVER_PID
