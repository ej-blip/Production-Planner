// Production Planner — the lists every choice in the app comes from.
//
//   lists/{name} = { items: [{ key, label, active, … }] }
//     units       unit types       + planAs "gen4" | "tap", rates (build speeds),
//                                    usesComms / usesConnector / usesConfig
//                                    (false for a standalone unit like Solar:
//                                    no network, SIM, connector or colour)
//     customers   customers
//     connectors  connectors
//     comms       comms types      + colourHex, planAs "verizon" | "global",
//                                    testingMinutes (older: testingPerDay)
//   lists/blocks = { start, second, finish }   minutes of work in each block
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

/* Build speeds, edited on the Rates tab: minutes one person takes for
   one unit of each task (rates.minutes on a unit item). A bench does its
   people × the block's minutes (lists/blocks) ÷ that, rounded down.
     subAssembly     one set for the next day's build (PSU + DCU for Gen4 /
                     Tap, chargers for Solar)
     assembly        one unit (only with Sub Assembly on)
     testing         one unit (standalone units like Solar)
     hardwareVerizon one unit through Hardware Check
     hardwareGlobal  the same for Global units
     packagingBuild  one box
     packing         one unit (null until set: it doesn't limit the target)
   spareToPackaging true: time Sub Assembly has left after tomorrow's parts
   goes to Packaging build-up (Solar). Each comms type has testingMinutes:
   one unit through its test rig, running through the 1st and 2nd blocks.
   A unit or comms type without its own figures uses the ones of the type
   it plans as.

   Older items hold units per 2-hour block instead, for one person or, for
   Hardware Check, Packaging build-up and Packing, for teams of 1, 2, 3, 4+
   (or a team's minutes per unit); and testingPerDay. Until a unit is saved
   with one value per task these are read as one person's minutes: 120 ÷
   the figure, the 2-person team's figure where there is one (2 × 120 ÷ it),
   and 270 ÷ the day's testing. */
export const RATE_PEOPLE = 4;
export const BLOCK_KEYS = ["start", "second", "finish"];
export const STARTING_BLOCK_MINUTES = { start: 120, second: 150, finish: 120 };
export const BASE_MINUTES = 120;          // what the older per-block figures were for
export const TESTING_DAY_MINUTES = 270;   // what the older per-day testing figures were for
export const STARTING_UNIT_RATES = {
  gen4: { subAssembly: 13, assembly: 6, hardwareVerizon: [0, 24, 30, 36], hardwareGlobal: [0, 24, 30, 36], packagingBuild: [0, 30, 36, 36] },
  tap: { subAssembly: 13, assembly: 8, hardwareVerizon: [0, 36, 42, 50], hardwareGlobal: [0, 30, 36, 42], packagingBuild: [0, 50, 50, 50] }
};
export const STARTING_TESTING_PER_DAY = { verizon: 36, global: 30 };

const copy = value => JSON.parse(JSON.stringify(value));

let current = copy(STARTING_LISTS);
let savedNames = new Set();
let loaded = false;
let blockTimes = { ...STARTING_BLOCK_MINUTES };

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
export const commsLabel = thing => (usesComms(thing) ? labelOf("comms", commsKeyOf(thing)) : "");
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

// ---------------------------------------------------------------------
// Block lengths and build speeds
// ---------------------------------------------------------------------
const wholeNumber = value => Math.max(0, Math.min(9999, Math.round(Number(value) || 0)));
const minutesNumber = value => {
  const number = Number(value);
  return value !== null && value !== "" && Number.isFinite(number) && number > 0 ? Math.min(number, 9999) : null;
};
const fromPerBlock = (value, base = BASE_MINUTES) => {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) && number > 0 ? base / number : null;
};
// Whole units done in some minutes (the small allowance keeps 120 ÷ (120 ÷ 13) at 13).
const unitsIn = (minutes, perUnit) => (perUnit ? Math.floor(minutes / perUnit + 0.001) : 0);

// Minutes of work in a block ("start", "second", "finish"), or a number of
// minutes passed straight through. Anything else is an old 2-hour block.
export function blockMinutes(block) {
  if (typeof block === "number" && block > 0) return block;
  const value = Number(blockTimes[block]);
  return value > 0 ? value : BASE_MINUTES;
}
export const blockTimesNow = () => ({ ...blockTimes });

function ownRates(unitKey) {
  const item = find("units", unitKey);
  if (item?.rates) return item.rates;
  // A standalone unit (Solar) borrows nothing from Gen4 / Tap's saved speeds.
  if (item && item.usesComms === false) return {};
  return find("units", unitPlanAs(unitKey))?.rates || {};
}

// One person's minutes from a team table: units per block (perBlock) or
// the team's minutes per unit, for teams of 1, 2, 3, 4+. The 2-person
// figure first (the usual crew), then 1, 3, 4.
function personMinutesFromTable(table, perBlock) {
  if (!Array.isArray(table)) return null;
  for (const index of [1, 0, 2, 3]) {
    const people = index + 1;
    const value = perBlock ? fromPerBlock(table[index], BASE_MINUTES * people) : minutesNumber(table[index]);
    if (value) return perBlock ? value : value * people;
  }
  return null;
}

// Minutes one person takes for one unit of each task, for a unit type
// (its own figures, or its plan-as type's). null: not set.
export function unitMinutes(unitKey) {
  const base = STARTING_UNIT_RATES[unitPlanAs(unitKey)];
  const own = ownRates(unitKey);
  const saved = own.minutes && typeof own.minutes === "object" ? own.minutes : {};
  const single = (field, fallback) => {
    if (field in saved) return minutesNumber(saved[field]);
    if (own[field] !== undefined && own[field] !== null) return fromPerBlock(own[field]);
    return fromPerBlock(fallback);
  };
  const team = (field, fallback) => {
    if (field in saved) return Array.isArray(saved[field]) ? personMinutesFromTable(saved[field], false) : minutesNumber(saved[field]);
    const old = Array.isArray(own[field]) && own[field].some(value => value !== null && value !== undefined && value !== "") ? own[field] : null;
    return personMinutesFromTable(old || fallback, true);
  };
  return {
    subAssembly: single("subAssembly", base.subAssembly),
    assembly: single("assembly", base.assembly),
    testing: single("testing", null),
    hardwareVerizon: team("hardwareVerizon", base.hardwareVerizon),
    hardwareGlobal: team("hardwareGlobal", base.hardwareGlobal),
    packagingBuild: team("packagingBuild", base.packagingBuild),
    packing: team("packing", null),
    spareToPackaging: own.spareToPackaging === true
  };
}

// What a bench does in a block (default: a 2-hour block) with 1, 2, 3, 4
// people (subAssembly and assembly: one person).
export function unitRates(unitKey, block) {
  const minutes = unitMinutes(unitKey);
  const length = blockMinutes(block);
  const table = perUnit => Array.from({ length: RATE_PEOPLE }, (_, index) => unitsIn((index + 1) * length, perUnit));
  return {
    subAssembly: unitsIn(length, minutes.subAssembly),
    assembly: unitsIn(length, minutes.assembly),
    hardwareVerizon: table(minutes.hardwareVerizon),
    hardwareGlobal: table(minutes.hardwareGlobal),
    packagingBuild: table(minutes.packagingBuild),
    spareToPackaging: minutes.spareToPackaging,
    packing: minutes.packing ? table(minutes.packing) : Array(RATE_PEOPLE).fill(null)
  };
}

// Units some people do in a block at one person's minutes per unit.
const benchUnits = (people, block, perUnit) => (people > 0 ? unitsIn(people * blockMinutes(block), perUnit) : 0);

export const assemblyRate = (unitKey, block) => benchUnits(1, block, unitMinutes(unitKey).assembly);
export const subAssemblyRate = (unitKey, block) => benchUnits(1, block, unitMinutes(unitKey).subAssembly);
export const spareToPackaging = unitKey => unitMinutes(unitKey).spareToPackaging;

export function hardwareRate(people, unitKey, commsKey, block) {
  const minutes = unitMinutes(unitKey);
  return benchUnits(people, block, commsPlanAs(commsKey) === "global" ? minutes.hardwareGlobal : minutes.hardwareVerizon);
}

export const packagingBuildRate = (people, unitKey, block) => benchUnits(people, block, unitMinutes(unitKey).packagingBuild);

// Units Packing can pack in a block, or null while no Packing speed is set.
export function packingRate(people, unitKey, block) {
  const perUnit = unitMinutes(unitKey).packing;
  return perUnit ? benchUnits(people, block, perUnit) : null;
}

// Minutes for one unit through a comms type's test rig.
export function testingMinutes(commsKey) {
  const fromItem = item => {
    if (!item) return null;
    const own = minutesNumber(item.testingMinutes);
    if (own) return own;
    return fromPerBlock(item.testingPerDay, TESTING_DAY_MINUTES);
  };
  return fromItem(find("comms", commsKey))
    ?? fromItem(find("comms", commsPlanAs(commsKey)))
    ?? TESTING_DAY_MINUTES / STARTING_TESTING_PER_DAY[commsPlanAs(commsKey)];
}

// Units a comms type's Testing does in a block. The rig runs on from the
// 1st block into the 2nd, so the 2nd gets what the two blocks together
// make beyond the 1st.
export function testingInBlock(commsKey, block) {
  const perUnit = testingMinutes(commsKey);
  if (block === "second") {
    const first = blockMinutes("start");
    return unitsIn(first + blockMinutes("second"), perUnit) - unitsIn(first, perUnit);
  }
  return unitsIn(blockMinutes(block), perUnit);
}

// Units Testing can do in a day: the 1st and 2nd blocks (never 0, so
// shares can be worked out).
export function testingPerDay(commsKey) {
  return Math.max(1, unitsIn(blockMinutes("start") + blockMinutes("second"), testingMinutes(commsKey)));
}

// The fewest people that reach a table's best figure; more add nothing.
export function usefulPeople(table) {
  const best = Math.max(...table);
  return best <= 0 ? 0 : table.findIndex(value => value >= best) + 1;
}

// ---------------------------------------------------------------------
// What a unit type uses. A standalone unit (Solar) has no network or SIM,
// connector or configuration colour; those fields don't show for it, and
// it plans as a product of its own (its own Assembly and Testing stations).
// Gen4 and Tap always use all three.
// ---------------------------------------------------------------------
export function unitUses(unitKey, field) {
  if (UNIT_PLANS.includes(unitKey)) return true;
  return find("units", unitKey)?.[field] !== false;
}

export const usesComms = thing => unitUses(unitKeyOf(thing), "usesComms");

// Units one tester tests in a block (standalone units only).
export const testingRate = (unitKey, block) => benchUnits(1, block, unitMinutes(unitKey).testing);

// Most a standalone unit can be built in a day (null: no limit set).
export function unitDailyLimit(unitKey) {
  const value = ownRates(unitKey).dailyLimit;
  return value === undefined || value === null || value === "" ? null : wholeNumber(value);
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
      const times = { ...STARTING_BLOCK_MINUTES };
      snapshot.docs.forEach(entry => {
        if (entry.id === "blocks") {
          BLOCK_KEYS.forEach(key => {
            const value = minutesNumber(entry.data()[key]);
            if (value) times[key] = value;
          });
          return;
        }
        const list = entry.data().items;
        if (!LIST_NAMES.includes(entry.id) || !Array.isArray(list)) return;
        next[entry.id] = list.filter(item => item && typeof item.key === "string" && item.key);
        names.add(entry.id);
      });
      current = next;
      savedNames = names;
      blockTimes = times;
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
  if (item.rates) out.rates = item.rates;
  if (item.testingPerDay !== undefined && item.testingPerDay !== null) out.testingPerDay = wholeNumber(item.testingPerDay);
  if (minutesNumber(item.testingMinutes)) out.testingMinutes = roundMinutes(item.testingMinutes);
  ["usesComms", "usesConnector", "usesConfig"].forEach(field => {
    if (item[field] === false) out[field] = false;
  });
  return out;
};

// Minutes kept to 6 decimal places (enough for 120 ÷ 13 to stay 13).
export const roundMinutes = value => Math.round(Number(value) * 1e6) / 1e6;

// Saves the block lengths (minutes of work in the 1st, 2nd and 3rd block).
export async function saveBlockMinutes(times, actor = "Management") {
  const next = { ...blockTimes };
  BLOCK_KEYS.forEach(key => {
    const value = minutesNumber(times?.[key]);
    if (value) next[key] = Math.min(600, Math.max(15, Math.round(value)));
  });
  await setDoc(doc(db, "lists", "blocks"), { ...next, updatedAt: serverTimestamp(), updatedBy: actor });
}

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
