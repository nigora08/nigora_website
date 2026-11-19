// Section pages stay blank until Nigora adds them.
// The full name belongs in Contact only when she writes it there.

export const EVENT_SECTION_ID = "event-notes";

export const EVENT_CATEGORIES = ["Play", "Campus event", "Hackathon", "Other"];

export function tidyCategory(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
}

export function matchCategory(value, custom = []) {
  const tidy = tidyCategory(value);
  if (!tidy) return "";
  const known = [...EVENT_CATEGORIES, ...custom];
  return known.find((item) => item.toLowerCase() === tidy.toLowerCase()) || "";
}

export function isRealDate(value) {
  const raw = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const SECTIONS = [
  { id: "projects", label: "Projects" },
  { id: "experiences", label: "Experiences" },
  { id: EVENT_SECTION_ID, label: "Events & experiences" },
  { id: "books", label: "Books" },
  { id: "journal", label: "Journal" },
  { id: "insights", label: "Insights" },
  { id: "gallery", label: "Gallery" },
  { id: "digital-projects", label: "Digital projects" },
  { id: "physical-projects", label: "Physical projects" },
  { id: "friends", label: "Friends" },
  { id: "contact", label: "Contact" },
];

export function sectionFromHash(hash) {
  const id = hash.replace(/^#/, "");
  return SECTIONS.some((section) => section.id === id) ? id : null;
}
