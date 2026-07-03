/** Supabase Storage helpers shared by payslips and compliance photos. */
import { supabase } from '@/lib/supabase';

export function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function uploadBase64(
  bucket: string,
  path: string,
  base64: string,
  contentType: string,
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, base64ToBytes(base64), { contentType, upsert: true });
  return error ? error.message : null;
}

/** One-hour signed URL for a private object. */
export async function signedUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
