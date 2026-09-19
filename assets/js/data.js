// ============================================================
// COUCHE DE DONNÉES — Réseau Minos
// Stockage : IndexedDB (persiste dans CE navigateur, sur CET ordinateur, quota
// bien plus large que localStorage ~5 Mo). Les données déjà présentes dans
// l'ancien localStorage sont migrées automatiquement et silencieusement au
// premier chargement de chaque clé.
// Utilisez Exporter / Importer (page éditeur) pour sauvegarder ou transférer vos données.
// ============================================================

const STORAGE_KEY = "minos_data_v1";

// ---------------- Moteur IndexedDB générique (clé/valeur) ----------------
const IDB_NAME = "reseau_minos_db";
const IDB_VERSION = 1;
const IDB_STORE = "kv";

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("IndexedDB non supporté par ce navigateur")); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Copie transparente d'une clé localStorage vers IndexedDB, une seule fois.
// N'efface pas le localStorage (filet de sécurité), mais ne le relit plus jamais ensuite.
async function migrateKeyFromLocalStorage(key) {
  const existing = await idbGet(key);
  if (existing !== undefined && existing !== null) return existing;
  let raw = null;
  try { raw = localStorage.getItem(key); } catch (e) { /* localStorage indisponible, tant pis */ }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      await idbSet(key, parsed);
      return parsed;
    } catch (e) { console.error("Migration : JSON invalide pour " + key, e); }
  }
  return null;
}


// Caractéristiques standard d'une fiche de planète (Star Wars FFG).
// Utilisées comme structure par défaut à l'édition ET à l'affichage
// (une planète sans caractéristiques renseignées affiche quand même ces lignes, vides).
const DEFAULT_LIEU_CARACTERISTIQUES = [
  "Type", "Terrain", "Atmosphère", "Climat", "Gravité",
  "Population", "Espèce(s) dominante(s)", "Gouvernement", "Langues", "Ressources"
];

const SEED_DATA = {
  zones: [
    { id: "amas-de-minos", nom: "Amas de Minos", description: "Sept systèmes recensés dans l'amas." }
  ],
  lieux: [
    { id: "adarlon", zoneId: "amas-de-minos", nom: "Adarlon", description: "", image: "",
      caracteristiques: [
        { label: "Données d'astronavigation", valeur: "Système d'Adarlon, Amas de Minos, Bordure extérieure (la Bande)" },
        { label: "Mesures orbitales", valeur: "381 jours par an / 21 heures par jour" },
        { label: "Gouvernement", valeur: "Démocratie" },
        { label: "Population", valeur: "20 000 000" },
        { label: "Langues", valeur: "Basique" },
        { label: "Terrain", valeur: "Montagnes" },
        { label: "Villes principales", valeur: "Balderdash, Belrand" },
        { label: "Exportations principales", valeur: "Spectacles, holos" },
        { label: "Importations principales", valeur: "Drogues, nourriture, appareils ménagers, biens de luxe, matières premières" },
        { label: "Routes commerciales", valeur: "Route commerciale Rimma" }
      ],
      points_interet: [
        { id: "pi-adarlon-1", nom: "Spatioport d'Adarlon", image: "", description: "" },
        { id: "pi-adarlon-2", nom: "Dôme Lumineux (Glow Dome)", image: "", description: "" },
        { id: "pi-adarlon-3", nom: "Chaîne de montagnes Natalar", image: "", description: "" }
      ]
    },
    { id: "eliad", zoneId: "amas-de-minos", nom: "Eliad", description: "", image: "", caracteristiques: [], points_interet: [] },
    { id: "mestra", zoneId: "amas-de-minos", nom: "Mestra", description: "Système d'origine de Kaiya Adrimetrum. Invasion séparatiste recensée.", image: "", caracteristiques: [], points_interet: [] },
    { id: "shesarile", zoneId: "amas-de-minos", nom: "Shésarile", description: "", image: "", caracteristiques: [], points_interet: [] },
    { id: "karideph", zoneId: "amas-de-minos", nom: "Karideph", description: "", image: "", caracteristiques: [], points_interet: [] },
    { id: "yelsain", zoneId: "amas-de-minos", nom: "Yelsain", description: "", image: "", caracteristiques: [], points_interet: [] },
    { id: "travnin", zoneId: "amas-de-minos", nom: "Travnin", description: "", image: "", caracteristiques: [], points_interet: [] }
  ],
  organisations: [
    { id: "rebellion-de-minos", nom: "Rébellion de Minos", description: "Cellule de commandement et unités actives dans l'Amas de Minos." }
  ],
  unites: [
    { id: "lieutenant-page", orgId: "rebellion-de-minos", nom: "Lieutenant Page", description: "" },
    { id: "escadron-hawk", orgId: "rebellion-de-minos", nom: "Escadron Hawk", description: "" },
    { id: "cellule-ciro-keleman", orgId: "rebellion-de-minos", nom: "Cellule de Ciro Keleman", description: "" },
    { id: "cellule-kayra", orgId: "rebellion-de-minos", nom: "Cellule rebelle de Kaiya",
      description: "Cellule fondée par Kaiya Adrimetrum sur Mestra après l'invasion séparatiste, puis intégrée à la Rébellion de Minos sous la supervision du Lieutenant Page." }
  ],
  personnages: [
    {
      id: "kaiya-adrimetrum",
      nom: "Kaiya Adrimetrum",
      uniteId: "cellule-kayra",
      lieuId: "",
      race: "Humaine", sexe: "F", age: "", taille: "1,72 m",
      motivation: "Vengeance",
      historique: "Kaiya est une ancienne mineuse. Sa famille a été tuée lors de l'invasion des séparatistes sur Mestra. Après avoir fondé une cellule révolutionnaire avec quelques amis, elle mena une attaque contre le gouverneur du système.\n\nElle fut alors presque immédiatement recrutée par le Lieutenant Page dans la rébellion de Minos.\n\nKaiya est jeune et extrêmement sérieuse. Elle ne comprend jamais les plaisanteries.\n\nConsciente des responsabilités qui pèsent sur ses épaules en tant que commandant d'une cellule rebelle, elle ne vit que pour venger la mort de sa famille.\n\nPlus que tous les autres, elle veut la mort de Sarne.",
      obligation: "Tête mise à prix",
      carriere: "Stratège", specialisation: "Chef d'escadron (AR p.97)",
      caracteristiques: { vig: 2, agi: 3, int: 3, rus: 3, vol: 4, pre: 3 },
      competences: {
        "Résistance": 2, "Armes lourdes": 2, "Bordure extérieure": 2, "Informatique": 2,
        "Médecine": 2, "Pègre": 2, "Art de la guerre": 2, "Sang-froid": 2, "Charme": 2,
        "Négociation": 2, "Survie": 3, "Système D": 1, "Tromperie": 1, "Coercition": 1,
        "Vigilance": 1, "Commandement": 1
      },
      capacites_speciales: [],
      enc: null, defense_cac: null, defense_dist: null, sante_max: null, stress_max: null,
      portrait: "assets/img/characters/kaiya_adrimetrum.png"
    },
    {
      id: "fell-jarris",
      nom: "Fell Jarris",
      uniteId: "cellule-kayra",
      lieuId: "mestra",
      race: "Latero", sexe: "M", age: "", taille: "1,60 m",
      motivation: "",
      historique: "Fell est un ancien contrebandier qui a bourlingué dans une bonne partie de la galaxie.\n\nCes dernières années il s'était implanté dans l'amas de Minos et travaillait avec les mineurs de Mestra.\n\nÀ l'arrivée de la flotte de Sarne, il fut arrêté et son vaisseau confisqué, pour avoir voulu « exporter » du minerai sans autorisation adéquate.\n\nIl doit sa liberté à Kaiya. Depuis il a décidé de lui filer « momentanément » un coup de main.",
      obligation: "Obligé / Tête mise à prix",
      carriere: "Contrebandier", specialisation: "Pilote (AcE p.83)",
      caracteristiques: { vig: 2, agi: 3, int: 3, rus: 3, vol: 2, pre: 2 },
      competences: {
        "Résistance": 1, "Armes légères": 1, "Artillerie": 1, "Discrétion": 1,
        "Pilotage spatial": 3, "Pilotage planétaire": 1, "Astrogation": 2, "Bordure extérieure": 1,
        "Pègre": 1, "Mécanique": 1, "Magouilles": 1, "Perception": 1, "Système D": 1,
        "Tromperie": 1, "Sang-froid": 3, "Vigilance": 2, "Charme": 1, "Commandement": 1, "Négociation": 2
      },
      capacites_speciales: [
        { nom: "Bras supplémentaires", description: "Peut effectuer gratuitement 2 manœuvres par tour." },
        { nom: "Pilote chevronné 2", description: "Retirer deux dés d'obstacle aux tests de pilotage." },
        { nom: "Cartographie de la galaxie 2", description: "Retirer deux dés d'obstacle aux tests d'astrogation." },
        { nom: "Dans le mille amélioré", description: "En dépensant 1 point de destin, ajoute +3 dégâts véhicule." },
        { nom: "Plein gaz", description: "Par une action (coût : 3 dés de Difficulté), augmente la vitesse max du véhicule pendant 3 tours." }
      ],
      enc: 3, defense_cac: 0, defense_dist: 0, sante_max: 10, stress_max: 14,
      portrait: "assets/img/characters/fell_jarris.png"
    },
    {
      id: "kera-nows",
      nom: "Kera Nows",
      uniteId: "cellule-kayra",
      lieuId: "",
      race: "Humaine", sexe: "F", age: "", taille: "1,76 m",
      motivation: "Défendre les faibles",
      historique: "Kera est originaire de Reuss VIII, un cauchemar industriel. Vivant au plus bas de l'échelle sociale, elle faisait partie des « rats de la rouille » — des enfants orphelins sans abri luttant chaque jour pour survivre.\n\nAvec le temps, elle gagna en férocité et attira l'attention d'un sbire de Torel Vorne, le seigneur du crime local. Elle se mit à travailler pour eux en jouant les gros bras, mais fut très vite écœurée par l'organisation.\n\nLorsqu'elle voulut la quitter, Vorne lui demanda son bras en échange.\n\nPerdue, mutilée, elle rencontra Jarris, un pilote latero qui eut pitié d'elle et qui l'emmena dans l'amas de Minos.",
      obligation: "Criminel",
      carriere: "Mercenaire", specialisation: "Exécuteur",
      caracteristiques: null,
      competences: {},
      capacites_speciales: [],
      enc: null, defense_cac: null, defense_dist: null, sante_max: null, stress_max: null,
      portrait: "assets/img/characters/kera_nows.png"
    },
    {
      id: "loffrhyn",
      nom: "Loffrhyn",
      uniteId: "cellule-kayra",
      lieuId: "mestra",
      race: "Besalisk", sexe: "M", age: "", taille: "1,82 m",
      motivation: "Ramener la paix",
      historique: "Loffrhyn est un mécano qui a roulé sa bosse dans la galaxie.\n\nDepuis une dizaine d'années, il a posé ses outils dans le système de Mestra. Le travail ne manquait pas et les mineurs payaient bien.\n\nAvec le temps, il s'est pris d'affection pour Kaiya et sa famille, devenant « tonton Frhyn ».\n\nLorsque la famille de Kaiya fut tuée, il fut profondément affecté et c'est naturellement qu'il se rangea à ses côtés. Depuis, il s'est fait un devoir de la protéger.",
      obligation: "Responsabilité (Kaiya)",
      carriere: "Technicien", specialisation: "Mécanicien (AcE p.89)",
      caracteristiques: { vig: 4, agi: 2, int: 3, rus: 3, vol: 2, pre: 2 },
      competences: {
        "Corps à corps": 2, "Pugilat": 2, "Résistance": 1, "Armes lourdes": 1, "Artillerie": 1,
        "Pilotage planétaire": 1, "Bordure extérieure": 2, "Informatique": 1, "Médecine": 1,
        "Pègre": 1, "Mécanique": 3, "Perception": 1, "Survie": 1, "Ressources": 2,
        "Système D": 1, "Tromperie": 1, "Coercition": 1, "Sang-froid": 1, "Charme": 1, "Négociation": 2
      },
      capacites_speciales: [
        { nom: "Bras supplémentaires", description: "Les Besalisks peuvent effectuer gratuitement 2 manœuvres par tour." },
        { nom: "As de la mécanique 2", description: "Retirer deux dés d'obstacle aux tests de mécanique. Le coût pour ajouter des mods sur des kits est réduit de moitié." },
        { nom: "Endurci", description: "Santé +2 ; Encaissement +1." },
        { nom: "Réparation solide 1", description: "Quand vous réparez un vaisseau ou véhicule, ajoutez +1 aux dégâts restaurés." }
      ],
      enc: 5, defense_cac: 0, defense_dist: 0, sante_max: 18, stress_max: 10,
      portrait: "assets/img/characters/loffrhyn.png"
    },
    {
      id: "valh-raveri",
      nom: "Valh Raveri",
      uniteId: "cellule-kayra",
      lieuId: "",
      race: "Twi'lek", sexe: "F", age: "", taille: "1,68 m",
      motivation: "",
      historique: "Valh vient du système d'Eriadu. Fille de marchand, elle utilisa rapidement ses talents de voleuse afin d'arrondir ses fins de mois.\n\nElle fut un temps approchée par le Soleil Noir et travailla pour eux. Devenant un peu trop exposée, elle décida de faire profil bas et s'éloigna le plus loin qu'elle put. Elle atterrit dans l'amas de Minos.\n\nAprès avoir réalisé quelques contrats avec la pègre locale, elle rencontra Kaiya. Touchée par l'histoire de la veuve, Valh décida de l'aider dans sa vendetta.",
      obligation: "Chantage",
      carriere: "Contrebandier", specialisation: "Voleur",
      caracteristiques: null,
      competences: {},
      capacites_speciales: [],
      enc: null, defense_cac: null, defense_dist: null, sante_max: null, stress_max: null,
      portrait: "assets/img/characters/valh_raveri.png"
    }
  ]
};

const ADVERSAIRES_ORG_ID = "adversaires";
const ADVERSAIRES_UNITE_ID = "adversaires";
const VEHICULES_ORG_ID = "vaisseaux";
const VEHICULES_UNITE_ID = "vaisseaux";

function ensureAdversairesFolder(data) {
  if (!data.organisations) data.organisations = [];
  if (!data.unites) data.unites = [];
  if (!data.organisations.find(o => o.id === ADVERSAIRES_ORG_ID)) {
    data.organisations.push({
      id: ADVERSAIRES_ORG_ID,
      nom: "Adversaires",
      description: "PNJ et groupes de sbires créés depuis l'appli de gestion des combats."
    });
  }
  if (!data.unites.find(u => u.id === ADVERSAIRES_UNITE_ID)) {
    data.unites.push({
      id: ADVERSAIRES_UNITE_ID,
      orgId: ADVERSAIRES_ORG_ID,
      nom: "Adversaires",
      description: "Antagonistes divers rencontrés lors des combats."
    });
  }

  const vehiculesOrg = data.organisations.find(o => o.id === VEHICULES_ORG_ID);
  if (!vehiculesOrg) {
    data.organisations.push({
      id: VEHICULES_ORG_ID,
      nom: "Vaisseaux & véhicules",
      description: "Vaisseaux, speeders et marcheurs utilisables comme fiches de véhicule dans l'appli de gestion des combats."
    });
  } else if (vehiculesOrg.nom === "Vaisseaux" || vehiculesOrg.nom === "Véhicules") {
    // migration : ancien dossier "Vaisseaux"/"Véhicules" renommé en "Vaisseaux & véhicules"
    // (les id restent identiques, donc les vaisseaux déjà créés/importés restent bien rattachés)
    vehiculesOrg.nom = "Vaisseaux & véhicules";
    vehiculesOrg.description = "Vaisseaux, speeders et marcheurs utilisables comme fiches de véhicule dans l'appli de gestion des combats.";
  }

  const vehiculesUnite = data.unites.find(u => u.id === VEHICULES_UNITE_ID);
  if (!vehiculesUnite) {
    data.unites.push({
      id: VEHICULES_UNITE_ID,
      orgId: VEHICULES_ORG_ID,
      nom: "Vaisseaux & véhicules",
      description: "Vaisseaux, speeders et marcheurs rencontrés ou pilotés lors des combats."
    });
  } else if (vehiculesUnite.nom === "Vaisseaux" || vehiculesUnite.nom === "Véhicules") {
    vehiculesUnite.nom = "Vaisseaux & véhicules";
    vehiculesUnite.description = "Vaisseaux, speeders et marcheurs rencontrés ou pilotés lors des combats.";
  }

  return data;
}

async function loadData() {
  try {
    const data = await migrateKeyFromLocalStorage(STORAGE_KEY);
    if (data) return ensureAdversairesFolder(data);
  } catch (e) { console.error("Erreur lecture IndexedDB", e); }
  // premier lancement : on initialise avec le jeu de données de départ
  const seed = ensureAdversairesFolder(JSON.parse(JSON.stringify(SEED_DATA)));
  await saveData(seed);
  return JSON.parse(JSON.stringify(seed));
}

async function saveData(data) {
  try {
    await idbSet(STORAGE_KEY, data);
    return true;
  } catch (e) {
    console.error("Erreur écriture IndexedDB", e);
    return false;
  }
}

async function exportData() {
  const data = await loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reseau-minos-donnees.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importDataFromFile(file, callback) {
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = JSON.parse(e.target.result);
      await saveData(data);
      if (callback) callback(true);
    } catch (err) {
      console.error("Fichier JSON invalide", err);
      if (callback) callback(false);
    }
  };
  reader.readAsText(file);
}

// Import additif : ajoute le contenu du fichier (n'importe lequel des tableaux
// zones/organisations/unites/lieux/personnages) au dossier existant, SANS rien
// écraser. Un élément est ignoré s'il existe déjà un id identique.
const MERGEABLE_COLLECTIONS = ["zones", "organisations", "unites", "lieux", "personnages"];

function mergeDataFromFile(file, callback) {
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const incoming = JSON.parse(e.target.result);
      const current = await loadData();
      const rapport = {};

      MERGEABLE_COLLECTIONS.forEach(key => {
        if (!Array.isArray(incoming[key])) return;
        if (!Array.isArray(current[key])) current[key] = [];
        const idsExistants = new Set(current[key].map(x => x.id));
        let ajoutes = 0, ignores = 0;
        incoming[key].forEach(item => {
          if (item && item.id && idsExistants.has(item.id)) { ignores++; return; }
          current[key].push(item);
          if (item && item.id) idsExistants.add(item.id);
          ajoutes++;
        });
        rapport[key] = { ajoutes, ignores };
      });

      await saveData(current);
      if (callback) callback(true, rapport);
    } catch (err) {
      console.error("Fichier JSON invalide (import en complément)", err);
      if (callback) callback(false, null);
    }
  };
  reader.readAsText(file);
}

// Import synchronisation : comme l'import en complément, mais un élément dont l'id
// existe déjà est REMPLACÉ (mise à jour) au lieu d'être ignoré. Pensé pour récupérer
// la fiche d'un personnage modifiée par un joueur sur sa propre copie du site.
function upsertDataFromFile(file, callback) {
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const incoming = JSON.parse(e.target.result);
      const current = await loadData();
      const rapport = {};

      MERGEABLE_COLLECTIONS.forEach(key => {
        if (!Array.isArray(incoming[key])) return;
        if (!Array.isArray(current[key])) current[key] = [];
        let ajoutes = 0, mis_a_jour = 0;
        incoming[key].forEach(item => {
          if (!item || !item.id) return;
          const idx = current[key].findIndex(x => x.id === item.id);
          if (idx >= 0) { current[key][idx] = item; mis_a_jour++; }
          else { current[key].push(item); ajoutes++; }
        });
        rapport[key] = { ajoutes, mis_a_jour };
      });

      await saveData(current);
      if (callback) callback(true, rapport);
    } catch (err) {
      console.error("Fichier JSON invalide (import / mise à jour)", err);
      if (callback) callback(false, null);
    }
  };
  reader.readAsText(file);
}

// Télécharge un seul personnage (ou vaisseau, sbire...) sous la même forme
// qu'un export complet, mais avec un unique élément dans "personnages".
function downloadSinglePersonnage(p) {
  const blob = new Blob([JSON.stringify({ personnages: [p] }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = slugify(p.nom) + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function resetData() {
  await saveData(JSON.parse(JSON.stringify(SEED_DATA)));
}

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 9);
}

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || uid("id");
}
