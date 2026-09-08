// Vercel server-side bridge for the one public browser configuration value.
// Do not add service-role, database, or other secret environment variables.
export const PUBLIC_KEY_ENV = "AILYNX_SUPABASE_PUBLISHABLE_KEY";

const javascriptString = (value) => JSON.stringify(value)
  .replace(/</g, "\\u003c")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");

export default function publicRuntimeConfig(_request, response) {
  const publishableKey = String(process.env[PUBLIC_KEY_ENV] || "").trim();
  const body = `window.__AILYNX_SUPABASE_PUBLISHABLE_KEY__ = ${javascriptString(publishableKey)};\n`;
  response
    .status(200)
    .setHeader("Content-Type", "application/javascript; charset=utf-8")
    .setHeader("Cache-Control", "no-store, max-age=0, must-revalidate")
    .setHeader("X-Content-Type-Options", "nosniff")
    .send(body);
}
