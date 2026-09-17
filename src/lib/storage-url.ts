import { createAdminClient } from "@/lib/supabase/admin";

type Bucket = "contracts" | "reports" | "documents";

/**
 * Existing records store public-style object URLs. Keep those stable in the
 * database, but turn them into short-lived signed URLs before sending them to
 * a browser after the bucket is made private.
 */
function objectPath(url: string, bucket: Bucket) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const start = url.indexOf(marker);
  return start === -1 ? null : url.slice(start + marker.length);
}

export async function signStorageUrl(
  admin: ReturnType<typeof createAdminClient>,
  bucket: Bucket,
  url: string,
) {
  const path = objectPath(url, bucket);
  if (!path) return url;

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error || !data?.signedUrl ? url : data.signedUrl;
}

export function storedObjectPath(url: string, bucket: Bucket) {
  return objectPath(url, bucket);
}
