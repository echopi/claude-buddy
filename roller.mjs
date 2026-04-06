#!/usr/bin/env node
// Compact Claude Code buddy roller - replicates /buddy derivation algorithm.
// Uses FNV-1a for npm-installed Claude Code, wyhash (via Bun) for compiled binary.
// Outputs JSON to stdout, progress to stderr.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync, statSync } from "fs";
import { execSync, execFileSync } from "child_process";
import { join } from "path";
import { homedir, platform } from "os";

const SALT = "friend-2026-401";

const SPECIES = [
  "duck", "goose", "blob", "cat", "dragon", "octopus", "owl", "penguin",
  "turtle", "snail", "ghost", "axolotl", "capybara", "cactus", "robot",
  "rabbit", "mushroom", "chonk",
];

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_WEIGHT = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
const RARITY_STARS = { common: "\u2605", uncommon: "\u2605\u2605", rare: "\u2605\u2605\u2605", epic: "\u2605\u2605\u2605\u2605", legendary: "\u2605\u2605\u2605\u2605\u2605" };

const HATS = ["none", "crown", "tophat", "propeller", "halo", "wizard", "beanie", "tinyduck"];
const EYES = ["\u00b7", "\u2726", "\u00d7", "\u25c9", "@", "\u00b0"];
const STAT_NAMES = ["DEBUGGING", "PATIENCE", "CHAOS", "WISDOM", "SNARK"];
const STAT_FLOOR = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 };

const SPECIES_ZH = {
  duck: "\u9e2d\u5b50", goose: "\u9e45", blob: "\u679c\u51bb\u56e2", cat: "\u732b",
  dragon: "\u9f99", octopus: "\u7ae0\u9c7c", owl: "\u732b\u5934\u9e70", penguin: "\u4f01\u9e45",
  turtle: "\u4e4c\u9f9f", snail: "\u8717\u725b", ghost: "\u5e7d\u7075", axolotl: "\u516d\u89d2\u6050\u9f99",
  capybara: "\u6c34\u8c5a", cactus: "\u4ed9\u4eba\u638c", robot: "\u673a\u5668\u4eba",
  rabbit: "\u5154\u5b50", mushroom: "\u8611\u83c7", chonk: "\u80d6\u58a9",
};
const RARITY_ZH = {
  common: "\u666e\u901a", uncommon: "\u975e\u51e1", rare: "\u7a00\u6709",
  epic: "\u53f2\u8bd7", legendary: "\u4f20\u8bf4",
};
const HAT_ZH = {
  none: "\u65e0", crown: "\u7687\u51a0", tophat: "\u793c\u5e3d", propeller: "\u87ba\u65cb\u6868\u5e3d",
  halo: "\u5149\u73af", wizard: "\u5deb\u5e08\u5e3d", beanie: "\u6bdb\u7ebf\u5e3d", tinyduck: "\u5c0f\u9e2d\u5b50",
};

const SPECIES_ART = {
  duck:     ["            ", "    __      ", "  <({E} )___  ", "   (  ._>   ", "    `--\u00b4    "],
  goose:    ["            ", "     ({E}>    ", "     ||     ", "   _(__)_   ", "    ^^^^    "],
  blob:     ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (      )  ", "   `----\u00b4   "],
  cat:      ["            ", "   /\\_/\\    ", "  ( {E}   {E})  ", "  (  \u03c9  )   ", '  (")\\_(")\u00a0  '],
  dragon:   ["            ", "  /^\\  /^\\  ", " <  {E}  {E}  > ", " (   ~~   ) ", "  `-vvvv-\u00b4  "],
  octopus:  ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (______)  ", "  /\\/\\/\\/\\  "],
  owl:      ["            ", "   /\\  /\\   ", "  (({E})({E}))  ", "  (  ><  )  ", "   `----\u00b4   "],
  penguin:  ["            ", "  .---.     ", "  ({E}>{E})     ", " /(   )\\    ", "  `---\u00b4     "],
  turtle:   ["            ", "   _,--._   ", "  ( {E}  {E} )  ", " /[______]\\ ", "  ``    ``  "],
  snail:    ["            ", " {E}    .--.  ", "  \\  ( @ )  ", "   \\_`--\u00b4   ", "  ~~~~~~~   "],
  ghost:    ["            ", "   .----.   ", "  / {E}  {E} \\  ", "  |      |  ", "  ~`~``~`~  "],
  axolotl:  ["            ", "}~(______)~{", "}~({E} .. {E})~{", "  ( .--. )  ", "  (_/  \\_)  "],
  capybara: ["            ", "  n______n  ", " ( {E}    {E} ) ", " (   oo   ) ", "  `------\u00b4  "],
  cactus:   ["            ", " n  ____  n ", " | |{E}  {E}| | ", " |_|    |_| ", "   |    |   "],
  robot:    ["            ", "   .[||].   ", "  [ {E}  {E} ]  ", "  [ ==== ]  ", "  `------\u00b4  "],
  rabbit:   ["            ", "   (\\__/)   ", "  ( {E}  {E} )  ", " =(  ..  )= ", '  (")\\_\\_(")  '],
  mushroom: ["            ", " .-o-OO-o-. ", "(__________)", "   |{E}  {E}|   ", "   |____|   "],
  chonk:    ["            ", "  /\\    /\\  ", " ( {E}    {E} ) ", " (   ..   ) ", "  `------\u00b4  "],
};
const HAT_ART = {
  none: "", crown: "   \\^^^/    ", tophat: "   [___]    ", propeller: "    -+-     ",
  halo: "   (   )    ", wizard: "    /^\\     ", beanie: "   (___)    ", tinyduck: "    ,>      ",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const HEX = "0123456789abcdef";

// --- Claude Code runtime detection + hash selection ---

const IS_BUN = typeof Bun !== "undefined" && typeof Bun.hash === "function";

function findClaudeBinary() {
  if (process.env.CLAUDE_BINARY) {
    const p = process.env.CLAUDE_BINARY;
    if (existsSync(p)) return realpathSync(p);
  }
  const IS_WIN = platform() === "win32";
  const IS_MAC = platform() === "darwin";
  const EXEC_OPTS = { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] };
  try {
    const raw = execSync(IS_WIN ? "where claude" : "which claude", EXEC_OPTS).trim().split(/\r?\n/)[0].trim();
    if (raw && existsSync(raw)) {
      const resolved = realpathSync(raw);
      try { if (statSync(resolved).size >= 1_000_000) return resolved; } catch {}
      const ccPkg = join("@anthropic-ai", "claude-code");
      const idx = resolved.indexOf(ccPkg);
      if (idx !== -1) {
        const bin = join(resolved.substring(0, idx + ccPkg.length), IS_WIN ? "claude.exe" : "claude");
        try { if (existsSync(bin) && statSync(bin).size >= 1_000_000) return bin; } catch {}
      }
      return resolved;
    }
  } catch {}
  const home = homedir();
  const candidates = IS_MAC
    ? [join(home, ".local", "bin", "claude"), join(home, ".claude", "local", "claude"), "/usr/local/bin/claude", "/opt/homebrew/bin/claude"]
    : [join(home, ".local", "bin", "claude"), "/usr/local/bin/claude", "/usr/bin/claude"];
  for (const c of candidates) {
    if (existsSync(c)) return realpathSync(c);
  }
  return null;
}

function findBun() {
  const EXEC_OPTS = { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] };
  try {
    const p = execSync(platform() === "win32" ? "where bun" : "which bun", EXEC_OPTS).trim().split(/\r?\n/)[0].trim();
    if (p && existsSync(p)) return p;
  } catch {}
  const home = homedir();
  for (const c of [join(home, ".bun", "bin", "bun"), "/usr/local/bin/bun"]) {
    if (existsSync(c)) return c;
  }
  return null;
}

let _detectCache;
function detectHashEngine() {
  if (_detectCache !== undefined) return _detectCache;
  const bin = findClaudeBinary();
  const isNodeBin = bin && (bin.endsWith(".js") || bin.endsWith(".mjs"));
  _detectCache = { binary: bin, useWyhash: bin ? !isNodeBin : false };
  return _detectCache;
}

// If wyhash needed but running under Node, re-exec under Bun
function maybeReexecUnderBun() {
  if (IS_BUN || !detectHashEngine().useWyhash) return;
  const bunPath = findBun();
  if (!bunPath) {
    process.stderr.write("Warning: compiled Claude Code detected but Bun not found, falling back to FNV-1a\n");
    _detectCache.useWyhash = false;
    return;
  }
  const result = execFileSync(bunPath, process.argv.slice(1), {
    encoding: "utf-8", stdio: ["pipe", "pipe", process.stderr],
  });
  process.stdout.write(result);
  process.exit(0);
}

function wyhash32(input) {
  return Number(BigInt.asUintN(32, Bun.hash(input)));
}

function hashInput(input) {
  return (IS_BUN && detectHashEngine().useWyhash) ? wyhash32(input) : fnv1a(input);
}

// --- Core algorithm (must match Claude Code's derivation) ---

function splitmix32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let q = Math.imul(s ^ (s >>> 15), 1 | s);
    q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
    return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
  };
}

function fnv1a(input) {
  let h = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
  }
  return h >>> 0;
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function rollRarity(rng) {
  let roll = rng() * 100;
  for (const r of RARITIES) {
    roll -= RARITY_WEIGHT[r];
    if (roll < 0) return r;
  }
  return "common";
}

function rollStats(rng, rarity) {
  const floor = STAT_FLOOR[rarity];
  const primary = pick(rng, STAT_NAMES);
  let weak = pick(rng, STAT_NAMES);
  while (weak === primary) weak = pick(rng, STAT_NAMES);
  const stats = {};
  for (const n of STAT_NAMES) {
    if (n === primary) stats[n] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    else if (n === weak) stats[n] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    else stats[n] = floor + Math.floor(rng() * 40);
  }
  return stats;
}

function deriveBuddy(seed) {
  const rng = splitmix32(hashInput(seed + SALT));
  const rarity = rollRarity(rng);
  const species = pick(rng, SPECIES);
  const eye = pick(rng, EYES);
  const hat = rarity === "common" ? "none" : pick(rng, HATS);
  const shiny = rng() < 0.01;
  const stats = rollStats(rng, rarity);
  return { seed, rarity, species, eye, hat, shiny, stats };
}

// --- Display ---

function renderArt(species, eye, hat) {
  const art = (SPECIES_ART[species] || SPECIES_ART.blob).map((l) => l.replace(/\{E\}/g, eye));
  if (hat !== "none" && !art[0].trim()) {
    const copy = [...art];
    copy[0] = HAT_ART[hat] || copy[0];
    return copy;
  }
  return art;
}

function bar(v, w = 10) {
  const f = Math.min(w, Math.round((v / 100) * w));
  return "\u2588".repeat(f) + "\u2591".repeat(w - f);
}

function formatCard(p) {
  const lines = [];
  lines.push(
    `${RARITY_STARS[p.rarity]} ${RARITY_ZH[p.rarity]}/${p.rarity.toUpperCase()} ` +
      `${SPECIES_ZH[p.species]}/${p.species}` +
      (p.shiny ? " \u2728\u95ea\u5149" : "") +
      (p.hat !== "none" ? ` [${HAT_ZH[p.hat]}]` : "")
  );
  lines.push(`Seed: ${p.seed}`);
  lines.push("\u2500".repeat(40));
  for (const l of renderArt(p.species, p.eye, p.hat)) lines.push(l);
  lines.push("\u2500".repeat(40));
  lines.push(`Eyes: ${p.eye}  Hat: ${HAT_ZH[p.hat]}/${p.hat}`);
  for (const n of STAT_NAMES) {
    lines.push(`  ${n.padEnd(10)} ${bar(p.stats[n])} ${String(p.stats[n]).padStart(3)}`);
  }
  return lines.join("\n");
}

// --- Config ---

function randomUUID() {
  let v = "";
  for (let i = 0; i < 32; i++) v += HEX[(Math.random() * 16) | 0];
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-4${v.slice(13, 16)}-${HEX[((Math.random() * 4) | 0) + 8]}${v.slice(17, 20)}-${v.slice(20, 32)}`;
}

function randomHex64() {
  let v = "";
  for (let i = 0; i < 64; i++) v += HEX[(Math.random() * 16) | 0];
  return v;
}

function getConfig() {
  const paths = [];
  if (process.env.CLAUDE_CONFIG_DIR) paths.push(join(process.env.CLAUDE_CONFIG_DIR, ".claude.json"));
  paths.push(join(homedir(), ".claude.json"), join(homedir(), ".claude", ".claude.json"));
  const found = paths.find((p) => existsSync(p));
  if (!found) return null;
  try {
    return { path: found, data: JSON.parse(readFileSync(found, "utf-8")) };
  } catch {
    return null;
  }
}

function getSeedSlot(data) {
  if (!data) return { source: "anon", value: "anon", format: "uuid" };
  if (data.oauthAccount?.accountUuid)
    return { source: "oauthAccount.accountUuid", value: data.oauthAccount.accountUuid, format: "uuid" };
  if (data.userID) return { source: "userID", value: data.userID, format: "hex" };
  return { source: "anon", value: "anon", format: "uuid" };
}

// --- Profiles ---

const PROFILES_PATH = join(homedir(), ".claude", "buddy-profiles.json");

function loadProfiles() {
  try { return JSON.parse(readFileSync(PROFILES_PATH, "utf-8")); } catch { return {}; }
}

function saveProfiles(profiles) {
  mkdirSync(join(homedir(), ".claude"), { recursive: true });
  writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2) + "\n");
}

// --- Commands ---

function cmdInspect() {
  const cfg = getConfig();
  if (!cfg) return JSON.stringify({ error: "No Claude config found" });
  const slot = getSeedSlot(cfg.data);
  const buddy = deriveBuddy(slot.value);
  return JSON.stringify({
    config: cfg.path,
    seedSource: slot.source,
    seedValue: slot.value,
    seedFormat: slot.format,
    hashEngine: _detectCache.useWyhash ? "wyhash (compiled)" : "fnv1a (npm)",
    claudeBinary: _detectCache.binary || "not found",
    companion: cfg.data.companion || null,
    buddy,
    card: formatCard(buddy),
  });
}

function cmdHunt(args) {
  const f = {
    rarity: null, species: null, eye: null, hat: null,
    shiny: false, statFloor: null, limit: 3, tries: 10_000_000,
  };
  let seedFormat = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--species":  f.species = args[++i]; break;
      case "--rarity":   f.rarity = args[++i]; break;
      case "--eye":      f.eye = args[++i]; break;
      case "--hat":      f.hat = args[++i]; break;
      case "--shiny":    f.shiny = true; break;
      case "--stat-floor": f.statFloor = parseInt(args[++i]); break;
      case "--limit":    f.limit = parseInt(args[++i]); break;
      case "--tries":    f.tries = parseInt(args[++i]); break;
      case "--format":   seedFormat = args[++i]; break;
    }
  }

  if (!seedFormat) {
    const cfg = getConfig();
    const slot = getSeedSlot(cfg?.data);
    seedFormat = slot.format;
  }

  const gen = seedFormat === "hex" ? randomHex64 : randomUUID;
  const results = [];
  const t0 = performance.now();

  for (let i = 0; i < f.tries; i++) {
    if (i > 0 && i % 2_000_000 === 0) {
      const rate = Math.round(i / ((performance.now() - t0) / 1000));
      process.stderr.write(`... searched ${(i / 1e6).toFixed(0)}M seeds (~${(rate / 1e6).toFixed(1)}M/s)\n`);
    }

    const seed = gen();
    const rng = splitmix32(hashInput(seed + SALT));

    const rarity = rollRarity(rng);
    if (f.rarity && rarity !== f.rarity) continue;

    const species = pick(rng, SPECIES);
    if (f.species && species !== f.species) continue;

    const eye = pick(rng, EYES);
    if (f.eye && eye !== f.eye) continue;

    const hat = rarity === "common" ? "none" : pick(rng, HATS);
    if (f.hat && hat !== f.hat) continue;

    const shiny = rng() < 0.01;
    if (f.shiny && !shiny) continue;

    const stats = rollStats(rng, rarity);
    if (f.statFloor && !Object.values(stats).every((v) => v >= f.statFloor)) continue;

    results.push({ seed, rarity, species, eye, hat, shiny, stats });
    process.stderr.write(`Match #${results.length} after ${(i + 1).toLocaleString()} attempts\n`);

    if (results.length >= f.limit) break;
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  return JSON.stringify({
    results: results.map((r) => ({ ...r, card: formatCard(r) })),
    elapsed: `${elapsed}s`,
    totalTried: f.tries,
    filters: f,
  });
}

function cmdStamp(seed) {
  const fmt = UUID_RE.test(seed) ? "uuid" : HEX64_RE.test(seed) ? "hex" : "unknown";
  if (fmt === "unknown") return JSON.stringify({ error: "Seed must be a UUID or 64-char hex string" });

  const cfg = getConfig();
  if (!cfg) return JSON.stringify({ error: "No Claude config found" });

  const slot = getSeedSlot(cfg.data);
  if (slot.format !== fmt)
    return JSON.stringify({ error: `Format mismatch: config expects ${slot.format}, got ${fmt}` });

  const backup = `${cfg.path}.backup-${Date.now()}`;
  copyFileSync(cfg.path, backup);

  if (slot.source === "oauthAccount.accountUuid") {
    if (!cfg.data.oauthAccount) cfg.data.oauthAccount = {};
    cfg.data.oauthAccount.accountUuid = seed;
  } else cfg.data.userID = seed;

  delete cfg.data.companion;
  writeFileSync(cfg.path, JSON.stringify(cfg.data, null, 2) + "\n");

  const buddy = deriveBuddy(seed);
  return JSON.stringify({
    stamped: true,
    backup,
    field: slot.source,
    seed,
    buddy,
    card: formatCard(buddy),
  });
}

function cmdReroll() {
  const cfg = getConfig();
  if (!cfg) return JSON.stringify({ error: "No Claude config found" });
  const slot = getSeedSlot(cfg.data);
  const seed = slot.format === "hex" ? randomHex64() : randomUUID();
  const buddy = deriveBuddy(seed);
  return JSON.stringify({ seed, format: slot.format, buddy, card: formatCard(buddy) });
}

function cmdRestore(backupPath) {
  if (!backupPath || !existsSync(backupPath)) return JSON.stringify({ error: "Backup file not found" });
  const cfg = getConfig();
  if (!cfg) return JSON.stringify({ error: "No Claude config found" });
  let data;
  try { data = JSON.parse(readFileSync(backupPath, "utf-8")); } catch {
    return JSON.stringify({ error: "Backup file is not valid JSON" });
  }
  copyFileSync(backupPath, cfg.path);
  const slot = getSeedSlot(data);
  const buddy = deriveBuddy(slot.value);
  return JSON.stringify({ restored: true, from: backupPath, config: cfg.path, buddy, card: formatCard(buddy) });
}

function cmdSave(name) {
  if (!name) return JSON.stringify({ error: "Profile name is required" });
  const cfg = getConfig();
  if (!cfg) return JSON.stringify({ error: "No Claude config found" });
  const slot = getSeedSlot(cfg.data);
  const buddy = deriveBuddy(slot.value);
  const profiles = loadProfiles();
  profiles[name] = {
    seed: slot.value,
    seedSource: slot.source,
    companion: cfg.data.companion || null,
    savedAt: Date.now(),
  };
  saveProfiles(profiles);
  return JSON.stringify({ saved: true, name, seed: slot.value, buddy, card: formatCard(buddy) });
}

function cmdSwitch(name) {
  if (!name) return JSON.stringify({ error: "Profile name is required" });
  const profiles = loadProfiles();
  const profile = profiles[name];
  if (!profile) return JSON.stringify({ error: `Profile "${name}" not found`, available: Object.keys(profiles) });
  const cfg = getConfig();
  if (!cfg) return JSON.stringify({ error: "No Claude config found" });

  const backup = `${cfg.path}.backup-${Date.now()}`;
  copyFileSync(cfg.path, backup);

  if (profile.seedSource === "oauthAccount.accountUuid") {
    if (!cfg.data.oauthAccount) cfg.data.oauthAccount = {};
    cfg.data.oauthAccount.accountUuid = profile.seed;
  } else cfg.data.userID = profile.seed;

  if (profile.companion) cfg.data.companion = profile.companion;
  else delete cfg.data.companion;

  writeFileSync(cfg.path, JSON.stringify(cfg.data, null, 2) + "\n");
  const buddy = deriveBuddy(profile.seed);
  return JSON.stringify({
    switched: true, name, backup, seed: profile.seed,
    companion: profile.companion, buddy, card: formatCard(buddy),
  });
}

function cmdProfiles() {
  const profiles = loadProfiles();
  const entries = Object.entries(profiles).map(([name, p]) => {
    const buddy = deriveBuddy(p.seed);
    return { name, seed: p.seed, companion: p.companion, buddy, card: formatCard(buddy) };
  });
  return JSON.stringify({ profiles: entries });
}

function cmdDeleteProfile(name) {
  if (!name) return JSON.stringify({ error: "Profile name is required" });
  const profiles = loadProfiles();
  if (!profiles[name]) return JSON.stringify({ error: `Profile "${name}" not found` });
  delete profiles[name];
  saveProfiles(profiles);
  return JSON.stringify({ deleted: true, name, remaining: Object.keys(profiles) });
}

// --- Main ---

maybeReexecUnderBun();
const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "inspect":
    console.log(cmdInspect());
    break;
  case "hunt":
    console.log(cmdHunt(args));
    break;
  case "stamp":
    if (!args[0]) { console.error("Usage: stamp <seed>"); process.exit(1); }
    console.log(cmdStamp(args[0]));
    break;
  case "reroll":
    console.log(cmdReroll());
    break;
  case "restore":
    if (!args[0]) { console.error("Usage: restore <backup-path>"); process.exit(1); }
    console.log(cmdRestore(args[0]));
    break;
  case "save":
    if (!args[0]) { console.error("Usage: save <name>"); process.exit(1); }
    console.log(cmdSave(args[0]));
    break;
  case "switch":
    if (!args[0]) { console.error("Usage: switch <name>"); process.exit(1); }
    console.log(cmdSwitch(args[0]));
    break;
  case "profiles":
    console.log(cmdProfiles());
    break;
  case "delete-profile":
    if (!args[0]) { console.error("Usage: delete-profile <name>"); process.exit(1); }
    console.log(cmdDeleteProfile(args[0]));
    break;
  default:
    console.error("Commands: inspect | hunt | stamp | reroll | restore | save | switch | profiles | delete-profile");
    process.exit(1);
}
