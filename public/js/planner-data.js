// Production Planner — Firebase data layer for the Management screen.
//
// Exposes window.plannerData for the calculator (a classic script):
//   start()                      → unlocks with the management PIN, then
//                                  returns { staff, presets }
//   watchStaff(callback)         → live staff list (edited on the Lists screen)
//   watchPresets(callback)       → live configuration colours (Lists screen)
//   lists                        → the lists module (js/lists.js): unit types,
//                                  customers, connectors, comms, SIM types
//   loadDay(date)                → { plan, roster } for "YYYY-MM-DD" (either may be null)
//   saveDraft(date, plan, roster)
//   releasePlan(date, plan, roster, assignments, target)
//   watchPlan(date, callback)    → live { plan, events } updates; returns a stop function
//   saveAttendance(date, roster) → saves who's in for that day straight away
//   watchRosters(dates, callback)→ live callback(date, roster | null) for each date;
//                                  returns a stop function
//   orders.watch(callback)       → live list of work orders (open and closed)
//   orders.save(order)           → adds an order (no id) or updates one
//   orders.setStatus(id, status) → "open" | "closed"
//   orders.remove(id)
//   orders.usage(ids, skipDate)  → Map id → { packed, released, finished }: job
//                                  cards not made for skipDate, plus older
//                                  released days saved before job cards;
//                                  finished counts every packed card
//   extraJobs.watch(callback)    → live list of text-only jobs not yet done
//   extraJobs.add(title), extraJobs.finish(id, day), extraJobs.remove(id)
//   customJobs.watch(callback)   → live list of saved custom job names
//   customJobs.add(name), customJobs.remove(id)
//   jobs.watch(callback)         → live list of job cards not yet done
//   jobs.remove(id)
//   requests.watch(date, callback) → live list of help / stock / faulty requests
//   requests.advance(date, request, status) → moves one on (and logs it)
//   requests.cardHtml(request)   → a request card with its next-step button
//   showPhoto(src)
//   lockScreen()
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp,
  onSnapshot, query, orderBy, limit, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, ensureAccess, lockScreen, friendlyError } from "./session.js";
import { REQUEST_KINDS, nextStatus, requestTitle, watchRequests, moveRequest, requestCardHtml } from "./requests.js";
import { showPhoto, floorBatches, progressOf, expectedUnits, JOB_STAGES } from "./floor.js";
import * as lists from "./lists.js";

const ACTOR = "Management";

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

// Live copies, so edits made on the Lists screen show here straight away.
function watchStaff(onChange) {
  return onSnapshot(collection(db, "staff"), snapshot => {
    onChange(snapshot.docs.map(entry => ({ key: entry.id, ...withoutTimestamps(entry.data()) })));
  }, () => {});
}

function watchPresets(onChange) {
  return onSnapshot(collection(db, "configPresets"), snapshot => {
    onChange(snapshot.docs.map(entry => ({ key: entry.id, ...withoutTimestamps(entry.data()) })));
  }, () => {});
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
    benchLimits: {},
    releasedAt: null,
    releasedBy: null,
    updatedAt: serverTimestamp(),
    updatedBy: ACTOR
  });
  batch.set(doc(db, "rosters", date), { ...roster, updatedAt: serverTimestamp(), updatedBy: ACTOR });
  await batch.commit();
}

async function releasePlan(date, plan, roster, assignments, target) {
  const jobs = Array.isArray(plan.jobs) ? plan.jobs : [];
  const [previous, jobSnaps] = await Promise.all([
    getDocs(collection(db, "plans", date, "assignments")),
    Promise.all(jobs.map(job => getDoc(doc(db, "jobs", job.id))))
  ]);
  const batch = writeBatch(db);

  // Job cards: the day's new builds are created (or resized while still
  // at Assembly); a waiting card the planner moved to another bench moves
  // there, unless a bench has moved it on since.
  jobs.forEach((job, index) => {
    const ref = doc(db, "jobs", job.id);
    const snap = jobSnaps[index];
    const fields = {
      orderId: job.orderId || null,
      customer: job.customer,
      unitType: job.unitType,
      unitKey: job.unitKey || job.unitType,
      commsType: job.commsType,
      commsKey: job.commsKey || job.commsType,
      simType: job.simType,
      configKey: job.configKey,
      configText: job.configText ?? "",
      quantity: job.quantity
    };
    if (job.isNew) {
      if (!snap.exists()) {
        batch.set(ref, { ...fields, stage: "assembly", day: date, createdAt: serverTimestamp(), createdBy: ACTOR, updatedAt: serverTimestamp(), updatedBy: ACTOR });
      } else if (snap.data().stage === "assembly") {
        batch.update(ref, { ...fields, updatedAt: serverTimestamp(), updatedBy: ACTOR });
      }
      return;
    }
    const first = job.route?.[0];
    const current = snap.exists() ? snap.data().stage : null;
    if (current && current === job.fromStage && first !== current && JOB_STAGES.includes(first)) {
      batch.update(ref, { stage: first, updatedAt: serverTimestamp(), updatedBy: ACTOR });
    }
  });

  batch.set(doc(db, "plans", date), {
    ...plan,
    status: "released",
    plannedTarget: target,
    currentTarget: target,
    benchLimits: {},
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

// Live updates for the plan and its latest change-log entries.
function watchPlan(date, callback) {
  let plan = null;
  let events = [];
  const send = () => callback({ plan, events });
  const stopPlan = onSnapshot(doc(db, "plans", date), snapshot => {
    plan = snapshot.exists() ? snapshot.data() : null;
    send();
  }, () => {});
  const stopEvents = onSnapshot(
    query(collection(db, "plans", date, "events"), orderBy("createdAt", "desc"), limit(20)),
    snapshot => {
      events = snapshot.docs.map(entry => entry.data());
      send();
    },
    () => {}
  );
  return () => {
    stopPlan();
    stopEvents();
  };
}

// ---------------------------------------------------------------------
// Who's in (rosters/{date}). Everyone is in unless marked away.
// ---------------------------------------------------------------------
async function saveAttendance(date, roster) {
  await setDoc(doc(db, "rosters", date), { ...roster, updatedAt: serverTimestamp(), updatedBy: ACTOR });
}

function watchRosters(dates, callback) {
  const stops = dates.map(date => onSnapshot(
    doc(db, "rosters", date),
    snapshot => callback(date, snapshot.exists() ? snapshot.data() : null),
    () => {}
  ));
  return () => stops.forEach(stop => stop());
}

// ---------------------------------------------------------------------
// Work orders: a customer order built over several days
// ---------------------------------------------------------------------
const ORDER_FIELDS = ["customer", "unitType", "unitKey", "commsType", "commsKey", "simType", "connectorKey", "configKey", "configText", "quantity"];

function watchOrders(onChange) {
  return onSnapshot(collection(db, "workOrders"), snapshot => {
    const list = snapshot.docs
      .map(entry => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => (a.createdAt?.toMillis?.() || Date.now()) - (b.createdAt?.toMillis?.() || Date.now()));
    onChange(list);
  }, () => onChange(null));
}

async function saveOrder(order) {
  const fields = {};
  ORDER_FIELDS.forEach(key => { fields[key] = order[key]; });
  fields.quantity = Math.floor(Number(fields.quantity) || 0);
  fields.configText = String(fields.configText ?? "").slice(0, 2000);
  if (order.id) {
    await updateDoc(doc(db, "workOrders", order.id), { ...fields, updatedAt: serverTimestamp(), updatedBy: ACTOR });
    return order.id;
  }
  const ref = doc(collection(db, "workOrders"));
  await setDoc(ref, {
    ...fields,
    status: "open",
    createdAt: serverTimestamp(),
    createdBy: ACTOR,
    updatedAt: serverTimestamp(),
    updatedBy: ACTOR
  });
  return ref.id;
}

function setOrderStatus(id, status) {
  return updateDoc(doc(db, "workOrders", id), { status, updatedAt: serverTimestamp(), updatedBy: ACTOR });
}

function removeOrder(id) {
  return deleteDoc(doc(db, "workOrders", id));
}

// How much of each order is used: job cards (done → packed, anything else
// → in progress), leaving out cards made for skipDate (the day on screen
// counts those as "today"). Released days saved before job cards count the
// old way: Packing's real number, or the planned amount until it reports.
async function orderUsage(ids, skipDate) {
  const usage = new Map(ids.map(id => [id, { packed: 0, released: 0, finished: 0 }]));
  if (!ids.length) return usage;
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const [snapshots, jobSnapshots] = await Promise.all([
    Promise.all(chunks.map(part =>
      getDocs(query(collection(db, "plans"), where("orderIds", "array-contains-any", part))))),
    Promise.all(chunks.map(part =>
      getDocs(query(collection(db, "jobs"), where("orderId", "in", part)))))
  ]);
  jobSnapshots.forEach(snapshot => snapshot.docs.forEach(entry => {
    const job = entry.data();
    const tally = usage.get(job.orderId);
    if (tally && job.stage === "done") tally.finished += job.quantity;
    if (!tally || job.day === skipDate) return;
    if (job.stage === "done") tally.packed += job.quantity;
    else tally.released += job.quantity;
  }));
  const plans = new Map();
  snapshots.forEach(snapshot => snapshot.docs.forEach(entry => plans.set(entry.id, entry.data())));
  await Promise.all([...plans].map(async ([date, plan]) => {
    if (date === skipDate || plan.status !== "released" || Array.isArray(plan.jobs)) return;
    const batches = floorBatches(plan).filter(batch => usage.has(batch.orderId));
    if (!batches.length) return;
    const progressDocs = await getDocs(collection(db, "plans", date, "progress"));
    const progress = new Map(progressDocs.docs.map(entry => [entry.id, entry.data()]));
    batches.forEach(batch => {
      const tally = usage.get(batch.orderId);
      const item = progressOf(progress, "packing", batch);
      const packed = item.status === "hit"
        ? (Number.isInteger(item.done) ? item.done : expectedUnits(progress, "packing", batch))
        : item.status === "short" ? item.done || 0 : 0;
      tally.packed += packed;
      tally.finished += packed;
      if (item.status !== "hit" && item.status !== "short") tally.released += batch.planned;
    });
  }));
  return usage;
}

// Job cards still on their way (not done), oldest first.
function watchJobs(onChange) {
  return onSnapshot(query(collection(db, "jobs"), where("stage", "in", JOB_STAGES)), snapshot => {
    const list = snapshot.docs
      .map(entry => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => String(a.day).localeCompare(String(b.day)) || a.id.localeCompare(b.id));
    onChange(list);
  }, () => onChange(null));
}

// Saved names for other work (cleaning, stocktake), A to Z.
// Jobs that are just text, open ones oldest first.
const extraJobs = {
  watch(onChange) {
    return onSnapshot(query(collection(db, "extraJobs"), where("status", "==", "open")), snapshot => {
      onChange(snapshot.docs
        .map(entry => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => (a.createdAt?.toMillis?.() || Date.now()) - (b.createdAt?.toMillis?.() || Date.now())));
    }, () => onChange(null));
  },
  add: title => addDoc(collection(db, "extraJobs"), {
    title: String(title).trim().slice(0, 200),
    status: "open",
    createdAt: serverTimestamp(),
    createdBy: ACTOR,
    updatedAt: serverTimestamp(),
    updatedBy: ACTOR
  }),
  finish: (id, day) => updateDoc(doc(db, "extraJobs", id), { status: "done", doneDay: day, updatedAt: serverTimestamp(), updatedBy: ACTOR }),
  remove: id => deleteDoc(doc(db, "extraJobs", id))
};

const customJobs = {
  watch(onChange) {
    return onSnapshot(collection(db, "customJobs"), snapshot => {
      onChange(snapshot.docs
        .map(entry => ({ id: entry.id, name: entry.data().name }))
        .sort((a, b) => a.name.localeCompare(b.name)));
    }, () => onChange(null));
  },
  add: name => addDoc(collection(db, "customJobs"), {
    name: String(name).trim().slice(0, 60),
    createdAt: serverTimestamp(),
    createdBy: ACTOR,
    updatedAt: serverTimestamp(),
    updatedBy: ACTOR
  }),
  remove: id => deleteDoc(doc(db, "customJobs", id))
};

const jobs = {
  watch: watchJobs,
  remove: id => deleteDoc(doc(db, "jobs", id))
};

const orders = {
  watch: watchOrders,
  save: saveOrder,
  setStatus: setOrderStatus,
  remove: removeOrder,
  usage: orderUsage
};

// ---------------------------------------------------------------------
// Requests from the benches (help, stock, faulty)
// ---------------------------------------------------------------------
async function advanceRequest(date, request, to) {
  await moveRequest(date, request, to, ACTOR);
  await addDoc(collection(db, "plans", date, "events"), {
    bench: "management",
    kind: "note",
    message: `${requestTitle(request)} · ${REQUEST_KINDS[request.kind].status[to]}`,
    createdBy: ACTOR,
    createdAt: serverTimestamp()
  });
}

const requests = {
  watch: watchRequests,
  advance: advanceRequest,
  title: requestTitle,
  kinds: REQUEST_KINDS,
  cardHtml: request => requestCardHtml(request, item => {
    const label = REQUEST_KINDS[item.kind]?.next?.[item.status];
    return label ? { label, to: nextStatus(item.status) } : null;
  })
};

// ---------------------------------------------------------------------
window.plannerData = {
  async start() {
    await ensureAccess({
      title: "Production Planner",
      intro: "Enter the management PIN.",
      pinLabel: "Management PIN",
      allowed: ["management"],
      wrongRoleMessage: "That's the bench PIN. This screen needs the management PIN."
    });
    return loadReferenceData();
  },
  watchStaff,
  watchPresets,
  lists,
  loadDay,
  saveDraft,
  releasePlan,
  watchPlan,
  saveAttendance,
  watchRosters,
  orders,
  jobs,
  customJobs,
  extraJobs,
  requests,
  showPhoto,
  lockScreen,
  friendlyError
};
window.dispatchEvent(new Event("plannerdata-ready"));
