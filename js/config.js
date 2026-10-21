/* =========================================================================
 * IdleLife — Origin of Life Prototype
 * config.js — ALL tunable data & balancing in one place.
 *
 * DESIGN RULE (William's standing request): every key value, resource name,
 * list, number, threshold, weight and piece of copy lives HERE. The logic
 * files (state/engine/render/ui) read this generically and must never bury a
 * magic number. To rebalance or rename anything, edit only this file.
 *
 * ---- THE REDUCTION AGE (this build) ----------------------------------------
 * The early game is a chemically-grounded arc:
 *   1. Hadean start — a neutral/oxidizing atmosphere (N2, CO2, H2O passively
 *      generated; trace CH4, H2, CO only from discrete events). Strikes drive
 *      a small set of REACTIONS that CONSUME inputs to make products:
 *      Formaldehyde (from CH4), NO (from CO2 + N2), and random Tars.
 *   2. Electron Donors accumulate — H2 (the weakest but most abundant donor)
 *      arrives mainly from meteors, in several sizes. Redox Charge is a hidden
 *      derived stat (sum of donor stock x strength), not shown yet.
 *   3. Reducing Environment unlocks once enough H2 accumulates — reveals Redox
 *      Charge and the reducing resources, and enables reducing chemistry.
 *   4. Reducing chemistry — NO -> NH3 (slow passive), HCN (NH3 + CH4, and from
 *      meteors), CO2 -> CH4 (passive), and NH3 + Formaldehyde / NH3 + HCN ->
 *      amino acids, the capstone. Amino acids unlock the locked RNA World teaser.
 *
 * Which product a strike forms is DENSITY-WEIGHTED (mass action): the more
 * abundant a reaction's inputs, the more likely that reaction fires.
 *
 * Classic <script> files (no ES modules) so the game runs from file://.
 * Everything hangs off the global `G` namespace.
 * ========================================================================= */

window.G = window.G || {};

G.config = {
  SAVE_KEY: "primordial.save.v3", // v3: Reduction Age rework (v2 was the RNA/ribozyme build)
  TICK_MS: 100,                   // logic tick (wall-clock delta; runs when hidden)

  /* --- Top-of-screen branding / soup framing copy --- */
  ui: {
    saveRecovery: "Save could not be loaded. Original kept; saving paused. Reset discards it and starts over.",
    title: "AbioGenesis",
    subtitle: "· Hadean Garden",
    tagline: "From Chaos, Chemistry.",
    logo: "assets/logo-mark.svg",
    soupHeading: "Hadean Earth",
    // The old one-paragraph intro/hint are retired in favor of the timed
    // narration queue (see `narratives.intro`). The title above is all that
    // shows over the soup at the very start.
    strikeButton: "Strike the Ooze",
    resourcesHeading: "Resources",
    upgradesHeading: "Upgrades",
    logHeading: "Event Log",
    prestigeHeading: "Prestige",
    draftHeading: "Choose an adaptation",
    ribozymeHeading: "Next Goal",      // the progress card, repurposed as the goal tracker
    nextPhaseHeading: "Next Phase",
    notesHeading: "Field Notes",
    notesButton: "Field Notes",
    // shown under the Prestige panel until the point-enabling milestone is reached
    prestigeLockedMeta: "Prestige points unlock when the world turns reducing.",
    prestigeLowMeta: "Reach more Complexity to bank points.",

    /* --- Progressive reveal: the game opens as just the soup + title, then
     * unveils each system as the player clicks. Values are strike counts
     * (s.stats.totalStrikes) at which each panel first appears. Keyed off the
     * persisted strike count, so returning players see the right set and a
     * reset replays the whole intro. --- */
    reveal: { resources: 1, upgrades: 3, log: 10 },

    /* --- Narration queue timing (see narratives + milestone.narrative). Each
     * story line shows for `lineMs`; the final line of a sequence lingers. --- */
    narration: { lineMs: 4200 },
  },

  /* =======================================================================
   * NARRATIVES — timed story sequences shown one line at a time in the center
   * overlay (G.ui.narrate). These are the non-milestone beats; milestone beats
   * live inline on each milestone as `narrative`. Lines render as HTML.
   * ===================================================================== */
  narratives: {
    // Plays once on a truly fresh start (totalStrikes === 0). The last line is
    // the click call-to-action and lingers until the first strike.
    intro: [
      "Roughly four billion years ago.",
      "A neutral, hazy sky hangs over an inert ocean.",
      "The lack of free electrons means little chemistry, slow change, and no life.",
      "But the ocean is not dead — it is just waiting. <strong>Click to add energy.</strong>",
    ],
    // Fires on the first meteor (which only arrives after the meteor lockout).
    firstMeteor: [
      "The meteor hisses into the sea, carrying hydrogen-rich minerals from worlds far away.",
      "In the boiling aftermath, they release hydrogen gas — unstable, reactive, hungry for partners.",
      "Maybe, with enough impacts, the ocean could wake up.",
    ],
  },

  /* =======================================================================
   * RESOURCE GROUPS — purely a UI grouping/collapse concern. Every entry in
   * `resources` below carries a `group` id matching one of these.
   * ===================================================================== */
  resourceGroups: [
    { id: "atmosphere", label: "Hadean Atmosphere", collapsedByDefault: false },
    { id: "chemistry", label: "Prebiotic Chemistry", collapsedByDefault: false },
    { id: "terrestrial", label: "Terrestrial Materials", collapsedByDefault: false },
    { id: "precursors", label: "RNA Precursors", collapsedByDefault: false },
    { id: "nucleobases", label: "Nucleobases", collapsedByDefault: false },
    { id: "genetic", label: "Genetic Material", collapsedByDefault: false },
  ],

  /* =======================================================================
   * RESOURCES
   * revealedBy: null  -> available from the start
   * revealedBy: "<milestoneId>" -> hidden (but still accumulates) until met
   * The UI shows resource rows only while their current displayed amount is > 0.
   * startAmount: initial per-run stock (reset by prestige)
   * passivePerSec: passive generation each second (atmospheric replenishment)
   * electronDonor: { strength, unlockEffect? } -> contributes to Redox Charge.
   *   `strength` is redox per unit; `unlockEffect` (if set) means the donor only
   *   counts once a prestige upgrade sets that derived effect > 0.
   * derived: "<G helper name>" -> the row displays a computed value instead of a
   *   stored amount (Redox Charge = G.redoxCharge).
   * ===================================================================== */
  resources: [
    // ---- Hadean atmosphere ----
    // N2 / CO2 / H2O are the bulk atmosphere: plentiful and passively replenished.
    {
      id: "n2", name: "Nitrogen", short: "N2", color: "#9db8d6",
      revealedBy: null, group: "atmosphere", startAmount: 500, passivePerSec: 0.5,
      tooltip: "Main atmospheric nitrogen reservoir. Slowly replenishes on its own.",
    },
    {
      id: "co2", name: "Carbon Dioxide", short: "CO2", color: "#c3d0d8",
      revealedBy: null, group: "atmosphere", startAmount: 200, passivePerSec: 0.35,
      tooltip: "Main carbon source. Volcanic outgassing keeps it topped up.",
    },
    {
      id: "h2o", name: "Water", short: "H2O", color: "#38BDF8",
      revealedBy: null, group: "atmosphere", startAmount: 1000, passivePerSec: 0.4,
      tooltip: "Ocean, solvent, and steam — the medium everything else reacts in.",
    },
    // CH4 / H2 / CO start as mere traces and ONLY arrive from discrete events
    // (volcanic, geothermal, meteors) — never passively.
    {
      id: "ch4", name: "Methane", short: "CH4", color: "#D9F99D",
      revealedBy: null, group: "atmosphere", startAmount: 4,
      tooltip: "Trace reduced carbon. Early on it seeps from volcanoes and geothermal vents; once the world turns reducing, CO2 can be reduced back into it.",
    },
    {
      id: "h2", name: "Hydrogen", short: "H2", color: "#ECFEFF",
      revealedBy: null, group: "atmosphere", startAmount: 3,
      electronDonor: { strength: 0.5 },
      tooltip: "The weakest but most abundant electron donor. Almost all early Redox Charge starts as H2, and meteors are its main source. Enough of it turns the world reducing.",
    },
    {
      id: "co", name: "Carbon Monoxide", short: "CO", color: "#9fb0a6",
      revealedBy: null, group: "atmosphere", startAmount: 4,
      electronDonor: { strength: 0.9, unlockEffect: "donorCO" },
      tooltip: "Trace reactive carbon from vents. A latent electron donor — recruited only once vent chemistry is mastered (a prestige upgrade).",
    },

    // ---- Prebiotic chemistry: the interactive economy ----
    // Early products reveal only after the first successful production.
    {
      id: "formaldehyde", name: "Formaldehyde", short: "HCHO", color: "#CDE87F",
      revealedBy: null, group: "chemistry",
      tooltip: "Forged from methane by energy. A building block for sugars, and (with ammonia) for amino acids.",
    },
    {
      id: "no", name: "Nitric Oxide", short: "NO", color: "#E4B07A",
      revealedBy: null, group: "chemistry",
      tooltip: "Made when energy fuses CO2 and N2. In a reducing world it slowly reduces down into ammonia.",
    },
    {
      id: "tars", name: "Tars", short: "Tar", color: "#7C877F",
      revealedBy: null, group: "chemistry",
      tooltip: "Gunky dead-end polymers — the byproduct of reactions that don't cleanly resolve. An unavoidable early nuisance.",
    },
    // Hidden until the Reducing Environment flips.
    {
      id: "redox", name: "Redox Charge", short: "Rx", color: "#64F7D2",
      revealedBy: "reducingEnvironment", group: "chemistry", derived: "redoxCharge",
      tooltip: "Reducing power available from electron donors (H2, later CO). Higher Redox Charge makes reactions run cleaner, with less tar. A hidden quantity until the world turns reducing.",
      deepNote: "Also called Reducing Power in deeper chemistry texts — the term is kept out of the main UI to stay approachable.",
    },
    {
      id: "ammonia", name: "Ammonia", short: "NH3", color: "#6FC8E6",
      revealedBy: "reducingEnvironment", group: "chemistry",
      tooltip: "Reduced nitrogen — the slow product of NO in a reducing world. Reacts with formaldehyde and HCN to make amino acids.",
    },
    {
      id: "hcn", name: "Hydrogen Cyanide", short: "HCN", color: "#E58CAE",
      revealedBy: "reducingEnvironment", group: "chemistry",
      tooltip: "Made from ammonia and methane (and delivered by meteors). A potent partner for ammonia on the road to amino acids.",
    },
    {
      id: "aminoAcids", name: "Amino Acids", short: "AA", color: "#6EE7B7",
      revealedBy: "reducingEnvironment", group: "chemistry",
      tooltip: "The first true biomolecules — assembled from ammonia with formaldehyde or HCN. One day they will help build the first RNA.",
    },

    // ---- Terrestrial materials: mineral catalysts weathered from the young
    // crust. Delivered as chance drops from volcanic/geothermal events; they
    // accumulate quietly and reveal once amino acids open the nucleobase phase.
    // Each templates a different base in the formamide pathway. ----
    {
      id: "phosphates", name: "Phosphates", short: "PO4", color: "#B9C6E8",
      revealedBy: "aminoAcids", group: "terrestrial",
      tooltip: "Weathered phosphate minerals. On mineral surfaces they help formamide condense into adenine.",
    },
    {
      id: "borates", name: "Borates", short: "BO3", color: "#A7F3D0",
      revealedBy: "aminoAcids", group: "terrestrial",
      tooltip: "Borate deposits from evaporating pools. They stabilize the sugars and steer formamide toward cytosine.",
    },
    {
      id: "clays", name: "Clays", short: "Clay", color: "#C2B79A",
      revealedBy: "aminoAcids", group: "terrestrial",
      tooltip: "Layered clay minerals — natural templating surfaces. With formamide they favor uracil.",
    },
    {
      id: "carbonates", name: "Carbonates", short: "CO3", color: "#CBD8DE",
      revealedBy: "aminoAcids", group: "terrestrial",
      tooltip: "Carbonate rock leached by warm water. On its surfaces formamide is drawn toward guanine.",
    },

    // ---- RNA precursors: the reactive intermediates on the road to bases. ----
    {
      id: "cyanoacetylene", name: "Cyanoacetylene", short: "HC3N", color: "#5FD8C6",
      revealedBy: "aminoAcids", group: "precursors",
      tooltip: "Forged from methane and carbon monoxide in a reducing sky (and delivered by meteors). Combines with aminooxazoline to build cytosine.",
    },
    {
      id: "aminooxazoline", name: "Aminooxazoline", short: "AmOx", color: "#9BB8EC",
      revealedBy: "aminoAcids", group: "precursors",
      tooltip: "A sugar-nitrogen intermediate that assembles where the soup is densest. Pairs with cyanoacetylene to make cytosine.",
    },
    {
      id: "formamide", name: "Formamide", short: "HCONH2", color: "#E8C79B",
      revealedBy: "aminoAcids", group: "precursors",
      tooltip: "Made from water and HCN. On terrestrial mineral surfaces it can condense into any RNA base — phosphates→A, borates→C, clays→U, carbonates→G.",
    },

    // ---- Nucleobases: the four letters of RNA (plus a dormant thymine). ----
    {
      id: "adenine", name: "Adenine", short: "A", color: "#E890A6",
      revealedBy: "aminoAcids", group: "nucleobases",
      tooltip: "The first RNA letter — condensed directly from five HCN, from formamide on phosphates, and from meteors. Later, the core of ATP.",
    },
    {
      id: "guanine", name: "Guanine", short: "G", color: "#7FDCA0",
      revealedBy: "aminoAcids", group: "nucleobases",
      tooltip: "A purine base — built from formamide on carbonate surfaces, and delivered by meteors.",
    },
    {
      id: "cytosine", name: "Cytosine", short: "C", color: "#7FB4EE",
      revealedBy: "aminoAcids", group: "nucleobases",
      tooltip: "A pyrimidine base — from aminooxazoline plus cyanoacetylene, or from formamide on borates. Slowly deaminates in water into uracil.",
    },
    {
      id: "uracil", name: "Uracil", short: "U", color: "#E4D48A",
      revealedBy: "aminoAcids", group: "nucleobases",
      tooltip: "The RNA stand-in for thymine — from cytosine hydrolysis, or from formamide on clays.",
    },
    {
      // Placeholder: RNA uses uracil, not thymine. T has no prebiotic recipe here
      // and stays dormant until a later DNA age gives it one.
      id: "thymine", name: "Thymine", short: "T", color: "#CFD8A0",
      revealedBy: "nucleobases", group: "nucleobases",
      tooltip: "The DNA-only letter. RNA uses uracil in its place — thymine waits for a later DNA age.",
    },

    // ---- Genetic material: the first crude RNA strands. Assembled from the
    // four bases on a phosphate backbone once the alphabet is complete. ----
    {
      id: "rna", name: "RNA Strand", short: "RNA", color: "#F4C4E0",
      revealedBy: "nucleobases", group: "genetic",
      tooltip: "A short chain of nucleobases on a phosphate backbone — the first molecule that can store and copy rough information. The threshold between chemistry and heredity.",
    },
  ],

  /* =======================================================================
   * ENERGY EVENTS — the strike roll table.
   * Each strike: weighted pick from `table`, optional size/variant sub-roll,
   * apply feedstock `grants`/`chance`, THEN drive one of the event's listed
   * `reactions` (mass-action / density weighted, see the reactions block).
   *
   * grants:    { resourceId: [min, max] }         feedstock, always applied
   * chance:    { resourceId: { p, min, max } }    feedstock, prob p
   * reactions: [reactionId, ...]                  which reactions this event drives
   * sizes:     true -> rolls a size tier from sizeMult/sizeWeight
   * variants:  named self-contained effect profiles (meteor)
   * rare:      counts toward "rare event discoveries" for Complexity
   * firstAlwaysGood + firstVariantId: first meteor is forced to the best variant
   * ===================================================================== */
  energyEvents: {
    sizeTiers: ["small", "medium", "large", "exceptional"],
    sizeMult: { small: 1, medium: 1.8, large: 3.2, exceptional: 6 },
    sizeWeight: { small: 60, medium: 28, large: 10, exceptional: 2 },

    // Meteor lockout: no meteor can roll until the player has struck at least
    // this many times. After that, the normal weighted table governs meteors.
    // (Enforced in engine.js rollEvent.)
    meteorMinStrikes: 30,

    table: [
      {
        id: "lightning", name: "Lightning Strike", weight: 40, color: "#64F7D2",
        sprite: "bolt.png",   // optional assets/fx/ texture; procedural bolt if absent
        flavor: "A bolt tears through the sky and shocks the ooze.",
        // Electric discharge through CO2/N2 makes NO; in a reducing world it also
        // drives ammonia + methane toward HCN. Once bases open up, discharge also
        // fixes cyanoacetylene and formamide and condenses HCN into adenine.
        reactions: [
          "no_from_co2_n2", "hcn_from_nh3_ch4",
          "cyanoacetylene_from_ch4_co", "adenine_from_hcn", "formamide_from_h2o_hcn",
          "rna_from_bases",
        ],
      },
      {
        id: "uv", name: "Solar Subflare / UV Exposure", weight: 30, color: "#D9F99D",
        sprite: "ray.png",
        flavor: "Ultraviolet light rains down, driving photochemistry.",
        // UV photolysis of methane makes formaldehyde; later it condenses amino acids,
        // assembles aminooxazoline, builds cytosine and fixes formamide.
        reactions: [
          "formaldehyde_from_ch4", "aa_from_nh3_formaldehyde",
          "aminooxazoline_from_hcn_formaldehyde", "cytosine_from_aminooxazoline_cyanoacetylene",
          "formamide_from_h2o_hcn", "rna_from_bases",
        ],
      },
      {
        // Base weight 0: bubble cavitation is LOCKED until the "Bubble Cavitation"
        // Ocean Activity upgrade adds weight via cavitationWeightAdd. Further
        // levels raise its frequency and (via cavitationReactionYieldMult) potency.
        id: "cavitation", name: "Bubble Cavitation", weight: 0, color: "#38BDF8",
        sprite: "bubble.png",
        flavor: "Collapsing bubbles concentrate molecules in fleeting hotspots.",
        // Concentration favors condensation: makes NO early, amino acids and
        // (once dense enough) adenine and cytosine later.
        reactions: [
          "no_from_co2_n2", "aa_from_nh3_hcn", "aa_from_nh3_formaldehyde",
          "adenine_from_hcn", "cytosine_from_aminooxazoline_cyanoacetylene",
        ],
      },
      {
        id: "volcanic", name: "Volcanic Activity", weight: 12, color: "#E4A57A",
        sprite: "volcano.png",
        flavor: "Hydrothermal venting belches methane, reactive minerals and heat.",
        sizes: true,
        // Volcanoes are the early feedstock source: methane, plus CO2/CO topping-up,
        // and they weather out igneous phosphates and carbonates. Their heat also
        // fixes cyanoacetylene and drives formamide toward adenine/guanine.
        grants: { ch4: [1, 3] },
        chance: {
          co2: { p: 0.5, min: 3, max: 10 },
          co: { p: 0.4, min: 1, max: 4 },
          phosphates: { p: 0.35, min: 0.5, max: 2 },
          carbonates: { p: 0.3, min: 0.5, max: 2 },
        },
        reactions: [
          "formaldehyde_from_ch4",
          "cyanoacetylene_from_ch4_co",
          "adenine_from_formamide_phosphates", "guanine_from_formamide_carbonates",
        ],
      },
      {
        id: "geothermal", name: "Geothermal Seep", weight: 8, color: "#E8C58A",
        sprite: "geothermal.png",   // gentle bubble-seep texture, drawn smaller
        flavor: "Warm ground exhales a slow breath of methane.",
        // A gentler methane source alongside volcanism. Hydrothermal alteration
        // leaches borates and clays; those warm mineral surfaces are the natural
        // home of the formamide→base condensations.
        grants: { ch4: [0.5, 1.5] },
        chance: {
          co: { p: 0.3, min: 0.5, max: 1.5 },
          borates: { p: 0.3, min: 0.3, max: 1.2 },
          clays: { p: 0.4, min: 0.5, max: 2 },
        },
        reactions: [
          "adenine_from_formamide_phosphates", "cytosine_from_formamide_borates",
          "uracil_from_formamide_clays", "guanine_from_formamide_carbonates",
        ],
      },
      {
        id: "meteor", name: "Meteor Strike", weight: 2, color: "#B9E8D6", rare: true,
        sprite: "meteor.png", bloomSprite: "spark.png",   // spark flashes on impact
        flavor: "An impactor delivers iron, water and exotic organics.",
        firstAlwaysGood: true, firstVariantId: "major_impact",
        /* --- Meteors are the main source of Hydrogen (the early electron donor),
         * scaled by size, plus occasional HCN. Each variant is self-contained. --- */
        variants: [
          {
            id: "micrometeor", name: "Micrometeor", weight: 55, visualScale: 0.6,
            flavor: "A speck of dust burns a thin streak — a wisp of hydrogen.",
            grants: { h2: [1, 2] },
          },
          {
            id: "iron_rich", name: "Iron-Rich Meteor", weight: 22, visualScale: 1.0,
            flavor: "Metallic iron hisses into the water, springing hydrogen loose.",
            grants: { h2: [2, 4] },
            chance: {
              hcn: { p: 0.2, min: 0.3, max: 1.0 },
              cyanoacetylene: { p: 0.15, min: 0.2, max: 0.6 },
            },
          },
          {
            id: "icy_comet", name: "Icy Comet", weight: 12, visualScale: 1.3,
            flavor: "A dirty snowball splashes down — water and hydrogen together.",
            grants: { h2: [3, 6], h2o: [5, 15] },
          },
          {
            id: "major_impact", name: "Major Impact", weight: 11, visualScale: 1.8,
            flavor: "The ground shakes. Impact ejecta floods the soup with hydrogen and organics.",
            grants: { h2: [5, 10] },
            chance: {
              hcn: { p: 0.4, min: 1, max: 3 },
              cyanoacetylene: { p: 0.3, min: 0.3, max: 1 },
              adenine: { p: 0.25, min: 0.3, max: 1 },
              guanine: { p: 0.2, min: 0.2, max: 0.8 },
            },
          },
        ],
      },
    ],
  },

  /* =======================================================================
   * REACTIONS — the core early-game mechanic. Strikes drive one of the firing
   * event's listed reactions; passive reactions tick on their own once the
   * world is reducing. Each reaction CONSUMES `inputs` and produces `outputs`
   * (or, on a bad roll, Tars — see reactionRoll).
   *
   * mode:   "strike" (driven by an energy event) | "passive" (ticks per second)
   * inputs: { resourceId: amountConsumed }
   * outputs:{ resourceId: [min, max] }   (scaled by reactionYieldMult)
   * weight: base selection weight for strike reactions (before density weighting)
   * ratePerSec: passive reactions only — reaction "fires" per second
   * gate:   null (available immediately) | "<milestoneId>" (reducing chemistry)
   * ===================================================================== */
  reactions: {
    // ---- Early products (available from the start) ----
    formaldehyde_from_ch4: {
      name: "Formaldehyde synthesis", mode: "strike", gate: null, weight: 10,
      inputs: { ch4: 1 }, outputs: { formaldehyde: [0.6, 1.4] },
    },
    no_from_co2_n2: {
      name: "Nitric oxide fixation", mode: "strike", gate: null, weight: 10,
      inputs: { co2: 1, n2: 1 }, outputs: { no: [0.6, 1.4] },
    },

    // ---- Reducing chemistry (gated by the Reducing Environment) ----
    ammonia_from_no: {
      name: "NO reduction", mode: "passive", gate: "reducingEnvironment", ratePerSec: 1.0,
      inputs: { no: 0.6 }, outputs: { ammonia: [0.6, 1.1] },
    },
    ch4_from_co2: {
      name: "CO2 reduction", mode: "passive", gate: "reducingEnvironment", ratePerSec: 0.25,
      inputs: { co2: 1 }, outputs: { ch4: [0.3, 0.7] },
    },
    hcn_from_nh3_ch4: {
      name: "HCN synthesis", mode: "strike", gate: "reducingEnvironment", weight: 8,
      inputs: { ammonia: 1, ch4: 1 }, outputs: { hcn: [0.5, 1.2] },
    },
    aa_from_nh3_formaldehyde: {
      name: "Amino-acid condensation", mode: "strike", gate: "reducingEnvironment", weight: 6,
      inputs: { ammonia: 1, formaldehyde: 1 }, outputs: { aminoAcids: [0.4, 0.9] },
    },
    aa_from_nh3_hcn: {
      name: "Strecker-style synthesis", mode: "strike", gate: "reducingEnvironment", weight: 6,
      inputs: { ammonia: 1, hcn: 1 }, outputs: { aminoAcids: [0.5, 1.1] },
    },

    // ---- Nucleobase chemistry (gated by Amino Acids — the RNA-precursor phase).
    // Cyanoacetylene fixes as soon as the world is reducing, then quietly stocks
    // up until the base phase reveals it. --------------------------------------
    // Adenine straight from an HCN pentamer (Oró).
    adenine_from_hcn: {
      name: "Adenine synthesis (HCN pentamer)", mode: "strike", gate: "aminoAcids", weight: 5,
      inputs: { hcn: 5 }, outputs: { adenine: [0.4, 1.0] },
    },
    // Cyanoacetylene forms only in a reducing sky (CH4 + CO); also from meteors.
    cyanoacetylene_from_ch4_co: {
      name: "Cyanoacetylene synthesis", mode: "strike", gate: "reducingEnvironment", weight: 6,
      inputs: { ch4: 1, co: 1 }, outputs: { cyanoacetylene: [0.3, 0.8] },
    },
    // Aminooxazoline assembles where the soup is densest (mass action does the
    // "sufficient density" gating — no complexity term, by design).
    aminooxazoline_from_hcn_formaldehyde: {
      name: "Aminooxazoline assembly", mode: "strike", gate: "aminoAcids", weight: 4,
      inputs: { hcn: 1, formaldehyde: 1 }, outputs: { aminooxazoline: [0.3, 0.7] },
    },
    // Cytosine (Powner–Sutherland): aminooxazoline + cyanoacetylene.
    cytosine_from_aminooxazoline_cyanoacetylene: {
      name: "Cytosine synthesis", mode: "strike", gate: "aminoAcids", weight: 5,
      inputs: { aminooxazoline: 1, cyanoacetylene: 1 }, outputs: { cytosine: [0.3, 0.8] },
    },
    // Uracil from slow hydrolytic deamination of cytosine (passive, in water).
    uracil_from_cytosine_h2o: {
      name: "Cytosine deamination", mode: "passive", gate: "aminoAcids", ratePerSec: 0.15,
      inputs: { cytosine: 0.5, h2o: 0.5 }, outputs: { uracil: [0.4, 0.9] },
    },
    // Formamide (water + HCN) — the terrestrial route to every RNA base.
    formamide_from_h2o_hcn: {
      name: "Formamide synthesis", mode: "strike", gate: "aminoAcids", weight: 5,
      inputs: { h2o: 1, hcn: 1 }, outputs: { formamide: [0.4, 0.9] },
    },
    // Formamide on mineral surfaces → a specific base per material.
    adenine_from_formamide_phosphates: {
      name: "Formamide → adenine (phosphate surfaces)", mode: "strike", gate: "aminoAcids", weight: 4,
      inputs: { formamide: 1, phosphates: 1 }, outputs: { adenine: [0.3, 0.7] },
    },
    cytosine_from_formamide_borates: {
      name: "Formamide → cytosine (borate surfaces)", mode: "strike", gate: "aminoAcids", weight: 4,
      inputs: { formamide: 1, borates: 1 }, outputs: { cytosine: [0.3, 0.7] },
    },
    uracil_from_formamide_clays: {
      name: "Formamide → uracil (clay surfaces)", mode: "strike", gate: "aminoAcids", weight: 4,
      inputs: { formamide: 1, clays: 1 }, outputs: { uracil: [0.3, 0.7] },
    },
    guanine_from_formamide_carbonates: {
      name: "Formamide → guanine (carbonate surfaces)", mode: "strike", gate: "aminoAcids", weight: 4,
      inputs: { formamide: 1, carbonates: 1 }, outputs: { guanine: [0.3, 0.7] },
    },

    // ---- Genetic capstone (gated by the complete nucleobase alphabet). Energy
    // links one of each base onto a phosphate backbone into the first crude RNA
    // strand. Deliberately expensive — the first strand is a real milestone. ----
    rna_from_bases: {
      name: "RNA strand assembly", mode: "strike", gate: "nucleobases", weight: 3,
      inputs: { adenine: 1, guanine: 1, cytosine: 1, uracil: 1, phosphates: 1 },
      outputs: { rna: [0.2, 0.5] },
    },
  },

  /* --- Reaction tuning ---
   * densityExponent: how strongly input abundance biases which reaction fires
   *   (mass action). 0 = flat odds; higher = "richer soup wins" more sharply.
   *   Kept small so it's only *slightly* predictive.
   * tarChance:   base probability a strike reaction produces Tars instead.
   * tarChanceMin: floor after tarReduction / redox relief are applied.
   * redoxTarRelief: Tar probability reduced by this much per point of Redox Charge.
   * tars.outputs: what a tarred reaction yields instead. --- */
  reactionRoll: {
    densityExponent: 0.4,
    tarChance: 0.2,
    tarChanceMin: 0.02,
    redoxTarRelief: 0.0025,
    tars: { outputs: { tars: [0.2, 0.7] } },
  },

  /* =======================================================================
   * MILESTONES — auto-firing, per-run (reset by prestige). Checked generically:
   * a milestone fires when its prerequisite milestone (if any) is met AND all
   * `requires` resource thresholds are satisfied.
   *
   * requiresMilestone: gate on another milestone first
   * requires: { resourceId: threshold }
   * reqLabels: optional friendlier labels for the goal card
   * reveals: informational (resources reveal via their own revealedBy)
   * grantOnUnlock: one-time resource grant
   * enablesPrestigePoints: prestige can bank points once this is reached
   * unlocksNextPhase: flips the permanent next-phase teaser
   * ===================================================================== */
  milestones: {
    reducingEnvironment: {
      name: "Reducing Environment",
      goalHeading: "Toward a Reducing World",
      requires: { h2: 125 },
      reqLabels: { h2: "Electron Donors" },
      reveals: ["redox", "ammonia", "hcn", "aminoAcids"],
      enablesPrestigePoints: true,
      unlockText:
        "REDUCING ENVIRONMENT — Electron donors now outweigh the oxidizing gases. Nitric oxide begins to reduce into ammonia, and a richer chemistry opens up.",
      // Multi-line story beat (preferred over the plain unlockText banner). Warns
      // the player things are still slow, motivating the new Ocean Activity path.
      narrative: [
        "The atmosphere has changed.",
        "Electrons are abundant. Reactions now occur freely.",
        "But the ocean is vast, and its molecules are lonely.",
        "Chemistry is possible. Contact is rare.",
      ],
      log: "Electron donors tip the balance — the world turns reducing.",
    },
    aminoAcids: {
      name: "Amino Acids",
      goalHeading: "Toward Amino Acids",
      requiresMilestone: "reducingEnvironment",
      requires: { aminoAcids: 230 },
      reqLabels: { aminoAcids: "Amino Acids" },
      unlocksNextPhase: true,
      unlockText:
        "AMINO ACIDS — The first true biomolecules pool in the soup. Reducing chemistry now reaches further: the RNA precursors and the first nucleobases begin to form.",
      narrative: [
        "Amino acids begin linking into short chains.",
        "For the first time, chemistry is building structures larger than a single molecule.",
        "But the sea is violent. Heat, salt, and motion tear weak bonds apart almost as quickly as they form.",
      ],
      log: "Amino acids accumulate — the ingredients of the first proteins and, eventually, RNA.",
    },
    nucleobases: {
      name: "Nucleobases",
      goalHeading: "Toward the Nucleobases",
      requiresMilestone: "aminoAcids",
      requires: { adenine: 10, guanine: 8, cytosine: 8, uracil: 8 },
      reqLabels: { adenine: "Adenine", guanine: "Guanine", cytosine: "Cytosine", uracil: "Uracil" },
      reveals: ["thymine"],
      unlockText:
        "NUCLEOBASES — The four letters of RNA — A, G, C and U — now pool in the soup together. Ribose and a backbone are all that stand between chemistry and the first genetic code.",
      log: "The RNA alphabet is complete — adenine, guanine, cytosine and uracil accumulate together.",
    },
    firstRNA: {
      name: "The First RNA",
      goalHeading: "Toward the First RNA",
      requiresMilestone: "nucleobases",
      requires: { rna: 1 },
      reqLabels: { rna: "RNA Strand" },
      unlockText:
        "THE FIRST RNA — A strand of bases links onto a phosphate backbone. Chemistry can now store and copy rough information.",
      narrative: [
        "Chemistry has learned to store and copy rough information.",
        "Life is no longer random.",
      ],
      log: "The first RNA strand assembles — heredity begins.",
    },
  },

  /* =======================================================================
   * PRESTIGE — soft prestige any time; points scale off run Complexity.
   * ===================================================================== */
  prestige: {
    name: "Prestige Points",
    nameShort: "PP",
    complexity: {
      weights: {
        formaldehyde: 1.0,
        no: 1.0,
        tars: 0.3,
        ammonia: 1.5,
        hcn: 2.0,
        aminoAcids: 4.0,
        cyanoacetylene: 2.0,
        aminooxazoline: 3.0,
        formamide: 2.0,
        adenine: 6.0,
        guanine: 6.0,
        cytosine: 6.0,
        uracil: 6.0,
        rna: 20.0,
        highestRedox: 0.5,
        rareEventsDiscovered: 15,        // per distinct rare event seen this run
        eventTypesDiscovered: 6,         // per distinct energy input triggered
        reducingEnvironmentUnlocked: 40, // flat bonus when the world turns reducing
      },
    },
    // points = floor( ((complexity - minComplexity)/divisor) ^ exponent ), min 0
    pointsFormula: { minComplexity: 50, divisor: 35, exponent: 0.7 },

    draftCount: 3,     // choices offered each prestige
    draftPrestiges: 10, // roguelike draft for the first N prestiges

    // Internal trunks. unlockedFromStart or unlockedBy:<milestoneId>.
    trunks: [
      { id: "celestial", name: "Celestial", unlockedFromStart: true },
      { id: "donors", name: "Electron Donors", unlockedFromStart: true },
      { id: "chemistry", name: "Prebiotic Chemistry", unlockedFromStart: true },
      { id: "gradient", name: "Electrochemical Gradients", unlockedBy: "reducingEnvironment" },
    ],
  },

  /* =======================================================================
   * PRESTIGE UPGRADES — fixed internal tree, surfaced as a 3-choice draft.
   * effects are summed generically in G.derive() and read by the engine —
   * adding an upgrade never touches engine logic. Each level adds its value.
   * ===================================================================== */
  prestigeUpgrades: [
    // ---- Celestial (meteors = the hydrogen supply) ----
    {
      id: "celestial_chaos", trunk: "celestial", name: "Celestial Chaos I", max: 5,
      desc: "The heavens grow restless. Slightly increases meteor frequency.",
      effects: { meteorWeightAdd: 2 },
    },
    {
      id: "icy_impacts", trunk: "celestial", name: "Hydrogen-Rich Impacts", max: 5,
      desc: "Impactors carry more volatiles. Meteors deliver more Hydrogen.",
      effects: { meteorH2Mult: 0.25 },
    },
    // ---- Electron Donors ----
    {
      id: "donor_residue", trunk: "donors", name: "Donor Residue I", max: 5,
      desc: "Reducing minerals linger between runs. Start each run with extra Hydrogen.",
      effects: { startDonors: 5 },
    },
    {
      id: "electron_donor_bias", trunk: "donors", name: "Electron Donor Bias", max: 5,
      desc: "Every strike scrapes a little hydrogen loose from the rocks.",
      effects: { donorPerTap: 0.3 },
    },
    {
      id: "donor_strength", trunk: "donors", name: "Reducing Power", max: 5,
      desc: "You wring more reducing power from every donor. Each donor yields more Redox Charge.",
      effects: { donorStrengthMult: 0.15 },
    },
    {
      id: "inorganic_donors", trunk: "donors", name: "Inorganic Electron Donors", max: 1,
      desc: "Vent chemistry mastered. Carbon monoxide now counts as an electron donor.",
      effects: { donorCO: 1 },
    },
    // ---- Prebiotic Chemistry ----
    {
      id: "reaction_yield", trunk: "chemistry", name: "Catalytic Surfaces", max: 5,
      desc: "Mineral surfaces catalyze cleaner reactions. Every reaction yields more product.",
      effects: { reactionYieldMult: 0.2 },
    },
    {
      id: "tar_reduction", trunk: "chemistry", name: "Fewer Dead Ends", max: 5,
      desc: "Better-ordered chemistry. Reactions clog into tar less often.",
      effects: { tarReduction: 0.03 },
    },
    // ---- Electrochemical Gradients (unlocked by the Reducing Environment) ----
    {
      id: "gradient_passive", trunk: "gradient", name: "Proton Gradients I", max: 3,
      requires: { milestone: "reducingEnvironment" },
      desc: "Mineral membranes hold a charge and drive the slow reactions faster.",
      effects: { passiveReactionRateMult: 0.3 },
      firstPickFlavor:
        "Charge no longer waits for lightning. Across thin mineral barriers, reduction begins to run itself.",
    },
  ],

  /* =======================================================================
   * PATHS + PATH UPGRADES — an in-run upgrade economy, PARALLEL to the
   * roguelike prestige draft above (they coexist, share nothing but G.derive).
   *
   * Bought with LIVE resources during a run; wiped on prestige (per-run, like
   * resources/milestones). Effects are summed into the same flat bag as
   * prestige upgrades by G.derive(), so any effect key the engine already
   * reads (reactionYieldMult, eventGainMult, donorStrengthMult, tarReduction,
   * <eventId>WeightAdd, ...) works here with zero engine changes.
   *
   * paths[]:  { id, name, unlockedFromStart | unlockedBy: "<milestoneId>" }
   * pathUpgrades[]:
   *   id, path, name, max, desc
   *   cost:        { resourceId: baseAmount }   cost of the FIRST level
   *   costGrowth:  next-level cost = ceil(base * costGrowth ^ currentLevel)
   *   effects:     { effectKey: perLevelValue }  (same bag as prestige upgrades)
   *   requires:    { milestone: "<id>" }        optional availability gate
   *   placeholder: true  -> shown greyed, non-buyable "coming later" (no effects)
   * ===================================================================== */
  paths: [
    { id: "chemistry",  name: "Chemistry",       unlockedFromStart: true,        color: "#2DD4BF" },
    { id: "ocean",      name: "Ocean Activity",  unlockedBy: "reducingEnvironment", color: "#38BDF8" },
    { id: "metabolism", name: "Metabolism",      unlockedBy: "aminoAcids",        color: "#6EE7B7" },
    { id: "nature",     name: "Nature",          unlockedFromStart: true,         color: "#D9F99D" },
    { id: "membrane",   name: "Membrane",        unlockedBy: "nucleobases",       color: "#38BDF8" },
    { id: "defense",    name: "Defense",         unlockedBy: "nucleobases",       color: "#64F7D2" },
  ],

  pathUpgrades: [
    // ---- Chemistry: faster/cheaper inorganic conversions ----
    {
      id: "catalyst", path: "chemistry", name: "Catalyst", max: 5,
      desc: "Mineral catalysts lower the material cost of prebiotic reactions.",
      cost: { formaldehyde: 8 }, costGrowth: 1.7,
      effects: { reactionInputDiscount: 0.06 },   // NEW key — read in engine
    },
    {
      id: "bioavailability", path: "chemistry", name: "Bio-Availability", max: 5,
      desc: "The young atmosphere replenishes its gases faster.",
      cost: { no: 6 }, costGrowth: 1.7,
      effects: { atmosphereGainMult: 0.15 },      // NEW key — read in engine
    },
    {
      id: "automatic_fixation", path: "chemistry", name: "Automatic Fixation", max: 5,
      desc: "Reducing-world chemistry keeps fixing CO2 and N2 into a steady trickle of NO.",
      requires: { milestone: "reducingEnvironment" },
      cost: { ammonia: 6 }, costGrowth: 1.7,
      effects: { autoNoFixationRate: 0.12 },      // NEW key — read in engine
    },
    {
      id: "redox_efficiency", path: "chemistry", name: "Redox Efficiency", max: 5,
      desc: "You wring more reducing power from every electron donor.",
      requires: { milestone: "reducingEnvironment" },
      cost: { hcn: 5 }, costGrowth: 1.8,
      effects: { donorStrengthMult: 0.12 },       // REUSES existing engine key
    },

    // ---- Ocean Activity (unlocks with the Reducing Environment). The Redox Age
    // problem is that molecules rarely meet ("Contact is rare") — these upgrades
    // concentrate the soup so reactions happen. ----
    {
      id: "bubble_cavitation", path: "ocean", name: "Bubble Cavitation", max: 5,
      desc: "Collapsing bubbles concentrate molecules in fleeting hotspots. Unlocks bubble cavitation strikes; higher levels make them more frequent and more productive.",
      cost: { formaldehyde: 12, no: 8 }, costGrowth: 1.7,
      // cavitationWeightAdd unlocks + up-frequents the (base-weight-0) cavitation
      // event; cavitationReactionYieldMult boosts its reactions. Both keys already
      // flow through the engine — no engine change needed.
      effects: { cavitationWeightAdd: 8, cavitationReactionYieldMult: 0.15 },
    },

    // ---- Nature: the raw power of the sky ----
    {
      id: "zeus_wrath", path: "nature", name: "Zeus's Wrath", max: 5,
      desc: "Lightning strikes hit harder, driving richer reactions.",
      cost: { no: 8 }, costGrowth: 1.7,
      effects: { lightningReactionYieldMult: 0.2 },  // NEW per-event key
    },
    {
      id: "armageddon_it", path: "nature", name: "Armageddon It", max: 5,
      desc: "Impactors trend larger — the average meteor grows.",
      cost: { formaldehyde: 10, tars: 4 }, costGrowth: 1.8,
      effects: { meteorVariantBias: 0.7 },        // NEW key — read in engine
    },
    {
      id: "hot_dry_cycles", path: "nature", name: "Hot/Dry Cycles", max: 5,
      desc: "Evaporation compresses free-ranging chemicals against drying shores, so every reaction yields more.",
      requires: { milestone: "reducingEnvironment" },
      cost: { no: 10 }, costGrowth: 1.7,
      effects: { reactionYieldMult: 0.12 },        // REUSES existing engine key
    },
    {
      id: "surface_minerals", path: "nature", name: "Surface Minerals", max: 5,
      desc: "Mineral surfaces give molecules a safe place to form — fewer dead-end tars and more organic product.",
      requires: { milestone: "aminoAcids" },
      cost: { aminoAcids: 10 }, costGrowth: 1.8,
      effects: { tarReduction: 0.03, reactionYieldMult: 0.1 },
    },
    {
      id: "protected_pools", path: "nature", name: "Protected Pools", max: 5,
      desc: "Sheltered tide pools protect fragile new molecules from the violent open sea. Reactions clog into tar far less often.",
      requires: { milestone: "aminoAcids" },
      cost: { aminoAcids: 14, tars: 6 }, costGrowth: 1.8,
      effects: { tarReduction: 0.045 },
    },

    // ---- Metabolism / Membrane / Defense: scaffolded placeholders. Their
    // mechanics (ATP, cell inputs/outputs, parasites) arrive in later ages, so
    // these show as greyed "coming later" rows with no active effect. ----
    {
      id: "metabolism_stub", path: "metabolism", name: "Proto-Metabolism", max: 1,
      placeholder: true, desc: "Awaits the arrival of ATP and an energy currency.",
    },
    {
      id: "membrane_protection", path: "membrane", name: "Protection", max: 1,
      placeholder: true, desc: "Shields a nascent compartment. Unlocks with membranes.",
    },
    {
      id: "membrane_permeability", path: "membrane", name: "Permeability", max: 1,
      placeholder: true, desc: "Controls what crosses the boundary. Unlocks with membranes.",
    },
    {
      id: "membrane_insulation", path: "membrane", name: "Insulation", max: 1,
      placeholder: true, desc: "Holds a gradient against the cold ocean. A later age.",
    },
    {
      id: "membrane_discrimination", path: "membrane", name: "Discrimination", max: 1,
      placeholder: true, desc: "Lets good things in, keeps bad things out. A later age.",
    },
    {
      id: "defense_stub", path: "defense", name: "Parasite Resistance", max: 1,
      placeholder: true, desc: "Resistance to parasites and freeloaders. A later age.",
    },
  ],

  /* =======================================================================
   * NEXT PHASE — the locked frontier teaser, revealed after amino acids.
   * The recipes that turn amino acids into RNA are deferred to a later build.
   * ===================================================================== */
  nextPhase: {
    id: "rnaWorld", name: "The RNA World",
    lockedText:
      "The four RNA bases can now be built from precursors and terrestrial minerals. Ribose and sugars, a phosphate backbone, and nucleotides must still assemble into the first self-copying strand — an age that is still ahead.",
    roadmap: [
      "Nucleobases (in progress)",
      "Ribose & Sugars",
      "Nucleotides",
      "RNA Strands (first strands forming)",
      "Self-Copying RNA",
      "Ribozymes",
    ],
  },

  /* =======================================================================
   * FUTURE NOTES — concepts and mechanics intentionally NOT implemented this
   * build, preserved so the design intent survives (data only for now; a Field
   * Notes panel renders these once the UI branch lands).
   * ===================================================================== */
  futureNotes: [
    { concept: "RNA World Recipes", why: "The nucleobases are now in play; ribose and sugars, a phosphate backbone and nucleotides assembling into self-copying RNA are the next major build." },
    { concept: "Named RNA Precursors", why: "Cyanoacetylene, aminooxazoline and formamide are now in-game on the road to the bases; cyanamide, cyanogen, glycolaldehyde and cyanic acid still wait for the ribose/nucleotide recipes." },
    { concept: "Thymine & DNA", why: "RNA uses uracil, so thymine has no prebiotic recipe here and sits dormant. It gets one only in a later DNA age, alongside deoxyribose and the RNA→DNA transition." },
    { concept: "RNA Diversity / Stability / Concentration", why: "The mid-game RNA quality axes, retired until the RNA World is implemented." },
    { concept: "Ribozymes", why: "RNA that catalyzes its own chemistry — the payoff of a fully built RNA World." },
    { concept: "Compartmentalization", why: "Fatty acids, vesicles, encapsulation and protocells — the arc after RNA." },
    { concept: "Radioactive Meteors", why: "Uranium/thorium impactors whose slow heat seeds a much later geothermal age." },
    { concept: "Inorganic Electron Donors", why: "H2S, Fe2+ and Fe0 join CO as deeper donor paths once Redox Charge needs richer sourcing." },
    { concept: "Water Paradox", why: "Water is the necessary solvent, yet the same water makes polymerization difficult." },
    { concept: "Dilution Problem", why: "Useful molecules disperse unless something concentrates them — bubbles, foams and drying pools." },
    { concept: "Wet-Dry Cycles", why: "Repeated wetting and drying concentrates molecules and supports polymerization." },
    { concept: "Hydrothermal Vents", why: "A later alternate starting point granting resources normally earned through prestige or clicking." },
    { concept: "Oxygen & ATP", why: "Arrive much later — oxygen from photosynthesis, ATP with the cellular stage." },
  ],

  /* --- Ambient WebGL background: selected from the Ripple Draft prototype.
   * The 2D soup canvas remains the click/effects layer; this sits behind it. --- */
  platonicBackground: {
    enabled: true,
    canvasId: "platonicBackground",
    clearColor: "#0B1726",
    fogColor: "#07111F",
    fogDensity: 0.034,
    stageWash: "rgba(11, 23, 38, 0.18)",
    pixelRatioMax: 1.75,
    camera: { fov: 45, z: 16, y: 0.2, near: 0.1, far: 90 },
    root: { scale: 0.88, y: -0.22, rotateY: 0.08, rotateX: 0.08, wobbleSpeed: 0.11 },
    motion: { speed: 0.48, shapeRotation: 0.26, pulse: 0.02, glowDrift: 0.014 },
    sketch: {
      color: "#A7F3D0",
      meshOpacity: 0.02,
      edgeOpacity: 0.2,
      scratchOpacity: 0.86,
      hatchOpacity: 0.46,
      hatchDensity: 0.94,
      scratchCopies: 3,
      scratchJitter: 0.018,
      hatchJitter: 0.01,
    },
    particles: {
      count: 260,
      opacity: 0.08,
      size: 0.01,
      color: "#64F7D2",
      radiusMin: 3,
      radiusMax: 11.6,
      ySpread: 7.4,
      zOffset: -2.2,
      rotateY: 0.018,
      rotateX: 0.04,
      rotateXSpeed: 0.09,
    },
    water: {
      opacity: 0.55,
      color: "#38BDF8",
      lineCount: 34,
      baseY: -2.25,
      yStep: 0.055,
      baseZ: -4.5,
      zStep: 0.09,
      minWidth: 2.5,
      maxWidth: 9.3,
      xSpread: 8,
      shimmerSpeed: 0.8,
      rotationAmount: 0.018,
      rotationSpeed: 0.035,
    },
    nebulas: [
      { color: "#64F7D2", x: -5.3, y: 2.3, z: -9, width: 5.8, heightScale: 0.68, opacity: 0.12 },
      { color: "#2DD4BF", x: 4.4, y: -1.8, z: -10, width: 7.4, heightScale: 0.68, opacity: 0.1 },
      { color: "#38BDF8", x: 0.8, y: 3.4, z: -11, width: 6.8, heightScale: 0.68, opacity: 0.06 },
    ],
    solids: [
      { id: "tetrahedron", type: "tetrahedron", color: "#64F7D2", scale: 1.05, rotation: [0.31, 0.64, 0.19], axis: [0.86, 0.24, 0.44] },
      { id: "cube", type: "cube", color: "#38BDF8", scale: 1.55, rotation: [0.54, 0.17, 0.38], axis: [0.22, 0.91, 0.35] },
      { id: "octahedron", type: "octahedron", color: "#2DD4BF", scale: 2.15, rotation: [0.26, 0.45, 0.72], axis: [0.47, 0.42, 0.78] },
      { id: "dodecahedron", type: "dodecahedron", color: "#A7F3D0", scale: 2.84, rotation: [0.18, 0.76, 0.29], axis: [0.76, 0.12, 0.63] },
      { id: "icosahedron", type: "icosahedron", color: "#D9F99D", scale: 3.54, rotation: [0.62, 0.28, 0.11], axis: [0.18, 0.62, 0.76] },
    ],
  },
};
