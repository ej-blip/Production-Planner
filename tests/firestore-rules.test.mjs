// Firestore security-rule tests.
//
// Runs against a local practice database (the Firebase emulator), never the
// live one, using made-up PINs. Run with:   npm run test:rules
//
// Each test starts from the same fresh data (see seed()) and acts as one of:
//   management  – a screen signed in with the management PIN
//   bench       – a screen signed in with the bench PIN
//   stranger    – signed in, but never entered a PIN
//   revoked     – entered a bench PIN that has since been changed
//   spoofed     – device record claims management but holds the bench PIN
//   nobody      – not signed in at all
//
// The writes below copy what the real screens send (bench.html,
// planner-data.js, session.js, setup.html), so a pass here means those
// screens will be allowed to do their job.

import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  writeBatch
} from "firebase/firestore";

const BENCH_PIN = "test-bench-pin";
const MANAGEMENT_PIN = "test-management-pin";
const RELEASED = "2099-01-05";
const DRAFT = "2099-01-06";
const MISSING = "2099-01-07";

let env;

before(async () => {
  setLogLevel("silent"); // "permission denied" is expected in half the tests
  env = await initializeTestEnvironment({
    projectId: "demo-production-planner",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") }
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

async function seed() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const now = Timestamp.now();
    const writes = [
      ["pins", BENCH_PIN, { role: "bench", updatedAt: now }],
      ["pins", MANAGEMENT_PIN, { role: "management", updatedAt: now }],
      ["devices", "management-screen", { role: "management", pin: MANAGEMENT_PIN, createdAt: now }],
      ["devices", "bench-screen", { role: "bench", pin: BENCH_PIN, createdAt: now }],
      ["devices", "revoked-screen", { role: "bench", pin: "old-bench-pin", createdAt: now }],
      ["devices", "spoofed-screen", { role: "management", pin: BENCH_PIN, createdAt: now }],
      ["staff", "ethan", { name: "Ethan", firstName: "Ethan", team: "B", active: true }],
      ["configPresets", "blue", { label: "Blue", colourHex: "#2563eb", active: true }],
      ["rosters", RELEASED, { people: { ethan: { available: true } } }],
      ["plans", RELEASED, { status: "released", plannedTarget: 30, currentTarget: 30, benchLimits: {}, batches: [] }],
      ["plans", DRAFT, { status: "draft", plannedTarget: null, currentTarget: null, benchLimits: {}, batches: [] }],
      [`plans/${RELEASED}/assignments`, "start_ethan", { phase: "start", station: "verizonTest", staffKey: "ethan", updatedAt: now }],
      [`plans/${RELEASED}/events`, "first", { bench: "management", kind: "released", createdAt: now }],
      [`plans/${DRAFT}/assignments`, "start_ethan", { phase: "start", station: "verizonTest", staffKey: "ethan", updatedAt: now }],
      [`plans/${DRAFT}/events`, "first", { bench: "management", kind: "note", createdAt: now }]
    ];
    for (const [path, id, data] of writes) await setDoc(doc(db, path, id), data);
  });
}

const as = uid => env.authenticatedContext(uid).firestore();
const management = () => as("management-screen");
const bench = () => as("bench-screen");
const stranger = () => as("stranger-screen");
const revoked = () => as("revoked-screen");
const spoofed = () => as("spoofed-screen");
const nobody = () => env.unauthenticatedContext().firestore();

// What bench.html writes when someone is moved onto a job.
const benchAssignment = (phase, staffKey, station = "globalTest") => ({
  phase,
  station,
  jobLabel: "Global testing",
  staffKey,
  source: "bench",
  updatedBy: "testing",
  updatedAt: serverTimestamp()
});

// What bench.html writes when the day target changes.
const benchTargetChange = (target, limitNow = target) => ({
  currentTarget: target,
  "benchLimits.testing": limitNow,
  updatedAt: serverTimestamp(),
  updatedBy: "testing"
});

const benchEvent = fields => ({
  bench: "testing",
  createdBy: "testing",
  createdAt: serverTimestamp(),
  ...fields
});

// ---------------------------------------------------------------------
describe("Entering a PIN", () => {
  it("a screen can sign in with the bench PIN", async () => {
    await assertSucceeds(setDoc(doc(as("new-screen"), "devices", "new-screen"),
      { role: "bench", pin: BENCH_PIN, createdAt: serverTimestamp() }));
  });

  it("a screen can sign in with the management PIN", async () => {
    await assertSucceeds(setDoc(doc(as("new-screen"), "devices", "new-screen"),
      { role: "management", pin: MANAGEMENT_PIN, createdAt: serverTimestamp() }));
  });

  it("the bench PIN can't be used to claim management", async () => {
    await assertFails(setDoc(doc(as("new-screen"), "devices", "new-screen"),
      { role: "management", pin: BENCH_PIN, createdAt: serverTimestamp() }));
  });

  it("a wrong PIN is rejected", async () => {
    await assertFails(setDoc(doc(as("new-screen"), "devices", "new-screen"),
      { role: "bench", pin: "guess-123", createdAt: serverTimestamp() }));
  });

  it("a PIN that breaks the format is rejected", async () => {
    await assertFails(setDoc(doc(as("new-screen"), "devices", "new-screen"),
      { role: "bench", pin: "../x", createdAt: serverTimestamp() }));
  });

  it("extra fields on the device record are rejected", async () => {
    await assertFails(setDoc(doc(as("new-screen"), "devices", "new-screen"),
      { role: "bench", pin: BENCH_PIN, createdAt: serverTimestamp(), admin: true }));
  });

  it("a screen can't write another screen's record", async () => {
    await assertFails(setDoc(doc(as("new-screen"), "devices", "bench-screen"),
      { role: "bench", pin: BENCH_PIN, createdAt: serverTimestamp() }));
  });

  it("a screen that isn't signed in can't enter a PIN", async () => {
    await assertFails(setDoc(doc(nobody(), "devices", "new-screen"),
      { role: "bench", pin: BENCH_PIN, createdAt: serverTimestamp() }));
  });

  it("a screen can read and remove its own record (Lock screen)", async () => {
    await assertSucceeds(getDoc(doc(bench(), "devices", "bench-screen")));
    await assertSucceeds(deleteDoc(doc(bench(), "devices", "bench-screen")));
  });

  it("a bench can't read another screen's record", async () => {
    await assertFails(getDoc(doc(bench(), "devices", "management-screen")));
  });
});

// ---------------------------------------------------------------------
describe("Management screen", () => {
  it("loads and saves staff and colours", async () => {
    const db = management();
    await assertSucceeds(getDocs(collection(db, "staff")));
    await assertSucceeds(getDocs(collection(db, "configPresets")));
    await assertSucceeds(setDoc(doc(db, "staff", "maged"), { name: "Maged", team: "C", active: true }));
    await assertSucceeds(deleteDoc(doc(db, "staff", "ethan")));
  });

  it("loads a draft plan and its roster", async () => {
    const db = management();
    await assertSucceeds(getDoc(doc(db, "plans", DRAFT)));
    await assertSucceeds(getDoc(doc(db, "plans", MISSING)));
    await assertSucceeds(getDoc(doc(db, "rosters", DRAFT)));
  });

  it("saves a draft (plan + roster in one batch)", async () => {
    const db = management();
    const batch = writeBatch(db);
    batch.set(doc(db, "plans", MISSING), {
      status: "draft", plannedTarget: null, currentTarget: null, benchLimits: {},
      releasedAt: null, releasedBy: null, updatedAt: serverTimestamp(), updatedBy: "management"
    });
    batch.set(doc(db, "rosters", MISSING), { people: {}, updatedAt: serverTimestamp(), updatedBy: "management" });
    await assertSucceeds(batch.commit());
  });

  it("releases a full day's plan in one batch (13 people)", async () => {
    const db = management();
    const staff = ["aarzoo", "ethan", "fares", "hansen", "jashan", "john", "jose",
      "juanita", "maged", "mark", "rajni", "ramesh", "rupesh"];
    await assertSucceeds(getDocs(collection(db, "plans", DRAFT, "assignments")));
    const batch = writeBatch(db);
    batch.set(doc(db, "plans", DRAFT), {
      status: "released", plannedTarget: 28, currentTarget: 28, benchLimits: {},
      releasedAt: serverTimestamp(), releasedBy: "management", updatedAt: serverTimestamp(), updatedBy: "management"
    });
    batch.set(doc(db, "rosters", DRAFT), { people: {}, updatedAt: serverTimestamp(), updatedBy: "management" });
    staff.forEach(key => batch.set(doc(db, "plans", DRAFT, "assignments", `start_${key}`), {
      phase: "start", station: "assembly", staffKey: key, updatedBy: "management", updatedAt: serverTimestamp()
    }));
    batch.set(doc(collection(db, "plans", DRAFT, "events")), {
      bench: "management", kind: "released", message: "Plan released with a target of 28 units.",
      targetAfter: 28, createdBy: "management", createdAt: serverTimestamp()
    });
    await assertSucceeds(batch.commit());
  });

  it("re-releasing removes people who dropped out of the plan", async () => {
    const db = management();
    const batch = writeBatch(db);
    batch.delete(doc(db, "plans", RELEASED, "assignments", "start_ethan"));
    batch.set(doc(db, "plans", RELEASED), { status: "released", plannedTarget: 25, currentTarget: 25, benchLimits: {} });
    await assertSucceeds(batch.commit());
  });

  it("watches the latest bench changes", async () => {
    await assertSucceeds(getDocs(query(collection(management(), "plans", RELEASED, "events"),
      orderBy("createdAt", "desc"), limit(20))));
  });

  it("can tidy up events and delete a plan", async () => {
    const db = management();
    await assertSucceeds(deleteDoc(doc(db, "plans", RELEASED, "events", "first")));
    await assertSucceeds(deleteDoc(doc(db, "plans", DRAFT)));
  });
});

// ---------------------------------------------------------------------
describe("Setup page (PINs)", () => {
  it("management can list the PINs", async () => {
    await assertSucceeds(getDocs(collection(management(), "pins")));
  });

  it("a bench PIN must be at least 6 characters", async () => {
    await assertSucceeds(setDoc(doc(management(), "pins", "bench6"), { role: "bench", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(management(), "pins", "b5555"), { role: "bench", updatedAt: serverTimestamp() }));
  });

  it("a management PIN must be at least 8 characters", async () => {
    await assertFails(setDoc(doc(management(), "pins", "mgmt777"), { role: "management", updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(management(), "pins", "mgmt8888"), { role: "management", updatedAt: serverTimestamp() }));
  });

  it("a PIN can only be 'bench' or 'management' with no extra fields", async () => {
    await assertFails(setDoc(doc(management(), "pins", "owner-pin-1"), { role: "owner", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(management(), "pins", "bench-pin-2"), { role: "bench", updatedAt: serverTimestamp(), note: "x" }));
  });

  it("changing the management PIN keeps this screen in and locks the others out", async () => {
    const db = management();
    const newPin = "new-management-pin";
    await assertSucceeds(setDoc(doc(db, "pins", newPin), { role: "management", updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, "devices", "management-screen"),
      { role: "management", pin: newPin, createdAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(db, "pins", MANAGEMENT_PIN)));

    // This screen still has management access.
    await assertSucceeds(getDocs(collection(management(), "pins")));

    // Another management screen still on the old PIN is locked out.
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "devices", "old-management-screen"),
        { role: "management", pin: MANAGEMENT_PIN, createdAt: Timestamp.now() });
    });
    await assertFails(getDocs(collection(as("old-management-screen"), "staff")));
  });

  it("changing the bench PIN locks every bench screen out", async () => {
    await assertSucceeds(deleteDoc(doc(management(), "pins", BENCH_PIN)));
    await assertFails(getDocs(collection(bench(), "staff")));
    await assertFails(getDoc(doc(bench(), "plans", RELEASED)));
  });

  it("loads the starter staff and colours", async () => {
    const db = management();
    const batch = writeBatch(db);
    batch.set(doc(db, "staff", "rupesh"), { name: "Rupesh", team: "C", active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    batch.set(doc(db, "configPresets", "green"), { label: "Green", notes: "", active: true, updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });
});

// ---------------------------------------------------------------------
describe("Bench screen – reading", () => {
  it("checks its PIN still works (one staff record)", async () => {
    await assertSucceeds(getDocs(query(collection(bench(), "staff"), limit(1))));
  });

  it("loads staff, colours and the roster", async () => {
    const db = bench();
    await assertSucceeds(getDocs(collection(db, "staff")));
    await assertSucceeds(getDocs(collection(db, "configPresets")));
    await assertSucceeds(getDoc(doc(db, "rosters", RELEASED)));
  });

  it("sees a released plan, its people and its changes", async () => {
    const db = bench();
    await assertSucceeds(getDoc(doc(db, "plans", RELEASED)));
    await assertSucceeds(getDocs(collection(db, "plans", RELEASED, "assignments")));
    await assertSucceeds(getDocs(query(collection(db, "plans", RELEASED, "events"),
      orderBy("createdAt", "desc"), limit(60))));
  });

  it("can't see a draft plan or its people", async () => {
    const db = bench();
    await assertFails(getDoc(doc(db, "plans", DRAFT)));
    await assertFails(getDocs(collection(db, "plans", DRAFT, "assignments")));
    await assertFails(getDocs(collection(db, "plans", DRAFT, "events")));
  });

  it("gets 'no access' for a day with no plan (screen shows 'not released yet')", async () => {
    await assertFails(getDoc(doc(bench(), "plans", MISSING)));
  });

  it("can't read the PINs", async () => {
    await assertFails(getDocs(collection(bench(), "pins")));
    await assertFails(getDoc(doc(bench(), "pins", BENCH_PIN)));
  });
});

// ---------------------------------------------------------------------
describe("Bench screen – moving people (released plan)", () => {
  it("moves someone to another job", async () => {
    await assertSucceeds(setDoc(doc(bench(), "plans", RELEASED, "assignments", "start_ethan"),
      benchAssignment("start", "ethan")));
  });

  it("adds someone who wasn't on Testing", async () => {
    await assertSucceeds(setDoc(doc(bench(), "plans", RELEASED, "assignments", "second_maged"),
      benchAssignment("second", "maged")));
  });

  it("takes someone off (sick / moved)", async () => {
    await assertSucceeds(deleteDoc(doc(bench(), "plans", RELEASED, "assignments", "start_ethan")));
  });

  it("logs each change", async () => {
    const db = bench();
    await assertSucceeds(addDoc(collection(db, "plans", RELEASED, "events"),
      benchEvent({ kind: "moved", staffKey: "ethan", message: "Ethan moved to Global testing." })));
    await assertSucceeds(addDoc(collection(db, "plans", RELEASED, "events"),
      benchEvent({ kind: "removed", staffKey: "ethan", message: "Ethan taken off: Sick / gone home." })));
    await assertSucceeds(addDoc(collection(db, "plans", RELEASED, "events"),
      benchEvent({ kind: "target_changed", message: "Target 30 → 26.", targetBefore: 30, targetAfter: 26 })));
  });

  it("updates the day target and its own limit", async () => {
    await assertSucceeds(updateDoc(doc(bench(), "plans", RELEASED), benchTargetChange(26)));
  });

  it("can set the target to 0 (everyone gone)", async () => {
    await assertSucceeds(updateDoc(doc(bench(), "plans", RELEASED), benchTargetChange(0)));
  });

  it("can raise the target back up", async () => {
    await assertSucceeds(updateDoc(doc(bench(), "plans", RELEASED), benchTargetChange(26)));
    await assertSucceeds(updateDoc(doc(bench(), "plans", RELEASED), benchTargetChange(30)));
  });
});

// ---------------------------------------------------------------------
describe("Bench screen – what it must NOT be able to do", () => {
  it("can't change the planned target, status or batches", async () => {
    const ref = doc(bench(), "plans", RELEASED);
    await assertFails(updateDoc(ref, { ...benchTargetChange(26), plannedTarget: 26 }));
    await assertFails(updateDoc(ref, { ...benchTargetChange(26), status: "draft" }));
    await assertFails(updateDoc(ref, { ...benchTargetChange(26), batches: [{ units: 99 }] }));
  });

  it("can't set a negative or fractional target", async () => {
    const ref = doc(bench(), "plans", RELEASED);
    await assertFails(updateDoc(ref, benchTargetChange(-1)));
    await assertFails(updateDoc(ref, benchTargetChange(12.5)));
    await assertFails(updateDoc(ref, benchTargetChange("26")));
  });

  it("can't change the target without a fresh timestamp", async () => {
    await assertFails(updateDoc(doc(bench(), "plans", RELEASED), { currentTarget: 26, updatedBy: "testing" }));
  });

  it("can't overwrite benchLimits with a non-map", async () => {
    await assertFails(updateDoc(doc(bench(), "plans", RELEASED),
      { currentTarget: 26, benchLimits: 5, updatedAt: serverTimestamp(), updatedBy: "testing" }));
  });

  it("can't touch a draft plan", async () => {
    const db = bench();
    await assertFails(updateDoc(doc(db, "plans", DRAFT), benchTargetChange(26)));
    await assertFails(setDoc(doc(db, "plans", DRAFT, "assignments", "start_ethan"), benchAssignment("start", "ethan")));
    await assertFails(deleteDoc(doc(db, "plans", DRAFT, "assignments", "start_ethan")));
  });

  it("can't create, replace or delete a plan", async () => {
    const db = bench();
    await assertFails(setDoc(doc(db, "plans", MISSING), { status: "released", currentTarget: 30 }));
    await assertFails(setDoc(doc(db, "plans", RELEASED), { status: "released", currentTarget: 99 }));
    await assertFails(deleteDoc(doc(db, "plans", RELEASED)));
  });

  it("can't file someone under the wrong ID or with extra fields", async () => {
    const db = bench();
    await assertFails(setDoc(doc(db, "plans", RELEASED, "assignments", "start_maged"), benchAssignment("start", "ethan")));
    await assertFails(setDoc(doc(db, "plans", RELEASED, "assignments", "lunch_ethan"), benchAssignment("lunch", "ethan")));
    await assertFails(setDoc(doc(db, "plans", RELEASED, "assignments", "start_ethan"),
      { ...benchAssignment("start", "ethan"), overtime: true }));
    await assertFails(setDoc(doc(db, "plans", RELEASED, "assignments", "start_ethan"),
      { ...benchAssignment("start", "ethan"), station: "" }));
  });

  it("can't log an unknown kind of change, or edit/delete the log", async () => {
    const db = bench();
    await assertFails(addDoc(collection(db, "plans", RELEASED, "events"), benchEvent({ kind: "hacked" })));
    await assertFails(addDoc(collection(db, "plans", RELEASED, "events"), benchEvent({ kind: "moved", extra: 1 })));
    await assertFails(updateDoc(doc(db, "plans", RELEASED, "events", "first"), { message: "edited" }));
    await assertFails(deleteDoc(doc(db, "plans", RELEASED, "events", "first")));
  });

  it("can't log a change on a draft plan or a day with no plan", async () => {
    await assertFails(addDoc(collection(bench(), "plans", DRAFT, "events"), benchEvent({ kind: "note" })));
    await assertFails(addDoc(collection(bench(), "plans", MISSING, "events"), benchEvent({ kind: "note" })));
  });

  it("can't post a log entry pretending to be management", async () => {
    const db = bench();
    await assertFails(addDoc(collection(db, "plans", RELEASED, "events"), benchEvent({ kind: "released" })));
    await assertFails(addDoc(collection(db, "plans", RELEASED, "events"), { ...benchEvent({ kind: "note" }), bench: "management" }));
  });

  it("can't change staff, colours, rosters or PINs", async () => {
    const db = bench();
    await assertFails(setDoc(doc(db, "staff", "ethan"), { name: "Ethan", team: "A" }));
    await assertFails(setDoc(doc(db, "configPresets", "blue"), { label: "Blue" }));
    await assertFails(setDoc(doc(db, "rosters", RELEASED), { people: {} }));
    await assertFails(setDoc(doc(db, "pins", "my-own-pin"), { role: "management", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, "pins", MANAGEMENT_PIN)));
  });

  it("can't promote itself to management", async () => {
    await assertFails(setDoc(doc(bench(), "devices", "bench-screen"),
      { role: "management", pin: BENCH_PIN, createdAt: serverTimestamp() }));
  });
});

// ---------------------------------------------------------------------
describe("Screens without a working PIN", () => {
  for (const [label, screen] of [
    ["signed in but no PIN", stranger],
    ["PIN was changed (revoked)", revoked],
    ["device record claims the wrong role", spoofed],
    ["not signed in", nobody]
  ]) {
    it(`${label}: sees and changes nothing`, async () => {
      const db = screen();
      await assertFails(getDocs(collection(db, "staff")));
      await assertFails(getDocs(collection(db, "configPresets")));
      await assertFails(getDoc(doc(db, "rosters", RELEASED)));
      await assertFails(getDoc(doc(db, "plans", RELEASED)));
      await assertFails(getDocs(collection(db, "plans", RELEASED, "assignments")));
      await assertFails(getDocs(collection(db, "pins")));
      await assertFails(updateDoc(doc(db, "plans", RELEASED), benchTargetChange(0)));
      await assertFails(setDoc(doc(db, "plans", RELEASED, "assignments", "start_ethan"), benchAssignment("start", "ethan")));
      await assertFails(addDoc(collection(db, "plans", RELEASED, "events"), benchEvent({ kind: "note" })));
    });
  }
});
