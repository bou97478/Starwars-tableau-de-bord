// ============================================================
// GESTION DES COMBATS — état 100% en mémoire (aucune sauvegarde entre deux visites)
// ============================================================

let DATA = null; // dossier principal, en lecture (et en écriture pour "Adversaires"/"Vaisseaux")
let COMBATS = [];
let currentCombatId = null;
let currentRollTarget = null; // { instanceId, skill }

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}
function openForm(id) { document.getElementById(id).classList.add("active"); document.getElementById(id).scrollIntoView({ behavior: "smooth", block: "center" }); }
function closeForm(id) { document.getElementById(id).classList.remove("active"); }

function uidC(prefix) { return prefix + "-" + Math.random().toString(36).slice(2, 9); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function currentCombat() { return COMBATS.find(c => c.id === currentCombatId) || null; }

// ---------------- Suggestions d'avantages / menaces ----------------
const SUGGESTIONS = {
  personnes: {
    avantage: [
      "un allié proche agit avec un peu plus d'aisance à son prochain tour",
      "l'adversaire perd l'équilibre ou se retrouve à découvert",
      "un détail utile sur le terrain ou sur la cible est repéré",
      "une position légèrement plus favorable est gagnée pour la suite"
    ],
    menace: [
      "une légère perte d'équilibre ou d'exposition pour la suite",
      "l'arme s'enraye ou nécessite un instant pour être rechargée",
      "un allié proche est gêné dans son prochain geste",
      "l'attention d'un ennemi supplémentaire est attirée"
    ],
    triomphe: "un effet exceptionnel change la donne : dégât critique bonus, ennemi neutralisé, position tactique majeure — au choix du MJ.",
    desastre: "un revers sérieux survient : arme hors d'usage, blessure supplémentaire, position compromise — au choix du MJ."
  },
  vaisseaux: {
    avantage: [
      "le vaisseau se place en position idéale pour la manœuvre suivante",
      "un système allié récupère un peu d'énergie",
      "une faiblesse dans la trajectoire ou le blindage adverse est repérée",
      "l'équipage gagne en coordination pour la suite du combat"
    ],
    menace: [
      "un système du vaisseau chauffe ou faiblit légèrement",
      "le vaisseau perd un peu de vitesse ou de position",
      "un tir allié manque de peu un vaisseau ami",
      "les boucliers faiblissent légèrement sur un arc"
    ],
    triomphe: "un effet exceptionnel change la donne : système ennemi hors d'usage, dégât critique bonus, avantage tactique majeur — au choix du MJ.",
    desastre: "un revers sérieux survient : avarie de système, perte de position, dégât critique subi — au choix du MJ."
  }
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function suggestionText(typeCombat, result) {
  const pool = SUGGESTIONS[typeCombat] || SUGGESTIONS.personnes;
  const lines = [];
  if (result.netAvantage > 0) lines.push("Suggestion (avantages) : " + pick(pool.avantage));
  else if (result.netAvantage < 0) lines.push("Suggestion (menaces) : " + pick(pool.menace));
  if (result.tr > 0) lines.push("Triomphe : " + pool.triomphe);
  if (result.d > 0) lines.push("Désastre : " + pool.desastre);
  return lines;
}

// ---------------- Calcul du nombre de sbires restants ----------------
function computeNombreActuel(p) {
  if (p.vaisseau) {
    const unit = p.vaisseau.coqueParUnite || 1;
    if (p.vaisseau.pvPool <= 0) return 0;
    return Math.min(p.nombreInitial, Math.ceil(p.vaisseau.pvPool / unit));
  }
  if (p.pvPool <= 0) return 0;
  return Math.min(p.nombreInitial, Math.ceil(p.pvPool / p.pvIndividuel));
}

// ---------------- Pool de dés d'un participant pour une compétence ----------------
function participantDicePool(p, skillName) {
  if (p.type === "sbires") {
    const carac = skillCarac(skillName);
    const caracVal = (p.caracteristiques && carac) ? (p.caracteristiques[carac] || 0) : 0;
    const nombre = computeNombreActuel(p);
    const rang = Math.max(0, nombre - 1);
    const { yellow, green } = dicePool(caracVal, rang);
    return { ability: green, proficiency: yellow };
  }
  if (p.type === "vaisseau") {
    // Ancien modèle, conservé au cas où une fiche isolée existerait encore : traité comme un PJ sans caractéristiques.
    const rang = (p.competences && p.competences[skillName]) || 0;
    return { ability: rang, proficiency: 0 };
  }
  const carac = skillCarac(skillName);
  const caracVal = (p.caracteristiques && carac) ? (p.caracteristiques[carac] || 0) : 0;
  const rang = (p.competences && p.competences[skillName]) || 0;
  const { yellow, green } = dicePool(caracVal, rang);
  return { ability: green, proficiency: yellow };
}

// ============================================================
// COMBATS — création / sélection / suppression
// ============================================================
const TERRAIN_LABELS = {
  1: "Facile (Difficulté 1)",
  2: "Moyen (Difficulté 2)",
  3: "Difficile (Difficulté 3)",
  4: "Très difficile (Difficulté 4)",
  5: "Héroïque (Difficulté 5)"
};

// Table Terrain × Vitesse : nombre de dés de Difficulté (diff) et de Défi (chal)
// à ajouter à un test de pilotage. Index [terrainDifficulte][vitesse 1-6].
const PILOTAGE_TABLE = {
  1: { 1: { diff: 0, chal: 0 }, 2: { diff: 0, chal: 0 }, 3: { diff: 1, chal: 0 }, 4: { diff: 2, chal: 0 }, 5: { diff: 3, chal: 0 }, 6: { diff: 4, chal: 0 } },
  2: { 1: { diff: 0, chal: 0 }, 2: { diff: 0, chal: 0 }, 3: { diff: 2, chal: 0 }, 4: { diff: 3, chal: 0 }, 5: { diff: 2, chal: 1 }, 6: { diff: 2, chal: 2 } },
  3: { 1: { diff: 2, chal: 0 }, 2: { diff: 3, chal: 0 }, 3: { diff: 2, chal: 1 }, 4: { diff: 1, chal: 2 }, 5: { diff: 0, chal: 3 }, 6: { diff: 1, chal: 3 } },
  4: { 1: { diff: 3, chal: 0 }, 2: { diff: 4, chal: 0 }, 3: { diff: 3, chal: 1 }, 4: { diff: 2, chal: 2 }, 5: { diff: 1, chal: 3 }, 6: { diff: 0, chal: 4 } },
  5: { 1: { diff: 4, chal: 0 }, 2: { diff: 5, chal: 0 }, 3: { diff: 4, chal: 1 }, 4: { diff: 3, chal: 2 }, 5: { diff: 2, chal: 3 }, 6: { diff: 1, chal: 4 } }
};

function pilotageDiceFromTable(terrainDifficulte, vitesse) {
  const v = clamp(Math.round(vitesse) || 1, 1, 6);
  const row = PILOTAGE_TABLE[terrainDifficulte] || PILOTAGE_TABLE[2];
  return row[v];
}

// Amélioration FFG : convertit des dés de Difficulté en dés de Défi, un par un ;
// une fois qu'il n'y a plus de dé de Difficulté à convertir, chaque amélioration
// restante ajoute directement un dé de Défi.
function upgradeDifficulty(diff, chal, nbAmeliorations) {
  let d = diff, c = chal;
  for (let i = 0; i < nbAmeliorations; i++) {
    if (d > 0) { d--; c++; } else { c++; }
  }
  return { diff: d, chal: c };
}

function toggleTerrainField() {
  const isVaisseaux = document.getElementById("ncf-type").value === "vaisseaux";
  document.getElementById("ncf-terrain-block").style.display = isVaisseaux ? "" : "none";
}

function openNouveauCombatForm() {
  document.getElementById("ncf-nom").value = "";
  document.getElementById("ncf-type").value = "personnes";
  document.getElementById("ncf-terrain").value = "2";
  toggleTerrainField();
  openForm("form-nouveau-combat");
}

function createCombat() {
  const nom = document.getElementById("ncf-nom").value.trim();
  if (!nom) { toast("Le nom est obligatoire"); return; }
  const combat = {
    id: uidC("combat"),
    nom,
    typeCombat: document.getElementById("ncf-type").value,
    terrainDifficulte: +document.getElementById("ncf-terrain").value || 2,
    round: 1,
    currentTurnIndex: -1,
    initiativeDone: false,
    participants: [],
    journal: []
  };
  COMBATS.push(combat);
  currentCombatId = combat.id;
  closeForm("form-nouveau-combat");
  renderAll();
}

function openTerrainForm() {
  const combat = currentCombat();
  if (!combat) return;
  document.getElementById("tf-terrain").value = combat.terrainDifficulte || 2;
  openForm("form-terrain");
}

function saveTerrain() {
  const combat = currentCombat();
  if (!combat) return;
  combat.terrainDifficulte = +document.getElementById("tf-terrain").value || 2;
  closeForm("form-terrain");
  renderAll();
}

function switchCombat(id) {
  currentCombatId = id;
  currentRollTarget = null;
  renderAll();
}

function renameCurrentCombat() {
  const combat = currentCombat();
  if (!combat) return;
  const nouveauNom = window.prompt("Nouveau nom du combat :", combat.nom);
  if (nouveauNom && nouveauNom.trim()) { combat.nom = nouveauNom.trim(); renderAll(); }
}

function deleteCurrentCombat() {
  const combat = currentCombat();
  if (!combat) return;
  if (!window.confirm("Supprimer définitivement le combat « " + combat.nom + " » ?")) return;
  COMBATS = COMBATS.filter(c => c.id !== combat.id);
  currentCombatId = COMBATS.length ? COMBATS[0].id : null;
  renderAll();
}

// ============================================================
// PARTICIPANTS — import depuis le dossier
// ============================================================
function onParticipantSearch() {
  const q = document.getElementById("participant-search").value.trim().toLowerCase();
  const box = document.getElementById("participant-search-results");
  if (!q) { box.innerHTML = ""; box.classList.remove("show"); return; }
  const results = DATA.personnages.filter(p => p.type !== "vaisseau" && p.nom.toLowerCase().includes(q)).slice(0, 8);
  if (!results.length) {
    box.innerHTML = `<div class="ac-item ac-empty">Aucun personnage trouvé.</div>`;
    box.classList.add("show");
    return;
  }
  box.innerHTML = results.map(p => {
    const unite = DATA.unites.find(u => u.id === p.uniteId);
    return `<div class="ac-item" onclick="importParticipant('${p.id}')">
      <span class="ac-nom">${escapeHtml(p.nom)}</span>
      <span class="ac-meta">${escapeHtml((unite && unite.nom) || "")}${p.type === "sbires" ? " · groupe de sbires" : ""}</span>
    </div>`;
  }).join("");
  box.classList.add("show");
}

function importParticipant(id) {
  const combat = currentCombat();
  if (!combat) { toast("Crée d'abord un combat"); return; }
  const p = DATA.personnages.find(x => x.id === id);
  if (!p) return;

  let participant;
  if (p.type === "sbires") {
    const pvIndividuel = p.pv_individuel || 5;
    const nombreInitial = p.nombre_sbires || 1;
    participant = {
      instanceId: uidC("part"), nom: p.nom, type: "sbires", personnageId: p.id,
      competences: { ...(p.competences || {}) }, armes: (p.armes || []).map(a => ({ ...a })),
      capacites_speciales: (p.capacites_speciales || []).map(c => ({ ...c })),
      caracteristiques: p.caracteristiques ? { ...p.caracteristiques } : null,
      enc: p.enc, defense_cac: p.defense_cac, defense_dist: p.defense_dist, adversite: p.adversite || 0,
      pvIndividuel, nombreInitial, pvPool: pvIndividuel * nombreInitial,
      portrait: p.portrait || "", initiative: null
    };
  } else {
    const pvMax = p.sante_max || 10;
    const stressMax = p.stress_max || 0;
    participant = {
      instanceId: uidC("part"), nom: p.nom, type: "pj", personnageId: p.id,
      competences: { ...(p.competences || {}) }, armes: (p.armes || []).map(a => ({ ...a })),
      capacites_speciales: (p.capacites_speciales || []).map(c => ({ ...c })),
      caracteristiques: p.caracteristiques ? { ...p.caracteristiques } : null,
      enc: p.enc, defense_cac: p.defense_cac, defense_dist: p.defense_dist, adversite: p.adversite || 0,
      pvMax, pvActuel: pvMax, stressMax, stressActuel: stressMax,
      portrait: p.portrait || "", initiative: null
    };
  }
  combat.participants.push(participant);
  document.getElementById("participant-search").value = "";
  document.getElementById("participant-search-results").classList.remove("show");
  toast(p.nom + " ajouté au combat");
  renderAll();
}

function removeParticipant(instanceId) {
  const combat = currentCombat();
  if (!combat) return;
  combat.participants = combat.participants.filter(p => p.instanceId !== instanceId);
  renderAll();
}

// ============================================================
// PARTICIPANTS — création manuelle (PNJ / Sbires) + lignes dynamiques
// ============================================================
function addCombatCompetenceRow(containerId, nom, rang) {
  const c = document.getElementById(containerId);
  const row = document.createElement("div");
  row.className = "dyn-row";
  const options = SKILLS_LIST.map(s => `<option value="${s.nom}" ${s.nom === nom ? "selected" : ""}>${s.nom} (${CARAC_LABELS[s.carac]})</option>`).join("");
  row.innerHTML = `
    <select class="cc-skill"><option value="">— compétence —</option>${options}</select>
    <input type="number" class="cc-rang" min="0" max="6" placeholder="Rang" value="${rang ?? ""}" style="max-width:90px;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}

function addCombatArmeRow(containerId, nom, competence, degat, critique, attribut) {
  const c = document.getElementById(containerId);
  const row = document.createElement("div");
  row.className = "dyn-row";
  const options = SKILLS_LIST.map(s => `<option value="${s.nom}" ${s.nom === competence ? "selected" : ""}>${s.nom}</option>`).join("");
  row.innerHTML = `
    <input type="text" class="ca-nom" placeholder="Nom de l'arme" value="${escapeHtml(nom || "")}" style="flex:2;">
    <select class="ca-competence" style="flex:2;"><option value="">— compétence associée —</option>${options}</select>
    <input type="text" class="ca-attribut" placeholder="Note libre (ex : perforant, ionisant...)" value="${escapeHtml(attribut || "")}" style="flex:1.5;">
    <input type="number" class="ca-degat" placeholder="Dégât" min="0" value="${degat ?? ""}" style="max-width:80px;">
    <input type="text" class="ca-critique" placeholder="Critique" value="${escapeHtml(critique || "")}" style="max-width:80px;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}

function addCombatCapaciteRow(containerId, nom, description) {
  const c = document.getElementById(containerId);
  const row = document.createElement("div");
  row.className = "dyn-row";
  row.innerHTML = `
    <input type="text" class="cd-nom" placeholder="Nom de la capacité" value="${escapeHtml(nom || "")}" style="flex:1;">
    <input type="text" class="cd-desc" placeholder="Description" value="${escapeHtml(description || "")}" style="flex:2;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}

function readCompetences(containerId) {
  const out = {};
  document.querySelectorAll("#" + containerId + " .dyn-row").forEach(row => {
    const skill = row.querySelector(".cc-skill").value;
    const rang = +row.querySelector(".cc-rang").value;
    if (skill && rang > 0) out[skill] = rang;
  });
  return out;
}
function readArmes(containerId) {
  const out = [];
  document.querySelectorAll("#" + containerId + " .dyn-row").forEach(row => {
    const nom = row.querySelector(".ca-nom").value.trim();
    if (!nom) return;
    out.push({
      nom,
      competence: row.querySelector(".ca-competence").value || "",
      attribut: row.querySelector(".ca-attribut").value || "",
      degat: +row.querySelector(".ca-degat").value || 0,
      critique: row.querySelector(".ca-critique").value.trim()
    });
  });
  return out;
}
function readCapacites(containerId) {
  const out = [];
  document.querySelectorAll("#" + containerId + " .dyn-row").forEach(row => {
    const nom = row.querySelector(".cd-nom").value.trim();
    const description = row.querySelector(".cd-desc").value.trim();
    if (nom) out.push({ nom, description });
  });
  return out;
}

function openPnjForm() {
  document.getElementById("pnjf-nom").value = "";
  document.getElementById("pnjf-enc").value = "0";
  document.getElementById("pnjf-pv").value = "10";
  document.getElementById("pnjf-stress").value = "10";
  document.getElementById("pnjf-defcac").value = "0";
  document.getElementById("pnjf-defdist").value = "0";
  document.getElementById("pnjf-adversite").value = "0";
  document.getElementById("pnjf-save").checked = false;
  document.getElementById("pnjf-competences").innerHTML = "";
  document.getElementById("pnjf-armes").innerHTML = "";
  document.getElementById("pnjf-capacites").innerHTML = "";
  addCombatCompetenceRow("pnjf-competences");
  openForm("form-pnj");
}

async function createPnj() {
  const combat = currentCombat();
  if (!combat) { toast("Crée d'abord un combat"); return; }
  const nom = document.getElementById("pnjf-nom").value.trim();
  if (!nom) { toast("Le nom est obligatoire"); return; }

  const competences = readCompetences("pnjf-competences");
  const armes = readArmes("pnjf-armes");
  const capacites_speciales = readCapacites("pnjf-capacites");
  const pvMax = +document.getElementById("pnjf-pv").value || 10;
  const stressMax = +document.getElementById("pnjf-stress").value || 10;
  const enc = +document.getElementById("pnjf-enc").value || 0;
  const defense_cac = +document.getElementById("pnjf-defcac").value || 0;
  const defense_dist = +document.getElementById("pnjf-defdist").value || 0;
  const adversite = +document.getElementById("pnjf-adversite").value || 0;

  const participant = {
    instanceId: uidC("part"), nom, type: "pj", personnageId: null,
    competences, armes, capacites_speciales, caracteristiques: null,
    enc, defense_cac, defense_dist, adversite,
    pvMax, pvActuel: pvMax, stressMax, stressActuel: stressMax,
    portrait: "", initiative: null
  };
  combat.participants.push(participant);

  if (document.getElementById("pnjf-save").checked) {
    const id = uidC("adv");
    DATA.personnages.push({
      id, nom, type: "pj", uniteId: ADVERSAIRES_UNITE_ID, lieuId: "",
      race: "", sexe: "", age: "", taille: "", motivation: "", historique: "",
      obligation: "", carriere: "", specialisation: "",
      caracteristiques: null, competences, capacites_speciales, armes,
      enc, defense_cac, defense_dist, adversite, sante_max: pvMax, stress_max: stressMax,
      pv_individuel: null, nombre_sbires: null, portrait: ""
    });
    await saveData(DATA);
    toast(nom + " ajouté au combat et enregistré dans « Adversaires »");
  } else {
    toast(nom + " ajouté au combat");
  }

  closeForm("form-pnj");
  renderAll();
}

function openSbireForm() {
  document.getElementById("sbf-nom").value = "";
  document.getElementById("sbf-enc").value = "0";
  document.getElementById("sbf-pv-individuel").value = "5";
  document.getElementById("sbf-nombre").value = "3";
  ["vig", "agi", "int", "rus", "vol", "pre"].forEach(k => document.getElementById("sbf-" + k).value = "2");
  document.getElementById("sbf-defcac").value = "0";
  document.getElementById("sbf-defdist").value = "0";
  document.getElementById("sbf-adversite").value = "0";
  document.getElementById("sbf-save").checked = false;
  document.getElementById("sbf-competences").innerHTML = "";
  document.getElementById("sbf-armes").innerHTML = "";
  document.getElementById("sbf-capacites").innerHTML = "";
  addCombatCompetenceRow("sbf-competences");
  openForm("form-sbire");
}

async function createSbire() {
  const combat = currentCombat();
  if (!combat) { toast("Crée d'abord un combat"); return; }
  const nom = document.getElementById("sbf-nom").value.trim();
  if (!nom) { toast("Le nom est obligatoire"); return; }

  const competences = readCompetences("sbf-competences");
  const armes = readArmes("sbf-armes");
  const capacites_speciales = readCapacites("sbf-capacites");
  const pvIndividuel = +document.getElementById("sbf-pv-individuel").value || 5;
  const nombreInitial = +document.getElementById("sbf-nombre").value || 1;
  const enc = +document.getElementById("sbf-enc").value || 0;
  const defense_cac = +document.getElementById("sbf-defcac").value || 0;
  const defense_dist = +document.getElementById("sbf-defdist").value || 0;
  const adversite = +document.getElementById("sbf-adversite").value || 0;
  const caracteristiques = {
    vig: +document.getElementById("sbf-vig").value || 0,
    agi: +document.getElementById("sbf-agi").value || 0,
    int: +document.getElementById("sbf-int").value || 0,
    rus: +document.getElementById("sbf-rus").value || 0,
    vol: +document.getElementById("sbf-vol").value || 0,
    pre: +document.getElementById("sbf-pre").value || 0
  };

  const participant = {
    instanceId: uidC("part"), nom, type: "sbires", personnageId: null,
    competences, armes, capacites_speciales, caracteristiques,
    enc, defense_cac, defense_dist, adversite,
    pvIndividuel, nombreInitial, pvPool: pvIndividuel * nombreInitial,
    portrait: "", initiative: null
  };
  combat.participants.push(participant);

  if (document.getElementById("sbf-save").checked) {
    const id = uidC("adv");
    DATA.personnages.push({
      id, nom, type: "sbires", uniteId: ADVERSAIRES_UNITE_ID, lieuId: "",
      race: "", sexe: "", age: "", taille: "", motivation: "", historique: "",
      obligation: "", carriere: "", specialisation: "",
      caracteristiques, competences, capacites_speciales, armes,
      enc, defense_cac, defense_dist, adversite, sante_max: null, stress_max: null,
      pv_individuel: pvIndividuel, nombre_sbires: nombreInitial, portrait: ""
    });
    await saveData(DATA);
    toast(nom + " ajouté au combat et enregistré dans « Adversaires »");
  } else {
    toast(nom + " ajouté au combat");
  }

  closeForm("form-sbire");
  renderAll();
}

let assignVaisseauTarget = null;

function openAssignVaisseauForm(instanceId) {
  const combat = currentCombat();
  if (!combat) return;
  const p = combat.participants.find(x => x.instanceId === instanceId);
  if (!p) return;
  assignVaisseauTarget = instanceId;

  document.getElementById("vf-search").value = "";
  document.getElementById("vf-search-results").classList.remove("show");
  document.getElementById("vf-nom").value = "";
  document.getElementById("vf-gabarit").value = "3";
  document.getElementById("vf-vitesse").value = "3";
  document.getElementById("vf-manoeuvrabilite").value = "0";
  document.getElementById("vf-enc").value = "0";
  document.getElementById("vf-pv").value = "15";
  document.getElementById("vf-stress").value = "10";
  document.getElementById("vf-defcac").value = "0";
  document.getElementById("vf-defdist").value = "0";
  document.getElementById("vf-ecrandroit").value = "0";
  document.getElementById("vf-ecrangauche").value = "0";
  document.getElementById("vf-adversite").value = "0";
  document.getElementById("vf-save").checked = false;
  document.getElementById("vf-armes").innerHTML = "";
  document.getElementById("vf-capacites").innerHTML = "";
  document.getElementById("vf-pv-note").textContent = p.type === "sbires" ? "(par sbire du groupe)" : "(max)";
  openForm("form-vaisseau");
}

function onVaisseauTemplateSearch() {
  const q = document.getElementById("vf-search").value.trim().toLowerCase();
  const box = document.getElementById("vf-search-results");
  if (!q) { box.innerHTML = ""; box.classList.remove("show"); return; }
  const results = DATA.personnages.filter(p => p.type === "vaisseau" && p.nom.toLowerCase().includes(q)).slice(0, 8);
  if (!results.length) {
    box.innerHTML = `<div class="ac-item ac-empty">Aucun vaisseau enregistré trouvé.</div>`;
    box.classList.add("show");
    return;
  }
  box.innerHTML = results.map(v => `<div class="ac-item" onclick="fillVaisseauFormFrom('${v.id}')">
    <span class="ac-nom">${escapeHtml(v.nom)}</span><span class="ac-meta">Vaisseau enregistré</span>
  </div>`).join("");
  box.classList.add("show");
}

function fillVaisseauFormFrom(id) {
  const v = DATA.personnages.find(x => x.id === id);
  if (!v) return;
  document.getElementById("vf-nom").value = v.nom;
  document.getElementById("vf-gabarit").value = v.gabarit ?? 3;
  document.getElementById("vf-vitesse").value = v.vitesse ?? 3;
  document.getElementById("vf-manoeuvrabilite").value = v.manoeuvrabilite ?? 0;
  document.getElementById("vf-enc").value = v.enc ?? 0;
  document.getElementById("vf-pv").value = v.sante_max ?? 15;
  document.getElementById("vf-stress").value = v.stress_max ?? 10;
  document.getElementById("vf-defcac").value = v.defense_cac ?? 0;
  document.getElementById("vf-defdist").value = v.defense_dist ?? 0;
  document.getElementById("vf-ecrandroit").value = v.ecran_droit ?? 0;
  document.getElementById("vf-ecrangauche").value = v.ecran_gauche ?? 0;
  document.getElementById("vf-adversite").value = v.adversite ?? 0;
  document.getElementById("vf-armes").innerHTML = "";
  document.getElementById("vf-capacites").innerHTML = "";
  (v.armes || []).forEach(a => addCombatArmeRow("vf-armes", a.nom, a.competence, a.degat, a.critique, a.attribut));
  (v.capacites_speciales || []).forEach(c => addCombatCapaciteRow("vf-capacites", c.nom, c.description));
  document.getElementById("vf-search").value = "";
  document.getElementById("vf-search-results").classList.remove("show");
}

async function saveAssignVaisseau() {
  const combat = currentCombat();
  if (!combat || !assignVaisseauTarget) return;
  const p = combat.participants.find(x => x.instanceId === assignVaisseauTarget);
  if (!p) return;
  const nom = document.getElementById("vf-nom").value.trim();
  if (!nom) { toast("Le nom du vaisseau est obligatoire"); return; }

  const armes = readArmes("vf-armes");
  const capacites_speciales = readCapacites("vf-capacites");
  const gabarit = +document.getElementById("vf-gabarit").value || 0;
  const vitesse = +document.getElementById("vf-vitesse").value || 0;
  const manoeuvrabilite = +document.getElementById("vf-manoeuvrabilite").value || 0;
  const coqueParUnite = +document.getElementById("vf-pv").value || 10;
  const stressMax = +document.getElementById("vf-stress").value || 0;
  const enc = +document.getElementById("vf-enc").value || 0;
  const defense_cac = +document.getElementById("vf-defcac").value || 0;
  const defense_dist = +document.getElementById("vf-defdist").value || 0;
  const ecran_droit = +document.getElementById("vf-ecrandroit").value || 0;
  const ecran_gauche = +document.getElementById("vf-ecrangauche").value || 0;
  const adversite = +document.getElementById("vf-adversite").value || 0;

  const nombreSquadron = p.type === "sbires" ? p.nombreInitial : 1;

  p.vaisseau = {
    nom, armes, capacites_speciales,
    enc, defense_cac, defense_dist, ecran_droit, ecran_gauche, adversite,
    gabarit, vitesse, vitesseBase: vitesse, manoeuvrabilite,
    coqueParUnite, pvPool: coqueParUnite * nombreSquadron,
    stressMax, stressActuel: stressMax
  };

  if (document.getElementById("vf-save").checked) {
    const id = uidC("vsl");
    DATA.personnages.push({
      id, nom, type: "vaisseau", uniteId: VEHICULES_UNITE_ID, lieuId: "",
      race: "", sexe: "", age: "", taille: "", motivation: "", historique: "",
      obligation: "", carriere: "", specialisation: "",
      caracteristiques: null, competences: {}, capacites_speciales, armes,
      enc, defense_cac, defense_dist, ecran_droit, ecran_gauche, adversite,
      sante_max: coqueParUnite, stress_max: stressMax,
      pv_individuel: null, nombre_sbires: null,
      gabarit, vitesse, manoeuvrabilite, portrait: ""
    });
    await saveData(DATA);
    toast(nom + " assigné à " + p.nom + " et enregistré dans « Vaisseaux »");
  } else {
    toast(nom + " assigné à " + p.nom);
  }

  assignVaisseauTarget = null;
  closeForm("form-vaisseau");
  renderAll();
}

function removeVaisseau(instanceId) {
  const combat = currentCombat();
  if (!combat) return;
  const p = combat.participants.find(x => x.instanceId === instanceId);
  if (!p) return;
  if (!window.confirm("Retirer le vaisseau assigné à " + p.nom + " ?")) return;
  p.vaisseau = null;
  renderAll();
}

// ============================================================
// PV / STRESS
// ============================================================
function applyDegats(instanceId) {
  const combat = currentCombat();
  if (!combat) return;
  const p = combat.participants.find(x => x.instanceId === instanceId);
  if (!p) return;
  const input = document.getElementById("dmg-" + instanceId);
  const brut = +input.value || 0;
  if (brut <= 0) { input.value = 0; return; }
  const enc = p.vaisseau ? (p.vaisseau.enc || 0) : (p.enc || 0);
  const net = Math.max(0, brut - enc);
  if (p.vaisseau) {
    const nombreSquadron = p.type === "sbires" ? p.nombreInitial : 1;
    p.vaisseau.pvPool = clamp(p.vaisseau.pvPool - net, 0, p.vaisseau.coqueParUnite * nombreSquadron);
  } else if (p.type === "sbires") {
    p.pvPool = clamp(p.pvPool - net, 0, p.pvIndividuel * p.nombreInitial);
  } else {
    p.pvActuel = clamp(p.pvActuel - net, 0, p.pvMax);
  }
  toast(`${p.nom} encaisse ${enc} sur ${brut}, subit ${net} dégât(s) net(s)`);
  renderAll();
}
function manoeuvrabiliteDiceHtml(val) {
  if (!val) return "—";
  if (val > 0) return Array(val).fill('<span class="die-boost"></span>').join("");
  return Array(-val).fill('<span class="die-setback"></span>').join("");
}

function adjustVitesse(instanceId, delta) {
  const combat = currentCombat();
  if (!combat) return;
  const p = combat.participants.find(x => x.instanceId === instanceId);
  if (!p || !p.vaisseau) return;
  p.vaisseau.vitesse = Math.max(0, (p.vaisseau.vitesse || 0) + delta);
  renderAll();
}
function adjustManoeuvrabilite(instanceId, delta) {
  const combat = currentCombat();
  if (!combat) return;
  const p = combat.participants.find(x => x.instanceId === instanceId);
  if (!p || !p.vaisseau) return;
  p.vaisseau.manoeuvrabilite = (p.vaisseau.manoeuvrabilite || 0) + delta;
  renderAll();
}

function adjustSbireCount(instanceId, delta) {
  const combat = currentCombat();
  if (!combat) return;
  const p = combat.participants.find(x => x.instanceId === instanceId);
  if (!p || p.type !== "sbires") return;
  const nombreActuel = computeNombreActuel(p);
  const nouveauNombre = clamp(nombreActuel + delta, 0, p.nombreInitial);
  if (p.vaisseau) {
    p.vaisseau.pvPool = nouveauNombre * (p.vaisseau.coqueParUnite || 1);
  } else {
    p.pvPool = nouveauNombre * p.pvIndividuel;
  }
  renderAll();
}
function adjustStress(instanceId, delta) {
  const combat = currentCombat();
  if (!combat) return;
  const p = combat.participants.find(x => x.instanceId === instanceId);
  if (!p) return;
  if (p.vaisseau) {
    p.vaisseau.stressActuel = clamp(p.vaisseau.stressActuel + delta, 0, p.vaisseau.stressMax);
  } else if (p.type !== "sbires") {
    p.stressActuel = clamp(p.stressActuel + delta, 0, p.stressMax);
  }
  renderAll();
}

// ============================================================
// INITIATIVE
// ============================================================
function openInitiativeForm() {
  const combat = currentCombat();
  if (!combat) return;
  const sel = document.getElementById("inif-competence");
  sel.innerHTML = SKILLS_LIST.map(s => `<option value="${s.nom}">${s.nom} (${CARAC_LABELS[s.carac]})</option>`).join("");
  openForm("form-initiative");
}

function rollInitiative() {
  const combat = currentCombat();
  if (!combat) return;
  const skill = document.getElementById("inif-competence").value;
  combat.participants.forEach(p => {
    const { ability, proficiency } = participantDicePool(p, skill);
    const result = rollDicePoolFFG({ ability, proficiency });
    p.initiative = { netSucces: result.netSucces, netAvantage: result.netAvantage };
  });
  combat.participants.sort((a, b) => {
    if (b.initiative.netSucces !== a.initiative.netSucces) return b.initiative.netSucces - a.initiative.netSucces;
    if (b.initiative.netAvantage !== a.initiative.netAvantage) return b.initiative.netAvantage - a.initiative.netAvantage;
    return Math.random() - 0.5;
  });
  combat.initiativeDone = true;
  combat.round = 1;
  combat.currentTurnIndex = 0;
  addJournalEntry(combat, "Initiative (" + skill + ") : " +
    combat.participants.map(p => p.nom + " (" + p.initiative.netSucces + ")").join(" › "));
  closeForm("form-initiative");
  renderAll();
}

function nextTurn() {
  const combat = currentCombat();
  if (!combat || !combat.initiativeDone || !combat.participants.length) return;
  combat.currentTurnIndex++;
  if (combat.currentTurnIndex >= combat.participants.length) {
    combat.currentTurnIndex = 0;
    combat.round++;
  }
  renderAll();
}

// ============================================================
// JETS DE COMPÉTENCE
// ============================================================
function openRollPanel(instanceId, skillName) {
  if (currentRollTarget && currentRollTarget.instanceId === instanceId && currentRollTarget.skill === skillName) {
    currentRollTarget = null;
  } else {
    currentRollTarget = { instanceId, skill: skillName };
  }
  renderAll();
}

const MELEE_SKILLS = ["Pugilat", "Corps à corps"];
const MARTIAL_SKILLS = ["Corps à corps", "Pugilat", "Sabrelaser", "Armes légères", "Armes lourdes", "Artillerie"];
const PILOTAGE_SKILLS = ["Pilotage planétaire", "Pilotage spatial"];
const VEHICLE_SKILLS = ["Astrogation", "Pilotage planétaire", "Pilotage spatial", "Calme", "Commandement", "Informatique", "Mécanique", "Sang-froid", "Vigilance", "Artillerie"];

function rollCritique() {
  return { roll: Math.floor(Math.random() * 100) + 1 };
}

function executeRoll(instanceId, skillName) {
  const combat = currentCombat();
  if (!combat) return;
  const p = combat.participants.find(x => x.instanceId === instanceId);
  if (!p) return;

  const challenge = clamp(+document.getElementById("rollp-challenge").value || 0, 0, 10);
  const difficulty = clamp(+document.getElementById("rollp-diff").value || 0, 0, 10);
  const boost = clamp(+document.getElementById("rollp-boost").value || 0, 0, 10);
  const setback = clamp(+document.getElementById("rollp-setback").value || 0, 0, 10);
  const isMartial = MARTIAL_SKILLS.includes(skillName);
  const armesSource = isMartial ? (p.vaisseau ? p.vaisseau.armes : p.armes) : null;
  const weaponIdx = document.getElementById("rollp-weapon").value;
  const weapon = (isMartial && weaponIdx !== "") ? armesSource[+weaponIdx] : null;

  const { ability, proficiency } = participantDicePool(p, skillName);
  const result = rollDicePoolFFG({ ability, proficiency, difficulty, challenge, boost, setback });

  const isMelee = MELEE_SKILLS.includes(skillName);
  const isAttack = isMartial && (!!weapon || isMelee);

  let baseDamage = weapon ? (weapon.degat || 0) : 0;
  let critique = weapon ? weapon.critique : "";
  let extraCapacites = [];

  if (isMelee) {
    const vigueur = (p.caracteristiques && p.caracteristiques.vig != null) ? p.caracteristiques.vig : 2;
    baseDamage = vigueur + (weapon ? (weapon.degat || 0) : 0);
    if (skillName === "Pugilat") {
      if (!critique) critique = "5";
      extraCapacites = ["Désorientation 1", "Renversement"];
    }
  }

  const degat = (isAttack && result.reussite) ? baseDamage + result.netSucces : null;

  let critTrigger = null;
  if (degat !== null && critique) {
    const critNum = parseInt(critique, 10);
    if (!isNaN(critNum) && result.netAvantage >= critNum) critTrigger = rollCritique();
  }

  let msg = `${p.nom} — ${skillName}${weapon ? " (" + weapon.nom + ")" : (isMelee ? " (mains nues)" : "")} : `;
  msg += result.reussite ? `Réussite ${result.netSucces}` : `Échec ${Math.abs(result.netSucces)}`;
  if (degat !== null) {
    msg += ` - Dégâts ${degat}`;
    if (weapon && weapon.attribut) msg += ` ("${weapon.attribut}")`;
    if (extraCapacites.length) msg += ` (${extraCapacites.join(", ")})`;
  }
  if (result.netAvantage > 0) msg += ` - ${result.netAvantage} avantage(s)`;
  else if (result.netAvantage < 0) msg += ` - ${-result.netAvantage} menace(s)`;
  if (result.tr > 0) msg += ` - ${result.tr} triomphe(s)`;
  if (result.d > 0) msg += ` - ${result.d} désastre(s)`;
  if (critTrigger) msg += ` — DÉGÂTS CRITIQUES !`;

  addJournalEntry(combat, msg, suggestionText(combat.typeCombat, result), critTrigger);

  currentRollTarget = null;
  renderAll();
}

function addJournalEntry(combat, text, suggestions, critique) {
  combat.journal.unshift({
    text,
    suggestions: suggestions || [],
    critique: critique || null,
    round: combat.initiativeDone ? combat.round : null
  });
}

// ============================================================
// RENDU
// ============================================================
function renderAll() {
  renderTabs();
  const combat = currentCombat();
  document.getElementById("combat-panel").style.display = combat ? "" : "none";
  document.getElementById("no-combat-box").style.display = combat ? "none" : "";
  if (!combat) return;

  document.getElementById("combat-titre").textContent = combat.nom;
  document.getElementById("combat-type-badge").textContent = combat.typeCombat === "vaisseaux" ? "Combat de vaisseaux" : "Combat de personnes";
  document.getElementById("combat-type-badge").className = "badge ok";

  const isVaisseauCombat = combat.typeCombat === "vaisseaux";
  const terrainBadge = document.getElementById("combat-terrain-badge");
  terrainBadge.style.display = isVaisseauCombat ? "" : "none";
  terrainBadge.textContent = "Terrain : " + (TERRAIN_LABELS[combat.terrainDifficulte] || TERRAIN_LABELS[2]);
  document.getElementById("btn-modifier-terrain").style.display = isVaisseauCombat ? "" : "none";

  renderInitiativeBox(combat);
  renderParticipantsGrid(combat);
  renderJournal(combat);
}

function renderTabs() {
  const box = document.getElementById("combat-tabs");
  box.innerHTML = COMBATS.map(c =>
    `<button class="combat-tab ${c.id === currentCombatId ? "active" : ""}" onclick="switchCombat('${c.id}')">${escapeHtml(c.nom)}</button>`
  ).join("") + `<button class="combat-tab new" onclick="openNouveauCombatForm()">+ Nouveau combat</button>`;
}

function renderInitiativeBox(combat) {
  const box = document.getElementById("initiative-box");
  if (!combat.initiativeDone) {
    box.innerHTML = combat.participants.length
      ? `<button class="btn primary" onclick="openInitiativeForm()">🎲 Lancer l'initiative</button>`
      : `<p class="section-note" style="margin:0;">Ajoute des participants avant de lancer l'initiative.</p>`;
    return;
  }
  const rows = combat.participants.map((p, i) => `
    <div class="init-row ${i === combat.currentTurnIndex ? "current" : ""}">
      <span class="init-name">${i === combat.currentTurnIndex ? "▶ " : ""}${escapeHtml(p.nom)}</span>
      <span class="init-score">${p.initiative ? p.initiative.netSucces : "—"}</span>
    </div>`).join("");
  box.innerHTML = `
    <div class="toolbar" style="justify-content:space-between; margin-bottom:10px;">
      <span style="font-family:'JetBrains Mono',monospace; color:var(--ink-dim); font-size:12px; text-transform:uppercase;">Round ${combat.round}</span>
      <div class="toolbar" style="margin:0;">
        <button class="btn small" onclick="openInitiativeForm()">Relancer l'initiative</button>
        <button class="btn small primary" onclick="nextTurn()">Tour suivant ▶</button>
      </div>
    </div>
    ${rows}`;
}

function renderParticipantsGrid(combat) {
  const grid = document.getElementById("participants-grid");
  if (!combat.participants.length) {
    grid.innerHTML = `<p class="section-note">Aucun participant pour l'instant.</p>`;
    return;
  }
  grid.innerHTML = combat.participants.map(p => participantCardHtml(p)).join("");
}

function participantCardHtml(p) {
  const isSbires = p.type === "sbires";
  const hasVaisseau = !!p.vaisseau;
  const nombreActuel = isSbires ? computeNombreActuel(p) : null;
  const v = p.vaisseau || null;

  const encSource = hasVaisseau ? (v.enc || 0) : (p.enc || 0);
  const encLabel = hasVaisseau ? "le blindage" : "l'encaissement";
  const pvLabel = hasVaisseau ? "aux points de coque" : "aux points de blessure";
  const dmgInputHtml = `
    <div class="degats-box">
      <label>Dégâts subis</label>
      <div class="degats-row">
        <input type="number" id="dmg-${p.instanceId}" min="0" value="0">
        <button class="btn small primary" onclick="applyDegats('${p.instanceId}')">Valider</button>
      </div>
      <p class="section-note" style="margin:4px 0 0; font-size:11px;">${encLabel} (${encSource}) est déduit(e) automatiquement, le reste s'applique ${pvLabel}.</p>
    </div>`;

  const pvGaugeLabel = hasVaisseau ? "Points de coque" : "Points de blessure";
  const stressGaugeLabel = hasVaisseau ? "Stress mécanique" : "Stress";

  let pvHtml;
  if (hasVaisseau) {
    const nombreSquadron = isSbires ? p.nombreInitial : 1;
    const max = v.coqueParUnite * nombreSquadron;
    const pct = max > 0 ? (v.pvPool / max) * 100 : 0;
    const cls = pct <= 25 ? "critical" : pct <= 50 ? "danger" : pct <= 75 ? "warn" : "ok";
    const spct = v.stressMax > 0 ? (v.stressActuel / v.stressMax) * 100 : 0;
    const scls = spct <= 25 ? "ok" : spct <= 50 ? "warn" : spct <= 75 ? "danger" : "critical";
    pvHtml = `
      <div class="gh"><span class="label">${pvGaugeLabel}</span><span class="val">${v.pvPool}/${max}</span></div>
      <div class="gauge-track"><div class="gauge-fill ${cls}" style="width:${pct}%"></div></div>
      ${dmgInputHtml}
      <div class="gh" style="margin-top:10px;"><span class="label">${stressGaugeLabel}</span><span class="val">${v.stressActuel}/${v.stressMax}</span></div>
      <div class="gauge-track"><div class="gauge-fill ${scls}" style="width:${spct}%"></div></div>
      <div class="gauge-controls">
        <button class="btn small" onclick="adjustStress('${p.instanceId}', -1)">−1</button>
        <button class="btn small" onclick="adjustStress('${p.instanceId}', 1)">+1</button>
      </div>`;
  } else if (isSbires) {
    const pct = (p.pvPool / (p.pvIndividuel * p.nombreInitial)) * 100;
    const cls = pct <= 25 ? "critical" : pct <= 50 ? "danger" : pct <= 75 ? "warn" : "ok";
    pvHtml = `
      <div class="gh"><span class="label">${pvGaugeLabel}</span><span class="val">${p.pvPool}/${p.pvIndividuel * p.nombreInitial}</span></div>
      <div class="gauge-track"><div class="gauge-fill ${cls}" style="width:${pct}%"></div></div>
      ${dmgInputHtml}`;
  } else {
    const pct = (p.pvActuel / p.pvMax) * 100;
    const cls = pct <= 25 ? "critical" : pct <= 50 ? "danger" : pct <= 75 ? "warn" : "ok";
    const spct = p.stressMax > 0 ? (p.stressActuel / p.stressMax) * 100 : 0;
    const scls = spct <= 25 ? "ok" : spct <= 50 ? "warn" : spct <= 75 ? "danger" : "critical";
    pvHtml = `
      <div class="gh"><span class="label">${pvGaugeLabel}</span><span class="val">${p.pvActuel}/${p.pvMax}</span></div>
      <div class="gauge-track"><div class="gauge-fill ${cls}" style="width:${pct}%"></div></div>
      ${dmgInputHtml}
      <div class="gh" style="margin-top:10px;"><span class="label">${stressGaugeLabel}</span><span class="val">${p.stressActuel}/${p.stressMax}</span></div>
      <div class="gauge-track"><div class="gauge-fill ${scls}" style="width:${spct}%"></div></div>
      <div class="gauge-controls">
        <button class="btn small" onclick="adjustStress('${p.instanceId}', -1)">−1</button>
        <button class="btn small" onclick="adjustStress('${p.instanceId}', 1)">+1</button>
      </div>`;
  }

  const vaisseauStatsHtml = hasVaisseau ? `
    <div class="defense-badges" style="margin-top:8px;">
      <div class="defense-badge">
        <span class="db-label">Gabarit</span>
        <span class="db-val">${v.gabarit ?? 0}</span>
      </div>
      <div class="defense-badge">
        <span class="db-label">Vitesse</span>
        <span class="db-val">${v.vitesse ?? 0}</span>
        <span style="font-size:9px; color:var(--ink-dim); font-family:'JetBrains Mono',monospace;">base ${v.vitesseBase ?? v.vitesse ?? 0}</span>
        <div class="gauge-controls" style="justify-content:center; margin-top:4px;">
          <button class="btn small" onclick="adjustVitesse('${p.instanceId}', -1)">−1</button>
          <button class="btn small" onclick="adjustVitesse('${p.instanceId}', 1)">+1</button>
        </div>
      </div>
      <div class="defense-badge">
        <span class="db-label">Manœuvrabilité</span>
        <span class="db-val">${v.manoeuvrabilite ?? 0}</span>
        <span class="db-dice">${manoeuvrabiliteDiceHtml(v.manoeuvrabilite || 0)}</span>
        <div class="gauge-controls" style="justify-content:center; margin-top:4px;">
          <button class="btn small" onclick="adjustManoeuvrabilite('${p.instanceId}', -1)">−1</button>
          <button class="btn small" onclick="adjustManoeuvrabilite('${p.instanceId}', 1)">+1</button>
        </div>
      </div>
    </div>` : "";

  const visibleSkills = Object.keys(p.competences || {}).filter(skill => !hasVaisseau || VEHICLE_SKILLS.includes(skill));
  const skillsHtml = visibleSkills.length
    ? visibleSkills.map(skill => {
        const { ability, proficiency } = participantDicePool(p, skill);
        const isOpen = currentRollTarget && currentRollTarget.instanceId === p.instanceId && currentRollTarget.skill === skill;
        return `
          <div class="skill-row combat-skill ${isOpen ? "open" : ""}" onclick="openRollPanel('${p.instanceId}', '${skill.replace(/'/g, "\\'")}')">
            <span class="sname">${escapeHtml(skill)}</span>${diceIconsHtml(proficiency, ability)}
          </div>
          ${isOpen ? rollPanelHtml(p, skill) : ""}`;
      }).join("")
    : `<p class="section-note" style="margin:4px 0 0;">${hasVaisseau ? "Aucune compétence pertinente en pilotage de véhicule renseignée pour ce pilote." : "Aucune compétence renseignée."}</p>`;

  const armesListe = hasVaisseau ? v.armes : p.armes;
  const armesHtml = (armesListe || []).length
    ? `<div class="id-block" style="margin-top:8px;">` + armesListe.map(a => `
        <div class="id-row"><span class="k">${escapeHtml(a.nom)}</span><span class="v">Dég. ${a.degat ?? "—"} · Crit. ${escapeHtml(a.critique) || "—"}${a.attribut ? ` · ${escapeHtml(a.attribut)}` : ""}</span></div>
      `).join("") + `</div>` : "";

  const capacitesListe = hasVaisseau ? v.capacites_speciales : p.capacites_speciales;
  const capHtml = (capacitesListe || []).length
    ? `<div style="margin-top:8px; font-size:12px; color:var(--ink-dim);">` + capacitesListe.map(c => `<div><strong style="color:var(--ink);">${escapeHtml(c.nom)}</strong> — ${escapeHtml(c.description)}</div>`).join("") + `</div>` : "";

  const defenseBadgesHtml = hasVaisseau ? `
    <div class="defense-badges" style="flex-wrap:wrap;">
      <div class="defense-badge"><span class="db-label">Écran avant</span><span class="db-val">${v.defense_cac ?? 0}</span></div>
      <div class="defense-badge"><span class="db-label">Écran arrière</span><span class="db-val">${v.defense_dist ?? 0}</span></div>
      <div class="defense-badge"><span class="db-label">Écran droit</span><span class="db-val">${v.ecran_droit ?? 0}</span></div>
      <div class="defense-badge"><span class="db-label">Écran gauche</span><span class="db-val">${v.ecran_gauche ?? 0}</span></div>
      <div class="defense-badge adversite-badge">
        <span class="db-label">Adversité</span>
        <span class="db-dice">${(v.adversite || 0) > 0 ? Array(v.adversite).fill('<span class="die-challenge"></span>').join("") : "—"}</span>
      </div>
    </div>` : `
    <div class="defense-badges">
      <div class="defense-badge"><span class="db-label">Déf. CàC</span><span class="db-val">${p.defense_cac ?? 0}</span></div>
      <div class="defense-badge"><span class="db-label">Déf. Distance</span><span class="db-val">${p.defense_dist ?? 0}</span></div>
      <div class="defense-badge adversite-badge">
        <span class="db-label">Adversité</span>
        <span class="db-dice">${(p.adversite || 0) > 0 ? Array(p.adversite).fill('<span class="die-challenge"></span>').join("") : "—"}</span>
      </div>
    </div>`;

  const vaisseauActionBtn = hasVaisseau
    ? `<button class="btn small" onclick="removeVaisseau('${p.instanceId}')">🚀 Retirer le vaisseau</button>`
    : `<button class="btn small" onclick="openAssignVaisseauForm('${p.instanceId}')">🚀 Assigner un vaisseau</button>`;

  return `
    <div class="participant-card">
      <div class="pc-head">
        ${p.portrait ? `<img class="pc-portrait" src="${portraitSrc(p.portrait)}" alt="">` : ""}
        <div>
          <h4>${escapeHtml(p.nom)}${isSbires ? `
            <span class="sbire-count-ctrl">
              <button class="btn small" onclick="adjustSbireCount('${p.instanceId}', -1)">−</button>
              <span class="badge ok" style="font-size:9px;">${nombreActuel}/${p.nombreInitial}</span>
              <button class="btn small" onclick="adjustSbireCount('${p.instanceId}', 1)">+</button>
            </span>` : ""}</h4>
          ${hasVaisseau ? `<span style="font-size:11px; color:var(--amber); font-family:'JetBrains Mono',monospace;">🚀 ${escapeHtml(v.nom)}</span>` : ""}
        </div>
        <button class="btn small danger" style="margin-left:auto;" onclick="removeParticipant('${p.instanceId}')">✕</button>
      </div>

      <div class="toolbar" style="margin:0 0 8px;">${vaisseauActionBtn}</div>

      ${defenseBadgesHtml}

      ${vaisseauStatsHtml}

      ${pvHtml}

      <div class="section-title" style="margin:12px 0 6px;"><h2 style="font-size:13px;">Compétences${hasVaisseau ? " du pilote" : ""}</h2><div class="rule"></div></div>
      ${skillsHtml}

      ${armesHtml}
      ${capHtml}
    </div>`;
}

function defaultWeaponIndex(armes, skillName) {
  if (!armes || !armes.length) return "";
  const matchIdx = armes.findIndex(a => a.competence === skillName);
  return matchIdx >= 0 ? matchIdx : 0;
}

function rollPanelHtml(p, skillName) {
  const isMartial = MARTIAL_SKILLS.includes(skillName);
  const armesSource = isMartial ? (p.vaisseau ? p.vaisseau.armes : p.armes) : null;
  const defaultIdx = defaultWeaponIndex(armesSource, skillName);
  const weaponOptions = (armesSource || []).map((a, i) => `<option value="${i}" ${i === defaultIdx ? "selected" : ""}>${escapeHtml(a.nom)} (dég. ${a.degat ?? 0})</option>`).join("");

  const isPilotage = PILOTAGE_SKILLS.includes(skillName);
  let boostDefault = 0, setbackDefault = 0;
  let challengeDefault = 0, diffDefault = 2;
  let terrainNote = "";
  if (p.vaisseau && isPilotage) {
    const man = p.vaisseau.manoeuvrabilite || 0;
    if (man > 0) boostDefault = man; else if (man < 0) setbackDefault = -man;

    const vitesseActuelle = p.vaisseau.vitesse || 0;
    if (vitesseActuelle <= 0) {
      challengeDefault = 0;
      diffDefault = 0;
      terrainNote = "Vitesse actuelle 0 (immobile) : aucun dé de Difficulté/Défi ajouté.";
    } else {
      const combat = currentCombat();
      const terrainDiff = (combat && combat.terrainDifficulte) || 2;
      const vitesseBase = (p.vaisseau.vitesseBase != null) ? p.vaisseau.vitesseBase : vitesseActuelle;
      const base = pilotageDiceFromTable(terrainDiff, vitesseActuelle);
      const excedent = Math.max(0, vitesseActuelle - vitesseBase);
      const ameliore = upgradeDifficulty(base.diff, base.chal, excedent);
      challengeDefault = ameliore.chal;
      diffDefault = ameliore.diff;
      terrainNote = `Vitesse actuelle ${vitesseActuelle} (base ${vitesseBase})` +
        (excedent > 0 ? ` — +${excedent} amélioration${excedent > 1 ? "s" : ""} pour dépassement de la vitesse de base` : "") +
        `, terrain ${TERRAIN_LABELS[terrainDiff] || terrainDiff}.`;
    }
  }

  return `
    <div class="roll-panel">
      <div class="roll-dice-row">
        <div class="roll-die-col"><span class="die-challenge" title="Dés de Défi"></span><input type="number" id="rollp-challenge" min="0" value="${challengeDefault}"></div>
        <div class="roll-die-col"><span class="die-difficulty" title="Dés de Difficulté"></span><input type="number" id="rollp-diff" min="0" value="${diffDefault}"></div>
        <div class="roll-die-col"><span class="die-setback" title="Dés de Désavantage"></span><input type="number" id="rollp-setback" min="0" value="${setbackDefault}"></div>
        <div class="roll-die-col"><span class="die-boost" title="Dés d'Avantage"></span><input type="number" id="rollp-boost" min="0" value="${boostDefault}"></div>
      </div>
      ${isPilotage && p.vaisseau ? `<p class="section-note" style="margin:0 0 8px;">${terrainNote} Avantage/désavantage pré-rempli d'après la Manœuvrabilité (${p.vaisseau.manoeuvrabilite || 0}) — tout reste modifiable.</p>` : ""}
      ${armesSource && armesSource.length ? `<div class="field"><label>Arme utilisée</label><select id="rollp-weapon"><option value="">— aucune —</option>${weaponOptions}</select></div>` : `<select id="rollp-weapon" style="display:none;"></select>`}
      <div class="toolbar">
        <button class="btn primary small" onclick="executeRoll('${p.instanceId}', '${skillName.replace(/'/g, "\\'")}')">🎲 Lancer</button>
        <button class="btn small" onclick="openRollPanel('${p.instanceId}', '${skillName.replace(/'/g, "\\'")}')">Annuler</button>
      </div>
    </div>`;
}

function renderJournal(combat) {
  const box = document.getElementById("combat-journal");
  if (!combat.journal.length) {
    box.innerHTML = `<p class="section-note">Aucun jet effectué pour l'instant.</p>`;
    return;
  }
  box.innerHTML = combat.journal.map(entry => `
    <div class="journal-entry">
      <div class="je-text">${entry.round ? `<span class="je-round">R${entry.round}</span> ` : ""}${escapeHtml(entry.text)}</div>
      ${(entry.suggestions || []).map(s => `<div class="je-suggestion">${escapeHtml(s)}</div>`).join("")}
      ${entry.critique ? `
        <div class="je-critical">
          <span class="je-critical-tag">Dégâts critiques</span>
          <span class="je-critical-roll">${entry.critique.roll}</span>
        </div>` : ""}
    </div>`).join("");
}

async function initCombats() {
  DATA = await loadData();
  renderAll();
}
initCombats();
