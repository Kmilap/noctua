#!/usr/bin/env bash
# Configura IP fija en la red solo-anfitrión exclusiva del laboratorio.
# Idempotente: reescribe el netplan de enp0s8. NO lo aplica (ver mensaje final).
# Red: 192.168.57.0/24 sin DHCP. Host 192.168.57.1, VM 192.168.57.10.
set -euo pipefail

readonly LAB_IP="192.168.57.10"
readonly LAB_CIDR="${LAB_IP}/24"
readonly IFACE="enp0s8"
readonly NETPLAN="/etc/netplan/90-lab-hostonly.yaml"

if [[ $EUID -ne 0 ]]; then echo "Ejecutar con sudo." >&2; exit 1; fi

install -m 600 /dev/null "$NETPLAN"
cat > "$NETPLAN" <<YAML
# Red solo-anfitrión exclusiva del laboratorio (sin DHCP). IP fija.
network:
  version: 2
  ethernets:
    ${IFACE}:
      dhcp4: false
      addresses: [${LAB_CIDR}]
YAML

chmod 600 "$NETPLAN"
netplan generate
echo "netplan escrito en ${NETPLAN} con ${LAB_CIDR} en ${IFACE}."
echo "NO se aplica aquí: se aplica tras conectar el adaptador a la red .57."
echo "Para aplicar dentro de la VM ya en la red nueva: sudo netplan apply"
