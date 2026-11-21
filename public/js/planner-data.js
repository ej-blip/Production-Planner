// Production Planner — Firebase data layer for the Management screen.
//
// Exposes window.plannerData for the calculator (a classic script):
//   start()                      → unlocks with the management PIN, then
//                                  returns { staff, presets }
//   saveStaff(workers)           → replaces the staff list
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
//   orders.usage(ids, skipDate)  → Map id → { packed, released } from released
//                                  days other than skipDate
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
import { showPhoto, floorBatches, progressOf, expectedUnits } from "./floor.js";

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

async function saveStaff(workers) {
  const existing = await getDocs(collection(db, "staff"));
  const keep = new Set(workers.map(worker => worker.key));
  const batch = writeBatch(db);
  workers.forEach(worker => {
    // Replaces the whole record, so older fields (team letters, preferred /
    // restricted benches) are dropped once the dots are saved.
    batch.set(doc(db, "staff", worker.key), {
      name: worker.name,
      firstName: worker.first,
      inProduction: worker.inProduction !== false,
      skills: { ...worker.skills },
      priorityRank: Number(worker.priorityRank) || 50,
      rosterRow: Number.isInteger(worker.rosterIndex) ? worker.rosterIndex : null,
      active: true,
      updatedAt: serverTimestamp()
    });
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
  const previous = await getDocs(collection(db, "plans", date, "assignments"));
  const batch = writeBatch(db);

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
const ORDER_FIELDS = ["customer", "unitType", "commsType", "simType", "configKey", "configText", "quantity"];

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

// How much of each order released days have used: what Packing finished
// (its real number), plus the planned amount of batches not packed yet.
async function orderUsage(ids, skipDate) {
  const usage = new Map(ids.map(id => [id, { packed: 0, released: 0 }]));
  if (!ids.length) return usage;
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const snapshots = await Promise.all(chunks.map(part =>
    getDocs(query(collection(db, "plans"), where("orderIds", "array-contains-any", part)))));
  const plans = new Map();
  snapshots.forEach(snapshot => snapshot.docs.forEach(entry => plans.set(entry.id, entry.data())));
  await Promise.all([...plans].map(async ([date, plan]) => {
    if (date === skipDate || plan.status !== "released") return;
    const batches = floorBatches(plan).filter(batch => usage.has(batch.orderId));
    if (!batches.length) return;
    const progressDocs = await getDocs(collection(db, "plans", date, "progress"));
    const progress = new Map(progressDocs.docs.map(entry => [entry.id, entry.data()]));
    batches.forEach(batch => {
      const tally = usage.get(batch.orderId);
      const item = progressOf(progress, "packing", batch);
      if (item.status === "hit") tally.packed += Number.isInteger(item.done) ? item.done : expectedUnits(progress, "packing", batch);
      else if (item.status === "short") tally.packed += item.done || 0;
      else tally.released += batch.planned;
    });
  }));
  return usage;
}

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
  saveStaff,
  loadDay,
  saveDraft,
  releasePlan,
  watchPlan,
  saveAttendance,
  watchRosters,
  orders,
  requests,
  showPhoto,
  lockScreen,
  friendlyError
};
window.dispatchEvent(new Event("plannerdata-ready"));
