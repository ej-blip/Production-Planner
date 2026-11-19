// Production Planner — floor board.
//
// Each bench reports a status for every batch of a released plan:
//   waiting → in progress → hit target, or "did N" when it finished short.
// A short count flows on: later benches expect that many units instead of
// the planned number. Notes (text and/or a photo) can be pinned to a bench
// or to everyone. Used by the floor board (board.html) and the bench screens.
//
// Firestore:
//   plans/{date}/progress/{bench}_{batchKey}  bench, batchId, status, done
//   plans/{date}/notes/{id}                   bench, text, photo, role, createdBy
import {
  collection, doc, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./session.js";

export const FLOOR_BENCHES = [
  { key: "cage", label: "Production Cage", short: "Cage" },
  { key: "assembly", label: "Assembly", short: "Assembly" },
  { key: "testing", label: "Testing", short: "Testing" },
  { key: "hardware", label: "Hardware Check", short: "Hardware" },
  { key: "packing", label: "Packing", short: "Packing" }
];
const ORDER = FLOOR_BENCHES.map(bench => bench.key);
export const benchLabel = key => FLOOR_BENCHES.find(bench => bench.key === key)?.label || key;

// Jobs whose people show as name magnets on each bench's column.
export const MAGNET_STATIONS = {
  cage: [],
  assembly: ["subAssembly", "assembly", "assemblyGen4", "assemblyTap"],
  testing: ["testing", "testingVerizon", "testingGlobal"],
  hardware: ["hardware"],
  packing: ["packing"]
};

const UNIT_LABELS = { gen4: "Gen4", tap: "Tap" };

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// ---------------------------------------------------------------------
// Batches and statuses
// ---------------------------------------------------------------------
export function batchKey(batch, index) {
  const id = String(batch?.id || "");
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : `b${index}`;
}

// The plan's batches with something to build, with their planned units.
export function floorBatches(plan) {
  const targets = plan?.snapshot?.batchTargets || [];
  return (plan?.batches || [])
    .map((batch, index) => {
      const target = targets.find(item => item.index === index);
      return {
        ...batch,
        index,
        key: batchKey(batch, index),
        planned: target ? Number(target.planned) || 0 : Number(batch.quantity) || 0,
        requested: Number(batch.quantity) || 0
      };
    })
    .filter(batch => batch.requested > 0);
}

export function batchTitle(batch) {
  return `${batch.customer || "Batch"} · ${UNIT_LABELS[batch.unitType] || batch.unitType || ""}`;
}

export function progressOf(progress, bench, batch) {
  return progress.get(`${bench}_${batch.key}`) || { status: "waiting", done: null };
}

// Units heading to this bench for this batch: the planned number, or less
// when an earlier bench finished short.
export function expectedUnits(progress, bench, batch) {
  let expected = batch.planned;
  ORDER.slice(0, ORDER.indexOf(bench)).forEach(earlier => {
    const item = progress.get(`${earlier}_${batch.key}`);
    if (item?.status === "short" && Number.isInteger(item.done)) expected = Math.min(expected, item.done);
  });
  return expected;
}

export function statusText(bench, item, expected) {
  const cage = bench === "cage";
  if (item.status === "in_progress") return cage ? "Releasing" : "In progress";
  if (item.status === "hit") return cage ? `Released · ${item.done ?? expected}` : `Hit target · ${item.done ?? expected}`;
  if (item.status === "short") return cage ? `Released ${item.done} of ${expected}` : `Did ${item.done} of ${expected}`;
  return "Waiting";
}

export function expectedText(progress, bench, batch) {
  const expected = expectedUnits(progress, bench, batch);
  return expected < batch.planned ? `${expected} coming (of ${batch.planned})` : `${batch.planned} planned`;
}

export function setBatchStatus(date, bench, batch, status, done, actor) {
  return setDoc(doc(db, "plans", date, "progress", `${bench}_${batch.key}`), {
    bench,
    batchId: batch.key,
    status,
    done: Number.isInteger(done) ? done : null,
    updatedBy: actor,
    updatedAt: serverTimestamp()
  });
}

// ---------------------------------------------------------------------
// Live updates
// ---------------------------------------------------------------------
export function watchFloor(date, onChange) {
  let progress = new Map();
  let notes = [];
  const send = () => onChange({ progress, notes });
  const stopProgress = onSnapshot(collection(db, "plans", date, "progress"), snapshot => {
    progress = new Map(snapshot.docs.map(entry => [entry.id, entry.data()]));
    send();
  }, () => {});
  const stopNotes = onSnapshot(collection(db, "plans", date, "notes"), snapshot => {
    notes = snapshot.docs
      .map(entry => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
    send();
  }, () => {});
  return () => {
    stopProgress();
    stopNotes();
  };
}

// ---------------------------------------------------------------------
// Pinned notes
// ---------------------------------------------------------------------
export function addNote(date, { bench, text, photo }, role, actor) {
  return addDoc(collection(db, "plans", date, "notes"), {
    bench,
    text: text || "",
    ...(photo ? { photo } : {}),
    role,
    createdBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export function editNote(date, note, { bench, text, photo }, role, actor) {
  return setDoc(doc(db, "plans", date, "notes", note.id), {
    bench: bench || note.bench,
    text: text || "",
    ...(photo ? { photo } : {}),
    role,
    createdBy: actor,
    createdAt: note.createdAt,
    updatedAt: serverTimestamp()
  });
}

export function removeNote(date, note) {
  return deleteDoc(doc(db, "plans", date, "notes", note.id));
}

export function canEditNote(note, role) {
  return role === "management" || note.role === "bench";
}

// A photo shrunk to a JPEG small enough to keep in the database (well under
// Firestore's 1 MB limit), so no separate file storage is needed.
export async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("That file isn't a photo the app can read."));
      element.src = url;
    });
    let size = 1400;
    let quality = 0.75;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= 850000) return data;
      size = Math.round(size * 0.75);
      quality = Math.max(0.5, quality - 0.08);
    }
    throw new Error("That photo is too large. Try a smaller one.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------
// Shared HTML
// ---------------------------------------------------------------------
function noteColour(batch, presets) {
  return presets?.[batch.configKey]?.colourHex || "#64748b";
}

// One bench's sticky note for one batch.
export function statusNoteHtml({ bench, batch, progress, presets, clickable = false }) {
  const item = progressOf(progress, bench, batch);
  const expected = expectedUnits(progress, bench, batch);
  const preset = presets?.[batch.configKey];
  return `
    <div class="sticky status-${item.status} ${clickable ? "clickable" : ""}" style="--note:${escapeHtml(noteColour(batch, presets))}"
      data-bench="${escapeHtml(bench)}" data-batch="${escapeHtml(batch.key)}" ${clickable ? 'role="button" tabindex="0"' : ""}>
      <b>${escapeHtml(batchTitle(batch))}</b>
      <span class="sticky-sub"><span class="nw">${escapeHtml(preset?.label || batch.configKey || "")}</span> · ${expected < batch.planned ? `<span class="nw">${Number(expected)} coming</span> <span class="nw">(of ${Number(batch.planned)})</span>` : `<span class="nw">${Number(batch.planned)} planned</span>`}</span>
      <span class="sticky-status">${escapeHtml(statusText(bench, item, expected))}</span>
    </div>`;
}

export function pinnedNoteHtml(note, role) {
  const editable = canEditNote(note, role);
  return `
    <div class="pinned" data-note="${escapeHtml(note.id)}">
      ${note.text ? `<div class="pinned-text">${escapeHtml(note.text)}</div>` : ""}
      ${note.photo ? `<img class="pinned-photo" src="${escapeHtml(note.photo)}" alt="Photo pinned by ${escapeHtml(note.createdBy || "someone")}" data-photo="${escapeHtml(note.id)}" />` : ""}
      <div class="pinned-meta">
        <span>${escapeHtml(note.createdBy || "")}${note.bench === "all" ? " · for everyone" : ""}</span>
        ${editable ? `<span class="pinned-actions"><button type="button" class="link" data-edit-note="${escapeHtml(note.id)}">Edit</button><button type="button" class="link" data-remove-note="${escapeHtml(note.id)}">Remove</button></span>` : ""}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------
function dialog(html) {
  const backdrop = document.createElement("div");
  backdrop.className = "floor-dialog-backdrop";
  backdrop.innerHTML = `<div class="floor-dialog" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(backdrop);
  return backdrop;
}

export function showPhoto(src) {
  const backdrop = dialog(`<img class="photo-full" alt="Pinned photo" /><button type="button" class="secondary" data-close>Close</button>`);
  backdrop.querySelector("img").src = src;
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop || event.target.closest("[data-close]")) backdrop.remove();
  });
}

// Ask how many units a bench actually did. Resolves with a number or null.
export function askUnitsDone({ title, expected }) {
  return new Promise(resolve => {
    const backdrop = dialog(`
      <h3></h3>
      <p>How many units were finished? The next benches will expect this many.</p>
      <input type="number" inputmode="numeric" min="0" step="1" />
      <p class="floor-error" role="alert"></p>
      <div class="floor-dialog-actions">
        <button type="button" class="secondary" data-cancel>Cancel</button>
        <button type="button" data-save>Save</button>
      </div>`);
    backdrop.querySelector("h3").textContent = title;
    const input = backdrop.querySelector("input");
    const error = backdrop.querySelector(".floor-error");
    input.max = String(expected);
    input.focus();
    const done = value => {
      backdrop.remove();
      resolve(value);
    };
    const save = () => {
      const value = Number(input.value);
      if (input.value === "" || !Number.isInteger(value) || value < 0) {
        error.textContent = "Enter a whole number of units.";
        return;
      }
      if (value > expected) {
        error.textContent = `That's more than the ${expected} expected. Use Hit target instead.`;
        return;
      }
      done(value);
    };
    input.addEventListener("input", () => { error.textContent = ""; });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") save();
    });
    backdrop.querySelector("[data-save]").addEventListener("click", save);
    backdrop.querySelector("[data-cancel]").addEventListener("click", () => done(null));
  });
}

// Pick a status for one bench and batch (used on the floor board).
// Resolves with { status, done } or null.
export function askStatus({ bench, batch, progress }) {
  const expected = expectedUnits(progress, bench, batch);
  const cage = bench === "cage";
  return new Promise(resolve => {
    const backdrop = dialog(`
      <h3></h3>
      <p></p>
      <div class="floor-choices">
        <button type="button" data-status="waiting" class="secondary">Waiting</button>
        <button type="button" data-status="in_progress">${cage ? "Releasing" : "In progress"}</button>
        <button type="button" data-status="hit">${cage ? "Released all" : "Hit target"} (${expected})</button>
        <button type="button" data-status="short">${cage ? "Released fewer…" : "Enter number done…"}</button>
        <button type="button" data-status="" class="secondary">Cancel</button>
      </div>`);
    backdrop.querySelector("h3").textContent = `${benchLabel(bench)}: ${batchTitle(batch)}`;
    backdrop.querySelector("p").textContent = `${expected} expected at this bench.`;
    backdrop.addEventListener("click", async event => {
      const button = event.target.closest("button[data-status]");
      if (!button) return;
      const status = button.dataset.status;
      backdrop.remove();
      if (!status) return resolve(null);
      if (status === "hit") return resolve({ status, done: expected });
      if (status === "short") {
        const done = await askUnitsDone({ title: `${benchLabel(bench)}: ${batchTitle(batch)}`, expected });
        return resolve(done === null ? null : { status: done >= expected ? "hit" : "short", done });
      }
      resolve({ status, done: null });
    });
  });
}

// Write or change a pinned note. Resolves with { bench, text, photo } or null.
// photo: a JPEG data URL, or null for none.
export function askNote({ title, bench, benches = null, note = null }) {
  return new Promise(resolve => {
    const backdrop = dialog(`
      <h3></h3>
      ${benches ? `<label>For<select data-bench>${benches.map(item => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`).join("")}</select></label>` : ""}
      <label>Note<textarea rows="4" maxlength="2000" placeholder="Pallet split is 2 × 15 today"></textarea></label>
      <label>Photo (optional)<input type="file" accept="image/*" /></label>
      <div class="floor-photo-preview"></div>
      <p class="floor-error" role="alert"></p>
      <div class="floor-dialog-actions">
        <button type="button" class="secondary" data-cancel>Cancel</button>
        <button type="button" data-save>Pin note</button>
      </div>`);
    backdrop.querySelector("h3").textContent = title;
    const textarea = backdrop.querySelector("textarea");
    const fileInput = backdrop.querySelector("input[type=file]");
    const preview = backdrop.querySelector(".floor-photo-preview");
    const error = backdrop.querySelector(".floor-error");
    const benchSelect = backdrop.querySelector("[data-bench]");
    const saveButton = backdrop.querySelector("[data-save]");
    let photo = note?.photo || null;

    if (benchSelect) benchSelect.value = note?.bench || bench || benchSelect.options[0].value;
    textarea.value = note?.text || "";

    const showPreview = () => {
      preview.innerHTML = photo
        ? `<img alt="Photo to pin" /><button type="button" class="link" data-remove-photo>Remove photo</button>`
        : "";
      if (photo) preview.querySelector("img").src = photo;
    };
    showPreview();

    preview.addEventListener("click", event => {
      if (!event.target.closest("[data-remove-photo]")) return;
      photo = null;
      fileInput.value = "";
      showPreview();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      error.textContent = "";
      saveButton.disabled = true;
      preview.textContent = "Shrinking the photo…";
      try {
        photo = await shrinkPhoto(file);
      } catch (problem) {
        photo = null;
        error.textContent = problem.message;
      }
      saveButton.disabled = false;
      showPreview();
    });

    const finish = value => {
      backdrop.remove();
      resolve(value);
    };
    textarea.addEventListener("input", () => { error.textContent = ""; });
    saveButton.addEventListener("click", () => {
      const text = textarea.value.trim();
      if (!text && !photo) {
        error.textContent = "Write a note or add a photo.";
        return;
      }
      finish({ bench: benchSelect ? benchSelect.value : bench, text, photo });
    });
    backdrop.querySelector("[data-cancel]").addEventListener("click", () => finish(null));
  });
}
