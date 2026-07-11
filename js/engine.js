/* =========================================================================
 * engine.js — game loop + all mechanics.
 * Strike the soup -> roll a random energy input -> deliver feedstock, then
 * drive a density-weighted REACTION that consumes inputs to make products
 * (or tar). Passive reactions + atmospheric generation tick on their own.
 * Milestones (Reducing Environment, Amino Acids) auto-fire; soft prestige with
 * a roguelike draft. The loop is setInterval driven with a wall-clock delta so
 * passive chemistry keeps accruing (throttled but accurate) even when hidden.
 * ========================================================================= */

(function () {
  "use strict";
  const cfg = G.config;
  const E = (G.engine = {});
  const EV = cfg.energyEvents;
  const RX = cfg.reactions || {};
  const RR = cfg.reactionRoll || {};

  function rollRange(range) {
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  // Reaction input-cost multiplier: the Chemistry "Catalyst" upgrade discounts
  // how much material each reaction consumes. Floored so it never hits zero.
  function inputMult(d) {
    return Math.max(0.2, 1 - ((d && d.reactionInputDiscount) || 0));
  }

  /* --------------------------------------------------------------------
   * Weighted pick from the energy-event table. Any prestige upgrade can bias
   * an event's frequency generically via a "<eventId>WeightAdd" derived key
   * (e.g. Celestial Chaos -> meteorWeightAdd) — no per-event special-casing.
   * ------------------------------------------------------------------ */
  function rollEvent(d) {
    // Meteor lockout: no meteor until the player has struck enough times. The
    // strike count was already incremented for this strike before we roll.
    const meteorLocked = G.state.stats.totalStrikes <= (EV.meteorMinStrikes || 0);
    let total = 0;
    const weights = EV.table.map((def) => {
      let w = def.weight + (d[def.id + "WeightAdd"] || 0);
      if (def.id === "meteor" && meteorLocked) w = 0;
      total += Math.max(0, w);
      return w;
    });
    let roll = Math.random() * total;
    for (let i = 0; i < EV.table.length; i++) {
      roll -= Math.max(0, weights[i]);
      if (roll <= 0) return EV.table[i];
    }
    return EV.table[0];
  }

  /* --- Roll a size tier (volcanic) or a named variant (meteor). Returns an
   * outcome bag consumed generically by applyEvent: { size } | { variant } | {} */
  function rollOutcome(def, s, d) {
    if (def.variants) {
      if (def.firstAlwaysGood && def.firstVariantId && !s.firstMeteorDone) {
        s.firstMeteorDone = true;
        const forced = def.variants.find((v) => v.id === def.firstVariantId);
        return { variant: forced || def.variants[0] };
      }
      // "Armageddon It" (meteorVariantBias) up-weights larger variants by their
      // visualScale, so the average meteor grows without new variant entries.
      const bias = (d && d.meteorVariantBias) || 0;
      const vw = def.variants.map((v) => v.weight * (1 + bias * (v.visualScale || 1)));
      let total = 0;
      vw.forEach((w) => (total += w));
      let roll = Math.random() * total;
      for (let i = 0; i < def.variants.length; i++) {
        roll -= vw[i];
        if (roll <= 0) return { variant: def.variants[i] };
      }
      return { variant: def.variants[0] };
    }
    if (def.sizes) {
      let total = 0;
      EV.sizeTiers.forEach((t) => (total += EV.sizeWeight[t] || 0));
      let roll = Math.random() * total;
      for (const t of EV.sizeTiers) {
        roll -= EV.sizeWeight[t] || 0;
        if (roll <= 0) return { size: t };
      }
      return { size: EV.sizeTiers[0] };
    }
    return {};
  }

  const resourceById = {};
  cfg.resources.forEach((r) => (resourceById[r.id] = r));

  /* --- Apply a single feedstock grant, honoring size, the global gain mult,
   * and the meteor Hydrogen coupling. --- */
  function grant(s, d, resId, amount, sizeMult, eventId) {
    let v = amount * sizeMult * d.eventGainMult;
    if (resId === "h2" && eventId === "meteor") v *= 1 + (d.meteorH2Mult || 0);
    s.resources[resId] = (s.resources[resId] || 0) + v;
    return v;
  }

  /* --- Apply a rolled event's feedstock (grants + chance grants) + discovery +
   * visuals + log. Reactions are handled separately (attemptReaction). --- */
  function applyEvent(def, outcome, x, y, passive) {
    const s = G.state;
    const d = G.derive(s);
    const variant = outcome && outcome.variant;
    const size = outcome && outcome.size;
    const sizeMult = size ? (EV.sizeMult[size] || 1) : 1;
    const effGrants = variant ? variant.grants : def.grants;
    const effChance = variant ? variant.chance : def.chance;

    if (effGrants) {
      for (const resId in effGrants) grant(s, d, resId, rollRange(effGrants[resId]), sizeMult, def.id);
    }
    if (effChance) {
      for (const resId in effChance) {
        const c = effChance[resId];
        if (Math.random() < c.p) grant(s, d, resId, rollRange([c.min, c.max]), sizeMult, def.id);
      }
    }

    // discovery tracking (Complexity credits distinct event TYPES per run,
    // and rare types separately — meteor variants all share the "meteor" id)
    const firstSeen = !s.discovered[def.id];
    if (firstSeen) {
      s.discovered[def.id] = true;
      if (def.rare) G.log("Discovered: " + def.name + ".");
    }
    if (def.rare) s.rareDiscovered[def.id] = true;

    if (G.render) G.render.playEvent(def, outcome, x, y);
    if (!passive) {
      const label = variant ? variant.name
        : size ? size.charAt(0).toUpperCase() + size.slice(1) + " " + def.name
        : def.name;
      const flavor = variant ? variant.flavor : def.flavor;
      G.log(label + " — " + flavor);
    }
    // First-ever meteor: play its story beat (keyed off run-persistent discovery,
    // so it never re-fires on reload within the same run).
    if (firstSeen && def.id === "meteor" && G.ui && G.ui.narrate &&
        cfg.narratives && cfg.narratives.firstMeteor) {
      G.ui.narrate(cfg.narratives.firstMeteor);
    }
    checkMilestones();
  }

  /* --------------------------------------------------------------------
   * Reactions — density-weighted (mass action). A strike drives ONE of the
   * firing event's listed reactions; the more abundant a reaction's inputs,
   * the more likely it is chosen. Reactions consume inputs and make products,
   * or (on a bad roll, eased by Redox Charge) clog into tar.
   * ------------------------------------------------------------------ */
  function reactionReady(rx, s, d) {
    if (!G.meetsMilestone(rx.gate, s)) return false;
    const im = inputMult(d);
    for (const k in rx.inputs) if ((s.resources[k] || 0) < rx.inputs[k] * im) return false;
    return true;
  }

  // Density = geometric mean of the input stocks (mass action).
  function densityScore(rx, s) {
    const keys = Object.keys(rx.inputs);
    if (!keys.length) return 1;
    let prod = 1;
    keys.forEach((k) => (prod *= Math.max(0, s.resources[k] || 0)));
    return Math.pow(prod, 1 / keys.length);
  }

  function runReaction(rx, s, d, passive, evYield) {
    const im = inputMult(d);
    for (const k in rx.inputs) s.resources[k] = (s.resources[k] || 0) - rx.inputs[k] * im;

    let tarP = (RR.tarChance || 0) - (d.tarReduction || 0) - (RR.redoxTarRelief || 0) * G.redoxCharge(s);
    if (tarP < (RR.tarChanceMin || 0)) tarP = RR.tarChanceMin || 0;

    if (RR.tars && Math.random() < tarP) {
      for (const k in RR.tars.outputs) s.resources[k] = (s.resources[k] || 0) + rollRange(RR.tars.outputs[k]);
      if (!passive) G.log("… " + (rx.name || "a reaction") + " clogs into tar.");
      return;
    }

    // Per-event power (e.g. Zeus's Wrath -> lightningReactionYieldMult) stacks
    // multiplicatively with the global reaction-yield multiplier.
    const yieldMult = (d.reactionYieldMult || 1) * (evYield || 1);
    const parts = [];
    for (const k in rx.outputs) {
      const amt = rollRange(rx.outputs[k]) * yieldMult;
      s.resources[k] = (s.resources[k] || 0) + amt;
      const def = resourceById[k];
      parts.push("+" + G.fmt(amt) + " " + (def ? def.short : k));
    }
    if (!passive) G.log("… " + (rx.name || "reaction") + ": " + parts.join(", ") + ".");
  }

  // Strike-driven reaction attempt for a given event.
  function attemptReaction(def, s, d) {
    const ids = def.reactions || [];
    const viable = [];
    ids.forEach((id) => {
      const rx = RX[id];
      if (rx && rx.mode === "strike" && reactionReady(rx, s, d)) viable.push(rx);
    });
    if (!viable.length) return;

    const exp = RR.densityExponent || 0;
    let total = 0;
    const weights = viable.map((rx) => {
      const w = Math.max(0, (rx.weight || 1) * Math.pow(densityScore(rx, s), exp));
      total += w;
      return w;
    });
    if (total <= 0) return;
    let roll = Math.random() * total;
    let pick = viable[0];
    for (let i = 0; i < viable.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { pick = viable[i]; break; }
    }
    const evYield = 1 + (d[def.id + "ReactionYieldMult"] || 0);
    runReaction(pick, s, d, false, evYield);
  }

  /* --------------------------------------------------------------------
   * Player strike (whole-canvas tap).
   * ------------------------------------------------------------------ */
  E.strike = function (x, y) {
    const s = G.state;
    s.stats.totalStrikes++;
    const d = G.derive(s);
    // Electron Donor Bias: every tap scrapes a little Hydrogen loose.
    if (d.donorPerTap > 0) grant(s, d, "h2", d.donorPerTap, 1, "tap");
    const def = rollEvent(d);
    const outcome = rollOutcome(def, s, d);
    applyEvent(def, outcome, x, y, false);
    attemptReaction(def, s, d);
    trackRedox(s);
    checkMilestones();
  };

  function trackRedox(s) {
    const rc = G.redoxCharge(s);
    if (rc > s.highestRedox) s.highestRedox = rc;
  }

  /* --------------------------------------------------------------------
   * Milestones — auto-fire generically from config. A milestone fires once its
   * prerequisite milestone (if any) is met and all resource thresholds pass.
   * ------------------------------------------------------------------ */
  function checkMilestones() {
    const s = G.state;
    const m = cfg.milestones;
    for (const id in m) {
      const def = m[id];
      if (s.milestones[id]) continue;
      if (def.requiresMilestone && !s.milestones[def.requiresMilestone]) continue;
      if (!G.meetsRequires(def.requires, s)) continue;
      s.milestones[id] = true;
      if (def.grantOnUnlock) {
        for (const r in def.grantOnUnlock) s.resources[r] = (s.resources[r] || 0) + def.grantOnUnlock[r];
      }
      if (def.unlocksNextPhase) s.nextPhaseUnlocked = true;
      if (def.log) G.log(def.log);
      if (G.ui) {
        // Prefer the multi-line story beat; fall back to the one-line banner.
        if (def.narrative && def.narrative.length && G.ui.narrate) G.ui.narrate(def.narrative);
        else if (def.unlockText) G.ui.showBanner(def.unlockText);
        G.ui.onMilestoneChange();
      }
    }
  }
  E.checkMilestones = checkMilestones;

  /* --------------------------------------------------------------------
   * Prestige + roguelike draft
   * ------------------------------------------------------------------ */
  E.prestige = function () {
    const prev = G.state;
    const gained = G.prestigePoints(prev);
    const earnsReward = gained > 0;
    const nextCount = prev.prestige.count + (earnsReward ? 1 : 0);

    // carry the prestige block forward, bank points, wipe the run
    if (earnsReward) {
      prev.prestige.points += gained;
      prev.prestige.count = nextCount;
      prev.stats.prestiges++;
    }

    const s = G.freshRun(prev);
    // Donor Residue: start each run with a little extra Hydrogen (electron donor).
    const d = G.derive(s);
    if (d.startDonors > 0) {
      s.resources.h2 = (s.resources.h2 || 0) + d.startDonors;
    }
    s.highestRedox = G.redoxCharge(s);
    G.state = s;

    G.log(
      (earnsReward ? "Prestige #" + nextCount : "Prestige") + " — the soup resets. " +
      (earnsReward ? "Banked " + G.fmt(gained) + " " + cfg.prestige.nameShort + "." :
        "This run was too simple to bank anything.")
    );

    // Reward drafts are only offered on point-earning prestiges.
    if (earnsReward && nextCount <= cfg.prestige.draftPrestiges) rollDraft();
    else s.prestige.draft = [];

    if (G.ui) G.ui.onMilestoneChange();
    return gained;
  };

  function rollDraft() {
    const s = G.state;
    // pool = available upgrades whose trunk is unlocked and not maxed
    const pool = cfg.prestigeUpgrades.filter((u) => {
      const trunk = cfg.prestige.trunks.find((t) => t.id === u.trunk);
      if (!trunk || !G.trunkUnlocked(trunk, s)) return false;
      return G.upgradeAvailable(u, s);
    });
    // shuffle & take draftCount
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    s.prestige.draft = shuffled.slice(0, cfg.prestige.draftCount).map((u) => u.id);
  }
  E.rollDraft = rollDraft;

  E.chooseDraft = function (id) {
    const s = G.state;
    if (s.prestige.draft.indexOf(id) < 0) return false;
    const u = G.upgradeById(id);
    if (!u) return false;
    const wasUnowned = !s.prestige.upgrades[id];
    s.prestige.upgrades[id] = (s.prestige.upgrades[id] || 0) + 1;
    s.prestige.draft = [];
    G.log("Adaptation gained: " + u.name + ".");
    if (wasUnowned && u.firstPickFlavor && G.ui) G.ui.showBanner(u.firstPickFlavor);
    if (G.ui) G.ui.onMilestoneChange();
    return true;
  };

  /* --------------------------------------------------------------------
   * Path upgrades — in-run purchases paid with live resources (parallel to
   * the prestige draft). Reset by prestige via G.freshRun.
   * ------------------------------------------------------------------ */
  E.buyUpgrade = function (id) {
    const s = G.state;
    const u = G.pathUpgradeById(id);
    if (!u || !G.pathUpgradeAvailable(u, s)) return false;
    const cost = G.pathUpgradeCost(u, s);
    if (!G.canAfford(cost, s)) return false;
    for (const r in cost) s.resources[r] = (s.resources[r] || 0) - cost[r];
    s.pathUpgrades[id] = (s.pathUpgrades[id] || 0) + 1;
    G.log("Upgrade purchased: " + u.name + " (Lv " + s.pathUpgrades[id] + ").");
    if (G.ui) G.ui.onMilestoneChange();
    return true;
  };

  /* --------------------------------------------------------------------
   * Passive atmospheric generation + passive reactions.
   * Shared by the real tick and tooltip projections so the UI reports the
   * same net rates the engine will actually apply.
   * ------------------------------------------------------------------ */
  function applyPassive(s, dt) {
    const d = G.derive(s);

    // Passive atmospheric replenishment (N2, CO2, H2O). The Chemistry
    // "Bio-Availability" upgrade boosts atmosphere-group resources specifically.
    const atmoMult = 1 + (d.atmosphereGainMult || 0);
    cfg.resources.forEach((r) => {
      if (!r.passivePerSec) return;
      const groupMult = r.group === "atmosphere" ? atmoMult : 1;
      s.resources[r.id] = (s.resources[r.id] || 0) + r.passivePerSec * dt * d.eventGainMult * groupMult;
    });

    // Automatic Fixation: Chemistry path upgrade that passively matches the
    // nitric oxide fixation recipe (CO2 + N2 -> NO) once the world is reducing.
    let fixationRate = (d.autoNoFixationRate || 0) * dt;
    if (fixationRate > 0 && G.meetsMilestone("reducingEnvironment", s)) {
      const rx = RX.no_from_co2_n2;
      if (rx && rx.inputs && rx.outputs && rx.outputs.no) {
        const im = inputMult(d);
        for (const k in rx.inputs) {
          const have = s.resources[k] || 0;
          const maxByInput = have / (rx.inputs[k] * im);
          if (maxByInput < fixationRate) fixationRate = maxByInput;
        }
        if (fixationRate > 0) {
          for (const k in rx.inputs) s.resources[k] = (s.resources[k] || 0) - rx.inputs[k] * im * fixationRate;
          const noMid = (rx.outputs.no[0] + rx.outputs.no[1]) / 2;
          s.resources.no = (s.resources.no || 0) + noMid * fixationRate * (d.reactionYieldMult || 1);
        }
      }
    }

    // Passive reactions (NO -> NH3, CO2 -> CH4) run continuously once gated.
    const rateMult = 1 + (d.passiveReactionRateMult || 0);
    const yieldMult = d.reactionYieldMult || 1;
    const im = inputMult(d);
    for (const id in RX) {
      const rx = RX[id];
      if (rx.mode !== "passive") continue;
      if (!G.meetsMilestone(rx.gate, s)) continue;
      let rate = (rx.ratePerSec || 0) * rateMult * dt;
      if (rate <= 0) continue;
      // Clamp the rate so we never consume more of an input than we have
      // (accounting for the Catalyst input discount).
      for (const k in rx.inputs) {
        const have = s.resources[k] || 0;
        const maxByInput = have / (rx.inputs[k] * im);
        if (maxByInput < rate) rate = maxByInput;
      }
      if (rate <= 0) continue;
      for (const k in rx.inputs) s.resources[k] = (s.resources[k] || 0) - rx.inputs[k] * im * rate;
      for (const k in rx.outputs) {
        const mid = (rx.outputs[k][0] + rx.outputs[k][1]) / 2;
        s.resources[k] = (s.resources[k] || 0) + mid * rate * yieldMult;
      }
    }
  }

  E.projectPassiveState = function (s, seconds) {
    s = s || G.state;
    const projected = Object.assign({}, s, {
      resources: Object.assign({}, s.resources),
      milestones: Object.assign({}, s.milestones),
      prestige: s.prestige,
      pathUpgrades: s.pathUpgrades,
    });
    applyPassive(projected, seconds == null ? 1 : seconds);
    return projected;
  };

  /* --------------------------------------------------------------------
   * Main tick — passive atmospheric generation + passive reactions.
   * ------------------------------------------------------------------ */
  function tick(dt) {
    const s = G.state;
    applyPassive(s, dt);

    trackRedox(s);
    checkMilestones();
  }
  E.tick = tick;

  /* --------------------------------------------------------------------
   * Loop: setInterval + wall-clock delta (survives background throttling)
   * ------------------------------------------------------------------ */
  let lastTick = Date.now();
  let started = false;

  E.start = function () {
    if (started) return;
    started = true;
    lastTick = Date.now();
    setInterval(function () {
      const now = Date.now();
      const dt = (now - lastTick) / 1000;
      lastTick = now;
      if (dt > 0) tick(Math.min(dt, 5)); // clamp huge jumps (sleep/lag)
      if (G.ui) G.ui.render();
    }, cfg.TICK_MS);

    setInterval(function () { G.save(false); }, 15000);
    window.addEventListener("beforeunload", function () { G.save(false); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) G.save(false);
      else lastTick = Date.now();
    });
  };
})();
