#!/usr/bin/env bash
# Free HTTPS for TopicTalk using the nginx already on this server (it also serves your other site).
# Adds ONE new nginx site file for this domain; never edits your other sites. Usage:
#   bash /opt/topictalk/deploy/https-nginx.sh topictalk.duckdns.org [your-email-for-certificate-notices]
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
D="${1:-}"; EM="${2:-}"; [ -n "$D" ] || { echo "Usage: bash $0 your-name.duckdns.org [email]"; exit 1; }
command -v nginx >/dev/null || { echo "nginx not found."; exit 1; }
APP_PORT=$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/topictalk.service); APP_PORT=${APP_PORT:-3001}
echo "==> Checking the name points here"
MYIP=$(curl -fsS https://api.ipify.org || true); DIP=$(getent hosts "$D" | awk '{print $1; exit}' || true)
echo "this server: $MYIP   $D -> ${DIP:-nothing yet}"
[ -n "$DIP" ] && [ "$DIP" = "$MYIP" ] || { echo "The name doesn't point to this server yet. Fix it on duckdns.org and try again in a minute."; exit 1; }
F=/etc/nginx/sites-available/topictalk
[ -e "$F" ] && cp "$F" "$F.bak"
cat > "$F" <<CONF
server {
  listen 80;
  server_name $D;
  client_max_body_size 2m;
  location / {
    proxy_pass http://127.0.0.1:$APP_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_buffering off;
    proxy_read_timeout 3600s;
  }
}
CONF
ln -sf "$F" /etc/nginx/sites-enabled/topictalk
if ! nginx -t; then echo "nginx test failed; undoing."; rm -f /etc/nginx/sites-enabled/topictalk; [ -e "$F.bak" ] && mv "$F.bak" "$F" || rm -f "$F"; exit 1; fi
systemctl reload nginx
command -v certbot >/dev/null || { echo "==> Installing certbot"; apt-get install -y certbot python3-certbot-nginx >/dev/null; }
echo "==> Getting a free certificate"
if ls /etc/letsencrypt/accounts/*/*/* >/dev/null 2>&1; then A=""; elif [ -n "$EM" ]; then A="-m $EM"; else A="--register-unsafely-without-email"; fi
certbot --nginx -d "$D" --non-interactive --agree-tos $A --redirect
nginx -t && systemctl reload nginx
touch /etc/topictalk.env
grep -vE '^(TRUST_PROXY|SECURE_COOKIE)=' /etc/topictalk.env > /etc/topictalk.env.new || true
printf 'TRUST_PROXY=1\nSECURE_COOKIE=1\n' >> /etc/topictalk.env.new
chmod 600 /etc/topictalk.env.new; mv /etc/topictalk.env.new /etc/topictalk.env
systemctl restart topictalk; sleep 3
curl -fsS "https://$D/healthz" && echo && echo "Done. Open https://$D"
