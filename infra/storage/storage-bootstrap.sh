#!/bin/sh
set -eu

: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${WEB_ORIGIN:?WEB_ORIGIN is required}"

alias_name="atlashq"
bucket_ref="${alias_name}/${S3_BUCKET}"

until mc alias set "${alias_name}" "${S3_ENDPOINT}" "${S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY}" >/dev/null 2>&1; do
  echo "Waiting for MinIO endpoint ${S3_ENDPOINT}..."
  sleep 2
done

mc mb --ignore-existing "${bucket_ref}"
mc anonymous set none "${bucket_ref}"
mc version enable "${bucket_ref}"

versioning_json="$(mc version info --json "${bucket_ref}")"
echo "${versioning_json}" | grep -q '"Status":"Enabled"' || {
  echo "Bucket versioning is not enabled for ${bucket_ref}." >&2
  exit 1
}

cat <<EOF > ./cors.json
[
  {
    "AllowedOrigins": ["${WEB_ORIGIN}"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "x-amz-*"],
    "ExposeHeaders": ["ETag", "x-amz-version-id", "x-amz-request-id"],
    "MaxAgeSeconds": 300
  }
]
EOF

mc cors set "${bucket_ref}" ./cors.json
mc cors list "${bucket_ref}"
rm -f ./cors.json
