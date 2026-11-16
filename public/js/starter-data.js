// Production Planner — starter data loaded by setup.html.
// Copied from the capacity calculator's Worker Admin defaults and
// configuration colours. Edit them in the app afterwards; loading the
// starter data again never overwrites anything that already exists.

export const STAFF = [
  { key: "aarzoo",  name: "Aarzoo Aarzoo",    firstName: "Aarzoo",  team: "A",      priorityRank: 3,  preferredBenches: "sub assembly, assembly", restrictedBenches: "",        rosterRow: 0 },
  { key: "ethan",   name: "Ethan Merrey",     firstName: "Ethan",   team: "A",      priorityRank: 4,  preferredBenches: "assembly, hardware",     restrictedBenches: "",        rosterRow: 1 },
  { key: "fares",   name: "Fares Jaber",      firstName: "Fares",   team: "B",      priorityRank: 4,  preferredBenches: "testing",                restrictedBenches: "",        rosterRow: 2 },
  { key: "hansen",  name: "Hansen",           firstName: "Hansen",  team: "A",      priorityRank: 5,  preferredBenches: "assembly, packing",      restrictedBenches: "",        rosterRow: 3 },
  { key: "jashan",  name: "Jashanpreet Kaur", firstName: "Jashan",  team: "A",      priorityRank: 1,  preferredBenches: "hardware",               restrictedBenches: "",        rosterRow: 4 },
  { key: "john",    name: "John Alimasi",     firstName: "John",    team: "A",      priorityRank: 6,  preferredBenches: "hardware, assembly",     restrictedBenches: "",        rosterRow: 5 },
  { key: "jose",    name: "Jose Miguel",      firstName: "Jose",    team: "IGNORE", priorityRank: 50, preferredBenches: "",                       restrictedBenches: "",        rosterRow: 6 },
  { key: "juanita", name: "Juanita Rhenals",  firstName: "Juanita", team: "A",      priorityRank: 2,  preferredBenches: "hardware",               restrictedBenches: "packing", rosterRow: 7 },
  { key: "maged",   name: "Maged Ba Suliman", firstName: "Maged",   team: "D",      priorityRank: 4,  preferredBenches: "assembly, packing",      restrictedBenches: "",        rosterRow: 8 },
  { key: "mark",    name: "Mark Malonzo",     firstName: "Mark",    team: "IGNORE", priorityRank: 50, preferredBenches: "",                       restrictedBenches: "",        rosterRow: 9 },
  { key: "rajni",   name: "Rajni Rana",       firstName: "Rajni",   team: "IGNORE", priorityRank: 50, preferredBenches: "",                       restrictedBenches: "",        rosterRow: 10 },
  { key: "ramesh",  name: "Ramesh Kshetry",   firstName: "Ramesh",  team: "C",      priorityRank: 3,  preferredBenches: "testing",                restrictedBenches: "",        rosterRow: 11 },
  { key: "rupesh",  name: "Rupesh Limbu",     firstName: "Rupesh",  team: "B",      priorityRank: 2,  preferredBenches: "hardware",               restrictedBenches: "",        rosterRow: 12 }
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
