#!/usr/bin/env bash
# Installs or updates TopicTalk on an Ubuntu 22.04/24.04 server (e.g. a DigitalOcean droplet).
# Run as root:  curl -fsSL https://raw.githubusercontent.com/suryasirius/topicverse/main/deploy/install.sh | bash
# Private repo: add GITHUB_TOKEN=<token> before bash. Optional: ADMIN_USERNAME=<name> makes that account the owner.
# Running it again updates to the newest code and restarts the site; your data stays.
set -euo pipefail

main() {
REPO_PATH="suryasirius/topicverse"
APP_DIR=/opt/topictalk
DATA_DIR=/var/lib/topictalk
PORT="${PORT:-80}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Run this as root (in the DigitalOcean console you already are)."; exit 1; }

say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq curl git ca-certificates ufw >/dev/null

if ! node -v 2>/dev/null | grep -qE '^v(2[4-9]|[3-9][0-9])\.'; then
  say "Installing Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "Node $(node -v)"

say "Getting the TopicTalk code"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  git config --global credential.helper store
  printf 'https://x-access-token:%s@github.com\n' "$GITHUB_TOKEN" > /root/.git-credentials
  chmod 600 /root/.git-credentials
fi
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  git clone --depth 1 "https://github.com/$REPO_PATH.git" "$APP_DIR" || {
    echo; echo "Couldn't download the code. If the GitHub repo is private, run again with GITHUB_TOKEN=<your token>."; exit 1; }
fi
git -C "$APP_DIR" log -1 --format='Code version: %h %s'

say "Setting up the service"
id topictalk >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin topictalk
mkdir -p "$DATA_DIR"
chown -R topictalk:topictalk "$DATA_DIR"
touch /etc/topictalk.env
if [ -n "${ADMIN_USERNAME:-}" ]; then
  grep -v '^ADMIN_USERNAME=' /etc/topictalk.env > /etc/topictalk.env.new || true
  echo "ADMIN_USERNAME=$ADMIN_USERNAME" >> /etc/topictalk.env.new
  mv /etc/topictalk.env.new /etc/topictalk.env
fi
cat > /etc/systemd/system/topictalk.service <<EOF
[Unit]
Description=TopicTalk
After=network-online.target
Wants=network-online.target

[Service]
User=topictalk
Group=topictalk
WorkingDirectory=$APP_DIR/server
Environment=PORT=$PORT
Environment=HOST=0.0.0.0
Environment=DATA_DIR=$DATA_DIR
EnvironmentFile=-/etc/topictalk.env
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning server.js
Restart=always
RestartSec=3
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable topictalk >/dev/null 2>&1
systemctl restart topictalk

say "Opening the firewall for SSH and the website"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

say "Checking the site"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then OK=1; break; fi
  sleep 1
done
if [ "${OK:-}" != 1 ]; then
  echo "The site didn't start. Recent log:"; journalctl -u topictalk -n 40 --no-pager; exit 1
fi
IP=$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null || hostname -I | awk '{print $1}')
URL="http://$IP"; [ "$PORT" = 80 ] || URL="$URL:$PORT"
echo
echo "TopicTalk is live at $URL"
echo "The first account you create there becomes the owner${ADMIN_USERNAME:+ (or the account named $ADMIN_USERNAME)}."
echo "Update later:  bash $APP_DIR/deploy/install.sh     Logs:  journalctl -u topictalk -f"
}
# the whole script is read before it runs, so updating its own file mid-run is safe
main "$@"
