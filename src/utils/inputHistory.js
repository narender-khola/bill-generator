const KEY_PREFIX = "bg_history_";
const MAX_ENTRIES = 8;

export const getHistory = (fieldKey) => {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + fieldKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const addToHistory = (fieldKey, value) => {
  if (value === null || value === undefined) return;
  const v = String(value).trim();
  if (!v) return;
  try {
    const list = getHistory(fieldKey);
    const next = [v, ...list.filter((x) => x !== v)].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(KEY_PREFIX + fieldKey, JSON.stringify(next));
  } catch {}
};

export const saveAll = (entries) => {
  Object.entries(entries).forEach(([k, v]) => addToHistory(k, v));
};
