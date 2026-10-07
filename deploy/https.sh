#!/usr/bin/env bash
# Free HTTPS for TopicTalk with Caddy (auto Let's Encrypt). Usage:  bash /opt/topictalk/deploy/https.sh topictalk.duckdns.org
# Only touches ports 80/443 and refuses to run if something else already uses them (so your other site is safe).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
D="${1:-}"; [ -n "$D" ] || { echo "Usage: bash $0 your-name.duckdns.org"; exit 1; }
if ss -ltn '( sport = :80 or sport = :443 )' | grep -q LISTEN && ! systemctl is-active --quiet caddy; then
  echo "Port 80 or 443 is already used by another program (your other site?). Not changing anything."; ss -ltnp '( sport = :80 or sport = :443 )'; exit 1
fi
APP_PORT=$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/topictalk.service); APP_PORT=${APP_PORT:-3001}
if ! command -v caddy >/dev/null; then
  echo "==> Installing Caddy"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg >/dev/null
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update >/dev/null; apt-get install -y caddy >/dev/null
fi
printf '%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:%s\n}\n' "$D" "$APP_PORT" > /etc/caddy/Caddyfile
touch /etc/topictalk.env
grep -vE '^(TRUST_PROXY|SECURE_COOKIE)=' /etc/topictalk.env > /etc/topictalk.env.new || true
printf 'TRUST_PROXY=1\nSECURE_COOKIE=1\n' >> /etc/topictalk.env.new
chmod 600 /etc/topictalk.env.new; mv /etc/topictalk.env.new /etc/topictalk.env
systemctl restart topictalk; systemctl enable caddy >/dev/null 2>&1; systemctl restart caddy
sleep 8
curl -fsS "https://$D/healthz" && echo && echo "Done. Open https://$D" || { echo "HTTPS not ready. Check: DuckDNS points to this server's IP, and ports 80+443 are open in the DigitalOcean firewall. Logs: journalctl -u caddy -n 20"; exit 1; }
