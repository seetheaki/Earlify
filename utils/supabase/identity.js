const STORAGE_KEY = "earlify_browser_id";
const NAME_KEY = "earlify_display_name";

export function getBrowserId() {
  let browserId = localStorage.getItem(STORAGE_KEY);

  if (!browserId) {
    browserId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, browserId);
  }

  return browserId;
}

export function getDisplayName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function saveDisplayName(name) {
  localStorage.setItem(NAME_KEY, name.trim());
}