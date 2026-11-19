// Production Planner — the agreed single-build capacity rules, shared.
// (Same numbers as the Management screen's planner.)
//
//   Assembly   6 a bench (Tap 8), only in a phase that has Sub Assembly
//   Testing    half the daily limit per phase with 2+ testers; day max
//              36 Verizon / 30 Global
//   Hardware   by benches in the phase (2 → 24, 3 → 30, 4 → 36 Gen4)
//   Packing    by benches in the phase (2 → 30, 3 → 36 Gen4; Tap 2 → 50)

export const isTap = unitType => unitType === "tap";
export const dailyLimit = commsType => (commsType === "verizon" ? 36 : 30);
export const assemblyPerBench = unitType => (isTap(unitType) ? 8 : 6);

export function hardwareCapacity(benches, unitType, commsType) {
  if (isTap(unitType)) {
    if (commsType !== "verizon") return benches >= 4 ? 42 : benches === 3 ? 36 : benches === 2 ? 30 : 0;
    return benches >= 4 ? 50 : benches === 3 ? 42 : benches === 2 ? 36 : 0;
  }
  return benches >= 4 ? 36 : benches === 3 ? 30 : benches === 2 ? 24 : 0;
}

export function packingCapacity(benches, unitType) {
  if (isTap(unitType)) return benches >= 2 ? 50 : 0;
  return benches >= 3 ? 36 : benches === 2 ? 30 : 0;
}

export const testingPerPhase = (testers, commsType) => (testers >= 2 ? dailyLimit(commsType) / 2 : 0);

// Units one station gives in one phase. counts = { station: people } for that phase.
export function phaseOutput(station, counts, unitType, commsType) {
  const n = counts[station] || 0;
  if (station === "assembly") return (counts.subAssembly || 0) > 0 ? n * assemblyPerBench(unitType) : 0;
  if (station === "testing") return testingPerPhase(n, commsType);
  if (station === "hardware") return hardwareCapacity(n, unitType, commsType);
  if (station === "packing") return packingCapacity(n, unitType);
  return null;
}

// The day's finished units for a layout. phaseCounts = [{ station: people }, …]
// Returns { units, limitedBy, totals } where totals are per stage.
export function dayEstimate(phaseCounts, unitType, commsType) {
  const sum = station => phaseCounts.reduce((total, counts) => total + (phaseOutput(station, counts, unitType, commsType) || 0), 0);
  const totals = {
    assembly: sum("assembly"),
    testing: Math.min(dailyLimit(commsType), sum("testing")),
    hardware: sum("hardware"),
    packing: sum("packing")
  };
  const [limitedBy, units] = Object.entries(totals).reduce((low, item) => (item[1] < low[1] ? item : low));
  return { units: Math.min(units, dailyLimit(commsType)), limitedBy, totals };
}
