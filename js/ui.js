/* =========================================================================
 * ui.js — DOM panels, resource meters, prestige draft, goal-progress card,
 * next-phase placeholder, event log, milestone banner, and boot.
 * Builds structural DOM once (driven entirely by config), updates each tick.
 * ========================================================================= */

(function () {
  "use strict";
  const cfg = G.config;
  const U = (G.ui = {});
  const $ = (id) => document.getElementById(id);

  let el = {};
  let resNodes = null;     // resourceId -> { row, amtEl }
  let groupNodes = null;   // groupId -> { section, visibleCount }
  let statusTimer = null;
  let narrTimer = null;    // narration line-advance / linger timer
  let introActive = false; // intro sequence playing (cleared on first strike)
  let resTooltip = null;
  let tooltipResId = null;
  let tooltipPointer = null;

  // The milestone that gates prestige points (config-driven).
  const PRESTIGE_MILESTONE = (function () {
    for (const id in cfg.milestones) if (cfg.milestones[id].enablesPrestigePoints) return id;
    return null;
  })();

  /* ---- static copy from config ---- */
  function applyStaticText() {
    el.brand.innerHTML =
      (cfg.ui.logo ? '<img class="brand-mark" src="' + cfg.ui.logo + '" alt="" />' : "") +
      '<span class="brand-text">' +
        '<span class="brand-word">' + cfg.ui.title + "</span>" +
        '<span class="brand-sub">' + cfg.ui.subtitle + "</span>" +
        (cfg.ui.tagline ? '<span class="brand-tag">' + cfg.ui.tagline + "</span>" : "") +
      "</span>";
    el.ppUnit.textContent = cfg.prestige.nameShort;
    el.soupHeading.textContent = cfg.ui.soupHeading;
    el.resHeading.textContent = cfg.ui.resourcesHeading;
    el.riboHeading.textContent = cfg.ui.ribozymeHeading;
    el.nextHeading.textContent = cfg.ui.nextPhaseHeading;
    el.logHeading.textContent = cfg.ui.logHeading;
    el.draftHeading.textContent = cfg.ui.draftHeading;
    el.notesHeading.textContent = cfg.ui.notesHeading;
    el.notesBtn.textContent = cfg.ui.notesButton;
    $("prestigeBtn").textContent = "Prestige";
  }

  /* ---- resource rows, grouped into collapsible sections (config.resourceGroups).
   * Built once; per-row visibility/values are updated every tick in U.render. ---- */
  function buildResources() {
    el.resourceList.innerHTML = "";
    resNodes = {};
    groupNodes = {};
    cfg.resourceGroups.forEach((g) => {
      const items = cfg.resources.filter((r) => (r.group || "chemistry") === g.id);
      if (!items.length) return;

      const section = document.createElement("div");
      section.className = "res-group";
      const header = document.createElement("div");
      header.className = "res-group-head";
      header.innerHTML =
        '<span class="res-group-chevron">▾</span><span class="res-group-label">' + g.label + "</span>";
      const list = document.createElement("div");
      list.className = "res-group-list";
      const collapsed = !!g.collapsedByDefault;
      header.classList.toggle("collapsed", collapsed);
      list.classList.toggle("collapsed", collapsed);
      header.addEventListener("click", () => {
        const nowCollapsed = !list.classList.contains("collapsed");
        header.classList.toggle("collapsed", nowCollapsed);
        list.classList.toggle("collapsed", nowCollapsed);
      });
      section.appendChild(header);
      section.appendChild(list);
      el.resourceList.appendChild(section);
      groupNodes[g.id] = { section, visibleCount: 0 };

      items.forEach((r) => {
        const row = document.createElement("div");
        row.className = "res-row";
        row.dataset.res = r.id;
        row.tabIndex = 0;
        row.innerHTML =
          '<span class="res-dot" style="background:' + r.color + '"></span>' +
          '<span class="res-name">' + r.name + "</span>" +
          '<span class="res-val"><span class="amt">0</span></span>';
        row.addEventListener("mouseenter", (ev) => showResourceTooltip(r.id, ev));
        row.addEventListener("mouseover", (ev) => {
          if (!row.contains(ev.relatedTarget)) showResourceTooltip(r.id, ev);
        });
        row.addEventListener("mousemove", (ev) => {
          if (tooltipResId === r.id) {
            tooltipPointer = { x: ev.clientX, y: ev.clientY };
            positionResourceTooltip(row);
          }
        });
        row.addEventListener("mouseleave", hideResourceTooltip);
        row.addEventListener("mouseout", (ev) => {
          if (!row.contains(ev.relatedTarget)) hideResourceTooltip();
        });
        row.addEventListener("focus", () => showResourceTooltip(r.id));
        row.addEventListener("blur", hideResourceTooltip);
        list.appendChild(row);
        resNodes[r.id] = { row, amtEl: row.querySelector(".amt") };
      });
    });
  }

  /* ---- Upgrades panel: in-run Path purchases (config.paths / pathUpgrades).
   * Rebuilt structurally on onMilestoneChange (paths unlock, levels change);
   * per-tick U.render only refreshes affordability so we don't thrash the DOM.
   * Reuses the collapsible res-group markup/CSS. ---- */
  let upgradeNodes = null;        // upgradeId -> { buyBtn, chipEls, maxed, placeholder }
  const upgradeCollapse = {};     // pathId -> collapsed? (persists across rebuilds)

  function renderUpgrades() {
    const s = G.state;
    el.upgradePanel.innerHTML = "";
    upgradeNodes = {};

    const h = document.createElement("h3");
    h.textContent = cfg.ui.upgradesHeading || "Upgrades";
    el.upgradePanel.appendChild(h);

    let anyPath = false;
    (cfg.paths || []).forEach((p) => {
      if (!G.pathUnlocked(p, s)) return;
      const ups = (cfg.pathUpgrades || []).filter((u) => u.path === p.id);
      if (!ups.length) return;
      anyPath = true;

      const section = document.createElement("div");
      section.className = "res-group upg-group";
      if (p.color) section.style.setProperty("--path-accent", p.color);
      const header = document.createElement("div");
      header.className = "res-group-head path-head";
      header.innerHTML =
        '<span class="res-group-chevron">▾</span><span class="res-group-label">' + p.name + "</span>";
      const list = document.createElement("div");
      list.className = "res-group-list";
      const collapsed = !!upgradeCollapse[p.id];
      header.classList.toggle("collapsed", collapsed);
      list.classList.toggle("collapsed", collapsed);
      header.addEventListener("click", () => {
        const nowCollapsed = !list.classList.contains("collapsed");
        header.classList.toggle("collapsed", nowCollapsed);
        list.classList.toggle("collapsed", nowCollapsed);
        upgradeCollapse[p.id] = nowCollapsed;
      });
      section.appendChild(header);
      section.appendChild(list);
      el.upgradePanel.appendChild(section);

      ups.forEach((u) => {
        const lvl = G.pathUpgradeLevel(u, s);
        const max = u.max || Infinity;
        const maxed = lvl >= max;
        const cost = G.pathUpgradeCost(u, s);
        // Locked = a milestone requirement not yet met (shown greyed, not buyable).
        const reqMs = u.requires && u.requires.milestone;
        const locked = !!(reqMs && !s.milestones[reqMs]);
        const inert = u.placeholder || locked;   // no Buy button, greyed row

        let costHtml;
        if (u.placeholder) {
          costHtml = '<span class="chip">Coming later</span>';
        } else if (locked) {
          const msName = (cfg.milestones[reqMs] && cfg.milestones[reqMs].name) || reqMs;
          costHtml = '<span class="chip">Requires ' + msName + "</span>";
        } else if (maxed) {
          costHtml = '<span class="chip ok">Maxed</span>';
        } else {
          costHtml = Object.keys(cost).map((r) => {
            const rd = cfg.resources.find((x) => x.id === r);
            const label = rd ? rd.short : r;
            return '<span class="chip cost" data-res="' + r + '" data-amt="' + cost[r] + '">' +
              G.fmt(cost[r]) + " " + label + "</span>";
          }).join("");
        }

        const lvlText = isFinite(max) ? "Lv " + lvl + "/" + max : "Lv " + lvl;
        const row = document.createElement("div");
        row.className = "upgrade-row" + (inert ? " placeholder" : "");
        row.innerHTML =
          '<div class="upg-top"><span class="upg-name">' + u.name + "</span>" +
          '<span class="upg-lvl muted small">' + lvlText + "</span></div>" +
          '<div class="upg-desc muted small">' + u.desc + "</div>" +
          '<div class="upg-foot"><div class="upg-cost">' + costHtml + "</div>" +
          (inert || maxed ? "" : '<button class="primary upg-buy">Buy</button>') +
          "</div>";
        list.appendChild(row);

        const buyBtn = row.querySelector(".upg-buy");
        const chipEls = Array.prototype.slice
          .call(row.querySelectorAll(".chip.cost"))
          .map((c) => ({ el: c, res: c.getAttribute("data-res"), amt: Number(c.getAttribute("data-amt")) }));
        upgradeNodes[u.id] = { buyBtn, chipEls, maxed, placeholder: inert };

        if (buyBtn) {
          buyBtn.addEventListener("click", () => {
            if (G.engine.buyUpgrade(u.id)) U.flashStatus(u.name + " bought");
          });
        }
      });
    });

    el.upgradePanel.style.display = anyPath ? "" : "none";
    refreshUpgradeAffordability();
  }

  function refreshUpgradeAffordability() {
    if (!upgradeNodes) return;
    const s = G.state;
    for (const id in upgradeNodes) {
      const n = upgradeNodes[id];
      if (n.placeholder || n.maxed) continue;
      let afford = true;
      n.chipEls.forEach((c) => {
        const ok = (s.resources[c.res] || 0) >= c.amt;
        c.el.classList.toggle("ok", ok);
        c.el.classList.toggle("no", !ok);
        if (!ok) afford = false;
      });
      if (n.buyBtn) n.buyBtn.disabled = !afford;
    }
  }

  /* ---- Field Notes: static list of preserved-but-unimplemented concepts ---- */
  function buildNotes() {
    el.notesBody.innerHTML = cfg.futureNotes
      .map((n) =>
        '<div class="note-row"><div class="note-concept">' + n.concept + "</div>" +
        '<div class="note-why">' + n.why + "</div></div>"
      )
      .join("");
  }

  function resourceVisible(r, s) {
    if (r.revealedBy && !s.milestones[r.revealedBy]) return false;
    return resourceAmount(r, s) > 0;
  }

  // A resource's displayed amount — a computed value if it's a derived row.
  function resourceAmount(r, s) {
    if (r.derived && typeof G[r.derived] === "function") return G[r.derived](s);
    return s.resources[r.id] || 0;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ensureResourceTooltip() {
    if (resTooltip) return resTooltip;
    resTooltip = document.createElement("div");
    resTooltip.className = "res-tooltip hidden";
    resTooltip.setAttribute("role", "tooltip");
    document.body.appendChild(resTooltip);
    return resTooltip;
  }

  function resourceNetRate(r, s) {
    if (!G.engine || typeof G.engine.projectPassiveState !== "function") return 0;
    const before = resourceAmount(r, s);
    const projected = G.engine.projectPassiveState(s, 1);
    return resourceAmount(r, projected) - before;
  }

  function formatRate(rate) {
    const abs = Math.abs(rate);
    let text;
    if (abs < 0.005) text = "0";
    else if (abs < 1) text = abs.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    else text = G.fmt(abs);
    return (rate > 0.005 ? "+" : rate < -0.005 ? "-" : "") + text + "/s";
  }

  function updateResourceTooltip() {
    if (!tooltipResId || !resTooltip) return;
    const r = cfg.resources.find((x) => x.id === tooltipResId);
    const n = resNodes && resNodes[tooltipResId];
    if (!r || !n || n.row.style.display === "none") {
      hideResourceTooltip();
      return;
    }

    const amount = resourceAmount(r, G.state);
    const rate = resourceNetRate(r, G.state);
    const rateClass = rate > 0.005 ? "gain" : rate < -0.005 ? "loss" : "flat";
    const tooltip = ensureResourceTooltip();
    tooltip.style.setProperty("--res-color", r.color || "var(--rail)");
    tooltip.innerHTML =
      '<div class="res-tooltip-head">' +
        '<span class="res-tooltip-dot"></span>' +
        '<div><div class="res-tooltip-name">' + escapeHtml(r.name) + "</div>" +
        '<div class="res-tooltip-short">' + escapeHtml(r.short || r.id) + "</div></div>" +
      "</div>" +
      '<div class="res-tooltip-stats">' +
        '<div><span class="res-tooltip-label">Amount</span><span>' + escapeHtml(G.fmt(amount)) + "</span></div>" +
        '<div><span class="res-tooltip-label">Net</span><span class="rate ' + rateClass + '">' + escapeHtml(formatRate(rate)) + "</span></div>" +
      "</div>" +
      (r.tooltip ? '<div class="res-tooltip-body">' + escapeHtml(r.tooltip) + "</div>" : "");
    positionResourceTooltip(n.row);
  }

  function positionResourceTooltip(row) {
    if (!resTooltip || resTooltip.classList.contains("hidden")) return;
    const gap = 14;
    const pad = 10;
    const rect = row.getBoundingClientRect();
    const anchorX = tooltipPointer ? tooltipPointer.x : rect.right;
    const anchorY = tooltipPointer ? tooltipPointer.y : rect.top + rect.height / 2;
    let left = anchorX + gap;
    let top = anchorY + gap;
    const tipRect = resTooltip.getBoundingClientRect();

    if (left + tipRect.width + pad > window.innerWidth) {
      left = Math.max(pad, anchorX - tipRect.width - gap);
    }
    if (top + tipRect.height + pad > window.innerHeight) {
      top = Math.max(pad, window.innerHeight - tipRect.height - pad);
    }
    resTooltip.style.left = left + "px";
    resTooltip.style.top = top + "px";
  }

  function showResourceTooltip(resId, ev) {
    tooltipResId = resId;
    tooltipPointer = ev ? { x: ev.clientX, y: ev.clientY } : null;
    ensureResourceTooltip().classList.remove("hidden");
    updateResourceTooltip();
  }

  function hideResourceTooltip() {
    tooltipResId = null;
    tooltipPointer = null;
    if (resTooltip) resTooltip.classList.add("hidden");
  }

  /* ---- prestige draft cards ---- */
  function renderDraft() {
    const s = G.state;
    const ids = s.prestige.draft || [];
    if (!ids.length) {
      el.draftModal.classList.add("hidden");
      el.draftCards.innerHTML = "";
      return;
    }
    el.draftModal.classList.remove("hidden");
    el.draftCards.innerHTML = "";
    ids.forEach((id) => {
      const u = G.upgradeById(id);
      if (!u) return;
      const trunk = cfg.prestige.trunks.find((t) => t.id === u.trunk);
      const lvl = s.prestige.upgrades[id] || 0;
      const card = document.createElement("div");
      card.className = "draft-card";
      card.innerHTML =
        '<div class="draft-trunk">' + (trunk ? trunk.name : u.trunk) + "</div>" +
        '<div class="draft-name">' + u.name + "</div>" +
        '<div class="draft-desc">' + u.desc + "</div>" +
        '<div class="draft-lvl">' + (lvl ? "Owned Lv " + lvl + " → " + (lvl + 1) : "New") + "</div>";
      card.addEventListener("click", () => {
        if (G.engine.chooseDraft(id)) U.flashStatus("Adaptation gained");
      });
      el.draftCards.appendChild(card);
    });
  }

  /* ---- Goal-progress card (reuses the old ribozyme box).
   * Shows the requirements of the next unreached milestone as chips — a display
   * tracker, no purchase button. Hides once every milestone is reached. ---- */
  function renderGoal() {
    const s = G.state;
    let def = null;
    for (const id in cfg.milestones) {
      const m = cfg.milestones[id];
      if (s.milestones[id]) continue;
      if (m.requiresMilestone && !s.milestones[m.requiresMilestone]) continue;
      def = m;
      break;
    }
    const show = !!def;
    el.ribozymeBox.classList.toggle("hidden", !show);
    el.ribozymeBtn.classList.add("hidden"); // no purchase step in the Reduction Age
    if (!show) return;

    el.riboHeading.textContent = def.goalHeading || cfg.ui.ribozymeHeading;
    const reqs = [];
    for (const r in def.requires) {
      const label = (def.reqLabels && def.reqLabels[r]) ||
        (function () { const rd = cfg.resources.find((x) => x.id === r); return rd ? rd.short : r; })();
      const have = s.resources[r] || 0;
      const ok = have >= def.requires[r];
      reqs.push('<span class="chip ' + (ok ? "ok" : "no") + '">' +
        G.fmt(have) + "/" + G.fmt(def.requires[r]) + " " + label + "</span>");
    }
    el.riboReqs.innerHTML = reqs.join("");
  }

  /* ---- Next phase placeholder ---- */
  function renderNextPhase() {
    const s = G.state;
    el.nextPhaseBox.classList.toggle("hidden", !s.nextPhaseUnlocked);
    if (!s.nextPhaseUnlocked || el._nextBuilt) return;
    const np = cfg.nextPhase;
    el.nextPhaseBody.innerHTML =
      '<div class="next-name">🔒 Next: ' + np.name + "</div>" +
      '<p class="muted small">' + np.lockedText + "</p>" +
      '<ol class="roadmap">' + np.roadmap.map((r) => "<li>" + r + "</li>").join("") + "</ol>";
    el._nextBuilt = true;
  }

  /* ---- event log ---- */
  U.renderLog = function () {
    el.log.innerHTML = G.state.eventLog
      .map((e) => '<div class="log-line">' + e.msg + "</div>")
      .join("");
  };

  /* ---- Narration: timed story queue shown one line at a time in the center
   * overlay (over the soup, pointer-events:none so clicks still strike). Lines
   * render as HTML. `opts.persistLast` keeps the final line up (the intro CTA);
   * otherwise the sequence clears itself after a linger. ---- */
  function clearNarration() {
    clearTimeout(narrTimer);
    if (el.narration) el.narration.innerHTML = "";
  }
  U.narrate = function (lines, opts) {
    if (!el.narration || !lines || !lines.length) return;
    opts = opts || {};
    clearTimeout(narrTimer);
    const seq = lines.slice();
    const nc = cfg.ui.narration || {};
    const lineMs = nc.lineMs || 4000;
    const lingerMs = nc.lingerMs || 7000;
    let i = 0;
    function showNext() {
      el.narration.innerHTML = '<div class="narr-line">' + seq[i] + "</div>";
      i++;
      if (i < seq.length) narrTimer = setTimeout(showNext, lineMs);
      else if (!opts.persistLast) narrTimer = setTimeout(clearNarration, lingerMs);
    }
    showNext();
  };

  // Start the fresh-run intro (only when nothing has been struck yet).
  function maybeStartIntro() {
    if ((G.state.stats.totalStrikes || 0) !== 0) return;
    if (!cfg.narratives || !cfg.narratives.intro) return;
    introActive = true;
    U.narrate(cfg.narratives.intro, { persistLast: true });
  }

  /* ---- transient milestone banner — now routed through the narration queue so
   * every story beat uses one system (single line, auto-clears after a linger). ---- */
  U.showBanner = function (text) {
    U.narrate([text]);
  };

  /* ---- Progressive reveal: panels appear as the player strikes; the prestige
   * cluster waits until the world turns reducing. Idempotent (driven by the
   * persisted strike count each tick), so a reset re-hides everything and a
   * returning player sees the correct set. ---- */
  function setHidden(node, hide) {
    if (node) node.style.display = hide ? "none" : "";
  }
  function updateReveals() {
    const s = G.state;
    const strikes = s.stats.totalStrikes || 0;
    const rv = cfg.ui.reveal || {};
    setHidden(el.resourcePanel, strikes < (rv.resources || 1));
    setHidden(el.rightPanel, strikes < (rv.upgrades || 3));
    setHidden(el.logPanel, strikes < (rv.log || 10));
    const reducing = !PRESTIGE_MILESTONE || !!s.milestones[PRESTIGE_MILESTONE];
    setHidden(el.prestigeBox, !reducing);
    setHidden(el.ppBlock, !reducing);
    // The intro's lingering CTA clears the instant the player first strikes.
    if (introActive && strikes >= 1) { introActive = false; clearNarration(); }
  }

  U.flashStatus = function (msg) {
    el.saveStatus.textContent = G.loadError ? cfg.ui.saveRecovery : msg;
    clearTimeout(statusTimer);
    if (G.loadError) return;
    statusTimer = setTimeout(() => (el.saveStatus.textContent = ""), 1800);
  };

  /* ---- called whenever a milestone / prestige / draft changes structure ---- */
  U.onMilestoneChange = function () {
    renderDraft();
    renderUpgrades();
    renderGoal();
    renderNextPhase();
    U.render();
  };

  /* ---- per-tick render ---- */
  U.render = function () {
    const s = G.state;

    updateReveals();

    // prestige header numbers
    el.ppValue.textContent = G.fmt(s.prestige.points);
    el.ppRate.textContent = "Prestige #" + s.prestige.count;
    const complexity = G.complexity(s);
    const proj = G.prestigePoints(s);
    el.complexityVal.textContent = G.fmt(complexity);
    el.projPoints.textContent = G.fmt(proj) + " " + cfg.prestige.nameShort;
    const prestigeReady = !PRESTIGE_MILESTONE || !!s.milestones[PRESTIGE_MILESTONE];
    el.prestigeMeta.textContent = prestigeReady
      ? (proj > 0 ? "" : cfg.ui.prestigeLowMeta)
      : cfg.ui.prestigeLockedMeta;
    el.projPoints.classList.toggle("good", proj > 0);

    // resources: reveal + values (derived rows show a computed amount)
    if (groupNodes) {
      for (const id in groupNodes) groupNodes[id].visibleCount = 0;
    }
    cfg.resources.forEach((r) => {
      const n = resNodes[r.id];
      if (!n) return;
      const vis = resourceVisible(r, s);
      n.row.style.display = vis ? "" : "none";
      if (vis) {
        n.amtEl.textContent = G.fmt(resourceAmount(r, s));
        const groupId = r.group || "chemistry";
        if (groupNodes && groupNodes[groupId]) groupNodes[groupId].visibleCount++;
      }
    });
    if (groupNodes) {
      for (const id in groupNodes) {
        const g = groupNodes[id];
        g.section.style.display = g.visibleCount > 0 ? "" : "none";
      }
    }
    updateResourceTooltip();

    refreshUpgradeAffordability();
    renderGoal();
  };

  /* ---- reset ---- */
  function resetGame() {
    if (!G.resetSave()) { U.flashStatus("Reset failed"); return; }
    el._nextBuilt = false;
    clearNarration();
    U.onMilestoneChange();
    U.renderLog();
    maybeStartIntro();
    U.flashStatus("Reset");
  }

  /* ---- boot ---- */
  U.init = function () {
    el = {
      brand: $("brand"), ppValue: $("ppValue"), ppUnit: $("ppUnit"), ppRate: $("ppRate"),
      saveStatus: $("saveStatus"), banner: $("banner"),
      soupHeading: $("soupHeading"), narration: $("narration"),
      resHeading: $("resHeading"), resourceList: $("resourceList"),
      resourcePanel: $("resourcePanel"), rightPanel: $("rightPanel"), logPanel: $("logPanel"),
      prestigeBox: $("prestigeBox"), ppBlock: $("ppBlock"),
      upgradePanel: $("upgradePanel"),
      complexityVal: $("complexityVal"),
      projPoints: $("projPoints"), prestigeMeta: $("prestigeMeta"),
      ribozymeBox: $("ribozymeBox"), riboHeading: $("riboHeading"),
      riboReqs: $("riboReqs"), ribozymeBtn: $("ribozymeBtn"),
      nextPhaseBox: $("nextPhaseBox"), nextHeading: $("nextHeading"), nextPhaseBody: $("nextPhaseBody"),
      logHeading: $("logHeading"), log: $("eventLog"),
      draftModal: $("draftModal"), draftHeading: $("draftHeading"), draftCards: $("draftCards"),
      notesBtn: $("notesBtn"), notesModal: $("notesModal"), notesHeading: $("notesHeading"), notesBody: $("notesBody"),
      _nextBuilt: false,
    };

    applyStaticText();
    G.load();
    if (G.loadError) U.flashStatus(cfg.ui.saveRecovery);

    $("saveBtn").addEventListener("click", () => G.save(true));
    $("resetBtn").addEventListener("click", resetGame);
    $("prestigeBtn").addEventListener("click", () => {
      const gained = G.engine.prestige();
      U.flashStatus(gained > 0 ? "Prestiged: +" + G.fmt(gained) + " " + cfg.prestige.nameShort : "Prestiged");
    });
    el.notesBtn.addEventListener("click", () => el.notesModal.classList.remove("hidden"));
    $("notesClose").addEventListener("click", () => el.notesModal.classList.add("hidden"));

    buildResources();
    buildNotes();
    U.onMilestoneChange();
    U.renderLog();
    maybeStartIntro();

    G.render.init();
    G.engine.start();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", U.init);
  } else {
    U.init();
  }
})();
