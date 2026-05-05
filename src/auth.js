const CREDENTIAL_HASH = "d79df91a1470229781f8d97c97d378e7b71ea7564a59bee2b8afe45d1dc5012c";
const STORAGE_KEY = "bg_auth";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const sha256 = async (s) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const isAuthed = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { expires } = JSON.parse(raw);
    return typeof expires === "number" && expires > Date.now();
  } catch {
    return false;
  }
};

export const login = async (username, password) => {
  const hash = await sha256(`${username}:${password}`);
  if (hash !== CREDENTIAL_HASH) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ expires: Date.now() + TTL_MS }));
  } catch {}
  return true;
};

export const logout = () => {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
};
