// Section pages stay blank until Nigora adds them.
// The full name belongs in Contact only when she writes it there.

export const SECTIONS = [
  { id: "projects", label: "Projects" },
  { id: "experiences", label: "Experiences" },
  { id: "event-notes", label: "Event notes" },
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
