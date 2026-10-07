#!/usr/bin/env bash
# Turns on email sign-up (6-digit code by email). Run as root on the server:
#   bash /opt/topictalk/deploy/set-mail.sh
# Works with Brevo (free), Gmail (needs an App Password) or any SMTP service.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
echo "Which mail service?"
echo "  1) Brevo (free, recommended)"
echo "  2) Gmail (needs an App Password)"
echo "  3) Other SMTP"
read -r -p "Choose 1, 2 or 3: " C
case "$C" in
  1) HOST=smtp-relay.brevo.com; PORT=587
     echo "In Brevo: top-right menu > SMTP & API > SMTP. Use the 'Login' shown there and an SMTP key."
     read -r -p "SMTP login (looks like abc123@smtp-brevo.com): " U
     read -r -p "Sender address people will see (must be verified in Brevo > Senders): " F ;;
  2) HOST=smtp.gmail.com; PORT=465
     read -r -p "Gmail address that sends the codes: " U; F=$U ;;
  *) read -r -p "SMTP host: " HOST; read -r -p "SMTP port (465 or 587): " PORT
     read -r -p "SMTP login: " U; read -r -p "Sender address: " F ;;
esac
read -r -s -p "Password / SMTP key (typing is hidden): " P; echo
touch /etc/topictalk.env
grep -v '^SMTP_' /etc/topictalk.env > /etc/topictalk.env.new || true
{ echo "SMTP_HOST=$HOST"; echo "SMTP_PORT=$PORT"; echo "SMTP_USER=$U"; echo "SMTP_PASS=$(printf '%s' "$P" | tr -d ' ')"; echo "SMTP_FROM=$F"; } >> /etc/topictalk.env.new
chmod 600 /etc/topictalk.env.new; mv /etc/topictalk.env.new /etc/topictalk.env
systemctl restart topictalk
sleep 2
APP_PORT=$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/topictalk.service)
curl -fsS "http://127.0.0.1:$APP_PORT/api/config" && echo
echo "Done. Sign-up now asks for an email and sends a code. If no code arrives, run:  journalctl -u topictalk -n 20"
