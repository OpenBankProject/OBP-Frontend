#!/bin/bash
# Build both Docker images locally — portal and api-manager-ii.

set -euo pipefail

cd "$(dirname "$0")"

./build_portal_image.sh
./build_apimanager_image.sh
