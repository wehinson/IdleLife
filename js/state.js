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
  G.save = function (flash) {
    G.state.lastSaved = Date.now();
    try {
      localStorage.setItem(cfg.SAVE_KEY, JSON.stringify(G.state));
      if (flash && G.ui) G.ui.flashStatus("Saved");
    } catch (e) {
      if (flash && G.ui) G.ui.flashStatus("Save failed");
    }
  };

  G.load = function () {
    let raw;
    try {
      raw = localStorage.getItem(cfg.SAVE_KEY);
    } catch (e) {
      return false;
    }
    if (!raw) return false;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return false;
    }
    const s = G.factory();
    // resources (ignore unknown / removed ids)
    for (const r in s.resources) s.resources[r] = Number(data.resources?.[r]) || 0;
    // milestones (only ids that still exist in config)
    if (data.milestones && typeof data.milestones === "object") {
      for (const id in s.milestones) s.milestones[id] = !!data.milestones[id];
    }
    if (data.discovered && typeof data.discovered === "object") s.discovered = data.discovered;
    if (data.rareDiscovered && typeof data.rareDiscovered === "object") s.rareDiscovered = data.rareDiscovered;
    s.highestRedox = Number(data.highestRedox) || 0;
    s.firstMeteorDone = !!data.firstMeteorDone;
    s.nextPhaseUnlocked = !!data.nextPhaseUnlocked;
    // prestige block
    if (data.prestige) {
      s.prestige.points = Number(data.prestige.points) || 0;
      s.prestige.count = Number(data.prestige.count) || 0;
      s.prestige.upgrades = {};
      cfg.prestigeUpgrades.forEach((u) => {
        s.prestige.upgrades[u.id] = Number(data.prestige.upgrades?.[u.id]) || 0;
      });
      // only keep drafted ids that still exist in config
      if (Array.isArray(data.prestige.draft)) {
        s.prestige.draft = data.prestige.draft.filter((id) => G.upgradeById(id));
      }
    }
    // path upgrades (in-run; only ids that still exist in config)
    s.pathUpgrades = {};
    (cfg.pathUpgrades || []).forEach((u) => {
      s.pathUpgrades[u.id] = Number(data.pathUpgrades?.[u.id]) || 0;
    });
    if (Array.isArray(data.eventLog)) s.eventLog = data.eventLog.slice(0, 40);
    if (data.stats) Object.assign(s.stats, data.stats);
    s.lastSaved = Number(data.lastSaved) || Date.now();
    G.state = s;
    return true;
  };
})();
