import { useState } from "react";
import { deleteEntry, patchJson, postJson, shrinkImage } from "./edit.js";
import { EVENT_CATEGORIES, EVENT_SECTION_ID } from "./sections.js";

const empty = {
  title: "",
  body: "",
  linkUrl: "",
  eventDate: "",
  category: "",
  image: undefined,
  fileName: "",
};

export default function SectionBoard({ section, entries, categories = [], editing, onChanged, onCategories }) {
  const eventSection = section.id === EVENT_SECTION_ID;
  const gallery = section.id === "gallery";

  async function reorder(id, to) {
    const data = await postJson(`/api/entries/${id}/move`, { to });
    onChanged(data);
  }

  return (
    <div className="board">
      <h2>{section.label}</h2>
      {editing ? (
        <EntryForm
          eventSection={eventSection}
          categories={categories}
          onCategories={onCategories}
          submitLabel="Add"
          onSubmit={async (draft) => {
            const data = await postJson("/api/entries", { sectionId: section.id, ...draft });
            onChanged(data);
          }}
        />
      ) : null}
      <div className={gallery ? "entries gallery" : "entries"}>
        {entries.map((entry, index) => (
          <Entry
            key={entry.id}
            entry={entry}
            editing={editing}
            gallery={gallery}
            eventSection={eventSection}
            categories={categories}
            onCategories={onCategories}
            first={index === 0}
            last={index === entries.length - 1}
            index={index}
            onChanged={onChanged}
            onReorder={reorder}
          />
        ))}
      </div>
    </div>
  );
}

function Entry({
  entry,
  editing,
  gallery,
  eventSection,
  categories,
  onCategories,
  first,
  last,
  index,
  onChanged,
  onReorder,
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [over, setOver] = useState(false);

  async function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const data = await deleteEntry(entry.id);
    onChanged(data);
  }

  async function move(direction) {
    const data = await postJson(`/api/entries/${entry.id}/move`, { direction });
    onChanged(data);
  }

  function dragStart(event) {
    event.dataTransfer.setData("text/plain", entry.id);
    event.dataTransfer.effectAllowed = "move";
  }

  function dragOver(event) {
    if (!editing || !gallery) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(true);
  }

  function drop(event) {
    if (!editing || !gallery) return;
    event.preventDefault();
    setOver(false);
    const id = event.dataTransfer.getData("text/plain");
    if (id && id !== entry.id) onReorder(id, index);
  }

  const meta = eventMeta(entry);

  return (
    <article
      className={over ? "entry over" : "entry"}
      onDragOver={dragOver}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      {entry.imageId ? (
        <div className={gallery ? "shot" : undefined}>
          <img
            src={imageSrc(entry.imageId)}
            alt={entry.title || ""}
            draggable={editing && gallery}
            onDragStart={dragStart}
          />
        </div>
      ) : null}
      {entry.title ? <h3>{entry.title}</h3> : null}
      {meta ? <p className="entry-meta">{meta}</p> : null}
      {entry.body ? <p>{entry.body}</p> : null}
      {entry.linkUrl ? (
        <a href={entry.linkUrl} rel="noreferrer">
          {linkLabel(entry.linkUrl)}
        </a>
      ) : null}
      {editing ? (
        <div className="entry-tools">
          <button type="button" onClick={() => setOpen((value) => !value)}>
            {open ? "Close" : "Change"}
          </button>
          {!first ? (
            <button type="button" onClick={() => move("up")}>
              Up
            </button>
          ) : null}
          {!last ? (
            <button type="button" onClick={() => move("down")}>
              Down
            </button>
          ) : null}
          <button type="button" onClick={remove}>
            {confirming ? "Remove" : "Delete"}
          </button>
        </div>
      ) : null}
      {open ? (
        <EntryForm
          eventSection={eventSection}
          categories={categories}
          onCategories={onCategories}
          submitLabel="Save"
          initial={entry}
          onSubmit={async (draft) => {
            const data = await patchJson(`/api/entries/${entry.id}`, draft);
            onChanged(data);
            setOpen(false);
          }}
        />
      ) : null}
    </article>
  );
}

function EntryForm({ eventSection, categories, onCategories, submitLabel, initial, onSubmit }) {
  const [draft, setDraft] = useState(() =>
    initial
      ? {
          title: initial.title,
          body: initial.body,
          linkUrl: initial.linkUrl,
          eventDate: initial.eventDate || "",
          category: initial.category || "",
          image: undefined,
          fileName: "",
        }
      : empty,
  );
  const [customName, setCustomName] = useState("");
  const [clearImage, setClearImage] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const custom = categories.filter(
    (name) => !EVENT_CATEGORIES.some((item) => item.toLowerCase() === name.toLowerCase()),
  );

  function setField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await shrinkImage(file);
      setDraft((current) => ({ ...current, image, fileName: file.name }));
      setClearImage(false);
      setError("");
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function addCategory() {
    setError("");
    try {
      const data = await postJson("/api/categories", { name: customName });
      onCategories(data.categories || []);
      setField("category", data.name || "");
      setCustomName("");
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        title: draft.title,
        body: draft.body,
        linkUrl: draft.linkUrl,
      };
      if (eventSection) {
        payload.eventDate = draft.eventDate;
        payload.category = draft.category;
      }
      if (draft.image) payload.image = draft.image;
      else if (clearImage) payload.image = null;
      await onSubmit(payload);
      if (!initial) setDraft(empty);
      setClearImage(false);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <input
        value={draft.title}
        onChange={(event) => setField("title", event.target.value)}
        placeholder="Title"
        aria-label="Title"
        maxLength={200}
      />
      {eventSection ? (
        <>
          <input
            type="date"
            value={draft.eventDate}
            onChange={(event) => setField("eventDate", event.target.value)}
            aria-label="Date"
            required
          />
          <select
            value={draft.category}
            onChange={(event) => setField("category", event.target.value)}
            aria-label="Category"
            required
          >
            <option value="">Category</option>
            {EVENT_CATEGORIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            {custom.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <div className="category-add">
            <input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addCategory();
              }}
              placeholder="Your category"
              aria-label="New category"
              maxLength={40}
            />
            <button type="button" onClick={addCategory}>
              Add category
            </button>
          </div>
        </>
      ) : null}
      <textarea
        value={draft.body}
        onChange={(event) => setField("body", event.target.value)}
        placeholder="Note"
        aria-label="Note"
        maxLength={20000}
      />
      <input
        value={draft.linkUrl}
        onChange={(event) => setField("linkUrl", event.target.value)}
        placeholder="Link"
        aria-label="Link"
        inputMode="url"
      />
      <label className="file">
        <input type="file" accept="image/*" onChange={onFile} />
        {draft.fileName || "Picture"}
      </label>
      {initial?.imageId ? (
        <button
          type="button"
          onClick={() => {
            setClearImage((value) => !value);
            setDraft((current) => ({ ...current, image: undefined, fileName: "" }));
          }}
        >
          {clearImage ? "Keep picture" : "Remove picture"}
        </button>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" disabled={busy}>
        {busy ? "Saving" : submitLabel}
      </button>
    </form>
  );
}

function eventMeta(entry) {
  const date = formatDate(entry.eventDate);
  return [date, entry.category].filter(Boolean).join(" · ");
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function imageSrc(id) {
  return id.startsWith("data:") ? id : `/api/media/${id}`;
}

function linkLabel(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
