#!/usr/bin/env bash
set -Eeuo pipefail

# Initial configuration for a newly provisioned EC2 instance.
# This script is separate from the existing remediation runner.

SERVICE="${1:-}"
CONFIG_VERSION="${2:-}"
PORT="${3:-}"

log() {
  printf '[initial-config] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

[[ $EUID -eq 0 ]] || fail "Run this script as root."
[[ "$CONFIG_VERSION" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
  fail "Invalid configuration version: $CONFIG_VERSION"

CONFIG_VERSION="${CONFIG_VERSION#v}"

# This initial module release supports the currently defined configuration.
[[ "$CONFIG_VERSION" == "1.0.0" ]] ||
  fail "Unsupported configuration version: v${CONFIG_VERSION}"

case "$SERVICE" in
  apache|nginx|tomcat) ;;
  *) fail "Unsupported service: $SERVICE" ;;
esac

[[ "$PORT" =~ ^[0-9]+$ ]] ||
  fail "Port must be numeric."

(( PORT >= 1 && PORT <= 65535 )) ||
  fail "Port must be between 1 and 65535."

[[ -r /etc/os-release ]] ||
  fail "Cannot identify operating system: /etc/os-release is missing."

# Identify supported package families from the actual instance.
. /etc/os-release
OS_FAMILY=""

case "${ID:-}" in
  ubuntu|debian) OS_FAMILY="debian" ;;
  amzn|rhel|rocky|almalinux|centos|fedora) OS_FAMILY="redhat" ;;
  *)
    case " ${ID_LIKE:-} " in
      *" debian "*) OS_FAMILY="debian" ;;
      *" rhel "*|*" fedora "*) OS_FAMILY="redhat" ;;
    esac
    ;;
esac

[[ -n "$OS_FAMILY" ]] ||
  fail "Unsupported OS: ${ID:-unknown}. No packages were installed."

# Check the requested port BEFORE installing or changing the service.
if command -v ss >/dev/null 2>&1; then
  LISTENERS="$(ss -H -ltnp "sport = :${PORT}" 2>/dev/null || true)"
elif command -v lsof >/dev/null 2>&1; then
  LISTENERS="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
else
  fail "Cannot check port availability: neither ss nor lsof is installed."
fi

if [[ -n "$LISTENERS" ]]; then
  log "Port ${PORT} is already in use. No service installation was attempted."
  printf '%s\n' "$LISTENERS"
  exit 20
fi

log "Port ${PORT} is available."
log "OS: ${PRETTY_NAME:-${ID}}; service: ${SERVICE}; configuration: v${CONFIG_VERSION}"

install_package() {
  local package="$1"

  log "Installing package: ${package}"
  case "$OS_FAMILY" in
    debian)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update
      apt-get install -y "$package"
      ;;
    redhat)
      if command -v dnf >/dev/null 2>&1; then
        dnf install -y "$package"
      elif command -v yum >/dev/null 2>&1; then
        yum install -y "$package"
      else
        fail "Neither dnf nor yum is available."
      fi
      ;;
  esac
}

case "${SERVICE}:${OS_FAMILY}" in
  apache:debian)
    PACKAGE="apache2"
    UNIT="apache2"
    ;;
  apache:redhat)
    PACKAGE="httpd"
    UNIT="httpd"
    ;;
  nginx:*)
    PACKAGE="nginx"
    UNIT="nginx"
    ;;
  tomcat:debian)
    PACKAGE="tomcat10"
    UNIT="tomcat10"
    ;;
  tomcat:redhat)
    PACKAGE="tomcat10"
    UNIT="tomcat"
    ;;
esac

install_package "$PACKAGE"

case "$SERVICE" in
  nginx)
    command -v nginx >/dev/null 2>&1 ||
      fail "Nginx executable was not found after package installation."

    mkdir -p /etc/nginx/conf.d

    # For a non-default port, adapt existing default port-80 listeners.
    # Back up every file before changing it.
    if [[ "$PORT" != "80" ]]; then
      while IFS= read -r -d "" file; do
        if grep -Eq '^[[:space:]]*listen[[:space:]]+80([[:space:]]*;|[[:space:]]+default_server)' "$file" ||
           grep -Eq '^[[:space:]]*listen[[:space:]]+\[::\]:80([[:space:]]*;|[[:space:]]+default_server)' "$file"; then
          cp -p "$file" "${file}.backstage-backup"
          sed -i -E \
            -e 's/^([[:space:]]*listen[[:space:]]+)80([[:space:]]*;)/\1'"${PORT}"'\2/' \
            -e 's/^([[:space:]]*listen[[:space:]]+\[::\]:)80([[:space:]]*;)/\1'"${PORT}"'\2/' \
            "$file"
          log "Updated default Nginx listener in $file"
        fi
      done < <(find /etc/nginx -type f \( -name "*.conf" -o -name "nginx.conf" \) -print0)
    fi

    cat > /etc/nginx/conf.d/backstage-initial-port.conf <<EOF
server {
    listen ${PORT};
    server_name _;
    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
EOF

    nginx -t
    ;;

  apache)
    if [[ "$OS_FAMILY" == "debian" ]]; then
      PORTS_FILE="/etc/apache2/ports.conf"
      VHOST_DIR="/etc/apache2/sites-available"
      mkdir -p "$VHOST_DIR"

      if ! grep -Eq "^[[:space:]]*Listen[[:space:]]+${PORT}([[:space:]]|$)" "$PORTS_FILE"; then
        printf '\nListen %s\n' "$PORT" >> "$PORTS_FILE"
      fi

      cat > "${VHOST_DIR}/backstage-initial-port.conf" <<EOF
<VirtualHost *:${PORT}>
    DocumentRoot /var/www/html
    <Directory /var/www/html>
        Require all granted
    </Directory>
</VirtualHost>
EOF
      a2ensite backstage-initial-port.conf
      apache2ctl configtest
    else
      CONF="/etc/httpd/conf.d/backstage-initial-port.conf"
      mkdir -p /etc/httpd/conf.d

      # Avoid duplicate Listen directives, but always retain the virtual host.
      if grep -REq "^[[:space:]]*Listen[[:space:]]+${PORT}([[:space:]]|$)" \
          /etc/httpd/conf /etc/httpd/conf.d 2>/dev/null; then
        : > "$CONF"
      else
        printf 'Listen %s\n' "$PORT" > "$CONF"
      fi

      cat >> "$CONF" <<EOF
<VirtualHost *:${PORT}>
    DocumentRoot /var/www/html
    <Directory /var/www/html>
        Require all granted
    </Directory>
</VirtualHost>
EOF
      httpd -t
    fi
    ;;

  tomcat)
    SERVER_XML=""
    for candidate in \
      /etc/tomcat10/server.xml \
      /etc/tomcat/server.xml \
      /etc/tomcat10/server.xml.dpkg-dist
    do
      if [[ -f "$candidate" ]]; then
        SERVER_XML="$candidate"
        break
      fi
    done

    [[ -n "$SERVER_XML" ]] ||
      fail "Tomcat server.xml was not found after installing ${PACKAGE}."

    # Safely update the first Tomcat Connector port, including multiline XML.
    command -v perl >/dev/null 2>&1 ||
      fail "Perl is required to safely update Tomcat XML."

    if ! perl -0777 -ne 'exit(!/<Connector\b[^>]*?\bport="[0-9]+"/s)' "$SERVER_XML"; then
      fail "No Tomcat Connector port was found in ${SERVER_XML}."
    fi

    cp -p "$SERVER_XML" "${SERVER_XML}.backstage-backup"

    PORT="$PORT" perl -0pi -e \
      's{(<Connector\b[^>]*?\bport=")\d+(")}{$1 . $ENV{PORT} . $2}se' \
      "$SERVER_XML"

    PORT="$PORT" perl -0777 -ne \
      'exit(!/<Connector\b[^>]*?\bport="$ENV{PORT}"/s)' "$SERVER_XML" ||
      fail "Tomcat Connector port update could not be verified."
    ;;
esac

log "Enabling ${UNIT}."
systemctl enable "$UNIT"

log "Restarting ${UNIT}."
if ! systemctl restart "$UNIT"; then
  log "Service startup failed. Recent service logs:"
  journalctl -u "$UNIT" -n 40 --no-pager || true

  log "Current listening ports:"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP -sTCP:LISTEN || true
  fi

  fail "Service ${UNIT} failed to start. Review the diagnostics above."
fi

systemctl is-active --quiet "$UNIT" ||
  fail "Service ${UNIT} did not become active."

# Verify the requested port is listening after service startup.
sleep 2

if command -v ss >/dev/null 2>&1; then
  FINAL_LISTENERS="$(ss -H -ltnp "sport = :${PORT}" 2>/dev/null || true)"
else
  FINAL_LISTENERS="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
fi

if [[ -z "$FINAL_LISTENERS" ]]; then
  journalctl -u "$UNIT" -n 40 --no-pager || true
  fail "${SERVICE} is active but port ${PORT} is not listening."
fi

log "SUCCESS: ${SERVICE} is active and listening on port ${PORT}."
printf '%s\n' "$FINAL_LISTENERS"
