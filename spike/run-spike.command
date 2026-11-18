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

say "The spike server is running"
cat <<'EOF2'
If the HDF Spike add-in is ALREADY installed in Outlook, you are ready:
  open an email, click HDF Spike (close and reopen the panel to load the latest page),
  press "Copy report", and paste it into the chat. Nothing to do in a browser.

Only on a machine where it is NOT installed yet (first time):
  1. Open https://aka.ms/olksideload in a browser and sign in if asked.
  2. My add-ins -> Custom Addins -> Add a custom add-in -> Add from File.
  3. Choose manifest.xml from this folder (spike/manifest.xml).

Leave this window open while testing. Press Ctrl+C or close the window to stop.
EOF2

wait $SERVER_PID
