/** Base URL of the deployment. Required: links we send out must be clickable. */
export function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL env var is required (ex: https://fretaja.example.com)");
  return url.replace(/\/+$/, "");
}
