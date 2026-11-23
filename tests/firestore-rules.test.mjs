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
      [`plans/${DRAFT}/events`, "first", { bench: "management", kind: "note", createdAt: now }],
      [`plans/${RELEASED}/progress`, "assembly_batch-1", { bench: "assembly", batchId: "batch-1", status: "in_progress", updatedAt: now }],
      [`plans/${RELEASED}/notes`, "from-management", { bench: "packing", text: "Pallet split 2 x 15", role: "management", createdAt: now, updatedAt: now }],
      [`plans/${RELEASED}/notes`, "from-bench", { bench: "packing", text: "Short on boxes", role: "bench", createdAt: now, updatedAt: now }],
      [`plans/${DRAFT}/notes`, "draft-note", { bench: "all", text: "Draft only", role: "management", createdAt: now, updatedAt: now }],
      [`plans/${RELEASED}/requests`, "stock-1", { kind: "stock", bench: "assembly", status: "open", text: "Boxes", qty: 20, createdAt: now, updatedAt: now }]
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
      await assertFails(getDocs(collection(db, "plans", RELEASED, "progress")));
      await assertFails(setDoc(doc(db, "plans", RELEASED, "progress", "assembly_batch-1"), progress("assembly", "batch-1", "hit")));
      await assertFails(getDocs(collection(db, "plans", RELEASED, "notes")));
      await assertFails(addDoc(collection(db, "plans", RELEASED, "notes"), note({ role: "bench" })));
    });
  }
});

// ---------------------------------------------------------------------
// Floor board: batch statuses per bench, and pinned notes / photos.
// ---------------------------------------------------------------------
function progress(bench, batchId, status, done) {
  return {
    bench, batchId, status,
    ...(done === undefined ? {} : { done }),
    updatedBy: `${bench} bench`,
    updatedAt: serverTimestamp()
  };
}

const SMALL_JPEG = "data:image/jpeg;base64," + "A".repeat(4000);

function note(fields = {}) {
  return {
    bench: "packing",
    text: "Pallet split changed to 3 x 10",
    role: "bench",
    createdBy: "Packing bench",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...fields
  };
}

describe("Floor board – batch statuses", () => {
  it("a bench marks a batch in progress, hit target, or short with a number", async () => {
    const db = bench();
    await assertSucceeds(setDoc(doc(db, "plans", RELEASED, "progress", "testing_batch-1"), progress("testing", "batch-1", "in_progress")));
    await assertSucceeds(setDoc(doc(db, "plans", RELEASED, "progress", "testing_batch-1"), progress("testing", "batch-1", "hit", 30)));
    await assertSucceeds(setDoc(doc(db, "plans", RELEASED, "progress", "assembly_batch-1"), progress("assembly", "batch-1", "short", 24)));
    await assertSucceeds(setDoc(doc(db, "plans", RELEASED, "progress", "cage_batch-1"), progress("cage", "batch-1", "waiting", null)));
  });

  it("benches and management read the statuses of a released plan", async () => {
    await assertSucceeds(getDocs(collection(bench(), "plans", RELEASED, "progress")));
    await assertSucceeds(getDocs(collection(management(), "plans", RELEASED, "progress")));
  });

  it("a bench can't see or set statuses on a draft plan", async () => {
    await assertFails(getDocs(collection(bench(), "plans", DRAFT, "progress")));
    await assertFails(setDoc(doc(bench(), "plans", DRAFT, "progress", "testing_batch-1"), progress("testing", "batch-1", "hit")));
  });

  it("management can set statuses on any plan", async () => {
    await assertSucceeds(setDoc(doc(management(), "plans", DRAFT, "progress", "packing_batch-1"), progress("packing", "batch-1", "hit", 36)));
  });

  it("statuses must be well formed", async () => {
    const db = bench();
    const ref = id => doc(db, "plans", RELEASED, "progress", id);
    await assertFails(setDoc(ref("testing_batch-2"), progress("testing", "batch-1", "hit")));          // id doesn't match
    await assertFails(setDoc(ref("office_batch-1"), progress("office", "batch-1", "hit")));            // unknown bench
    await assertFails(setDoc(ref("testing_batch-1"), progress("testing", "batch-1", "done")));         // unknown status
    await assertFails(setDoc(ref("testing_batch-1"), progress("testing", "batch-1", "short", -3)));    // negative
    await assertFails(setDoc(ref("testing_batch-1"), progress("testing", "batch-1", "short", 2.5)));   // fraction
    await assertFails(setDoc(ref("testing_batch-1"), { ...progress("testing", "batch-1", "hit"), extra: 1 }));
    await assertFails(setDoc(ref("testing_batch-1"), { ...progress("testing", "batch-1", "hit"), updatedAt: Timestamp.now() }));
  });

  it("only management can delete a status", async () => {
    await assertFails(deleteDoc(doc(bench(), "plans", RELEASED, "progress", "assembly_batch-1")));
    await assertSucceeds(deleteDoc(doc(management(), "plans", RELEASED, "progress", "assembly_batch-1")));
  });
});

describe("Floor board – pinned notes and photos", () => {
  it("a bench pins a note, with or without a photo", async () => {
    const db = bench();
    await assertSucceeds(addDoc(collection(db, "plans", RELEASED, "notes"), note()));
    await assertSucceeds(addDoc(collection(db, "plans", RELEASED, "notes"), note({ photo: SMALL_JPEG })));
  });

  it("management pins notes on any plan, including drafts", async () => {
    await assertSucceeds(addDoc(collection(management(), "plans", DRAFT, "notes"), note({ role: "management", bench: "all" })));
  });

  it("a bench can't pretend its note came from management", async () => {
    await assertFails(addDoc(collection(bench(), "plans", RELEASED, "notes"), note({ role: "management" })));
  });

  it("photos must be a JPEG under the size limit", async () => {
    const db = bench();
    await assertFails(addDoc(collection(db, "plans", RELEASED, "notes"), note({ photo: "data:image/png;base64,AAAA" })));
    await assertFails(addDoc(collection(db, "plans", RELEASED, "notes"), note({ photo: "https://example.com/x.jpg" })));
    await assertFails(addDoc(collection(db, "plans", RELEASED, "notes"), note({ photo: "data:image/jpeg;base64," + "A".repeat(900000) })));
  });

  it("notes must be well formed", async () => {
    const db = bench();
    await assertFails(addDoc(collection(db, "plans", RELEASED, "notes"), note({ bench: "office" })));
    await assertFails(addDoc(collection(db, "plans", RELEASED, "notes"), note({ text: "x".repeat(2001) })));
    await assertFails(addDoc(collection(db, "plans", RELEASED, "notes"), note({ pinned: true })));
  });

  it("benches read notes on a released plan only", async () => {
    await assertSucceeds(getDocs(collection(bench(), "plans", RELEASED, "notes")));
    await assertFails(getDocs(collection(bench(), "plans", DRAFT, "notes")));
    await assertFails(addDoc(collection(bench(), "plans", DRAFT, "notes"), note()));
  });

  it("a bench edits or removes bench notes, but not management's", async () => {
    const db = bench();
    const keepCreated = { createdAt: Timestamp.fromMillis(0) };
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "plans", RELEASED, "notes", "from-bench"), note({ createdAt: keepCreated.createdAt, updatedAt: Timestamp.now() }));
      await setDoc(doc(context.firestore(), "plans", RELEASED, "notes", "from-management"), note({ role: "management", createdAt: keepCreated.createdAt, updatedAt: Timestamp.now() }));
    });
    await assertSucceeds(setDoc(doc(db, "plans", RELEASED, "notes", "from-bench"), note({ text: "Boxes arrived", ...keepCreated })));
    await assertFails(setDoc(doc(db, "plans", RELEASED, "notes", "from-bench"), note({ text: "Moved the date" })));   // createdAt changed
    await assertFails(setDoc(doc(db, "plans", RELEASED, "notes", "from-management"), note({ text: "Edited", ...keepCreated })));
    await assertFails(deleteDoc(doc(db, "plans", RELEASED, "notes", "from-management")));
    await assertSucceeds(deleteDoc(doc(db, "plans", RELEASED, "notes", "from-bench")));
  });

  it("management edits and removes any note", async () => {
    const db = management();
    await assertSucceeds(deleteDoc(doc(db, "plans", RELEASED, "notes", "from-bench")));
    await assertSucceeds(deleteDoc(doc(db, "plans", RELEASED, "notes", "from-management")));
  });
});


describe("Requests – help, stock and faulty reports", () => {
  const request = fields => ({
    kind: "help", bench: "testing", status: "open", text: "Need an extra person",
    createdBy: "Testing bench", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...fields
  });
  const move = status => ({ status, updatedAt: serverTimestamp(), updatedBy: "Production Cage bench" });

  it("a bench calls for help, orders stock and reports a faulty unit", async () => {
    const db = bench();
    await assertSucceeds(addDoc(collection(db, "plans", RELEASED, "requests"), request()));
    await assertSucceeds(addDoc(collection(db, "plans", RELEASED, "requests"), request({ kind: "stock", bench: "assembly", text: "Labels", qty: 36 })));
    await assertSucceeds(addDoc(collection(db, "plans", RELEASED, "requests"), request({ kind: "faulty", bench: "hardware", text: "No power", unit: "DCU-1042", batchId: "batch-1", photo: SMALL_JPEG })));
  });

  it("requests start open and must be well formed", async () => {
    const db = bench();
    const col = collection(db, "plans", RELEASED, "requests");
    await assertFails(addDoc(col, request({ status: "done" })));
    await assertFails(addDoc(col, request({ kind: "pizza" })));
    await assertFails(addDoc(col, request({ bench: "office" })));
    await assertFails(addDoc(col, request({ qty: -2 })));
    await assertFails(addDoc(col, request({ text: "x".repeat(501) })));
    await assertFails(addDoc(col, request({ priority: "urgent" })));
    await assertFails(addDoc(col, request({ photo: "data:image/png;base64,AAAA" })));
  });

  it("the cage sends stock and the bench marks it received", async () => {
    const ref = doc(bench(), "plans", RELEASED, "requests", "stock-1");
    await assertSucceeds(updateDoc(ref, move("accepted")));
    await assertSucceeds(updateDoc(ref, move("done")));
  });

  it("only the status can change after a request is made", async () => {
    const ref = doc(bench(), "plans", RELEASED, "requests", "stock-1");
    await assertFails(updateDoc(ref, { ...move("accepted"), qty: 500 }));
    await assertFails(updateDoc(ref, { ...move("accepted"), text: "Changed" }));
    await assertFails(updateDoc(ref, move("lost")));
  });

  it("benches only see and make requests on a released plan", async () => {
    await assertSucceeds(getDocs(collection(bench(), "plans", RELEASED, "requests")));
    await assertFails(getDocs(collection(bench(), "plans", DRAFT, "requests")));
    await assertFails(addDoc(collection(bench(), "plans", DRAFT, "requests"), request()));
  });

  it("only management can delete a request", async () => {
    await assertFails(deleteDoc(doc(bench(), "plans", RELEASED, "requests", "stock-1")));
    await assertSucceeds(deleteDoc(doc(management(), "plans", RELEASED, "requests", "stock-1")));
  });

  it("screens without a working PIN can't see or make requests", async () => {
    for (const db of [stranger(), revoked(), nobody()]) {
      await assertFails(getDocs(collection(db, "plans", RELEASED, "requests")));
      await assertFails(addDoc(collection(db, "plans", RELEASED, "requests"), request()));
    }
  });
});

// ---------------------------------------------------------------------
describe("Work orders", () => {
  // What planner-data.js writes when an order is added or edited.
  const order = fields => ({
    customer: "Portland", unitType: "gen4", commsType: "verizon", simType: "verizon",
    configKey: "blue", configText: "Sensor cable: 9.2 m", quantity: 150, status: "open",
    createdBy: "Management", createdAt: serverTimestamp(), updatedBy: "Management", updatedAt: serverTimestamp(),
    ...fields
  });

  it("management adds, edits, closes and deletes an order", async () => {
    const db = management();
    const ref = doc(db, "workOrders", "order-1");
    await assertSucceeds(setDoc(ref, order()));
    await assertSucceeds(setDoc(ref, order({ quantity: 300 })));
    await assertSucceeds(updateDoc(ref, { status: "closed", updatedBy: "Management", updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it("orders must be well formed", async () => {
    const db = management();
    const ref = doc(db, "workOrders", "order-2");
    await assertFails(setDoc(ref, order({ quantity: 0 })));
    await assertFails(setDoc(ref, order({ quantity: 12.5 })));
    await assertFails(setDoc(ref, order({ unitType: "gen3" })));
    await assertFails(setDoc(ref, order({ commsType: "wifi" })));
    await assertFails(setDoc(ref, order({ status: "lost" })));
    await assertFails(setDoc(ref, order({ customer: "" })));
    await assertFails(setDoc(ref, order({ priority: "rush" })));
    const { quantity, ...noQuantity } = order();
    await assertFails(setDoc(ref, noQuantity));
  });

  it("benches read orders but cannot change them", async () => {
    await assertSucceeds(setDoc(doc(management(), "workOrders", "order-3"), order()));
    const db = bench();
    await assertSucceeds(getDoc(doc(db, "workOrders", "order-3")));
    await assertSucceeds(getDocs(collection(db, "workOrders")));
    await assertFails(setDoc(doc(db, "workOrders", "order-4"), order()));
    await assertFails(updateDoc(doc(db, "workOrders", "order-3"), { status: "closed", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, "workOrders", "order-3")));
  });

  it("screens without a working PIN see nothing", async () => {
    for (const screen of [stranger, revoked, spoofed, nobody]) {
      await assertFails(getDocs(collection(screen(), "workOrders")));
      await assertFails(setDoc(doc(screen(), "workOrders", "order-5"), order()));
    }
  });
});

// ---------------------------------------------------------------------
describe("Lists", () => {
  // What lists.js writes when a list is edited on the Lists screen.
  const list = fields => ({
    items: [
      { key: "gen4", label: "Gen4", planAs: "gen4", active: true },
      { key: "gen5", label: "Gen5", planAs: "gen4", active: true }
    ],
    updatedBy: "Management",
    updatedAt: serverTimestamp(),
    ...fields
  });

  it("management saves each list", async () => {
    const db = management();
    for (const name of ["units", "customers", "connectors", "comms", "sims"]) {
      await assertSucceeds(setDoc(doc(db, "lists", name), list()));
    }
    await assertSucceeds(getDocs(collection(db, "lists")));
  });

  it("only the known lists, well formed, and never deleted", async () => {
    const db = management();
    await assertFails(setDoc(doc(db, "lists", "colours"), list()));
    await assertFails(setDoc(doc(db, "lists", "units"), list({ items: "Gen4" })));
    await assertFails(setDoc(doc(db, "lists", "units"), list({ note: "extra" })));
    await assertFails(setDoc(doc(db, "lists", "units"), list({ updatedAt: Timestamp.fromDate(new Date(2020, 0, 1)) })));
    await assertSucceeds(setDoc(doc(db, "lists", "units"), list()));
    await assertFails(deleteDoc(doc(db, "lists", "units")));
  });

  it("benches read the lists but cannot change them", async () => {
    await assertSucceeds(setDoc(doc(management(), "lists", "sims"), list()));
    const db = bench();
    await assertSucceeds(getDocs(collection(db, "lists")));
    await assertFails(setDoc(doc(db, "lists", "sims"), list()));
  });

  it("screens without a working PIN see nothing", async () => {
    for (const screen of [stranger, revoked, spoofed, nobody]) {
      await assertFails(getDocs(collection(screen(), "lists")));
    }
  });

  it("orders and job cards can name a unit and comms from the lists", async () => {
    const db = management();
    const fields = {
      customer: "Portland", unitType: "gen4", unitKey: "gen5", commsType: "global", commsKey: "lora",
      simType: "", configKey: "blue", quantity: 36, updatedBy: "Management", updatedAt: serverTimestamp()
    };
    await assertSucceeds(setDoc(doc(db, "workOrders", "listed-order"), { ...fields, status: "open" }));
    await assertSucceeds(setDoc(doc(db, "jobs", "listed-job"), { ...fields, stage: "assembly", day: RELEASED }));
    await assertFails(setDoc(doc(db, "workOrders", "listed-order-2"), { ...fields, status: "open", unitKey: "" }));
    await assertFails(setDoc(doc(db, "jobs", "listed-job-2"), { ...fields, stage: "assembly", day: RELEASED, commsKey: 7 }));
    await assertFails(setDoc(doc(db, "workOrders", "listed-order-3"), { ...fields, status: "open", unitType: "gen5" }));
    await assertSucceeds(setDoc(doc(db, "workOrders", "listed-order-4"), { ...fields, status: "open", connectorKey: "2-pin-plastic" }));
    await assertFails(setDoc(doc(db, "workOrders", "listed-order-5"), { ...fields, status: "open", connectorKey: 2 }));
    await assertSucceeds(setDoc(doc(db, "jobs", "listed-job-3"), { ...fields, stage: "assembly", day: RELEASED, connectorKey: "2-pin-plastic" }));
    await assertFails(setDoc(doc(db, "jobs", "listed-job-4"), { ...fields, stage: "assembly", day: RELEASED, connectorKey: ["x"] }));
  });
});

describe("Extra jobs", () => {
  // What planner-data.js writes for a job that is just text.
  const extra = fields => ({
    title: "Test one Solar PCB and send to Western Power", status: "open",
    createdBy: "Management", createdAt: serverTimestamp(), updatedBy: "Management", updatedAt: serverTimestamp(),
    ...fields
  });

  it("management adds, finishes and deletes one", async () => {
    const db = management();
    const ref = doc(db, "extraJobs", "extra-1");
    await assertSucceeds(setDoc(ref, extra()));
    await assertSucceeds(updateDoc(ref, { status: "done", doneDay: RELEASED, updatedBy: "Management", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: "open", doneDay: null, updatedBy: "Management", updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it("they must be well formed", async () => {
    const db = management();
    const ref = doc(db, "extraJobs", "extra-2");
    await assertFails(setDoc(ref, extra({ title: "" })));
    await assertFails(setDoc(ref, extra({ title: "x".repeat(201) })));
    await assertFails(setDoc(ref, extra({ status: "lost" })));
    await assertFails(setDoc(ref, extra({ doneDay: "tomorrow" })));
    await assertFails(setDoc(ref, extra({ hours: 2 })));
  });

  it("benches read them and can only mark one done", async () => {
    await assertSucceeds(setDoc(doc(management(), "extraJobs", "extra-3"), extra()));
    const db = bench();
    await assertSucceeds(getDocs(collection(db, "extraJobs")));
    await assertFails(setDoc(doc(db, "extraJobs", "extra-4"), extra()));
    await assertFails(updateDoc(doc(db, "extraJobs", "extra-3"), { title: "Something else", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "extraJobs", "extra-3"), { status: "done", title: "Changed", doneDay: RELEASED, updatedBy: "Floor board", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, "extraJobs", "extra-3")));
    await assertSucceeds(updateDoc(doc(db, "extraJobs", "extra-3"), { status: "done", doneDay: RELEASED, updatedBy: "Floor board", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "extraJobs", "extra-3"), { status: "open", doneDay: null, updatedBy: "Floor board", updatedAt: serverTimestamp() }));
  });

  it("screens without a working PIN see nothing", async () => {
    for (const screen of [stranger, revoked, spoofed, nobody]) {
      await assertFails(getDocs(collection(screen(), "extraJobs")));
    }
  });
});

describe("Job cards", () => {
  // What planner-data.js writes at release, and floor.js when a bench finishes.
  const job = fields => ({
    orderId: "order-1", customer: "Portland", unitType: "gen4", commsType: "verizon", simType: "verizon",
    configKey: "blue", configText: "Sensor cable: 9.2 m", quantity: 36, stage: "assembly", day: "2099-01-05",
    createdBy: "Management", createdAt: serverTimestamp(), updatedBy: "Management", updatedAt: serverTimestamp(),
    ...fields
  });
  const step = fields => ({ updatedAt: serverTimestamp(), updatedBy: "Testing bench", ...fields });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "jobs", "job-1"), { ...job(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
  });

  it("management creates, moves and deletes job cards", async () => {
    const db = management();
    await assertSucceeds(setDoc(doc(db, "jobs", "job-2"), job()));
    await assertSucceeds(updateDoc(doc(db, "jobs", "job-2"), { stage: "hardware", updatedAt: serverTimestamp(), updatedBy: "Management" }));
    await assertSucceeds(deleteDoc(doc(db, "jobs", "job-2")));
  });

  it("job cards must be well formed", async () => {
    const db = management();
    const ref = doc(db, "jobs", "job-3");
    await assertFails(setDoc(ref, job({ stage: "shipping" })));
    await assertFails(setDoc(ref, job({ quantity: 0 })));
    await assertFails(setDoc(ref, job({ day: "Monday" })));
    await assertFails(setDoc(ref, job({ colour: "red" })));
  });

  it("a bench moves a card on, records the count and can move it back", async () => {
    const ref = doc(bench(), "jobs", "job-1");
    await assertSucceeds(updateDoc(ref, step({ stage: "testing", quantity: 36 })));
    await assertSucceeds(updateDoc(ref, step({ stage: "done", quantity: 34, doneDay: "2099-01-06" })));
    await assertSucceeds(updateDoc(ref, step({ stage: "packing", quantity: 36, doneDay: null })));
  });

  it("a bench cannot rewrite what a card is", async () => {
    const ref = doc(bench(), "jobs", "job-1");
    await assertFails(updateDoc(ref, step({ customer: "Someone else" })));
    await assertFails(updateDoc(ref, step({ orderId: "order-9" })));
    await assertFails(updateDoc(ref, step({ stage: "lost" })));
    await assertFails(setDoc(doc(bench(), "jobs", "job-new"), job()));
  });

  it("a bench leaves a short remainder as its own card, and can take it back", async () => {
    const db = bench();
    const rest = doc(db, "jobs", "job-1-testing");
    await assertSucceeds(setDoc(rest, job({ quantity: 2, stage: "testing", parentId: "job-1", createdBy: "Testing bench", updatedBy: "Testing bench" })));
    await assertFails(setDoc(doc(db, "jobs", "job-1-x"), job({ quantity: 2, stage: "done", parentId: "job-1" })));
    await assertSucceeds(deleteDoc(rest));
    await assertFails(deleteDoc(doc(db, "jobs", "job-1")));
  });

  it("screens without a working PIN see nothing", async () => {
    for (const screen of [stranger, revoked, spoofed, nobody]) {
      await assertFails(getDocs(collection(screen(), "jobs")));
      await assertFails(updateDoc(doc(screen(), "jobs", "job-1"), step({ stage: "testing" })));
    }
  });
});

// ---------------------------------------------------------------------
describe("Custom jobs", () => {
  // What planner-data.js writes when a custom job name is saved.
  const name = text => ({ name: text, createdBy: "Management", createdAt: serverTimestamp(), updatedBy: "Management", updatedAt: serverTimestamp() });

  it("management saves and removes custom job names", async () => {
    const db = management();
    await assertSucceeds(setDoc(doc(db, "customJobs", "cleaning"), name("Cleaning warehouse")));
    await assertSucceeds(deleteDoc(doc(db, "customJobs", "cleaning")));
  });

  it("names must be short and nothing else is stored", async () => {
    const db = management();
    await assertFails(setDoc(doc(db, "customJobs", "a"), name("")));
    await assertFails(setDoc(doc(db, "customJobs", "b"), name("x".repeat(61))));
    await assertFails(setDoc(doc(db, "customJobs", "c"), { ...name("Stocktake"), people: 3 }));
  });

  it("benches read the names but cannot change them", async () => {
    await assertSucceeds(setDoc(doc(management(), "customJobs", "stocktake"), name("Stocktake")));
    const db = bench();
    await assertSucceeds(getDocs(collection(db, "customJobs")));
    await assertFails(setDoc(doc(db, "customJobs", "other"), name("Other")));
    await assertFails(deleteDoc(doc(db, "customJobs", "stocktake")));
  });

  it("screens without a working PIN see nothing", async () => {
    for (const screen of [stranger, revoked, spoofed, nobody]) {
      await assertFails(getDocs(collection(screen(), "customJobs")));
    }
  });
});
