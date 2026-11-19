// Production Planner — shared Firebase connection and PIN sign-in.
// Used by the Management screen (planner-data.js) and the bench screens.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signInAnonymously, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  serverTimestamp, query, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Practice mode (developers only). On this computer (localhost), opening any
// screen with ?practice=1 switches the app to the local practice database
// (the Firebase emulator, see `npm run practice`) with made-up PINs; ?practice=0
// switches back. It can never apply on the live website.
export const PRACTICE = (() => {
  if (!["localhost", "127.0.0.1"].includes(location.hostname)) return false;
  const choice = new URLSearchParams(location.search).get("practice");
  try {
    if (choice === "1") localStorage.setItem("practiceDatabase", "1");
    if (choice === "0") localStorage.removeItem("practiceDatabase");
    return localStorage.getItem("practiceDatabase") === "1";
  } catch {
    return choice === "1";
  }
})();

export const app = PRACTICE
  ? initializeApp({ ...firebaseConfig, projectId: "demo-production-planner" }, "practice")
  : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

if (PRACTICE) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const banner = document.createElement("div");
  banner.textContent = "PRACTICE DATABASE: local test data, not the live app";
  banner.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:4px;" +
    "background:#a16207;color:#fff;font:800 13px system-ui,sans-serif;text-align:center;pointer-events:none;";
  document.body.appendChild(banner);
}

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
          padding: 24px; color: #0f2747; font-family: "Barlow", "Segoe UI", system-ui, sans-serif;
          background-color: #173f6e;
          background-image: linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 80px 80px, 80px 80px, 16px 16px, 16px 16px; }
        #plannerPinOverlay .pin-box { width: min(420px, 100%); background: #f9fbfd; border: 1px solid #0f2f55;
          border-radius: 3px; padding: 22px 22px 18px; box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.6); }
        #plannerPinOverlay h2 { margin: 0 0 6px; font-family: "Barlow Condensed", "Barlow", sans-serif; font-weight: 600; font-size: 26px;
          letter-spacing: 0.05em; text-transform: uppercase; }
        #plannerPinOverlay p { margin: 0 0 14px; color: #4f6785; line-height: 1.45; }
        #plannerPinOverlay .pin-note { color: #93570a; font-weight: 600; }
        #plannerPinOverlay label { display: block; margin-bottom: 6px; color: #2c4a6e; font-family: "Barlow Condensed", "Barlow", sans-serif;
          font-weight: 600; font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; }
        #plannerPinOverlay input { width: 100%; padding: 12px; border-radius: 3px; border: 1px solid #8ea4bf; background: #ffffff;
          color: #0f2747; font-size: 20px; letter-spacing: 0.2em; margin-bottom: 12px; font-family: inherit; }
        #plannerPinOverlay input:focus { outline: 2px solid #dde9f7; border-color: #1d5fae; }
        #plannerPinOverlay button { width: 100%; min-height: 46px; padding: 12px; border: 1px solid #0f2f55; border-radius: 3px; background: #173f6e;
          color: #f4f8fc; font-family: inherit; font-weight: 600; font-size: 17px; cursor: pointer; }
        #plannerPinOverlay button:hover { background: #1f4f88; }
        #plannerPinOverlay button:disabled { opacity: 0.6; cursor: wait; }
        #plannerPinOverlay .pin-message { min-height: 22px; margin: 12px 0 0; font-weight: 600; color: #b9381a; }
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
    overlay.querySelector(".pin-intro").remove();
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
