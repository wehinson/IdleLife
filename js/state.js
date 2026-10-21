/* =========================================================================
 * state.js — game state factory, derived stats, Complexity/prestige math,
 * save/load, event log, number formatting.
 * G.state is the single live mutable state object the whole game reads.
 * ========================================================================= */

(function () {
  "use strict";
  const cfg = G.config;

  /* --- Fresh state ---
   * A "run" is everything reset by prestige. Prestige-persistent data lives
   * under `prestige` and is carried across runs by G.engine.prestige(). --- */
  G.factory = function newState() {
    const resources = {};
    cfg.resources.forEach((r) => (resources[r.id] = r.startAmount || 0));
    const milestones = {};
    for (const id in cfg.milestones) milestones[id] = false;
    return {
      version: 3,
      resources,
      // run-scoped progress
      milestones,                // milestoneId -> reached? (built from config)
      discovered: {},            // eventId -> true (first-seen tracking, run-scoped)
      rareDiscovered: {},        // rare eventId -> true (feeds Complexity)
      highestRedox: 0,           // peak derived Redox Charge this run
      firstMeteorDone: false,
      // prestige-persistent
      prestige: {
        points: 0,
        count: 0,               // total prestiges performed
        upgrades: {},           // upgradeId -> level
        draft: [],              // current offered upgrade ids (empty = none pending)
      },
      // run-scoped in-run upgrade economy (Paths). Wiped by prestige — NOT
      // carried in freshRun. upgradeId -> level.
      pathUpgrades: {},
      nextPhaseUnlocked: false,  // set when the amino-acid capstone fires (persists)
      eventLog: [],
      stats: { totalStrikes: 0, prestiges: 0 },
      lastSaved: Date.now(),
    };
  };

  G.state = G.factory();

  /* --- Fresh RUN state (prestige): wipe run resources & milestones, keep the
   * prestige block, counters, and the permanent nextPhase flag. --- */
  G.freshRun = function (prev) {
    const s = G.factory();
    s.prestige = prev.prestige;
    s.nextPhaseUnlocked = prev.nextPhaseUnlocked;
    s.eventLog = prev.eventLog;
    s.stats = prev.stats;
    return s;
  };

  /* --- Derived stats: sum prestige-upgrade effects into a flat bag the engine
   * reads. Fully generic — every effect key found in config is accumulated, so
   * adding an upgrade with a new effect key needs only a matching read in the
   * engine (no switch to maintain here). Base multipliers default to 1; every
   * other effect key defaults to 0. --- */
  G.derive = function (s) {
    s = s || G.state;
    const d = {
      eventGainMult: 1,       // scales feedstock grants + passive generation
      reactionYieldMult: 1,   // scales reaction outputs
      totalLevels: 0,
    };
    // Seed every effect key that appears in config to 0 (unless it's a base
    // multiplier already set to 1 above), so a zero-level key reads as 0.
    cfg.prestigeUpgrades.forEach((u) => {
      if (!u.effects) return;
      for (const k in u.effects) if (d[k] == null) d[k] = 0;
    });
    cfg.prestigeUpgrades.forEach((u) => {
      const lvl = (s.prestige.upgrades && s.prestige.upgrades[u.id]) || 0;
      d.totalLevels += lvl;
      if (!lvl || !u.effects) return;
      for (const k in u.effects) d[k] += u.effects[k] * lvl;
    });
    // Path upgrades (in-run, per-run) fold into the SAME bag, so any effect key
    // the engine already reads works identically. Placeholders carry no effects.
    (cfg.pathUpgrades || []).forEach((u) => {
      if (!u.effects || u.placeholder) return;
      for (const k in u.effects) if (d[k] == null) d[k] = 0;
    });
    (cfg.pathUpgrades || []).forEach((u) => {
      if (!u.effects || u.placeholder) return;
      const lvl = (s.pathUpgrades && s.pathUpgrades[u.id]) || 0;
      d.totalLevels += lvl;
      if (!lvl) return;
      for (const k in u.effects) d[k] += u.effects[k] * lvl;
    });
    return d;
  };

  /* --- Redox Charge: derived reducing power from electron donors. Each
   * resource flagged `electronDonor` contributes stock x strength; donors with
   * an `unlockEffect` only count once a prestige upgrade sets that effect.
   * Boosted by donorStrengthMult. This is the hidden stat that stays out of the
   * UI until the Reducing Environment reveals it. --- */
  G.redoxCharge = function (s) {
    s = s || G.state;
    const d = G.derive(s);
    const strengthMult = 1 + (d.donorStrengthMult || 0);
    let total = 0;
    cfg.resources.forEach((r) => {
      const ed = r.electronDonor;
      if (!ed) return;
      if (ed.unlockEffect && !((d[ed.unlockEffect] || 0) > 0)) return;
      total += (s.resources[r.id] || 0) * (ed.strength || 0) * strengthMult;
    });
    return total;
  };

  /* --- Milestone gate check: null gate is always open. --- */
  G.meetsMilestone = function (gate, s) {
    s = s || G.state;
    if (!gate) return true;
    return !!(s.milestones && s.milestones[gate]);
  };

  /* --- Complexity: weighted run score used to compute prestige points.
   * Any weight key matching a resource id is read straight off s.resources —
   * add a resource + a weight in config.js and it counts automatically. The
   * remaining keys are special, non-resource run stats. --- */
  const COMPLEXITY_SPECIAL = {
    highestRedox: (s) => s.highestRedox || 0,
    rareEventsDiscovered: (s) => Object.keys(s.rareDiscovered || {}).length,
    reducingEnvironmentUnlocked: (s) => (s.milestones.reducingEnvironment ? 1 : 0),
    // "Energy input types triggered" — distinct top-level events (lightning, uv,
    // cavitation, volcanic, geothermal, meteor), not meteor sub-variants.
    eventTypesDiscovered: (s) => Object.keys(s.discovered || {}).length,
  };
  G.complexity = function (s) {
    s = s || G.state;
    const w = cfg.prestige.complexity.weights;
    let c = 0;
    for (const k in w) {
      const special = COMPLEXITY_SPECIAL[k];
      const amount = special ? special(s) : (s.resources[k] || 0);
      c += amount * w[k];
    }
    return c;
  };

  /* --- Prestige points earnable from the current run (0 for shallow runs). --- */
  G.prestigePoints = function (s) {
    s = s || G.state;
    const f = cfg.prestige.pointsFormula;
    const c = G.complexity(s);
    if (c <= f.minComplexity) return 0;
    return Math.floor(Math.pow((c - f.minComplexity) / f.divisor, f.exponent));
  };

  /* --- Prestige-upgrade / milestone helpers --- */
  G.upgradeById = function (id) {
    return cfg.prestigeUpgrades.find((u) => u.id === id);
  };

  G.trunkUnlocked = function (trunk, s) {
    s = s || G.state;
    if (trunk.unlockedFromStart) return true;
    if (trunk.unlockedBy) return !!s.milestones[trunk.unlockedBy];
    return true;
  };

  G.upgradeAvailable = function (u, s) {
    s = s || G.state;
    if (u.requires && u.requires.milestone && !s.milestones[u.requires.milestone]) return false;
    const lvl = (s.prestige.upgrades && s.prestige.upgrades[u.id]) || 0;
    return lvl < (u.max || Infinity);
  };

  /* --- Path-upgrade helpers (in-run economy, parallel to the prestige draft) --- */
  G.pathUpgradeById = function (id) {
    return (cfg.pathUpgrades || []).find((u) => u.id === id);
  };

  G.pathUnlocked = function (path, s) {
    s = s || G.state;
    if (!path) return false;
    if (path.unlockedFromStart) return true;
    if (path.unlockedBy) return !!s.milestones[path.unlockedBy];
    return true;
  };

  G.pathUpgradeLevel = function (u, s) {
    s = s || G.state;
    return (s.pathUpgrades && s.pathUpgrades[u.id]) || 0;
  };

  // Cost of the NEXT level: base * costGrowth ^ currentLevel, per resource.
  G.pathUpgradeCost = function (u, s) {
    s = s || G.state;
    const lvl = G.pathUpgradeLevel(u, s);
    const growth = u.costGrowth || 1;
    const out = {};
    for (const r in (u.cost || {})) out[r] = Math.ceil(u.cost[r] * Math.pow(growth, lvl));
    return out;
  };

  G.canAfford = function (cost, s) {
    s = s || G.state;
    for (const r in (cost || {})) if ((s.resources[r] || 0) < cost[r]) return false;
    return true;
  };

  // Buyable now? not a placeholder, path unlocked, requires met, below max.
  G.pathUpgradeAvailable = function (u, s) {
    s = s || G.state;
    if (!u || u.placeholder) return false;
    const path = (cfg.paths || []).find((p) => p.id === u.path);
    if (!G.pathUnlocked(path, s)) return false;
    if (u.requires && u.requires.milestone && !s.milestones[u.requires.milestone]) return false;
    return G.pathUpgradeLevel(u, s) < (u.max || Infinity);
  };

  /* --- Milestone requirement check (resource thresholds) --- */
  G.meetsRequires = function (requires, s) {
    s = s || G.state;
    for (const r in requires) {
      if ((s.resources[r] || 0) < requires[r]) return false;
    }
    return true;
  };

  /* --- Event log --- */
  G.log = function (msg) {
    const s = G.state;
    s.eventLog.unshift({ t: Date.now(), msg });
    if (s.eventLog.length > 40) s.eventLog.length = 40;
    if (G.ui && G.ui.renderLog) G.ui.renderLog();
  };

  /* --- Number formatting (idle counts grow fast) --- */
  const SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  G.fmt = function (n) {
    if (!isFinite(n)) return "∞";
    const neg = n < 0;
    n = Math.abs(n);
    let out;
    if (n < 1000) {
      out = n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
    } else {
      const tier = Math.floor(Math.log10(n) / 3);
      const s = SUFFIX[tier] || "e" + tier * 3;
      out = (n / Math.pow(10, tier * 3)).toFixed(2) + s;
    }
    return neg ? "-" + out : out;
  };

  /* --- Save / Load --- */
  // Build a candidate without mutating live state. Missing fields still migrate
  // through factory defaults; unknown/removed config ids are ignored as before.
  G.hydrateSave = function (data) {
    function invalid(path) { throw new Error("Invalid save field: " + path); }
    function record(value, path) {
      if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path);
      return value;
    }
    function optionalRecord(value, path) {
      return value === undefined ? {} : record(value, path);
    }
    function number(value, fallback, path, integer, max) {
      if (value === undefined) return fallback;
      // Older hydration accepted numeric strings; retain that compatibility,
      // but do not coerce null, booleans, empty strings, arrays or objects.
      if (typeof value !== "number" &&
          !(typeof value === "string" && value.trim() !== "")) invalid(path);
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n)) ||
          (max !== undefined && n > max)) invalid(path);
      return n;
    }
    function flag(value, fallback, path) {
      if (value === undefined) return fallback;
      if (typeof value !== "boolean") invalid(path);
      return value;
    }
    function flags(value, path, defaults) {
      const input = optionalRecord(value, path);
      const result = {};
      for (const id of Object.keys(defaults || input)) {
        Object.defineProperty(result, id, {
          value: flag(input[id], false, path + "." + id),
          enumerable: true, writable: true, configurable: true,
        });
      }
      return result;
    }
    record(data, "root");
    if (data.version !== undefined && data.version !== 3) invalid("version");
    const s = G.factory();
    const resources = optionalRecord(data.resources, "resources");
    for (const id in s.resources) {
      s.resources[id] = number(resources[id], 0, "resources." + id);
    }
    s.milestones = flags(data.milestones, "milestones", s.milestones);
    s.discovered = flags(data.discovered, "discovered");
    s.rareDiscovered = flags(data.rareDiscovered, "rareDiscovered");
    s.highestRedox = number(data.highestRedox, 0, "highestRedox");
    s.firstMeteorDone = flag(data.firstMeteorDone, false, "firstMeteorDone");
    s.nextPhaseUnlocked = flag(data.nextPhaseUnlocked, false, "nextPhaseUnlocked");
    const prestige = optionalRecord(data.prestige, "prestige");
    s.prestige.points = number(prestige.points, 0, "prestige.points", true);
    s.prestige.count = number(prestige.count, 0, "prestige.count", true);
    function levels(value, upgrades, path) {
      const input = optionalRecord(value, path);
      const result = {};
      upgrades.forEach((u) => {
        result[u.id] = number(input[u.id], 0, path + "." + u.id, true, u.max);
      });
      return result;
    }
    s.prestige.upgrades = levels(prestige.upgrades, cfg.prestigeUpgrades, "prestige.upgrades");
    if (prestige.draft !== undefined) {
      if (!Array.isArray(prestige.draft) || prestige.draft.some((id) => typeof id !== "string")) {
        invalid("prestige.draft");
      }
      s.prestige.draft = prestige.draft.filter((id) => G.upgradeById(id));
    }
    s.pathUpgrades = levels(data.pathUpgrades, cfg.pathUpgrades || [], "pathUpgrades");
    if (data.eventLog !== undefined) {
      if (!Array.isArray(data.eventLog)) invalid("eventLog");
      s.eventLog = data.eventLog.map((entry) => {
        record(entry, "eventLog entry");
        if (typeof entry.msg !== "string") invalid("eventLog.msg");
        return { t: number(entry.t, s.lastSaved, "eventLog.t", false, 8640000000000000), msg: entry.msg };
      }).slice(0, 40);
    }
    const stats = optionalRecord(data.stats, "stats");
    for (const id in s.stats) s.stats[id] = number(stats[id], 0, "stats." + id, true);
    // Date's representable range, not an economy cap. Future timestamps are
    // allowed for clock skew. Loading never awards offline catch-up in this build.
    s.lastSaved = number(data.lastSaved, s.lastSaved, "lastSaved", false, 8640000000000000);
    // Finite inputs can still overflow the actual derived economy calculations.
    if (![...Object.values(G.derive(s)), G.redoxCharge(s), G.complexity(s), G.prestigePoints(s)]
        .every(Number.isFinite)) invalid("derived economy");
    return s;
  };

  // A rejected/unreadable save stays byte-for-byte at SAVE_KEY. All save entry
  // points (manual, autosave, visibility and unload) use this same guard. Only a
  // successful load or the player's explicit Reset releases it.
  G.loadError = null;
  G.save = function (flash) {
    if (G.loadError) {
      if (flash && G.ui) G.ui.flashStatus(cfg.ui.saveRecovery);
      return false;
    }
    const lastSaved = Date.now();
    try {
      localStorage.setItem(cfg.SAVE_KEY, JSON.stringify(Object.assign({}, G.state, { lastSaved })));
      G.state.lastSaved = lastSaved;
      if (flash && G.ui) G.ui.flashStatus("Saved");
      return true;
    } catch (e) {
      if (flash && G.ui) G.ui.flashStatus("Save failed");
      return false;
    }
  };

  G.load = function () {
    try {
      const raw = localStorage.getItem(cfg.SAVE_KEY);
      if (raw === null) { G.loadError = null; return false; }
      const candidate = G.hydrateSave(JSON.parse(raw));
      G.state = candidate;
      G.loadError = null;
      return true;
    } catch (e) {
      G.loadError = e.message;
      return false;
    }
  };

  G.resetSave = function () {
    try {
      localStorage.removeItem(cfg.SAVE_KEY);
    } catch (e) {
      return false;
    }
    G.loadError = null;
    G.state = G.factory();
    return true;
  };
})();
