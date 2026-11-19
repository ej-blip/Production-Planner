// Production Planner — requests from the benches.
//
//   help    Need help        Waiting  → Responding → Resolved
//   stock   Stock request    Waiting  → Sent       → Received
//   faulty  Report faulty    Reported → Checking   → Fixed
//
// Stored per day in plans/{date}/requests/{id} with status open → accepted
// → done. Shared by the bench screens, the cage screen and the floor board.
import {
  collection, doc, addDoc, updateDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./session.js";
import { escapeHtml, shrinkPhoto } from "./floor.js";

const ICON = {
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
  stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/><path d="m7.5 5.5 9 5"/></svg>',
  faulty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
};

export const REQUEST_KINDS = {
  help: {
    label: "Need help",
    icon: ICON.help,
    status: { open: "Waiting", accepted: "Responding", done: "Resolved" },
    next: { open: "Respond", accepted: "Resolved" }
  },
  stock: {
    label: "Stock request",
    icon: ICON.stock,
    status: { open: "Waiting", accepted: "Sent", done: "Received" },
    next: { open: "Send", accepted: "Received" }
  },
  faulty: {
    label: "Report faulty",
    icon: ICON.faulty,
    status: { open: "Reported", accepted: "Checking", done: "Fixed" },
    next: { open: "Checking", accepted: "Fixed" }
  }
};

const BENCH_LABELS = { cage: "Cage", assembly: "Assembly", testing: "Testing", hardware: "Hardware", packing: "Packing", management: "Management" };
export const nextStatus = status => (status === "open" ? "accepted" : status === "accepted" ? "done" : null);

export function requestTitle(request) {
  if (request.kind === "stock") return `${request.qty ? `${request.qty} × ` : ""}${request.text || "Stock"}`;
  if (request.kind === "faulty") return `${request.text || "Faulty unit"}${request.unit ? ` · ${request.unit}` : ""}`;
  return request.text || "Need help";
}

// ---------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------
export function watchRequests(date, onChange) {
  return onSnapshot(collection(db, "plans", date, "requests"), snapshot => {
    const list = snapshot.docs
      .map(entry => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
    onChange(list);
  }, () => {});
}

export function makeRequest(date, fields, actor) {
  const data = {
    kind: fields.kind,
    bench: fields.bench,
    status: "open",
    text: String(fields.text || "").slice(0, 500),
    createdBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor
  };
  if (Number.isInteger(fields.qty) && fields.qty > 0) data.qty = fields.qty;
  if (fields.unit) data.unit = String(fields.unit).slice(0, 60);
  if (fields.batchId) data.batchId = fields.batchId;
  if (fields.photo) data.photo = fields.photo;
  return addDoc(collection(db, "plans", date, "requests"), data);
}

export function moveRequest(date, request, status, actor) {
  return updateDoc(doc(db, "plans", date, "requests", request.id), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: actor
  });
}

// ---------------------------------------------------------------------
// Shared HTML: one request as a card. actionFor(request) → { label, to }
// for a button that moves it on, or null for no button here.
// ---------------------------------------------------------------------
export function requestCardHtml(request, actionFor = () => null) {
  const kind = REQUEST_KINDS[request.kind] || REQUEST_KINDS.help;
  const time = request.createdAt?.toDate ? request.createdAt.toDate().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "now";
  const action = actionFor(request);
  return `
    <div class="req req-${escapeHtml(request.kind)} st-${escapeHtml(request.status)}" data-request="${escapeHtml(request.id)}">
      <span class="req-icon">${kind.icon}</span>
      <div class="req-body">
        <b>${escapeHtml(requestTitle(request))}</b>
        <span>${escapeHtml(BENCH_LABELS[request.bench] || request.bench)} · ${escapeHtml(time)}</span>
      </div>
      ${request.photo ? `<img class="req-photo" src="${escapeHtml(request.photo)}" alt="Photo" data-photo="${escapeHtml(request.id)}" />` : ""}
      <span class="req-status">${escapeHtml(kind.status[request.status] || request.status)}</span>
      ${action ? `<button type="button" class="req-go" data-req-move="${escapeHtml(request.id)}" data-req-to="${escapeHtml(action.to)}">${escapeHtml(action.label)}</button>` : ""}
    </div>`;
}

// ---------------------------------------------------------------------
// Dialogs. Each resolves with the request fields, or null if cancelled.
// ---------------------------------------------------------------------
function dialog(html) {
  const backdrop = document.createElement("div");
  backdrop.className = "floor-dialog-backdrop";
  backdrop.innerHTML = `<div class="floor-dialog req-dialog" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(backdrop);
  return backdrop;
}

function chipsHtml(options) {
  return `<div class="quick-chips">${options.map(option => `<button type="button" class="secondary" data-chip="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}</div>`;
}

function finish(backdrop, resolve, value) {
  backdrop.remove();
  resolve(value);
}

export function askHelp() {
  return new Promise(resolve => {
    const backdrop = dialog(`
      <h3><span class="req-dialog-icon help">${ICON.help}</span>Need help</h3>
      ${chipsHtml(["Extra person", "Question", "Machine problem", "Supervisor"])}
      <input type="text" maxlength="200" placeholder="Extra person for packing" aria-label="What do you need" />
      <div class="floor-dialog-actions">
        <button type="button" class="secondary" data-cancel>Cancel</button>
        <button type="button" data-save>Call for help</button>
      </div>`);
    const input = backdrop.querySelector("input");
    backdrop.addEventListener("click", event => {
      const chip = event.target.closest("[data-chip]");
      if (chip) input.value = chip.dataset.chip;
      if (event.target.closest("[data-cancel]")) finish(backdrop, resolve, null);
      if (event.target.closest("[data-save]")) finish(backdrop, resolve, { kind: "help", text: input.value.trim() || "Need help" });
    });
  });
}

export function askStock() {
  return new Promise(resolve => {
    const backdrop = dialog(`
      <h3><span class="req-dialog-icon stock">${ICON.stock}</span>Stock request</h3>
      ${chipsHtml(["Boxes", "Labels", "Sensors", "Cables", "Screws", "SIM cards"])}
      <label>Item<input type="text" maxlength="200" placeholder="Labels" data-item /></label>
      <label>How many<input type="number" inputmode="numeric" min="1" step="1" placeholder="20" data-qty /></label>
      <p class="floor-error" role="alert"></p>
      <div class="floor-dialog-actions">
        <button type="button" class="secondary" data-cancel>Cancel</button>
        <button type="button" data-save>Request</button>
      </div>`);
    const item = backdrop.querySelector("[data-item]");
    const qty = backdrop.querySelector("[data-qty]");
    const error = backdrop.querySelector(".floor-error");
    backdrop.addEventListener("click", event => {
      const chip = event.target.closest("[data-chip]");
      if (chip) { item.value = chip.dataset.chip; error.textContent = ""; qty.focus(); }
      if (event.target.closest("[data-cancel]")) finish(backdrop, resolve, null);
      if (event.target.closest("[data-save]")) {
        const text = item.value.trim();
        const amount = qty.value === "" ? null : Number(qty.value);
        if (!text) { error.textContent = "Pick or type an item."; return; }
        if (amount !== null && (!Number.isInteger(amount) || amount < 1)) { error.textContent = "Enter a whole number."; return; }
        finish(backdrop, resolve, { kind: "stock", text, qty: amount });
      }
    });
    item.addEventListener("input", () => { error.textContent = ""; });
  });
}

// batches: [{ key, title }]
export function askFaulty(batches = []) {
  return new Promise(resolve => {
    const backdrop = dialog(`
      <h3><span class="req-dialog-icon faulty">${ICON.faulty}</span>Report faulty</h3>
      ${batches.length ? `<label>Batch<select data-batch>${batches.map(batch => `<option value="${escapeHtml(batch.key)}">${escapeHtml(batch.title)}</option>`).join("")}</select></label>` : ""}
      <label>Unit number (optional)<input type="text" maxlength="60" placeholder="DCU-1042" data-unit /></label>
      <label>What's wrong<input type="text" maxlength="300" placeholder="No power on test" data-text /></label>
      <label>Photo (optional)<input type="file" accept="image/*" data-photo /></label>
      <div class="floor-photo-preview"></div>
      <p class="floor-error" role="alert"></p>
      <div class="floor-dialog-actions">
        <button type="button" class="secondary" data-cancel>Cancel</button>
        <button type="button" data-save>Report</button>
      </div>`);
    const text = backdrop.querySelector("[data-text]");
    const fileInput = backdrop.querySelector("[data-photo]");
    const preview = backdrop.querySelector(".floor-photo-preview");
    const error = backdrop.querySelector(".floor-error");
    const save = backdrop.querySelector("[data-save]");
    let photo = null;
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      save.disabled = true;
      preview.textContent = "Shrinking the photo…";
      try {
        photo = await shrinkPhoto(file);
        preview.innerHTML = '<img alt="Photo to send" />';
        preview.querySelector("img").src = photo;
      } catch (problem) {
        photo = null;
        preview.textContent = "";
        error.textContent = problem.message;
      }
      save.disabled = false;
    });
    text.addEventListener("input", () => { error.textContent = ""; });
    backdrop.addEventListener("click", event => {
      if (event.target.closest("[data-cancel]")) finish(backdrop, resolve, null);
      if (event.target.closest("[data-save]")) {
        if (!text.value.trim()) { error.textContent = "Say what's wrong."; return; }
        finish(backdrop, resolve, {
          kind: "faulty",
          text: text.value.trim(),
          unit: backdrop.querySelector("[data-unit]").value.trim() || null,
          batchId: backdrop.querySelector("[data-batch]")?.value || null,
          photo
        });
      }
    });
  });
}
