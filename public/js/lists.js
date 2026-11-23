// Production Planner — the lists every choice in the app comes from.
//
//   lists/{name} = { items: [{ key, label, active, … }] }
//     units       unit types       + planAs "gen4" | "tap"
//     customers   customers
//     connectors  connectors
//     comms       comms types      + colourHex, planAs "verizon" | "global"
//     sims        SIM types        + comms (the comms key it belongs to)
//   configPresets/{key}            configuration colours (label, colourHex,
//                                  sensorCable, sensors, powerCable,
//                                  sortOrder, active)
//
// Edited on lists.html; every screen reads them live. A key never changes
// once made, so a renamed or retired item still shows on older orders and
// job cards. "planAs" is the built-in product whose planning speeds an item
// uses: orders and job cards keep that in unitType / commsType (what the
// planner reads) and the item itself in unitKey / commsKey (what is shown).
// Until a list is first saved online, the starting values below are used.
import {
  collection, doc, onSnapshot, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./session.js";

export const LIST_NAMES = ["units", "customers", "connectors", "comms", "sims"];
export const UNIT_PLANS = ["gen4", "tap"];
export const COMMS_PLANS = ["verizon", "global"];

export const STARTING_LISTS = {
  units: [
    { key: "gen4", label: "Gen4", planAs: "gen4", active: true },
    { key: "tap", label: "Tap", planAs: "tap", active: true }
  ],
  customers: [
    { key: "stock", label: "Stock", active: true }
  ],
  connectors: [
    { key: "2-pin-plastic", label: "2-Pin Plastic", active: true },
    { key: "2-pin-metal-bulgin", label: "2-Pin Metal Bulgin", active: true },
    { key: "cable-gland", label: "Cable Gland", active: true }
  ],
  comms: [
    { key: "verizon", label: "Verizon", colourHex: "#b8262c", planAs: "verizon", active: true },
    { key: "global", label: "Global", colourHex: "#1b7643", planAs: "global", active: true }
  ],
  sims: [
    { key: "verizon", label: "Verizon", comms: "verizon", active: true },
    { key: "att", label: "AT&T", comms: "global", active: true },
    { key: "fusion-na", label: "Fusion NA", comms: "global", active: true },
    { key: "telstra", label: "Telstra", comms: "global", active: true }
  ]
};

const copy = value => JSON.parse(JSON.stringify(value));

let current = copy(STARTING_LISTS);
let savedNames = new Set();
let loaded = false;

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------
export const isLoaded = () => loaded;
export const isSaved = name => savedNames.has(name);

export function items(name, { withRetired = false } = {}) {
  const list = current[name] || [];
  return withRetired ? list : list.filter(item => item.active !== false);
}

export function find(name, key) {
  if (!key) return null;
  return (current[name] || []).find(item => item.key === key)
    || (STARTING_LISTS[name] || []).find(item => item.key === key)
    || null;
}

export const labelOf = (name, key) => find(name, key)?.label || key || "";

export const unitKeyOf = thing => thing?.unitKey || thing?.unitType || "gen4";
export const commsKeyOf = thing => thing?.commsKey || thing?.commsType || "verizon";
export const unitLabel = thing => labelOf("units", unitKeyOf(thing));
export const commsLabel = thing => labelOf("comms", commsKeyOf(thing));
export const simLabel = key => labelOf("sims", key);
export const commsColour = thing => find("comms", commsKeyOf(thing))?.colourHex || "";

export function unitPlanAs(key) {
  const plan = find("units", key)?.planAs;
  if (UNIT_PLANS.includes(plan)) return plan;
  return key === "tap" ? "tap" : "gen4";
}

export function commsPlanAs(key) {
  const plan = find("comms", key)?.planAs;
  if (COMMS_PLANS.includes(plan)) return plan;
  return key === "global" ? "global" : "verizon";
}

// SIM types for a comms type. A SIM key still on the list (even retired)
// stays; otherwise the first active SIM for that comms type, or "".
export function simsFor(commsKey, options) {
  return items("sims", options).filter(sim => sim.comms === commsKey);
}

export function simFor(commsKey, simKey) {
  if (simsFor(commsKey, { withRetired: true }).some(sim => sim.key === simKey)) return simKey;
  return simsFor(commsKey)[0]?.key || "";
}

// A new key from a name, not clashing with any key already on the list.
export function makeKey(label, takenKeys) {
  const base = String(label || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "item";
  const taken = new Set(takenKeys);
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
  return key;
}

// Ink or white text, whichever reads better on a fill colour.
export function textOn(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!match) return "#ffffff";
  const value = parseInt(match[1], 16);
  const channel = shift => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.36 ? "#0f2747" : "#ffffff";
}

// ---------------------------------------------------------------------
// Watching: one live connection per page, shared by every caller
// ---------------------------------------------------------------------
const listeners = new Set();
let stopWatching = null;

export function watchLists(onChange) {
  listeners.add(onChange);
  if (loaded) onChange(current);
  if (!stopWatching) {
    stopWatching = onSnapshot(collection(db, "lists"), snapshot => {
      const next = copy(STARTING_LISTS);
      const names = new Set();
      snapshot.docs.forEach(entry => {
        const list = entry.data().items;
        if (!LIST_NAMES.includes(entry.id) || !Array.isArray(list)) return;
        next[entry.id] = list.filter(item => item && typeof item.key === "string" && item.key);
        names.add(entry.id);
      });
      current = next;
      savedNames = names;
      loaded = true;
      listeners.forEach(listener => listener(current));
    }, () => {
      loaded = true;
      listeners.forEach(listener => listener(current));
    });
  }
  return () => listeners.delete(onChange);
}

// Resolves once the lists have loaded (or failed to), so a screen can
// read saved orders and plans with the right unit and comms types.
export function whenLoaded() {
  if (loaded) return Promise.resolve(current);
  return new Promise(resolve => {
    const stop = watchLists(lists => {
      stop();
      resolve(lists);
    });
  });
}

// ---------------------------------------------------------------------
// Writing (management only)
// ---------------------------------------------------------------------
const clean = item => {
  const out = { key: String(item.key), label: String(item.label || "").trim().slice(0, 80), active: item.active !== false };
  if (item.planAs) out.planAs = item.planAs;
  if (item.colourHex) out.colourHex = item.colourHex;
  if (item.comms) out.comms = item.comms;
  return out;
};

export async function saveList(name, list, actor = "Management") {
  if (!LIST_NAMES.includes(name)) throw new Error(`Unknown list: ${name}`);
  await setDoc(doc(db, "lists", name), {
    items: list.map(clean),
    updatedAt: serverTimestamp(),
    updatedBy: actor
  });
}

// Adds a name to a list unless it is already there (any case). A retired
// match comes back. Returns the item's key.
export async function addName(name, label, actor) {
  const text = String(label || "").trim();
  if (!text) return "";
  const list = items(name, { withRetired: true });
  const match = list.find(item => item.label.trim().toLowerCase() === text.toLowerCase());
  if (match && match.active !== false) return match.key;
  const next = match
    ? list.map(item => (item === match ? { ...item, active: true } : item))
    : [...list, { key: makeKey(text, list.map(item => item.key)), label: text, active: true }];
  await saveList(name, next, actor);
  return match ? match.key : next[next.length - 1].key;
}
