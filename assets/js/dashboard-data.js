// ============================================================
// TABLEAU DE BORD — Cellule de Kaiya
// Stockage séparé du dossier principal : minos_dashboard_v1
// ============================================================

const DASH_KEY = "minos_dashboard_v1";
const DASH_UNITE_ID = "cellule-kayra";

const DASH_SEED = {
  jour: 1,
  moral: 10,
  ressources: { nourriture: 80, energie: 80, munitions: 80, credits: 500 },
  systemes: [
    { id: "sys-vaisseau", nom: "Le Furet de Mestra (vaisseau)", type: "Véhicule", structure_max: 10, structure: 10, avaries: [] },
    { id: "sys-base", nom: "Cache secrète (base)", type: "Local", structure_max: 10, structure: 10, avaries: [] }
  ],
  actions_en_cours: [],
  journal: [
    { jour: 1, texte: "Ouverture du dossier de suivi de la cellule." }
  ]
};

// ---------------- Paliers de moral ----------------
const MORAL_TIERS = [
  { min: 9, max: 15, key: "ok", label: "Tout va bien",
    desc: "Les troupes sont motivées et disciplinées." },
  { min: 6, max: 8, key: "warn", label: "Grognements",
    desc: "Les troupes se plaignent et rechignent à faire les tâches." },
  { min: 3, max: 5, key: "danger", label: "Tensions",
    desc: "Les tensions s'accumulent : bagarres, disputes, insubordination." },
  { min: 0, max: 2, key: "critical", label: "Critique",
    desc: "Risque de désertion, de vol de matériel, voire de mutinerie." }
];

function moralTier(v) {
  return MORAL_TIERS.find(t => v >= t.min && v <= t.max) || MORAL_TIERS[MORAL_TIERS.length - 1];
}

const MORAL_EVENTS = {
  ok: [
    "Deux membres de la cellule partagent un moment de camaraderie autour d'un repas improvisé.",
    "Un exercice d'entraînement se passe remarquablement bien — proposez un bonus mineur à la prochaine action d'un PJ.",
    "Un contact local propose spontanément un service ou une information utile, séduit par le moral affiché du groupe.",
    "Un personnage propose une amélioration ou une astuce qui facilite la vie quotidienne de la cellule.",
    "Une bonne nouvelle arrive par le réseau de renseignement — un petit regain d'espoir general."
  ],
  warn: [
    "Un personnage traîne des pieds pour accomplir une tâche assignée ; il faut le convaincre ou insister.",
    "Deux membres se chamaillent pour une broutille (tour de garde, rations, rangement du matériel).",
    "Une rumeur pessimiste circule dans la cellule, sapant un peu plus le moral si rien n'est fait.",
    "Un personnage demande ouvertement une pause ou un jour de repos.",
    "Le rendement d'une corvée ou d'une réparation est réduit : ajoutez un dé de setback à ce test."
  ],
  danger: [
    "Une dispute dégénère en bagarre entre deux personnages ou PNJ de la cellule.",
    "Du matériel est retrouvé endommagé ou manquant — sabotage discret ou négligence ?",
    "Un membre de la cellule menace de partir si la situation ne s'améliore pas.",
    "Un personnage remet en question les ordres ou l'autorité du commandant en pleine mission.",
    "Une négociation ou un test social échoue automatiquement à cause de l'ambiance délétère (ou ajoutez deux dés de setback)."
  ],
  critical: [
    "Un membre de la cellule déserte dans la nuit, emportant un peu d'équipement ou de crédits.",
    "Un vol de matériel important est découvert au petit matin (armes, rations, pièces détachées).",
    "Une confrontation ouverte éclate : les PJ doivent gérer une mutinerie naissante.",
    "Un personnage envisage de dénoncer la cellule en échange d'une protection ou d'une récompense.",
    "La cellule perd la confiance d'un contact ou allié local, alertée par les rumeurs de désordre interne."
  ]
};

// ---------------- Stockage ----------------
async function loadDash() {
  try {
    const d = await migrateKeyFromLocalStorage(DASH_KEY);
    if (d) {
      (d.systemes || []).forEach(sys => {
        if (sys.structure_max == null) sys.structure_max = 10;
        if (sys.structure == null) sys.structure = sys.structure_max;
      });
      return d;
    }
  } catch (e) { console.error(e); }
  await saveDash(DASH_SEED);
  return JSON.parse(JSON.stringify(DASH_SEED));
}
async function saveDash(d) {
  return idbSet(DASH_KEY, d);
}
async function resetDash() {
  await saveDash(DASH_SEED);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ---------------- Avancer d'un jour ----------------
function advanceDay(D) {
  D.jour += 1;
  const log = [];

  // Résolution des actions en cours
  const restantes = [];
  D.actions_en_cours.forEach(a => {
    a.joursRestants -= 1;
    if (a.joursRestants <= 0) {
      resolveAction(D, a, log);
    } else {
      restantes.push(a);
    }
  });
  D.actions_en_cours = restantes;

  // Impact des ressources basses sur le moral
  const basses = [];
  ["nourriture", "energie", "munitions"].forEach(r => {
    if (D.ressources[r] < 25) basses.push(r);
  });
  if (basses.length) {
    D.moral = clamp(D.moral - basses.length, 0, 15);
    log.push(`Moral -${basses.length} (ressources critiques : ${basses.join(", ")} sous 25%).`);
  }

  log.forEach(t => D.journal.unshift({ jour: D.jour, texte: t }));
  if (!log.length) D.journal.unshift({ jour: D.jour, texte: "Journée calme, rien à signaler." });

  saveDash(D);
  return D;
}

function resolveAction(D, a, log) {
  // Coûts déjà déduits à la création de l'action (ajustés par les avantages/menaces).
  // La réussite/l'échec et le montant effectif ont été déterminés au moment du jet, à la création.
  if (a.type === "reparation") {
    const sys = D.systemes.find(s => s.id === a.systemeId);
    if (sys) {
      const av = sys.avaries.find(x => x.id === a.avarieId);
      if (a.reussite) {
        sys.avaries = sys.avaries.filter(av2 => av2.id !== a.avarieId);
        if (av) {
          const structMax = sys.structure_max || 10;
          sys.structure = Math.max(0, Math.min(structMax, (sys.structure != null ? sys.structure : structMax) + (av.degat_structure || 0)));
        }
        log.push(`Réparation réussie sur « ${sys.nom} » par ${a.personnageNom} : avarie résolue.${a.rollNote ? " (" + a.rollNote + ")" : ""}`);
      } else {
        log.push(`Réparation échouée sur « ${sys.nom} » par ${a.personnageNom} : l'avarie persiste.${a.rollNote ? " (" + a.rollNote + ")" : ""}`);
      }
    }
  } else if (a.type === "jauge") {
    const montant = a.montantEffectif || 0;
    if (a.cible === "moral") {
      D.moral = clamp(D.moral + montant, 0, 15);
    } else {
      const max = a.cible === "credits" ? 999999 : 100;
      D.ressources[a.cible] = clamp(D.ressources[a.cible] + montant, 0, max);
    }
    log.push(`${a.personnageNom} termine « ${a.description} » (${a.reussite ? "succès" : "échec"}) : ${RESSOURCE_LABEL(a.cible)} ${montant >= 0 ? "+" : ""}${montant}.${a.rollNote ? " (" + a.rollNote + ")" : ""}`);
  } else {
    log.push(`${a.personnageNom} termine « ${a.description} » (${a.reussite ? "succès" : "échec"}).${a.rollNote ? " (" + a.rollNote + ")" : ""}`);
  }
}

function RESSOURCE_LABEL(key) {
  const labels = { nourriture: "Nourriture", energie: "Énergie", munitions: "Munitions", credits: "Crédits", moral: "Moral" };
  return labels[key] || key;
}

function uidDash(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8);
}
