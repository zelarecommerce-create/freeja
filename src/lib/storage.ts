import { createClient } from "@supabase/supabase-js";

const BUCKET = "comprovantes";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required");
  return createClient(url, key);
}

// ponytail: base64 JSON upload, simplest path for MVP photo volume.
// Upgrade path: switch to a signed direct-upload URL if photo size or
// volume starts straining API route payload limits.
export async function uploadComprovante(routeId: string, base64Image: string): Promise<string> {
  const supabase = getClient();
  const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const path = `${routeId}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: "image/jpeg" });
  if (error) throw new Error(`upload comprovante failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
