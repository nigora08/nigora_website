import { useState } from "react";
import { deleteEntry, patchJson, postJson, shrinkImage } from "./edit.js";

const empty = { title: "", body: "", linkUrl: "", image: undefined, fileName: "" };

export default function SectionBoard({ section, entries, editing, onChanged }) {
  return (
    <div className="board">
      <h2>{section.label}</h2>
      {editing ? (
        <EntryForm
          sectionId={section.id}
          submitLabel="Add"
          onSubmit={async (draft) => {
            const data = await postJson("/api/entries", { sectionId: section.id, ...draft });
            onChanged(data.sections);
          }}
        />
      ) : null}
      <div className="entries">
        {entries.map((entry, index) => (
          <Entry
            key={entry.id}
            entry={entry}
            editing={editing}
            first={index === 0}
            last={index === entries.length - 1}
            onChanged={onChanged}
          />
        ))}
      </div>
    </div>
  );
}

function Entry({ entry, editing, first, last, onChanged }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const data = await deleteEntry(entry.id);
    onChanged(data.sections);
  }

  async function move(direction) {
    const data = await postJson(`/api/entries/${entry.id}/move`, { direction });
    onChanged(data.sections);
  }

  return (
    <article className="entry">
      {entry.imageId ? <img src={`/api/media/${entry.imageId}`} alt="" /> : null}
      {entry.title ? <h3>{entry.title}</h3> : null}
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
          sectionId=""
          submitLabel="Save"
          initial={entry}
          onSubmit={async (draft) => {
            const data = await patchJson(`/api/entries/${entry.id}`, draft);
            onChanged(data.sections);
            setOpen(false);
          }}
        />
      ) : null}
    </article>
  );
}

function EntryForm({ submitLabel, initial, onSubmit }) {
  const [draft, setDraft] = useState(() =>
    initial
      ? { title: initial.title, body: initial.body, linkUrl: initial.linkUrl, image: undefined, fileName: "" }
      : empty,
  );
  const [clearImage, setClearImage] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

function linkLabel(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
