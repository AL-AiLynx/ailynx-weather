"use strict";

const sessionKeyFor = (url) => {
  try { return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`; }
  catch { return "ailynx-auth-session"; }
};

export function publicAuthConfig(config = globalThis.window?.AiLynxCommunityConfig) {
  const url = String(config?.supabaseUrl || "").replace(/\/$/, "");
  const publishableKey = String(config?.publishableKey || "").trim();
  return { url, publishableKey, available: Boolean(url && publishableKey) };
}

function storedSession(config) {
  const key = sessionKeyFor(config.url);
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch { return null; }
}

function saveSession(config, session) {
  try { globalThis.localStorage?.setItem(sessionKeyFor(config.url), JSON.stringify(session)); } catch { /* storage is optional */ }
}

function forgetSession(config) {
  try { globalThis.localStorage?.removeItem(sessionKeyFor(config.url)); } catch { /* storage is optional */ }
}

async function request(config, path, options = {}) {
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.publishableKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.msg || body?.message || "AUTH_REQUEST_FAILED");
    error.status = response.status;
    throw error;
  }
  return body;
}

export function createAuthClient(rawConfig) {
  const config = publicAuthConfig(rawConfig);
  const unavailable = () => { throw new Error("AUTH_UNAVAILABLE"); };
  if (!config.available) return Object.freeze({ available: false, getSession: async () => null, signUp: unavailable, signIn: unavailable, signOut: async () => {}, resetPasswordForEmail: unavailable, updatePassword: unavailable });

  const userFor = async (session) => {
    if (!session?.access_token) return null;
    try {
      return await request(config, "/auth/v1/user", { headers: { Authorization: `Bearer ${session.access_token}` } });
    } catch (error) {
      if (error.status === 401) forgetSession(config);
      return null;
    }
  };
  return Object.freeze({
    available: true,
    async getSession() {
      const session = storedSession(config);
      if (!session) return null;
      const user = await userFor(session);
      return user ? { ...session, user } : null;
    },
    async signUp({ email, password, redirectTo }) {
      const body = await request(config, "/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password, options: { emailRedirectTo: redirectTo } }) });
      if (body.session) saveSession(config, body.session);
      return { confirmationRequired: !body.session, user: body.user || null, session: body.session || null };
    },
    async signIn({ email, password }) {
      const session = await request(config, "/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
      saveSession(config, session);
      return session;
    },
    async signOut() {
      const session = storedSession(config);
      try {
        if (session?.access_token) await request(config, "/auth/v1/logout", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      } finally { forgetSession(config); }
    },
    async resetPasswordForEmail(email, redirectTo) {
      return request(config, "/auth/v1/recover", { method: "POST", body: JSON.stringify({ email, options: { redirectTo } }) });
    },
    async updatePassword(password) {
      const session = await this.getSession();
      if (!session) throw new Error("AUTH_REQUIRED");
      return request(config, "/auth/v1/user", { method: "PUT", headers: { Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ password }) });
    },
  });
}

if (typeof window !== "undefined") window.AiLynxSupabaseAuth = createAuthClient(window.AiLynxCommunityConfig);
