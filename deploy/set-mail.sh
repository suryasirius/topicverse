#!/usr/bin/env bash
# Turns on email sign-up (6-digit code by email). Run as root on the server:
#   bash /opt/topictalk/deploy/set-mail.sh
# DigitalOcean blocks SMTP ports (465/587), so option 1 or 2 (HTTPS API) is recommended.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
echo "Which mail service?"
echo "  1) Brevo API key  (free, recommended - works on DigitalOcean)"
echo "  2) Resend API key (needs your own domain)"
echo "  3) Brevo / Gmail / other SMTP (only works if your host allows SMTP ports)"
read -r -p "Choose 1, 2 or 3: " C
touch /etc/topictalk.env
grep -vE '^(SMTP_|BREVO_API_KEY|RESEND_API_KEY|MAIL_FROM)' /etc/topictalk.env > /etc/topictalk.env.new || true
case "$C" in
  1|2)
    if [ "$C" = 1 ]; then
      echo "In Brevo: top-right menu > SMTP & API > tab 'API keys & MCP' > Generate a new API key (NOT the SMTP key)."
      NAME=BREVO_API_KEY
    else NAME=RESEND_API_KEY; fi
    read -r -p "Sender address people will see (must be verified in Brevo/Resend): " F
    read -r -s -p "API key (typing is hidden; paste once): " K; echo
    { echo "$NAME=$(printf '%s' "$K" | tr -d ' ')"; echo "MAIL_FROM=$F"; } >> /etc/topictalk.env.new ;;
  *)
    echo "  a) Brevo SMTP  b) Gmail  c) Other"
    read -r -p "Choose a, b or c: " S
    case "$S" in
      a) HOST=smtp-relay.brevo.com; PORT=587
         read -r -p "SMTP login (abc123@smtp-brevo.com): " U
         read -r -p "Sender address (verified in Brevo): " F ;;
      b) HOST=smtp.gmail.com; PORT=465
         read -r -p "Gmail address that sends the codes: " U; F=$U ;;
      *) read -r -p "SMTP host: " HOST; read -r -p "SMTP port (465 or 587): " PORT
         read -r -p "SMTP login: " U; read -r -p "Sender address: " F ;;
    esac
    read -r -s -p "Password / SMTP key (typing is hidden; paste once): " P; echo
    { echo "SMTP_HOST=$HOST"; echo "SMTP_PORT=$PORT"; echo "SMTP_USER=$U"; echo "SMTP_PASS=$(printf '%s' "$P" | tr -d ' ')"; echo "SMTP_FROM=$F"; } >> /etc/topictalk.env.new ;;
esac
chmod 600 /etc/topictalk.env.new; mv /etc/topictalk.env.new /etc/topictalk.env
systemctl restart topictalk
sleep 2
APP_PORT=$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/topictalk.service)
curl -fsS "http://127.0.0.1:$APP_PORT/api/config" && echo
echo "Done. Sign-up now asks for an email and sends a code. If no code arrives, run:  journalctl -u topictalk -n 20"
