// Production Planner — skills: who can do which job, and how well.
//
// Each person has 0–3 dots for each job:
//   3  usually on this job (picked first)
//   2  on it when needed
//   1  last resort
//   0  can't do it
// plus "in production" (off = not planned at all).
//
// Staff saved before skills existed used team letters (A–D, Ignore) with
// preferred / restricted benches; those are turned into dots here so the
// plans come out the same.
(function () {
  "use strict";

  const SKILL_KEYS = ["subAssembly", "assembly", "testing", "hardware", "packing"];
  const SKILL_LABELS = { subAssembly: "Sub Assembly", assembly: "Assembly", testing: "Testing", hardware: "Hardware", packing: "Packaging build-up" };
  const SKILL_SHORT = { subAssembly: "SA", assembly: "AS", testing: "TE", hardware: "HW", packing: "PB" };

  // Which job each station needs. Final packaging and custom jobs: anyone.
  const STATION_SKILL = {
    subAssembly: "subAssembly",
    assembly: "assembly", assemblyGen4: "assembly", assemblyTap: "assembly",
    testing: "testing", testingVerizon: "testing", testingGlobal: "testing",
    hardware: "hardware",
    packing: "packing"
  };

  const LEGACY_TEAMS = { subAssembly: ["A"], assembly: ["A", "D"], testing: ["B", "C"], hardware: ["A", "B"], packing: ["A", "B", "D"] };

  function benchToken(value) {
    const text = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const aliases = {
      "sub assembly": "subAssembly", subassembly: "subAssembly", assembly: "assembly",
      testing: "testing", test: "testing", hardware: "hardware", "hardware check": "hardware",
      packing: "packing", pack: "packing"
    };
    return aliases[text] || text;
  }

  // A station can belong to one product: "assembly:solar", "testing:solar".
  // Its first part says which job (and skill) it is.
  const stationBase = station => String(station || "").split(":")[0];

  const benchList = value => String(value || "").split(/[;,|]/).map(benchToken).filter(Boolean);
  const clampLevel = value => Math.max(0, Math.min(3, Math.round(Number(value) || 0)));

  function legacySkills(person, key) {
    const preferred = benchList(person.preferredBenches);
    const restricted = benchList(person.restrictedBenches);
    const team = String(person.team || "").toUpperCase();
    const skills = {};
    SKILL_KEYS.forEach(skill => {
      let level = LEGACY_TEAMS[skill].includes(team) ? 2 : 0;
      if (level && preferred.includes(skill)) level = 3;
      if (restricted.includes(skill)) level = 0;
      skills[skill] = level;
    });
    // The old planner always put Jashan on Hardware first, and on Sub
    // Assembly and Packing only as a last resort.
    if (key === "jashan") {
      if (skills.hardware) skills.hardware = 3;
      if (skills.subAssembly) skills.subAssembly = 1;
      if (skills.packing) skills.packing = 1;
    }
    return skills;
  }

  function skillsOf(person, key) {
    const saved = person && person.skills;
    if (saved && typeof saved === "object") {
      return Object.fromEntries(SKILL_KEYS.map(skill => [skill, clampLevel(saved[skill])]));
    }
    return legacySkills(person || {}, key || (person && person.key));
  }

  function inProduction(person) {
    if (person && typeof person.inProduction === "boolean") return person.inProduction;
    return String((person && person.team) || "").toUpperCase() !== "IGNORE";
  }

  // 0–3 for a station (or a skill key). Not in production = 0.
  function levelFor(person, station, key) {
    if (!person || !inProduction(person)) return 0;
    const base = stationBase(station);
    const skill = STATION_SKILL[station] || STATION_SKILL[base] || (SKILL_KEYS.includes(base) ? base : null);
    if (!skill) return 1;
    return skillsOf(person, key)[skill];
  }

  window.PlannerSkills = { SKILL_KEYS, SKILL_LABELS, SKILL_SHORT, skillsOf, inProduction, levelFor, clampLevel, stationBase };
})();
