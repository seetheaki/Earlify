const STORAGE_KEY = "earlify_browser_id";
const NUMBER_KEY = "earlify_public_number";
const NAME_KEY = "earlify_display_name";
const COLOR_KEY = "earlify_name_color";

export const CHAT_COLORS = [
  "#8000A6",
  "#FE7D00",
  "#00FF19",
  "#F5E300",
  "#BA0000",
  "#FF00E4",
  "#5300FF",
  "#FF0000",
  "#D4FF00",
  "#177500",
  "#00FF96",
  "#B50050",
];

export function getBrowserId() {
  let browserId = localStorage.getItem(STORAGE_KEY);

  if (!browserId) {
    browserId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, browserId);
  }

  return browserId;
}

export function getPublicNumber() {
  let number = localStorage.getItem(NUMBER_KEY);

  if (!number) {
    number = String(
      Math.floor(1000 + Math.random() * 9000)
    );
    localStorage.setItem(NUMBER_KEY, number);
  }

  return number;
}

export function getDisplayName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function saveDisplayName(name) {
  localStorage.setItem(NAME_KEY, name.trim());
}

export function getNameColor() {
  const savedColor = localStorage.getItem(COLOR_KEY);

  return CHAT_COLORS.includes(savedColor)
    ? savedColor
    : CHAT_COLORS[0];
}

export function saveNameColor(color) {
  if (CHAT_COLORS.includes(color)) {
    localStorage.setItem(COLOR_KEY, color);
  }
}