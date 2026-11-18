// Fills the local practice database (Firebase emulator) with starter data and
// made-up PINs. Never touches the live database.
//
//   Terminal 1:  npm run practice        (starts the practice database)
//   Terminal 2:  npm run practice:seed   (run once after it starts)
//   Then open    http://localhost:8765/?practice=1
//
// Practice PINs (made up, only valid in the practice database):
//   management  practice-manager
//   bench       practice-bench
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, doc, setDoc } from "firebase/firestore";
import { STAFF, CONFIG_PRESETS } from "../public/js/starter-data.js";

const PINS = { "practice-manager": "management", "practice-bench": "bench" };

const env = await initializeTestEnvironment({
  projectId: "demo-production-planner",
  firestore: { host: "127.0.0.1", port: 8080 }
});

await env.withSecurityRulesDisabled(async context => {
  const db = context.firestore();
  const now = Timestamp.now();
  for (const [pin, role] of Object.entries(PINS)) {
    await setDoc(doc(db, "pins", pin), { role, updatedAt: now });
  }
  for (const { key, ...person } of STAFF) {
    await setDoc(doc(db, "staff", key), { ...person, active: true, createdAt: now, updatedAt: now });
  }
  for (const { key, ...preset } of CONFIG_PRESETS) {
    await setDoc(doc(db, "configPresets", key), { ...preset, notes: "", active: true, updatedAt: now });
  }
});

await env.cleanup();
console.log(`Practice database ready: ${STAFF.length} staff, ${CONFIG_PRESETS.length} colours, 2 practice PINs.`);
