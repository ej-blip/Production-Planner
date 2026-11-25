// Production Planner — notes between the benches and management.
//
// Stored per day in plans/{date}/messages/{id}:
//   bench    the bench it's about (or "all")
//   tag      delay · stock · quality · other (for spotting trends later)
//   text     what happened ("Waited for procurement to release plugs. 20
//            minute delay." / "Change to 14 Solar units: low stock.")
//   role     who wrote it: "bench" or "management"
//   seenBy / seenAt   set once the other side marks it seen
// Shared by the bench screens and the Management screen.
import {
  collection, doc, addDoc, updateDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./session.js";
import { escapeHtml } from "./floor.js";

export const MESSAGE_TAGS = [["delay", "Delay"], ["stock", "Stock"], ["quality", "Quality"], ["other", "Other"]];
export const MESSAGE_BENCHES = [
  ["subassembly", "Sub Assembly"], ["assembly", "Assembly"], ["testing", "Testing"], ["hardware", "Hardware Check"],
  ["buildup", "Packaging build-up"], ["packing", "Packing"], ["cage", "Production Cage"], ["all", "Everyone"]
];
const tagLabel = tag => (MESSAGE_TAGS.find(([key]) => key === tag) || [tag, tag])[1];
export const messageBenchLabel = bench => (MESSAGE_BENCHES.find(([key]) => key === bench) || [bench, bench])[1];

export function watchMessages(date, onChange) {
  return onSnapshot(collection(db, "plans", date, "messages"), snapshot => {
    onChange(snapshot.docs
      .map(entry => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now())));
  }, () => onChange(null));
}

export function addMessage(date, { bench, tag, text }, role, actor) {
  return addDoc(collection(db, "plans", date, "messages"), {
    bench,
    tag: MESSAGE_TAGS.some(([key]) => key === tag) ? tag : "other",
    text: String(text || "").trim().slice(0, 1000),
    role,
    createdBy: actor,
    createdAt: serverTimestamp()
  });
}

export function markMessageSeen(date, id, actor) {
  return updateDoc(doc(db, "plans", date, "messages", id), { seenBy: actor, seenAt: serverTimestamp() });
}

// One note: tag, text, who and when; "Seen" for the other side to tap, or
// who saw it. role: the screen showing it.
export function messageHtml(message, role, { showBench = false } = {}) {
  const at = message.createdAt?.toDate ? message.createdAt.toDate() : null;
  const time = at ? at.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "now";
  const mine = message.role === role;
  const seen = message.seenBy
    ? `<span class="msg-seen">Seen · ${escapeHtml(message.seenBy)}</span>`
    : mine ? "" : `<button type="button" class="msg-seen-button" data-message-seen="${escapeHtml(message.id)}">Seen</button>`;
  return `
    <div class="msg ${message.role === "management" ? "from-management" : "from-bench"} ${message.seenBy || mine ? "" : "unseen"}">
      <div class="msg-head">
        <span class="msg-tag tag-${escapeHtml(message.tag)}">${escapeHtml(tagLabel(message.tag))}</span>
        <span class="msg-who">${escapeHtml(message.createdBy || "")}${showBench && message.bench !== "all" ? ` · ${escapeHtml(messageBenchLabel(message.bench))}` : ""} · ${escapeHtml(time)}</span>
        ${seen}
      </div>
      <div class="msg-text">${escapeHtml(message.text)}</div>
    </div>`;
}

// Asks for a note: a tag and the text (and on the Management screen, which
// bench it's for). Resolves with { bench, tag, text } or null.
export function askMessage({ title = "Note", bench = null, benches = null } = {}) {
  return new Promise(resolve => {
    const backdrop = document.createElement("div");
    backdrop.className = "floor-dialog-backdrop";
    backdrop.innerHTML = `
      <div class="floor-dialog msg-dialog" role="dialog" aria-modal="true">
        <h3>${escapeHtml(title)}</h3>
        ${benches ? `<select data-bench aria-label="For">${benches.map(([key, label]) => `<option value="${escapeHtml(key)}"${key === bench ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>` : ""}
        <div class="quick-chips msg-tags">${MESSAGE_TAGS.map(([key, label], index) => `<button type="button" class="${index === 0 ? "" : "secondary"}" data-tag="${key}" aria-pressed="${index === 0}">${label}</button>`).join("")}</div>
        <textarea rows="3" maxlength="1000" aria-label="Note"></textarea>
        <p class="floor-error" data-error></p>
        <div class="floor-dialog-actions">
          <button type="button" class="secondary" data-cancel>Cancel</button>
          <button type="button" data-save>Send</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    let tag = MESSAGE_TAGS[0][0];
    const text = backdrop.querySelector("textarea");
    text.focus();
    const close = value => {
      backdrop.remove();
      resolve(value);
    };
    backdrop.addEventListener("click", event => {
      const chip = event.target.closest("[data-tag]");
      if (chip) {
        tag = chip.dataset.tag;
        backdrop.querySelectorAll("[data-tag]").forEach(button => {
          const on = button === chip;
          button.classList.toggle("secondary", !on);
          button.setAttribute("aria-pressed", String(on));
        });
        return;
      }
      if (event.target.closest("[data-cancel]") || event.target === backdrop) return close(null);
      if (event.target.closest("[data-save]")) {
        if (!text.value.trim()) {
          backdrop.querySelector("[data-error]").textContent = "Write the note first.";
          text.focus();
          return;
        }
        close({ bench: backdrop.querySelector("[data-bench]")?.value || bench, tag, text: text.value.trim() });
      }
    });
  });
}
