// Production Planner — starter data loaded by setup.html.
// Copied from the capacity calculator's Worker Admin defaults and
// configuration colours. Edit them in the app afterwards; loading the
// starter data again never overwrites anything that already exists.

export const STAFF = [
  { key: "aarzoo",  name: "Aarzoo Aarzoo",    firstName: "Aarzoo",  inProduction: true,  skills: { subAssembly: 3, assembly: 3, testing: 0, hardware: 2, packing: 2 }, priorityRank: 3,  rosterRow: 0 },
  { key: "ethan",   name: "Ethan Merrey",     firstName: "Ethan",   inProduction: true,  skills: { subAssembly: 2, assembly: 3, testing: 0, hardware: 3, packing: 2 }, priorityRank: 4,  rosterRow: 1 },
  { key: "fares",   name: "Fares Jaber",      firstName: "Fares",   inProduction: true,  skills: { subAssembly: 0, assembly: 0, testing: 3, hardware: 2, packing: 2 }, priorityRank: 4,  rosterRow: 2 },
  { key: "hansen",  name: "Hansen",           firstName: "Hansen",  inProduction: true,  skills: { subAssembly: 2, assembly: 3, testing: 0, hardware: 2, packing: 3 }, priorityRank: 5,  rosterRow: 3 },
  { key: "jashan",  name: "Jashanpreet Kaur", firstName: "Jashan",  inProduction: true,  skills: { subAssembly: 1, assembly: 2, testing: 0, hardware: 3, packing: 1 }, priorityRank: 1,  rosterRow: 4 },
  { key: "john",    name: "John Alimasi",     firstName: "John",    inProduction: true,  skills: { subAssembly: 2, assembly: 3, testing: 0, hardware: 3, packing: 2 }, priorityRank: 6,  rosterRow: 5 },
  { key: "jose",    name: "Jose Miguel",      firstName: "Jose",    inProduction: false, skills: { subAssembly: 0, assembly: 0, testing: 0, hardware: 0, packing: 0 }, priorityRank: 50, rosterRow: 6 },
  { key: "juanita", name: "Juanita Rhenals",  firstName: "Juanita", inProduction: true,  skills: { subAssembly: 2, assembly: 2, testing: 0, hardware: 3, packing: 0 }, priorityRank: 2,  rosterRow: 7 },
  { key: "maged",   name: "Maged Ba Suliman", firstName: "Maged",   inProduction: true,  skills: { subAssembly: 0, assembly: 3, testing: 0, hardware: 0, packing: 3 }, priorityRank: 4,  rosterRow: 8 },
  { key: "mark",    name: "Mark Malonzo",     firstName: "Mark",    inProduction: false, skills: { subAssembly: 0, assembly: 0, testing: 0, hardware: 0, packing: 0 }, priorityRank: 50, rosterRow: 9 },
  { key: "rajni",   name: "Rajni Rana",       firstName: "Rajni",   inProduction: false, skills: { subAssembly: 0, assembly: 0, testing: 0, hardware: 0, packing: 0 }, priorityRank: 50, rosterRow: 10 },
  { key: "ramesh",  name: "Ramesh Kshetry",   firstName: "Ramesh",  inProduction: true,  skills: { subAssembly: 0, assembly: 0, testing: 3, hardware: 0, packing: 0 }, priorityRank: 3,  rosterRow: 11 },
  { key: "rupesh",  name: "Rupesh Limbu",     firstName: "Rupesh",  inProduction: true,  skills: { subAssembly: 0, assembly: 0, testing: 2, hardware: 3, packing: 2 }, priorityRank: 2,  rosterRow: 12 }
];

// To confirm: which connector each colour uses (cable gland, plastic 2-pin
// Bulgin or metal 2-pin) and whether the sensor wording matches the stock app.
export const CONFIG_PRESETS = [
  { key: "red",     label: "Red",     colourHex: "#b91c1c", connector: "",             sensors: "3 Standard", sensorCable: "9.2 m", powerCable: "5 m", sortOrder: 1 },
  { key: "blue",    label: "Blue",    colourHex: "#1d4ed8", connector: "2-Pin Bulgin", sensors: "1 Extended", sensorCable: "9.2 m", powerCable: "5 m", sortOrder: 2 },
  { key: "purple",  label: "Purple",  colourHex: "#7e22ce", connector: "",             sensors: "3 Standard", sensorCable: "9.2 m", powerCable: "2 m", sortOrder: 3 },
  { key: "magenta", label: "Magenta", colourHex: "#be185d", connector: "",             sensors: "1 Extended", sensorCable: "9.2 m", powerCable: "2 m", sortOrder: 4 },
  { key: "green",   label: "Green",   colourHex: "#15803d", connector: "2-Pin Bulgin", sensors: "3 Standard", sensorCable: "15 m",  powerCable: "5 m", sortOrder: 5 },
  { key: "yellow",  label: "Yellow",  colourHex: "#a16207", connector: "",             sensors: "1 Extended", sensorCable: "15 m",  powerCable: "5 m", sortOrder: 6 },
  { key: "orange",  label: "Orange",  colourHex: "#c2410c", connector: "",             sensors: "3 Standard", sensorCable: "15 m",  powerCable: "2 m", sortOrder: 7 },
  { key: "pink",    label: "Pink",    colourHex: "#db2777", connector: "",             sensors: "1 Extended", sensorCable: "15 m",  powerCable: "2 m", sortOrder: 8 }
];

export const BENCHES = [
  { key: "assembly", label: "Assembly" },
  { key: "testing",  label: "Testing" },
  { key: "hardware", label: "Hardware Check" },
  { key: "packing",  label: "Packing" },
  { key: "cage",     label: "Production cage" }
];
