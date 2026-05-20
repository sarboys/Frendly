#!/bin/sh
set -eu

if [ "${CODE_SIGNING_ALLOWED:-NO}" != "YES" ]; then
  exit 0
fi

identity="${EXPANDED_CODE_SIGN_IDENTITY:-}"
if [ -z "$identity" ] || [ "$identity" = "-" ]; then
  exit 0
fi

frameworks_path="${FRAMEWORKS_FOLDER_PATH:-${FULL_PRODUCT_NAME}/Frameworks}"
frameworks_dir="${TARGET_BUILD_DIR}/${frameworks_path}"

if [ ! -d "$frameworks_dir" ]; then
  exit 0
fi

find "$frameworks_dir" -maxdepth 1 -type d -name "*.framework" | while IFS= read -r framework; do
  signature="$(codesign -dv "$framework" 2>&1 || true)"
  case "$signature" in
    *"Signature=adhoc"*)
      echo "Re-signing native asset framework: ${framework##*/}"
      codesign --force --sign "$identity" --timestamp=none --preserve-metadata=identifier,entitlements "$framework"
      ;;
  esac
done
