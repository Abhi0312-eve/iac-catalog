#!/usr/bin/env bash
set -Eeuo pipefail

# EC2 initial provisioning only.
# Installs the selected exact package version and starts its
# package-owned systemd service. Does not modify service configuration.

SERVICE_ID="${1:-}"
CONFIG_VERSION="${2:-}"
PACKAGE_NAME="${3:-}"
PACKAGE_VERSION="${4:-}"

log() {
  printf '[initial-install] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

[[ $# -eq 4 ]] ||
  fail "Expected SERVICE_ID CONFIG_VERSION PACKAGE_NAME PACKAGE_VERSION."

[[ $EUID -eq 0 ]] || fail "Run this script as root."

[[ "$SERVICE_ID" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] ||
  fail "Invalid service identifier."

[[ "$CONFIG_VERSION" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
  fail "Invalid configuration version."

[[ "$PACKAGE_NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9+._-]*$ ]] ||
  fail "Invalid package name."

[[ "$PACKAGE_VERSION" =~ ^[0-9]+([.+~:_-][a-zA-Z0-9.+~:_-]*)*$ ]] ||
  fail "Invalid package version."

[[ -r /etc/os-release ]] ||
  fail "/etc/os-release is missing."

. /etc/os-release

OS_FAMILY=""

case "${ID:-}" in
  ubuntu|debian)
    OS_FAMILY="debian"
    command -v apt-get >/dev/null 2>&1 ||
      fail "apt-get is unavailable."
    command -v dpkg-query >/dev/null 2>&1 ||
      fail "dpkg-query is unavailable."
    ;;
  amzn)
    [[ "${VERSION_ID:-}" == 2023* ]] ||
      fail "Only Amazon Linux 2023 is supported."
    OS_FAMILY="amazon"
    command -v dnf >/dev/null 2>&1 ||
      fail "dnf is unavailable."
    command -v rpm >/dev/null 2>&1 ||
      fail "rpm is unavailable."
    ;;
  *)
    fail "Unsupported operating system: ${ID:-unknown}."
    ;;
esac

log "OS: ${PRETTY_NAME:-${ID}}"
log "Service identifier: ${SERVICE_ID}"
log "Configuration version: ${CONFIG_VERSION}"
log "Package: ${PACKAGE_NAME}"
log "Requested exact version: ${PACKAGE_VERSION}"

install_debian_exact() {
  export DEBIAN_FRONTEND=noninteractive

  log "Refreshing APT metadata."
  apt-get update

  if ! apt-cache madison "$PACKAGE_NAME" |
      awk -F '|' -v wanted="$PACKAGE_VERSION" '
        {
          version = $2
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", version)
          if (version == wanted) found = 1
        }
        END { exit !found }
      '; then
    fail "Exact version ${PACKAGE_VERSION} is unavailable for ${PACKAGE_NAME}."
  fi

  log "Installing ${PACKAGE_NAME}=${PACKAGE_VERSION}"
  apt-get install -y "${PACKAGE_NAME}=${PACKAGE_VERSION}"

  local installed
  installed="$(dpkg-query -W -f='${Version}' "$PACKAGE_NAME" 2>/dev/null)" ||
    fail "Could not query installed package ${PACKAGE_NAME}."

  [[ "$installed" == "$PACKAGE_VERSION" ]] ||
    fail "Installed version '${installed}' does not match '${PACKAGE_VERSION}'."

  log "Verified installed Debian package version: ${installed}"
}

install_amazon_exact() {
  log "Refreshing DNF metadata."
  dnf makecache

  local requested_epoch requested_version_release
  local available installed

  if [[ "$PACKAGE_VERSION" =~ ^([0-9]+):(.+)$ ]]; then
    requested_epoch="${BASH_REMATCH[1]}"
    requested_version_release="${BASH_REMATCH[2]}"
  else
    requested_epoch="0"
    requested_version_release="$PACKAGE_VERSION"
  fi

  [[ "$requested_version_release" == *-* ]] ||
    fail "Invalid RPM version-release: ${PACKAGE_VERSION}"

  available="$(dnf repoquery --available \
    --qf '%{epoch}:%{version}-%{release}' "$PACKAGE_NAME" 2>/dev/null)" ||
    fail "Could not query repository versions for ${PACKAGE_NAME}."

  if ! printf '%s\n' "$available" |
      awk -v wanted="${requested_epoch}:${requested_version_release}" '
        {
          value = $0
          sub(/^\(none\):/, "0:", value)
          if (value == wanted) found = 1
        }
        END { exit !found }
      '; then
    fail "Exact RPM version ${PACKAGE_VERSION} is unavailable for ${PACKAGE_NAME}."
  fi

  log "Installing ${PACKAGE_NAME} at exact EVR ${PACKAGE_VERSION}"

  dnf install -y \
    "${PACKAGE_NAME}-${requested_epoch}:${requested_version_release}"

  installed="$(rpm -q --qf '%{EPOCHNUM}:%{VERSION}-%{RELEASE}' \
    "$PACKAGE_NAME" 2>/dev/null)" ||
    fail "Could not query installed RPM ${PACKAGE_NAME}."

  [[ "$installed" == "${requested_epoch}:${requested_version_release}" ]] ||
    fail "Installed RPM '${installed}' does not match requested '${PACKAGE_VERSION}'."

  log "Verified installed RPM EVR: ${installed}"
}

case "$OS_FAMILY" in
  debian) install_debian_exact ;;
  amazon) install_amazon_exact ;;
esac

command -v systemctl >/dev/null 2>&1 ||
  fail "systemctl is unavailable."

# Discover service units from files owned by the selected package.
PACKAGE_FILES=""

case "$OS_FAMILY" in
  debian)
    PACKAGE_FILES="$(dpkg-query -L "$PACKAGE_NAME" 2>/dev/null)" ||
      fail "Could not list files owned by ${PACKAGE_NAME}."
    ;;
  amazon)
    PACKAGE_FILES="$(rpm -ql "$PACKAGE_NAME" 2>/dev/null)" ||
      fail "Could not list files owned by ${PACKAGE_NAME}."
    ;;
esac

declare -A UNIT_CANDIDATES=()

while IFS= read -r package_file; do
  case "$package_file" in
    /usr/lib/systemd/system/*.service|\
    /lib/systemd/system/*.service|\
    /etc/systemd/system/*.service)
      if [[ -f "$package_file" || -L "$package_file" ]]; then
        unit_name="${package_file##*/}"
        UNIT_CANDIDATES["$unit_name"]=1
      fi
      ;;
  esac
done <<< "$PACKAGE_FILES"

STANDALONE_UNITS=()
TEMPLATE_UNITS=()

for candidate in "${!UNIT_CANDIDATES[@]}"; do
  if [[ "$candidate" == *@*.service ]]; then
    TEMPLATE_UNITS+=("$candidate")
  else
    STANDALONE_UNITS+=("$candidate")
  fi
done

if [[ -z "${STANDALONE_UNITS[*]}" ]]; then
  if [[ -n "${TEMPLATE_UNITS[*]}" ]]; then
    templates="$(printf '%s\\n' "${TEMPLATE_UNITS[@]}" | sort | paste -sd ', ' -)"
    fail "Package ${PACKAGE_NAME} provides only templated systemd units (${templates}); an instance name is required."
  fi
  fail "Package ${PACKAGE_NAME} owns no discoverable standalone systemd service unit."
fi

if [[ -n "${STANDALONE_UNITS[1]:-}" ]]; then
  candidates="$(printf '%s\\n' "${STANDALONE_UNITS[@]}" | sort | paste -sd ', ' -)"
  fail "Package ${PACKAGE_NAME} has multiple standalone service units: ${candidates}."
fi

UNIT="${STANDALONE_UNITS[0]}"

log "Discovered package-owned systemd unit: ${UNIT}"

systemctl daemon-reload

systemctl enable "$UNIT" ||
  fail "Could not enable ${UNIT}."

systemctl start "$UNIT" ||
  fail "Could not start ${UNIT}."

systemctl is-active --quiet "$UNIT" ||
  fail "${UNIT} is not active after startup."

systemctl is-enabled --quiet "$UNIT" ||
  fail "${UNIT} is not enabled."

log "Verified package: ${PACKAGE_NAME} ${PACKAGE_VERSION}"
log "Verified service: ${UNIT} is enabled and active."
log "Initial installation completed."
