// Production Planner — shared Firebase connection and PIN sign-in.
// Used by the Management screen (planner-data.js) and the bench screens.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  serverTimestamp, query, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

const PIN_PATTERN = /^[A-Za-z0-9 _-]{6,64}$/;

export function friendlyError(error) {
  const messages = {
    "auth/operation-not-allowed": "Anonymous sign-in is turned off in Firebase.",
    "auth/admin-restricted-operation": "Anonymous sign-in is turned off in Firebase.",
    "auth/network-request-failed": "Firebase can't be reached. Check the internet connection.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "permission-denied": "The database refused this. The PIN may have changed.",
    "unavailable": "The database can't be reached. Check the internet connection."
  };
  return messages[error?.code] || error?.message || "Something went wrong.";
}

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

// PIN screen drawn over the page until a PIN with an allowed role is entered.
function showPinScreen({ title, intro, pinLabel, allowed, wrongRoleMessage, note }) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.id = "plannerPinOverlay";
    overlay.innerHTML = `
      <style>
        #plannerPinOverlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center;
          padding: 24px; background: rgba(2, 6, 23, 0.95); font-family: Arial, Helvetica, sans-serif; color: #f8fafc; }
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
        <h2></h2>
        <p class="pin-intro"></p>
        <p class="pin-note" hidden></p>
        <label for="plannerPinInput"></label>
        <input id="plannerPinInput" type="password" autocomplete="off" required />
        <button type="submit">Unlock</button>
        <p class="pin-message" role="status"></p>
      </form>`;
    overlay.querySelector("h2").textContent = title;
    overlay.querySelector(".pin-intro").textContent = intro;
    overlay.querySelector("label").textContent = pinLabel;
    const noteElement = overlay.querySelector(".pin-note");
    noteElement.textContent = note || "";
    noteElement.hidden = !note;
    document.body.appendChild(overlay);

    const form = overlay.querySelector("form");
    const input = overlay.querySelector("input");
    const button = overlay.querySelector("button");
    const message = overlay.querySelector(".pin-message");
    input.focus();

    form.onsubmit = async event => {
      event.preventDefault();
      button.disabled = true;
      message.textContent = "Checking…";
      try {
        const role = await unlockWithPin(input.value.trim());
        if (role && allowed.includes(role)) {
          overlay.remove();
          resolve(role);
        } else if (role) {
          message.textContent = wrongRoleMessage;
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

// Resolves with the screen's role once it holds a PIN with an allowed role.
export async function ensureAccess(options) {
  await firstAuthState();
  let role = null;
  let note = "";
  try {
    role = await currentRole();
  } catch (error) {
    note = friendlyError(error);
  }
  if (role && options.allowed.includes(role)) return role;
  if (role === "changed") note = "The PIN has changed. Enter the new one.";
  else if (role) note = options.wrongRoleMessage;
  return showPinScreen({ ...options, note: note || options.note });
}

export async function lockScreen() {
  try {
    if (auth.currentUser) await deleteDoc(doc(db, "devices", auth.currentUser.uid));
  } catch {
    // Signing out still locks this screen.
  }
  await signOut(auth);
}
