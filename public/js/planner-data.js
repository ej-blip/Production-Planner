// Production Planner — Firebase data layer for the Management screen.
//
// Exposes window.plannerData for the calculator (a classic script):
//   start()                      → unlocks with the management PIN, then
//                                  returns { staff, presets }
//   saveStaff(workers)           → replaces the staff list
//   loadDay(date)                → { plan, roster } for "YYYY-MM-DD" (either may be null)
//   saveDraft(date, plan, roster)
//   releasePlan(date, plan, roster, assignments, target)
//   lockScreen()
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  writeBatch, serverTimestamp, query, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

const PIN_PATTERN = /^[A-Za-z0-9 _-]{6,64}$/;
const ACTOR = "Management";

// ---------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------
function firstAuthState() {
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, user => {
      stop();
      resolve(user);
    });
  });
}

// "management", "bench", "changed" (PIN no longer valid) or null.
async function currentRole() {
  const user = auth.currentUser;
  if (!user) return null;
  const device = await getDoc(doc(db, "devices", user.uid));
  if (!device.exists()) return null;
  const role = device.data().role;
  try {
    // Reading something only that role may read proves the PIN still exists.
    await getDocs(query(collection(db, role === "management" ? "pins" : "staff"), limit(1)));
    return role;
  } catch (error) {
    if (error?.code === "permission-denied") return "changed";
    throw error;
  }
}

async function unlockWithPin(pin) {
  if (!PIN_PATTERN.test(pin)) return null;
  if (!auth.currentUser) await signInAnonymously(auth);
  const deviceRef = doc(db, "devices", auth.currentUser.uid);
  for (const role of ["management", "bench"]) {
    try {
      await setDoc(deviceRef, { role, pin, createdAt: serverTimestamp() });
      return role;
    } catch (error) {
      if (error?.code !== "permission-denied") throw error;
    }
  }
  return null;
}

function friendlyError(error) {
  const messages = {
    "auth/operation-not-allowed": "Anonymous sign-in is turned off in Firebase.",
    "auth/admin-restricted-operation": "Anonymous sign-in is turned off in Firebase.",
    "auth/network-request-failed": "Firebase can't be reached. Check the internet connection.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "permission-denied": "The database refused this. The management PIN may have changed.",
    "unavailable": "The database can't be reached. Check the internet connection."
  };
  return messages[error?.code] || error?.message || "Something went wrong.";
}

// ---------------------------------------------------------------------
// PIN screen (built here so the calculator page stays unchanged)
// ---------------------------------------------------------------------
function showPinScreen(note) {
  return new Promise(resolve => {
    let overlay = document.getElementById("plannerPinOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "plannerPinOverlay";
      overlay.innerHTML = `
        <style>
          #plannerPinOverlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center;
            padding: 24px; background: rgba(2, 6, 23, 0.94); font-family: Arial, Helvetica, sans-serif; color: #f8fafc; }
          #plannerPinOverlay .pin-box { width: min(440px, 100%); background: #111827; border: 1px solid #334155; border-radius: 16px; padding: 22px; }
          #plannerPinOverlay h2 { margin: 0 0 6px; font-size: 22px; }
          #plannerPinOverlay p { margin: 0 0 14px; color: #94a3b8; line-height: 1.45; }
          #plannerPinOverlay .pin-note { color: #fde68a; }
          #plannerPinOverlay label { display: block; margin-bottom: 6px; color: #cbd5e1; font-weight: 700; font-size: 14px; }
          #plannerPinOverlay input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #334155; background: #020617;
            color: #f8fafc; font-size: 18px; margin-bottom: 12px; }
          #plannerPinOverlay button { width: 100%; padding: 12px; border: none; border-radius: 10px; background: #38bdf8; color: #00111f;
            font-weight: 800; font-size: 16px; cursor: pointer; }
          #plannerPinOverlay button:disabled { opacity: 0.6; cursor: wait; }
          #plannerPinOverlay .pin-message { min-height: 22px; margin: 12px 0 0; font-weight: 700; color: #f87171; }
        </style>
        <form class="pin-box">
          <h2>Production Planner</h2>
          <p>Management screen. Enter the management PIN to continue.</p>
          <p class="pin-note" hidden></p>
          <label for="plannerPinInput">Management PIN</label>
          <input id="plannerPinInput" type="password" autocomplete="off" required />
          <button type="submit">Unlock</button>
          <p class="pin-message" role="status"></p>
        </form>`;
      document.body.appendChild(overlay);
    }

    const form = overlay.querySelector("form");
    const input = overlay.querySelector("input");
    const button = overlay.querySelector("button");
    const message = overlay.querySelector(".pin-message");
    const noteElement = overlay.querySelector(".pin-note");
    noteElement.textContent = note || "";
    noteElement.hidden = !note;
    overlay.hidden = false;
    input.focus();

    form.onsubmit = async event => {
      event.preventDefault();
      button.disabled = true;
      message.textContent = "Checking…";
      try {
        const role = await unlockWithPin(input.value.trim());
        if (role === "management") {
          input.value = "";
          message.textContent = "";
          overlay.hidden = true;
          resolve();
        } else if (role === "bench") {
          message.textContent = "That's the bench PIN. This screen needs the management PIN.";
        } else {
          message.textContent = "That PIN isn't right.";
        }
      } catch (error) {
        message.textContent = friendlyError(error);
      } finally {
        button.disabled = false;
      }
    };
  });
}

async function ensureManagement() {
  await firstAuthState();
  let role = null;
  try {
    role = await currentRole();
  } catch (error) {
    await showPinScreen(friendlyError(error));
    return;
  }
  if (role === "management") return;
  const notes = {
    bench: "This screen is unlocked for a bench. Enter the management PIN to plan.",
    changed: "The management PIN has changed. Enter the new one."
  };
  await showPinScreen(notes[role] || "");
}

// ---------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------
function withoutTimestamps(data) {
  const { createdAt, updatedAt, ...rest } = data;
  return rest;
}

async function loadReferenceData() {
  const [staff, presets] = await Promise.all([
    getDocs(collection(db, "staff")),
    getDocs(collection(db, "configPresets"))
  ]);
  return {
    staff: staff.docs.map(entry => ({ key: entry.id, ...withoutTimestamps(entry.data()) })),
    presets: presets.docs.map(entry => ({ key: entry.id, ...withoutTimestamps(entry.data()) }))
  };
}

async function saveStaff(workers) {
  const existing = await getDocs(collection(db, "staff"));
  const keep = new Set(workers.map(worker => worker.key));
  const batch = writeBatch(db);
  workers.forEach(worker => {
    batch.set(doc(db, "staff", worker.key), {
      name: worker.name,
      firstName: worker.first,
      team: worker.team,
      priorityRank: Number(worker.priorityRank) || 50,
      preferredBenches: worker.preferredBenches || "",
      restrictedBenches: worker.restrictedBenches || "",
      rosterRow: Number.isInteger(worker.rosterIndex) ? worker.rosterIndex : null,
      active: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
  existing.docs.forEach(entry => {
    if (!keep.has(entry.id)) batch.delete(entry.ref);
  });
  await batch.commit();
}

// ---------------------------------------------------------------------
// Daily plans
// ---------------------------------------------------------------------
async function loadDay(date) {
  const [plan, roster] = await Promise.all([
    getDoc(doc(db, "plans", date)),
    getDoc(doc(db, "rosters", date))
  ]);
  return {
    plan: plan.exists() ? plan.data() : null,
    roster: roster.exists() ? roster.data() : null
  };
}

async function saveDraft(date, plan, roster) {
  const batch = writeBatch(db);
  batch.set(doc(db, "plans", date), {
    ...plan,
    status: "draft",
    plannedTarget: null,
    currentTarget: null,
    releasedAt: null,
    releasedBy: null,
    updatedAt: serverTimestamp(),
    updatedBy: ACTOR
  });
  batch.set(doc(db, "rosters", date), { ...roster, updatedAt: serverTimestamp(), updatedBy: ACTOR });
  await batch.commit();
}

async function releasePlan(date, plan, roster, assignments, target) {
  const previous = await getDocs(collection(db, "plans", date, "assignments"));
  const batch = writeBatch(db);

  batch.set(doc(db, "plans", date), {
    ...plan,
    status: "released",
    plannedTarget: target,
    currentTarget: target,
    releasedAt: serverTimestamp(),
    releasedBy: ACTOR,
    updatedAt: serverTimestamp(),
    updatedBy: ACTOR
  });
  batch.set(doc(db, "rosters", date), { ...roster, updatedAt: serverTimestamp(), updatedBy: ACTOR });

  // Remove assignments that aren't in the new plan; the rest are overwritten.
  const newIds = new Set(assignments.map(assignment => `${assignment.phase}_${assignment.staffKey}`));
  previous.docs.forEach(entry => {
    if (!newIds.has(entry.id)) batch.delete(entry.ref);
  });
  assignments.forEach(assignment => {
    batch.set(doc(db, "plans", date, "assignments", `${assignment.phase}_${assignment.staffKey}`), {
      ...assignment,
      updatedBy: ACTOR,
      updatedAt: serverTimestamp()
    });
  });

  batch.set(doc(collection(db, "plans", date, "events")), {
    bench: "management",
    kind: "released",
    message: `Plan released with a target of ${target} units.`,
    targetAfter: target,
    createdBy: ACTOR,
    createdAt: serverTimestamp()
  });

  await batch.commit();
}

async function lockScreen() {
  try {
    if (auth.currentUser) await deleteDoc(doc(db, "devices", auth.currentUser.uid));
  } catch {
    // Signing out still locks this screen.
  }
  await signOut(auth);
}

// ---------------------------------------------------------------------
window.plannerData = {
  async start() {
    await ensureManagement();
    return loadReferenceData();
  },
  saveStaff,
  loadDay,
  saveDraft,
  releasePlan,
  lockScreen,
  friendlyError
};
window.dispatchEvent(new Event("plannerdata-ready"));
