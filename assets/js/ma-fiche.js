// ============================================================
// MA FICHE — page joueur : réception par QR/fichier, édition locale,
// renvoi par QR/fichier. Stockage 100% local à cet appareil (IndexedDB).
// ============================================================

const MA_FICHE_KEY = "ma_fiche_v1";
let FICHE = null;
let scanAnimFrame = null;

function toast(msg, duration) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration || 2200);
}
function openForm(id) { document.getElementById(id).classList.add("active"); }
function closeForm(id) { document.getElementById(id).classList.remove("active"); }

// ---------------- Chargement initial ----------------
async function init() {
  // Ouverture via un lien "#import=..." (QR ou lien partagé) : on charge et on
  // nettoie l'URL pour ne pas la recharger en boucle si la page est raffraîchie.
  const hashMatch = location.hash.match(/^#import=(.+)$/);
  if (hashMatch) {
    const p = decodePayload(decodeURIComponent(hashMatch[1]));
    history.replaceState(null, "", location.pathname);
    if (p) { await acceptFiche(p); return; }
    toast("Lien illisible — vérifie qu'il n'a pas été tronqué");
  }
  try {
    const saved = await idbGet(MA_FICHE_KEY);
    if (saved) { FICHE = saved; showFiche(); return; }
  } catch (e) { console.error(e); }
  showOnboarding();
}

function shareUrlFor(payload) {
  return location.origin + location.pathname + "#import=" + encodeURIComponent(payload);
}

function showOnboarding() {
  document.getElementById("onboarding-box").style.display = "";
  document.getElementById("fiche-box").style.display = "none";
}

function showFiche() {
  document.getElementById("onboarding-box").style.display = "none";
  document.getElementById("fiche-box").style.display = "";
  buildEditForm();
  switchView("edit");
}

// ---------------- Décodage d'un payload reçu (QR / collé / fichier) ----------------
function decodePayload(raw) {
  const text = (raw || "").trim();
  if (!text) return null;
  // 1) essai : JSON brut (fichier exporté depuis l'éditeur -> {personnages:[...]})
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.personnages) && parsed.personnages.length) return parsed.personnages[0];
    if (parsed && parsed.nom) return parsed;
  } catch (e) { /* pas du JSON brut, on tente la décompression */ }
  // 2) essai : chaîne compressée LZString (format des QR générés par ce site)
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(text);
    if (decompressed) {
      const parsed = JSON.parse(decompressed);
      if (parsed && parsed.nom) return parsed;
    }
  } catch (e) { /* échec silencieux, on retombe sur null */ }
  return null;
}

async function acceptFiche(p) {
  if (!p || !p.nom) { toast("Fiche illisible — vérifie le code ou le fichier"); return; }
  FICHE = p;
  try { await idbSet(MA_FICHE_KEY, FICHE); } catch (e) { console.error(e); }
  toast(`Fiche « ${p.nom} » chargée`);
  showFiche();
}

function loadFromPaste() {
  const raw = document.getElementById("mf-paste").value;
  const p = decodePayload(raw);
  acceptFiche(p);
}

document.getElementById("mf-file").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (ev) {
    const p = decodePayload(ev.target.result);
    acceptFiche(p);
  };
  reader.readAsText(file);
  e.target.value = "";
});

function resetFiche() {
  if (!confirm("Repartir de zéro ? Ta fiche actuelle sera effacée de cet appareil (le MJ garde sa copie).")) return;
  FICHE = null;
  idbSet(MA_FICHE_KEY, null).catch(() => {});
  showOnboarding();
}

// ---------------- Scan caméra ----------------
async function startScan() {
  document.getElementById("scan-box").style.display = "";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = document.getElementById("qr-video");
    video.srcObject = stream;
    await video.play();
    scanLoop();
  } catch (e) {
    toast("Caméra indisponible sur ce navigateur — utilise le collage du code ou le fichier");
    document.getElementById("scan-box").style.display = "none";
  }
}

function scanLoop() {
  const video = document.getElementById("qr-video");
  const canvas = document.getElementById("qr-canvas");
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      stopScan();
      const p = decodePayload(code.data);
      acceptFiche(p);
      return;
    }
  }
  scanAnimFrame = requestAnimationFrame(scanLoop);
}

function stopScan() {
  if (scanAnimFrame) cancelAnimationFrame(scanAnimFrame);
  const video = document.getElementById("qr-video");
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  document.getElementById("scan-box").style.display = "none";
}

// ---------------- Vues Modifier / Voir ----------------
function switchView(mode) {
  document.getElementById("tab-edit").classList.toggle("active", mode === "edit");
  document.getElementById("tab-voir").classList.toggle("active", mode === "voir");
  document.getElementById("edit-view").style.display = mode === "edit" ? "" : "none";
  document.getElementById("voir-view").style.display = mode === "voir" ? "" : "none";
  if (mode === "voir") renderCharacterSheet(document.getElementById("voir-view"), FICHE);
}

// ---------------- Lignes dynamiques (compétences / capacités / armes) ----------------
function addMfCompetenceRow(nom, rang) {
  const c = document.getElementById("mf-competences");
  const row = document.createElement("div");
  row.className = "dyn-row";
  const options = SKILLS_LIST.map(s => `<option value="${s.nom}" ${s.nom === nom ? "selected" : ""}>${s.nom} (${CARAC_LABELS[s.carac]})</option>`).join("");
  row.innerHTML = `
    <select class="mf-cp-skill"><option value="">— compétence —</option>${options}</select>
    <input type="number" class="mf-cp-rang" min="0" max="6" placeholder="Rang" value="${rang ?? ""}" style="max-width:90px;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}
function addMfCapaciteRow(nom, description) {
  const c = document.getElementById("mf-capacites");
  const row = document.createElement("div");
  row.className = "dyn-row";
  row.innerHTML = `
    <input type="text" class="mf-cap-nom" placeholder="Nom de la capacité" value="${escapeHtml(nom || "")}" style="flex:1;">
    <input type="text" class="mf-cap-desc" placeholder="Description" value="${escapeHtml(description || "")}" style="flex:2;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}
function addMfArmeRow(nom, competence, degat, critique, attribut) {
  const c = document.getElementById("mf-armes");
  const row = document.createElement("div");
  row.className = "dyn-row";
  const options = SKILLS_LIST.map(s => `<option value="${s.nom}" ${s.nom === competence ? "selected" : ""}>${s.nom}</option>`).join("");
  row.innerHTML = `
    <input type="text" class="mf-arme-nom" placeholder="Nom de l'arme" value="${escapeHtml(nom || "")}" style="flex:2;">
    <select class="mf-arme-competence" style="flex:2;"><option value="">— compétence —</option>${options}</select>
    <input type="text" class="mf-arme-attribut" placeholder="Note libre" value="${escapeHtml(attribut || "")}" style="flex:1.5;">
    <input type="number" class="mf-arme-degat" placeholder="Dégât" min="0" value="${degat ?? ""}" style="max-width:80px;">
    <input type="text" class="mf-arme-critique" placeholder="Critique" value="${escapeHtml(critique || "")}" style="max-width:80px;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}

// ---------------- Construction du formulaire d'édition ----------------
function buildEditForm() {
  const p = FICHE;
  const c = p.caracteristiques || {};
  const container = document.getElementById("edit-view");
  container.innerHTML = `
    <div class="dossier-head" style="margin:18px 0;">
      <h1 id="mf-nom-affiche">${escapeHtml(p.nom)}</h1>
      <p class="lead">${escapeHtml([p.race, p.carriere, p.specialisation].filter(Boolean).join(" · ")) || "&nbsp;"}</p>
    </div>

    <div class="field-row">
      <div class="field"><label>Nom</label><input type="text" id="mf-nom" value="${escapeHtml(p.nom)}"></div>
      <div class="field"><label>Race</label><input type="text" id="mf-race" value="${escapeHtml(p.race || "")}"></div>
      <div class="field"><label>Carrière</label><input type="text" id="mf-carriere" value="${escapeHtml(p.carriere || "")}"></div>
      <div class="field"><label>Spécialisation</label><input type="text" id="mf-specialisation" value="${escapeHtml(p.specialisation || "")}"></div>
    </div>

    <div class="section-title"><h2>Caractéristiques</h2><div class="rule"></div></div>
    <div class="carac-grid">
      <div class="field"><label>Vigueur</label><input type="number" id="mf-vig" min="0" max="6" value="${c.vig ?? ""}"></div>
      <div class="field"><label>Agilité</label><input type="number" id="mf-agi" min="0" max="6" value="${c.agi ?? ""}"></div>
      <div class="field"><label>Intelligence</label><input type="number" id="mf-int" min="0" max="6" value="${c.int ?? ""}"></div>
      <div class="field"><label>Ruse</label><input type="number" id="mf-rus" min="0" max="6" value="${c.rus ?? ""}"></div>
      <div class="field"><label>Volonté</label><input type="number" id="mf-vol" min="0" max="6" value="${c.vol ?? ""}"></div>
      <div class="field"><label>Présence</label><input type="number" id="mf-pre" min="0" max="6" value="${c.pre ?? ""}"></div>
    </div>

    <div class="section-title"><h2>Compétences</h2><div class="rule"></div></div>
    <div class="dyn-list" id="mf-competences"></div>
    <button class="btn small" type="button" onclick="addMfCompetenceRow()">+ Ajouter une compétence</button>

    <div class="section-title"><h2>Encaissement / Défense / Santé / Stress</h2><div class="rule"></div></div>
    <div class="field-row">
      <div class="field"><label>Encaissement</label><input type="number" id="mf-enc" value="${p.enc ?? ""}"></div>
      <div class="field"><label>Défense CàC</label><input type="number" id="mf-defcac" value="${p.defense_cac ?? ""}"></div>
      <div class="field"><label>Défense distance</label><input type="number" id="mf-defdist" value="${p.defense_dist ?? ""}"></div>
      <div class="field"><label>Points de blessure max</label><input type="number" id="mf-santemax" value="${p.sante_max ?? ""}"></div>
      <div class="field"><label>Stress max</label><input type="number" id="mf-stressmax" value="${p.stress_max ?? ""}"></div>
    </div>

    <div class="section-title"><h2>Armes / attaques</h2><div class="rule"></div></div>
    <div class="dyn-list" id="mf-armes"></div>
    <button class="btn small" type="button" onclick="addMfArmeRow()">+ Ajouter une arme</button>

    <div class="section-title"><h2>Capacités spéciales</h2><div class="rule"></div></div>
    <div class="dyn-list" id="mf-capacites"></div>
    <button class="btn small" type="button" onclick="addMfCapaciteRow()">+ Ajouter une capacité</button>

    <div class="section-title"><h2>Obligation / Historique</h2><div class="rule"></div></div>
    <div class="field"><label>Obligation</label><input type="text" id="mf-obligation" value="${escapeHtml(p.obligation || "")}"></div>
    <div class="field"><label>Historique</label><textarea id="mf-historique" rows="5">${escapeHtml(p.historique || "")}</textarea></div>
  `;

  Object.keys(p.competences || {}).forEach(k => addMfCompetenceRow(k, p.competences[k]));
  (p.capacites_speciales || []).forEach(cap => addMfCapaciteRow(cap.nom, cap.description));
  (p.armes || []).forEach(a => addMfArmeRow(a.nom, a.competence, a.degat, a.critique, a.attribut));
}

function collectFicheFromForm() {
  const competences = {};
  document.querySelectorAll("#mf-competences .dyn-row").forEach(row => {
    const skill = row.querySelector(".mf-cp-skill").value;
    const rang = +row.querySelector(".mf-cp-rang").value;
    if (skill && rang > 0) competences[skill] = rang;
  });
  const capacites_speciales = [];
  document.querySelectorAll("#mf-capacites .dyn-row").forEach(row => {
    const nom = row.querySelector(".mf-cap-nom").value.trim();
    const description = row.querySelector(".mf-cap-desc").value.trim();
    if (nom) capacites_speciales.push({ nom, description });
  });
  const armes = [];
  document.querySelectorAll("#mf-armes .dyn-row").forEach(row => {
    const nom = row.querySelector(".mf-arme-nom").value.trim();
    if (!nom) return;
    armes.push({
      nom,
      competence: row.querySelector(".mf-arme-competence").value || "",
      attribut: row.querySelector(".mf-arme-attribut").value || "",
      degat: +row.querySelector(".mf-arme-degat").value || 0,
      critique: row.querySelector(".mf-arme-critique").value.trim()
    });
  });

  const numOrNull = (v) => v === "" ? null : +v;
  const caracVals = ["vig", "agi", "int", "rus", "vol", "pre"].map(k => document.getElementById("mf-" + k).value);
  const hasCarac = caracVals.some(v => v !== "");
  const caracteristiques = hasCarac ? {
    vig: +document.getElementById("mf-vig").value || 0,
    agi: +document.getElementById("mf-agi").value || 0,
    int: +document.getElementById("mf-int").value || 0,
    rus: +document.getElementById("mf-rus").value || 0,
    vol: +document.getElementById("mf-vol").value || 0,
    pre: +document.getElementById("mf-pre").value || 0
  } : null;

  // On part de la fiche existante pour ne jamais perdre un champ non affiché ici
  // (ex : type, uniteId, lieuId, portrait...), puis on écrase avec le formulaire.
  return {
    ...FICHE,
    nom: document.getElementById("mf-nom").value.trim() || FICHE.nom,
    race: document.getElementById("mf-race").value.trim(),
    carriere: document.getElementById("mf-carriere").value.trim(),
    specialisation: document.getElementById("mf-specialisation").value.trim(),
    caracteristiques, competences, capacites_speciales, armes,
    enc: numOrNull(document.getElementById("mf-enc").value),
    defense_cac: numOrNull(document.getElementById("mf-defcac").value),
    defense_dist: numOrNull(document.getElementById("mf-defdist").value),
    sante_max: numOrNull(document.getElementById("mf-santemax").value),
    stress_max: numOrNull(document.getElementById("mf-stressmax").value),
    obligation: document.getElementById("mf-obligation").value.trim(),
    historique: document.getElementById("mf-historique").value.trim()
  };
}

async function saveFiche() {
  FICHE = collectFicheFromForm();
  try {
    await idbSet(MA_FICHE_KEY, FICHE);
    toast("Fiche enregistrée sur cet appareil");
    document.getElementById("mf-nom-affiche").textContent = FICHE.nom;
  } catch (e) {
    console.error(e);
    toast("⚠ Échec de l'enregistrement");
  }
}

function downloadFiche() {
  downloadSinglePersonnage(FICHE);
}

function showMyQr() {
  FICHE = collectFicheFromForm();
  const box = document.getElementById("qr-modal-code");
  const warn = document.getElementById("qr-modal-warning");
  const result = buildQrText(FICHE);
  renderQrOrWarn(box, warn, result);
  document.getElementById("qr-modal-copy").onclick = () => {
    const text = result ? result.text : "";
    navigator.clipboard.writeText(text).then(() => toast("Code copié"), () => toast("Impossible de copier automatiquement"));
  };
  openForm("qr-modal");
}

init();
