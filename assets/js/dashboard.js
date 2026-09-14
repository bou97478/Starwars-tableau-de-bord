// ============================================================
// TABLEAU DE BORD — logique d'affichage et d'interaction
// ============================================================

let DB = null;
let ROSTER_DATA = null;
let ROSTER = null;

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}
function openForm(id) { document.getElementById(id).classList.add("active"); document.getElementById(id).scrollIntoView({ behavior: "smooth", block: "center" }); }
function closeForm(id) { document.getElementById(id).classList.remove("active"); }

async function persistDash() { await saveDash(DB); renderAll(); }

// ---------------- MORAL ----------------
function renderMoral() {
  const tier = moralTier(DB.moral);
  document.getElementById("jour-actuel").textContent = DB.jour;
  document.getElementById("moral-val").textContent = DB.moral + " / 15";
  const fill = document.getElementById("moral-fill");
  fill.style.width = (DB.moral / 15 * 100) + "%";
  fill.className = "gauge-fill " + tier.key;
  const banner = document.getElementById("moral-banner");
  banner.className = "moral-banner " + tier.key;
  document.getElementById("moral-label").textContent = tier.label;
  document.getElementById("moral-desc").textContent = tier.desc;
}
function adjustMoral(delta) {
  DB.moral = clamp(DB.moral + delta, 0, 15);
  persistDash();
}
function proposerEvenement() {
  const tier = moralTier(DB.moral);
  const list = MORAL_EVENTS[tier.key];
  const pick = list[Math.floor(Math.random() * list.length)];
  const box = document.getElementById("suggestion-box");
  box.textContent = "Suggestion (" + tier.label + ") : " + pick;
  box.classList.add("show");
}

// ---------------- RESSOURCES ----------------
const RESSOURCE_META = {
  nourriture: { label: "Nourriture", pct: true },
  energie: { label: "Énergie", pct: true },
  munitions: { label: "Munitions", pct: true },
  credits: { label: "Crédits", pct: false }
};

function renderRessources() {
  const grid = document.getElementById("ressources-grid");
  grid.innerHTML = "";
  Object.keys(RESSOURCE_META).forEach(key => {
    const meta = RESSOURCE_META[key];
    const val = DB.ressources[key];
    const card = document.createElement("div");
    card.className = "gauge-card";
    if (meta.pct) {
      let cls = "ok";
      if (val < 25) cls = "critical"; else if (val < 50) cls = "danger"; else if (val < 75) cls = "warn";
      card.innerHTML = `
        <div class="gh"><span class="label">${meta.label}</span><span class="val">${val}%</span></div>
        <div class="gauge-track"><div class="gauge-fill ${cls}" style="width:${clamp(val,0,100)}%"></div></div>
        ${val < 25 ? `<div class="gauge-note" style="color:#c1543f;">Sous 25% : impact négatif sur le moral chaque jour.</div>` : ""}
        <div class="gauge-controls">
          <button class="btn small" onclick="adjustRessource('${key}',-10)">−10</button>
          <button class="btn small" onclick="adjustRessource('${key}',10)">+10</button>
          <input type="number" id="rf-${key}" value="${val}" min="0" max="100">
          <button class="btn small" onclick="setRessource('${key}')">Fixer</button>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="gh"><span class="label">${meta.label}</span><span class="val">${val}</span></div>
        <div class="gauge-controls">
          <button class="btn small" onclick="adjustRessource('${key}',-50)">−50</button>
          <button class="btn small" onclick="adjustRessource('${key}',50)">+50</button>
          <input type="number" id="rf-${key}" value="${val}">
          <button class="btn small" onclick="setRessource('${key}')">Fixer</button>
        </div>`;
    }
    grid.appendChild(card);
  });
}
function adjustRessource(key, delta) {
  const max = RESSOURCE_META[key].pct ? 100 : 999999;
  DB.ressources[key] = clamp(DB.ressources[key] + delta, 0, max);
  persistDash();
}
function setRessource(key) {
  const v = +document.getElementById("rf-" + key).value;
  const max = RESSOURCE_META[key].pct ? 100 : 999999;
  DB.ressources[key] = clamp(v, 0, max);
  persistDash();
}

// ---------------- SYSTÈMES ----------------
function renderSystemes() {
  const c = document.getElementById("systemes-list");
  c.innerHTML = "";
  if (!DB.systemes.length) { c.innerHTML = `<p class="section-note">Aucun système enregistré.</p>`; return; }
  DB.systemes.forEach(sys => {
    const enAvarie = sys.avaries.length > 0;
    const structMax = sys.structure_max || 10;
    const struct = clamp(sys.structure != null ? sys.structure : structMax, 0, structMax);
    let structCls = "ok";
    if (struct <= structMax * 0.25) structCls = "critical"; else if (struct <= structMax * 0.5) structCls = "danger"; else if (struct <= structMax * 0.75) structCls = "warn";
    const card = document.createElement("div");
    card.className = "system-card compact";
    card.innerHTML = `
      <div class="sh">
        <h4>${escapeHtml(sys.nom)} <span style="color:var(--ink-dim); font-weight:400; font-size:12px;">(${escapeHtml(sys.type)})</span></h4>
        <div style="display:flex; gap:8px; align-items:center;">
          <span class="badge ${enAvarie ? "avarie" : "ok"}">${enAvarie ? sys.avaries.length + " avarie(s)" : "Opérationnel"}</span>
          <button class="btn small" onclick="openAvarieForm('${sys.id}')">+ Avarie</button>
          <button class="btn small danger" onclick="deleteSysteme('${sys.id}')">Supprimer</button>
        </div>
      </div>
      <div class="gh" style="margin-bottom:4px;"><span class="label">Structure</span><span class="val">${struct}/${structMax}</span></div>
      <div class="gauge-track"><div class="gauge-fill ${structCls}" style="width:${(struct/structMax)*100}%"></div></div>
      <div id="avaries-${sys.id}"></div>
      <div class="form-box" id="form-avarie-${sys.id}">
        <div class="field"><label>Description de l'avarie</label><input type="text" id="avf-desc-${sys.id}" placeholder="Ex : Court-circuit dans le générateur"></div>
        <div class="field-row">
          <div class="field"><label>Coût énergie</label><input type="number" id="avf-energie-${sys.id}" value="10"></div>
          <div class="field"><label>Coût crédits</label><input type="number" id="avf-credits-${sys.id}" value="50"></div>
          <div class="field"><label>Durée (jours)</label><input type="number" id="avf-duree-${sys.id}" value="1" min="1"></div>
          <div class="field"><label>Dégât structure</label><input type="number" id="avf-structure-${sys.id}" value="1" min="0"></div>
        </div>
        <div class="toolbar">
          <button class="btn primary small" onclick="saveAvarie('${sys.id}')">Signaler</button>
          <button class="btn small" onclick="closeForm('form-avarie-${sys.id}')">Annuler</button>
        </div>
      </div>
    `;
    c.appendChild(card);
    const avList = card.querySelector("#avaries-" + sys.id);
    sys.avaries.forEach(av => {
      const row = document.createElement("div");
      row.className = "avarie-row";
      row.innerHTML = `
        <span>${escapeHtml(av.description)}</span>
        <span class="meta">⚡${av.cout_energie} · ¤${av.cout_credits} · ${av.duree_jours}j · 🛠−${av.degat_structure || 0} structure</span>
        <button class="btn small" onclick="startRepair('${sys.id}','${av.id}')">Réparer</button>`;
      avList.appendChild(row);
    });
  });
}
function openAvarieForm(sysId) { openForm("form-avarie-" + sysId); }
function saveAvarie(sysId) {
  const sys = DB.systemes.find(s => s.id === sysId);
  const desc = document.getElementById("avf-desc-" + sysId).value.trim();
  if (!desc) { toast("Décrivez l'avarie"); return; }
  const structMax = sys.structure_max || 10;
  if (sys.structure == null) sys.structure = structMax;
  const degat = +document.getElementById("avf-structure-" + sysId).value || 0;
  sys.avaries.push({
    id: uidDash("av"),
    description: desc,
    cout_energie: +document.getElementById("avf-energie-" + sysId).value || 0,
    cout_credits: +document.getElementById("avf-credits-" + sysId).value || 0,
    duree_jours: +document.getElementById("avf-duree-" + sysId).value || 1,
    degat_structure: degat
  });
  sys.structure = clamp(sys.structure - degat, 0, structMax);
  closeForm("form-avarie-" + sysId);
  persistDash();
}
function saveSysteme() {
  const nom = document.getElementById("sf-nom").value.trim();
  const type = document.getElementById("sf-type").value.trim() || "Système";
  const structureMax = +document.getElementById("sf-structure").value || 10;
  if (!nom) { toast("Le nom est obligatoire"); return; }
  DB.systemes.push({ id: uidDash("sys"), nom, type, structure_max: structureMax, structure: structureMax, avaries: [] });
  document.getElementById("sf-nom").value = ""; document.getElementById("sf-type").value = ""; document.getElementById("sf-structure").value = "10";
  closeForm("form-systeme");
  persistDash();
}
function deleteSysteme(id) {
  if (!confirm("Supprimer ce système et ses avaries ?")) return;
  DB.systemes = DB.systemes.filter(s => s.id !== id);
  persistDash();
}

// ---------------- PERSONNES MOBILISÉES ----------------
function renderMobilises() {
  const box = document.getElementById("mobilises-box");
  const mobilises = [];
  DB.actions_en_cours.forEach(a => {
    const ids = a.personnageIds || (a.personnageId ? [a.personnageId] : []);
    ids.forEach(id => {
      const p = ROSTER.find(r => r.id === id);
      mobilises.push({ nom: p ? p.nom : "?", desc: a.description, jours: a.joursRestants, sansFiche: false });
    });
    (a.personnageManuel || []).forEach(nom => {
      mobilises.push({ nom, desc: a.description, jours: a.joursRestants, sansFiche: true });
    });
  });
  if (!mobilises.length) {
    box.innerHTML = `<p style="color:var(--ink-dim); font-size:13px; margin:0;">Personne n'est mobilisé actuellement.</p>`;
    return;
  }
  box.innerHTML = mobilises.map(m => `
    <div class="mobilise-row">
      <span class="pn">${escapeHtml(m.nom)}${m.sansFiche ? ` <span class="sans-fiche" title="Sans fiche personnage">(hors cellule)</span>` : ""}</span>
      <span class="pd">${escapeHtml(m.desc)} · ${m.jours}j</span>
    </div>`).join("");
}

// ---------------- ACTIONS EN COURS ----------------
function renderActions() {
  const c = document.getElementById("actions-list");
  c.innerHTML = "";
  if (!DB.actions_en_cours.length) { c.innerHTML = `<p class="section-note">Aucune action en cours.</p>`; return; }
  DB.actions_en_cours.forEach(a => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="info">
        <div class="t">${escapeHtml(a.description)}</div>
        <div class="s">${escapeHtml(a.personnageNom)} — ${a.joursRestants} jour(s) restant(s)</div>
        <div class="roll-badge">
          <span class="${a.reussite ? "succes" : "echec"}">${a.reussite ? "Succès" : "Échec"}</span>
          ${a.rollNote ? `<span>${escapeHtml(a.rollNote)}</span>` : ""}
        </div>
      </div>
      <div class="actions"><button class="btn small danger" onclick="cancelAction('${a.id}')">Annuler</button></div>`;
    c.appendChild(row);
  });
}
function cancelAction(id) {
  if (!confirm("Annuler cette action ? Les coûts déjà déduits ne sont pas remboursés.")) return;
  DB.actions_en_cours = DB.actions_en_cours.filter(a => a.id !== id);
  persistDash();
}

function personnageOptionsHtml(selectedId) {
  return `<option value="">— choisir —</option>` + ROSTER.map(p =>
    `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(p.nom)}</option>`).join("")
    + `<option value="__manual__" ${selectedId === "__manual__" ? "selected" : ""}>Autre (saisir un nom)…</option>`;
}
function isPersonnageMobilise(personnageId) {
  return DB.actions_en_cours.some(a => (a.personnageIds || []).includes(personnageId));
}
function checkMobiliseWarning(wrap, personnageId) {
  const warn = wrap.querySelector(".pf-mobilise-warning");
  if (!personnageId || personnageId === "__manual__" || !isPersonnageMobilise(personnageId)) {
    warn.style.display = "none";
    warn.textContent = "";
    return;
  }
  const p = ROSTER.find(x => x.id === personnageId);
  warn.textContent = `⚠ ${p ? p.nom : "Ce personnage"} est déjà mobilisé sur une autre action en cours.`;
  warn.style.display = "block";
}
function addPersonnageRow(selectedId, manualName) {
  const c = document.getElementById("af-personnages");
  const wrap = document.createElement("div");
  wrap.className = "pf-row";
  const isManual = selectedId === "__manual__";
  wrap.innerHTML = `
    <div class="dyn-row">
      <select class="pf-personnage-select">${personnageOptionsHtml(selectedId)}</select>
      <input type="text" class="pf-personnage-manual" placeholder="Nom du personnage" value="${escapeHtml(manualName || "")}" style="${isManual ? "" : "display:none;"}">
      <button class="btn small danger rm" type="button" onclick="this.closest('.pf-row').remove()">✕</button>
    </div>
    <p class="pf-mobilise-warning" style="display:none;"></p>`;
  c.appendChild(wrap);
  const select = wrap.querySelector(".pf-personnage-select");
  const manualInput = wrap.querySelector(".pf-personnage-manual");
  select.addEventListener("change", function () {
    const manual = select.value === "__manual__";
    manualInput.style.display = manual ? "" : "none";
    if (manual) manualInput.focus(); else manualInput.value = "";
    checkMobiliseWarning(wrap, select.value);
  });
  checkMobiliseWarning(wrap, selectedId);
}
function resetPersonnageRows(selectedIds) {
  const c = document.getElementById("af-personnages");
  c.innerHTML = "";
  if (selectedIds && selectedIds.length) selectedIds.forEach(id => addPersonnageRow(id));
  else addPersonnageRow();
}
function getSelectedPersonnages() {
  const ids = Array.from(document.querySelectorAll(".pf-personnage-select"))
    .map(s => s.value).filter(v => v && v !== "__manual__");
  const uniqueIds = [...new Set(ids)];
  return ROSTER.filter(p => uniqueIds.includes(p.id));
}
function getManualPersonnageNames() {
  const names = Array.from(document.querySelectorAll(".pf-row")).filter(row =>
    row.querySelector(".pf-personnage-select").value === "__manual__"
  ).map(row => row.querySelector(".pf-personnage-manual").value.trim()).filter(Boolean);
  return [...new Set(names)];
}
function fillSystemeSelect() {
  const sel = document.getElementById("af-systeme");
  const withAvaries = DB.systemes.filter(s => s.avaries.length);
  sel.innerHTML = withAvaries.map(s => `<option value="${s.id}">${escapeHtml(s.nom)}</option>`).join("") || `<option value="">— aucune avarie en attente —</option>`;
  fillAvarieSelect();
}
function fillAvarieSelect() {
  const sysId = document.getElementById("af-systeme").value;
  const sys = DB.systemes.find(s => s.id === sysId);
  const sel = document.getElementById("af-avarie");
  sel.innerHTML = sys ? sys.avaries.map(av => `<option value="${av.id}">${escapeHtml(av.description)}</option>`).join("") : "";
  fillReparationCosts();
}
function fillReparationCosts() {
  const sysId = document.getElementById("af-systeme").value;
  const avId = document.getElementById("af-avarie").value;
  const sys = DB.systemes.find(s => s.id === sysId);
  const av = sys ? sys.avaries.find(a => a.id === avId) : null;
  document.getElementById("af-cout-energie").value = av ? av.cout_energie : 0;
  document.getElementById("af-cout-credits").value = av ? av.cout_credits : 0;
  document.getElementById("af-duree").value = av ? av.duree_jours : 1;
  document.getElementById("af-description").value = av ? ("Réparation : " + av.description) : "";
}
function updateActionFormFields() {
  const type = document.getElementById("af-type").value;
  document.getElementById("af-reparation-fields").style.display = type === "reparation" ? "block" : "none";
  document.getElementById("af-jauge-fields").style.display = type === "jauge" ? "block" : "none";
  if (type === "reparation") fillSystemeSelect();
}

function openNewActionForm() {
  resetPersonnageRows();
  document.getElementById("af-type").value = "reparation";
  updateActionFormFields();
  ["af-avantages", "af-menaces", "af-triomphes", "af-desastres"].forEach(id => document.getElementById(id).value = 0);
  document.getElementById("af-succes").value = 1;
  openForm("form-action");
}

// pré-remplit le formulaire depuis le bouton "Réparer" d'une avarie
function startRepair(sysId, avId) {
  resetPersonnageRows();
  document.getElementById("af-type").value = "reparation";
  updateActionFormFields();
  document.getElementById("af-systeme").value = sysId;
  fillAvarieSelect();
  document.getElementById("af-avarie").value = avId;
  fillReparationCosts();
  openForm("form-action");
}

function saveAction() {
  const type = document.getElementById("af-type").value;
  const personnages = getSelectedPersonnages();
  const manualNames = getManualPersonnageNames();
  if (!personnages.length && !manualNames.length) { toast("Choisissez au moins un personnage"); return; }
  const personnageIds = personnages.map(p => p.id);
  const personnageNom = personnages.map(p => p.nom).concat(manualNames).join(", ");

  const coutEnergieBase = +document.getElementById("af-cout-energie").value || 0;
  const coutCredits = +document.getElementById("af-cout-credits").value || 0;
  const dureeBase = Math.max(0, +document.getElementById("af-duree").value || 0);
  let description = document.getElementById("af-description").value.trim();

  const succesNet = +document.getElementById("af-succes").value || 0;
  const avantages = Math.max(0, +document.getElementById("af-avantages").value || 0);
  const menaces = Math.max(0, +document.getElementById("af-menaces").value || 0);
  const triomphes = Math.max(0, +document.getElementById("af-triomphes").value || 0);
  const desastres = Math.max(0, +document.getElementById("af-desastres").value || 0);
  const appliqueA = document.getElementById("af-applique-a").value; // duree | energie | aucun

  const netAvantage = (avantages + 3 * triomphes) - (menaces + 3 * desastres);
  const reussite = succesNet > 0;

  let dureeFinale = dureeBase;
  let coutEnergieFinal = coutEnergieBase;
  let rollNoteParts = [succesNet + " succès net" + (Math.abs(succesNet) > 1 ? "s" : "")];
  if (avantages) rollNoteParts.push(avantages + " avantage" + (avantages > 1 ? "s" : ""));
  if (menaces) rollNoteParts.push(menaces + " menace" + (menaces > 1 ? "s" : ""));
  if (triomphes) rollNoteParts.push(triomphes + " triomphe" + (triomphes > 1 ? "s" : ""));
  if (desastres) rollNoteParts.push(desastres + " désastre" + (desastres > 1 ? "s" : ""));
  let rollNote = rollNoteParts.join(", ");

  if (appliqueA === "duree" && netAvantage !== 0) {
    dureeFinale = Math.max(0, dureeBase - netAvantage);
    rollNote += ` → durée ${dureeFinale}j (base ${dureeBase}j)`;
  } else if (appliqueA === "energie" && netAvantage !== 0) {
    coutEnergieFinal = Math.max(0, coutEnergieBase - netAvantage);
    rollNote += ` → coût énergie ${coutEnergieFinal} (base ${coutEnergieBase})`;
  }

  const action = {
    id: uidDash("act"),
    type,
    personnageIds, personnageNom, personnageManuel: manualNames,
    joursRestants: dureeFinale,
    description: description || "Action en cours",
    reussite, rollNote
  };

  if (type === "reparation") {
    const sysId = document.getElementById("af-systeme").value;
    const avId = document.getElementById("af-avarie").value;
    if (!sysId || !avId) { toast("Choisissez un système et une avarie"); return; }
    action.systemeId = sysId; action.avarieId = avId;
  } else if (type === "jauge") {
    action.cible = document.getElementById("af-cible").value;
    const montantParSucces = +document.getElementById("af-montant").value || 0;
    // les succès nets déterminent le montant obtenu ; en cas d'échec (succès nets <= 0), aucun gain.
    action.montantEffectif = reussite ? succesNet * montantParSucces : 0;
  }

  // déduction immédiate des coûts (ajustés par les avantages/menaces si applicable)
  DB.ressources.energie = clamp(DB.ressources.energie - coutEnergieFinal, 0, 100);
  DB.ressources.credits = clamp(DB.ressources.credits - coutCredits, 0, 999999);

  DB.actions_en_cours.push(action);
  DB.journal.unshift({
    jour: DB.jour,
    texte: `${personnageNom} entreprend : « ${action.description} » — ${reussite ? "Succès" : "Échec"} (${rollNote}). Coût immédiat : ⚡${coutEnergieFinal} ¤${coutCredits}, durée ${dureeFinale}j.`
  });

  // Si la durée finale est 0, l'action se résout immédiatement.
  if (dureeFinale <= 0) {
    const log = [];
    resolveAction(DB, action, log);
    DB.actions_en_cours = DB.actions_en_cours.filter(a => a.id !== action.id);
    log.forEach(t => DB.journal.unshift({ jour: DB.jour, texte: t }));
  }

  closeForm("form-action");
  persistDash();
}

// ---------------- JOURNAL ----------------
function renderJournal() {
  const c = document.getElementById("journal-list");
  c.innerHTML = "";
  if (!DB.journal.length) { c.innerHTML = `<p class="section-note">Journal vide.</p>`; return; }
  DB.journal.slice(0, 60).forEach(entry => {
    const row = document.createElement("div");
    row.className = "journal-entry";
    row.innerHTML = `<span class="jday">JOUR ${entry.jour}</span><span>${escapeHtml(entry.texte)}</span>`;
    c.appendChild(row);
  });
}

// ---------------- ACTIONS GLOBALES ----------------
function doAdvanceDay() {
  DB = advanceDay(DB);
  persistDash();
  toast("Jour " + DB.jour);
}
async function doResetDash() {
  if (!confirm("Réinitialiser tout le tableau de bord (moral, ressources, systèmes, journal) ?")) return;
  await resetDash();
  DB = await loadDash();
  renderAll();
  toast("Tableau de bord réinitialisé");
}

function renderAll() {
  renderMoral();
  renderRessources();
  renderSystemes();
  renderMobilises();
  renderActions();
  renderJournal();
  document.getElementById("suggestion-box").classList.remove("show");
}

async function initDashboard() {
  DB = await loadDash();
  ROSTER_DATA = await loadData(); // dossier principal, lecture seule ici
  ROSTER = ROSTER_DATA.personnages.filter(p => p.uniteId === DASH_UNITE_ID);
  renderAll();
}
initDashboard();
