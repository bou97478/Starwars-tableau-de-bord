// ============================================================
// ÉDITEUR — logique de gestion (CRUD) du dossier Réseau Minos
// ============================================================

let DATA = null;

async function persist() {
  const ok = await saveData(DATA);
  refreshAll();
  if (ok) toast("Enregistré");
  else toast("⚠ Échec de l'enregistrement — stockage plein ou indisponible", 4500);
}

// Redimensionne et compresse une image avant de la stocker en base64,
// pour éviter de saturer le quota du stockage local du navigateur (~5 Mo).
function resizeImageFile(file, maxDim, quality, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = function () { callback(e.target.result); }; // repli si l'image ne peut pas être décodée
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function toast(msg, duration) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration || 1800);
}

function uniqueId(nom, existingIds) {
  let base = slugify(nom);
  let id = base, n = 2;
  while (existingIds.includes(id)) { id = base + "-" + n; n++; }
  return id;
}

function closeForm(boxId) {
  document.getElementById(boxId).classList.remove("active");
}
function openForm(boxId) {
  document.getElementById(boxId).classList.add("active");
  document.getElementById(boxId).scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------------- TABS ----------------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ============================================================
// PERSONNAGES
// ============================================================
function fillSelect(select, options, placeholder) {
  select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : "") +
    options.map(o => `<option value="${o.id}">${escapeHtml(o.nom)}</option>`).join("");
}

function renderPersonnagesList() {
  const c = document.getElementById("list-personnages");
  c.innerHTML = "";
  if (!DATA.personnages.length) { c.innerHTML = `<p class="section-note">Aucun personnage.</p>`; return; }

  // Remplit les filtres Groupe / Race dynamiquement à chaque rendu, en préservant la sélection en cours
  const uniteSelect = document.getElementById("pl-filter-unite");
  const currentUnite = uniteSelect.value;
  const unitesTriees = DATA.unites.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  uniteSelect.innerHTML = `<option value="">Tous les groupes</option>` + unitesTriees.map(u => `<option value="${u.id}">${escapeHtml(u.nom)}</option>`).join("");
  uniteSelect.value = unitesTriees.some(u => u.id === currentUnite) ? currentUnite : "";
  const raceSelect = document.getElementById("pl-filter-race");
  const racesConnues = [...new Set(DATA.personnages.map(p => (p.race || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const currentRace = raceSelect.value;
  raceSelect.innerHTML = `<option value="">Toutes les races</option>` + racesConnues.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
  raceSelect.value = racesConnues.includes(currentRace) ? currentRace : "";

  const search = document.getElementById("pl-search").value.trim().toLowerCase();
  const sortMode = document.getElementById("pl-sort").value;
  const filterUnite = document.getElementById("pl-filter-unite").value;
  const filterRace = document.getElementById("pl-filter-race").value;
  const filterType = document.getElementById("pl-filter-type").value;

  let liste = DATA.personnages.map((p, idx) => ({ p, idx })); // idx = ordre de création (ordre du tableau)

  if (search) liste = liste.filter(({ p }) => p.nom.toLowerCase().includes(search));
  if (filterUnite) liste = liste.filter(({ p }) => p.uniteId === filterUnite);
  if (filterRace) liste = liste.filter(({ p }) => (p.race || "").trim() === filterRace);
  if (filterType) liste = liste.filter(({ p }) => (p.type || "pj") === filterType);

  if (sortMode === "alpha") liste.sort((a, b) => a.p.nom.localeCompare(b.p.nom, "fr"));
  else liste.sort((a, b) => a.idx - b.idx);

  if (!liste.length) { c.innerHTML = `<p class="section-note">Aucun personnage ne correspond à ces critères.</p>`; return; }

  const typeLabels = { pj: "PJ / PNJ", sbires: "Sbires", vaisseau: "Véhicule" };

  liste.forEach(({ p }) => {
    const unite = DATA.unites.find(u => u.id === p.uniteId);
    const typeLabel = typeLabels[p.type || "pj"];
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="info">
        <div class="t">${escapeHtml(p.nom)} <span class="badge ok" style="font-size:9px; margin-left:6px;">${typeLabel}</span></div>
        <div class="s">${escapeHtml(p.race || "?")} — ${escapeHtml(unite ? unite.nom : "sans unité")}</div>
      </div>
      <div class="actions">
        <a class="btn small" href="personnages/personnage.html?id=${encodeURIComponent(p.id)}" target="_blank">Voir</a>
        <button class="btn small" onclick="openPersonnageForm('${p.id}')">Modifier</button>
        <button class="btn small" onclick="exportOnePersonnage('${p.id}')">Exporter</button>
        <button class="btn small" onclick="showPersonnageQr('${p.id}')">QR</button>
        <button class="btn small danger" onclick="deletePersonnage('${p.id}')">Supprimer</button>
      </div>`;
    c.appendChild(row);
  });
}

function addCompetenceRow(nom, rang) {
  const c = document.getElementById("pf-competences");
  const row = document.createElement("div");
  row.className = "dyn-row";
  const options = SKILLS_LIST.map(s => `<option value="${s.nom}" ${s.nom === nom ? "selected" : ""}>${s.nom} (${CARAC_LABELS[s.carac]})</option>`).join("");
  row.innerHTML = `
    <select class="cp-skill"><option value="">— compétence —</option>${options}</select>
    <input type="number" class="cp-rang" min="0" max="6" placeholder="Rang" value="${rang ?? ""}" style="max-width:90px;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}

function addCapaciteRow(nom, description) {
  const c = document.getElementById("pf-capacites");
  const row = document.createElement("div");
  row.className = "dyn-row";
  row.innerHTML = `
    <input type="text" class="cap-nom" placeholder="Nom de la capacité" value="${escapeHtml(nom || "")}" style="flex:1;">
    <input type="text" class="cap-desc" placeholder="Description" value="${escapeHtml(description || "")}" style="flex:2;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}

function addArmeRow(nom, competence, degat, critique, attribut) {
  const c = document.getElementById("pf-armes");
  const row = document.createElement("div");
  row.className = "dyn-row";
  const options = SKILLS_LIST.map(s => `<option value="${s.nom}" ${s.nom === competence ? "selected" : ""}>${s.nom}</option>`).join("");
  row.innerHTML = `
    <input type="text" class="arme-nom" placeholder="Nom de l'arme" value="${escapeHtml(nom || "")}" style="flex:2;">
    <select class="arme-competence" style="flex:2;"><option value="">— compétence associée —</option>${options}</select>
    <input type="text" class="arme-attribut" placeholder="Note libre (ex : perforant, ionisant...)" value="${escapeHtml(attribut || "")}" style="flex:1.5;">
    <input type="number" class="arme-degat" placeholder="Dégât" min="0" value="${degat ?? ""}" style="max-width:80px;">
    <input type="text" class="arme-critique" placeholder="Critique" value="${escapeHtml(critique || "")}" style="max-width:80px;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}

function togglePersonnageType() {
  const type = document.getElementById("pf-type").value;
  const isSbires = type === "sbires";
  const isVaisseau = type === "vaisseau";

  document.getElementById("pf-block-carac").style.display = isVaisseau ? "none" : "";
  document.getElementById("pf-block-sbires").style.display = isSbires ? "" : "none";
  document.getElementById("pf-block-vaisseau").style.display = isVaisseau ? "" : "none";
  document.getElementById("pf-competences-sbires-note").style.display = isSbires ? "" : "none";
  document.getElementById("pf-block-santemax").style.display = isSbires ? "none" : "";
  document.getElementById("pf-block-stressmax").style.display = isSbires ? "none" : "";

  document.getElementById("pf-block-ecrans-extra").style.display = isVaisseau ? "" : "none";
  document.getElementById("pf-block-ecrans-extra2").style.display = isVaisseau ? "" : "none";

  document.getElementById("pf-enc-label").textContent = isVaisseau ? "Blindage" : "Encaissement";
  document.getElementById("pf-defcac-label").textContent = isVaisseau ? "Écran avant" : "Défense CàC";
  document.getElementById("pf-defdist-label").textContent = isVaisseau ? "Écran arrière" : "Défense distance";
  document.getElementById("pf-santemax-label").textContent = isVaisseau ? "Points de coque max" : "Points de blessure max";
  document.getElementById("pf-stressmax-label").textContent = isVaisseau ? "Stress mécanique max" : "Stress max";
}

function openPersonnageForm(id) {
  fillSelect(document.getElementById("pf-unite"), DATA.unites, null);
  fillSelect(document.getElementById("pf-lieu"), DATA.lieux, "— aucun —");
  document.getElementById("pf-competences").innerHTML = "";
  document.getElementById("pf-capacites").innerHTML = "";
  document.getElementById("pf-armes").innerHTML = "";
  document.getElementById("pf-portrait-data").value = "";
  const preview = document.getElementById("pf-portrait-preview");
  preview.classList.remove("show");

  const p = id ? DATA.personnages.find(x => x.id === id) : null;
  document.getElementById("pf-title").textContent = p ? "Modifier : " + p.nom : "Nouveau personnage";
  document.getElementById("pf-id").value = id || "";
  document.getElementById("pf-nom").value = p ? p.nom : "";
  document.getElementById("pf-type").value = (p && (p.type === "sbires" || p.type === "vaisseau")) ? p.type : "pj";
  document.getElementById("pf-unite").value = p ? p.uniteId || "" : "";
  document.getElementById("pf-lieu").value = p ? p.lieuId || "" : "";
  document.getElementById("pf-race").value = p ? p.race || "" : "";
  document.getElementById("pf-sexe").value = p ? p.sexe || "" : "";
  document.getElementById("pf-age").value = p ? p.age || "" : "";
  document.getElementById("pf-taille").value = p ? p.taille || "" : "";
  document.getElementById("pf-motivation").value = p ? p.motivation || "" : "";
  document.getElementById("pf-historique").value = p ? p.historique || "" : "";
  document.getElementById("pf-obligation").value = p ? p.obligation || "" : "";
  document.getElementById("pf-carriere").value = p ? p.carriere || "" : "";
  document.getElementById("pf-specialisation").value = p ? p.specialisation || "" : "";

  const c = (p && p.caracteristiques) || {};
  document.getElementById("pf-vig").value = c.vig ?? "";
  document.getElementById("pf-agi").value = c.agi ?? "";
  document.getElementById("pf-int").value = c.int ?? "";
  document.getElementById("pf-rus").value = c.rus ?? "";
  document.getElementById("pf-vol").value = c.vol ?? "";
  document.getElementById("pf-pre").value = c.pre ?? "";

  document.getElementById("pf-pv-individuel").value = p ? (p.pv_individuel ?? 5) : 5;
  document.getElementById("pf-nombre-sbires").value = p ? (p.nombre_sbires ?? 3) : 3;
  document.getElementById("pf-gabarit").value = p ? (p.gabarit ?? 3) : 3;
  document.getElementById("pf-vitesse").value = p ? (p.vitesse ?? 3) : 3;
  document.getElementById("pf-manoeuvrabilite").value = p ? (p.manoeuvrabilite ?? 0) : 0;

  document.getElementById("pf-hyperpropulseur").value = p ? p.hyperpropulseur || "" : "";
  document.getElementById("pf-navordinateur").value = p ? p.navordinateur || "" : "";
  document.getElementById("pf-capacite-soute").value = p ? p.capaciteSoute || "" : "";
  document.getElementById("pf-equipage-txt").value = p ? p.equipageTxt || "" : "";
  document.getElementById("pf-passagers-txt").value = p ? p.passagersTxt || "" : "";
  document.getElementById("pf-autonomie").value = p ? p.autonomie || "" : "";
  document.getElementById("pf-prix-txt").value = p ? p.prixTxt || "" : "";
  document.getElementById("pf-rarete-txt").value = p ? p.rareteTxt || "" : "";
  document.getElementById("pf-points-customisation").value = p ? p.pointsCustomisation || "" : "";

  if (p && p.competences) {
    Object.keys(p.competences).forEach(k => addCompetenceRow(k, p.competences[k]));
  }
  if (p && p.capacites_speciales) {
    p.capacites_speciales.forEach(cap => addCapaciteRow(cap.nom, cap.description));
  }
  if (p && p.armes) {
    p.armes.forEach(a => addArmeRow(a.nom, a.competence, a.degat, a.critique, a.attribut));
  }

  document.getElementById("pf-enc").value = p ? (p.enc ?? "") : "";
  document.getElementById("pf-defcac").value = p ? (p.defense_cac ?? "") : "";
  document.getElementById("pf-defdist").value = p ? (p.defense_dist ?? "") : "";
  document.getElementById("pf-ecrandroit").value = p ? (p.ecran_droit ?? "") : "";
  document.getElementById("pf-ecrangauche").value = p ? (p.ecran_gauche ?? "") : "";
  document.getElementById("pf-adversite").value = p ? (p.adversite ?? "") : "";
  document.getElementById("pf-santemax").value = p ? (p.sante_max ?? "") : "";
  document.getElementById("pf-stressmax").value = p ? (p.stress_max ?? "") : "";

  if (p && p.portrait) {
    preview.src = portraitSrc(p.portrait);
    preview.classList.add("show");
    document.getElementById("pf-portrait-data").value = p.portrait;
  }

  togglePersonnageType();
  openForm("form-personnage");
}

document.getElementById("pf-portrait-file").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  resizeImageFile(file, 900, 0.85, function (dataUrl) {
    document.getElementById("pf-portrait-data").value = dataUrl;
    const preview = document.getElementById("pf-portrait-preview");
    preview.src = dataUrl;
    preview.classList.add("show");
  });
});

function savePersonnage() {
  const nom = document.getElementById("pf-nom").value.trim();
  if (!nom) { toast("Le nom est obligatoire"); return; }

  const existingId = document.getElementById("pf-id").value;
  const id = existingId || uniqueId(nom, DATA.personnages.map(p => p.id));
  const typeRaw = document.getElementById("pf-type").value;
  const type = (typeRaw === "sbires" || typeRaw === "vaisseau") ? typeRaw : "pj";

  const caracVals = ["vig", "agi", "int", "rus", "vol", "pre"].map(k => document.getElementById("pf-" + k).value);
  const hasCarac = caracVals.some(v => v !== "");
  const caracteristiques = (type !== "vaisseau" && hasCarac)
    ? { vig: +document.getElementById("pf-vig").value || 0, agi: +document.getElementById("pf-agi").value || 0,
        int: +document.getElementById("pf-int").value || 0, rus: +document.getElementById("pf-rus").value || 0,
        vol: +document.getElementById("pf-vol").value || 0, pre: +document.getElementById("pf-pre").value || 0 }
    : null;

  const competences = {};
  document.querySelectorAll("#pf-competences .dyn-row").forEach(row => {
    const skill = row.querySelector(".cp-skill").value;
    const rang = +row.querySelector(".cp-rang").value;
    if (skill && rang > 0) competences[skill] = rang;
  });

  const capacites_speciales = [];
  document.querySelectorAll("#pf-capacites .dyn-row").forEach(row => {
    const n = row.querySelector(".cap-nom").value.trim();
    const d = row.querySelector(".cap-desc").value.trim();
    if (n) capacites_speciales.push({ nom: n, description: d });
  });

  const armes = [];
  document.querySelectorAll("#pf-armes .dyn-row").forEach(row => {
    const n = row.querySelector(".arme-nom").value.trim();
    if (!n) return;
    armes.push({
      nom: n,
      competence: row.querySelector(".arme-competence").value || "",
      attribut: row.querySelector(".arme-attribut").value || "",
      degat: +row.querySelector(".arme-degat").value || 0,
      critique: row.querySelector(".arme-critique").value.trim()
    });
  });

  const numOrNull = (v) => v === "" ? null : +v;

  const obj = {
    id, nom, type,
    uniteId: document.getElementById("pf-unite").value || "",
    lieuId: document.getElementById("pf-lieu").value || "",
    race: document.getElementById("pf-race").value.trim(),
    sexe: document.getElementById("pf-sexe").value.trim(),
    age: document.getElementById("pf-age").value.trim(),
    taille: document.getElementById("pf-taille").value.trim(),
    motivation: document.getElementById("pf-motivation").value.trim(),
    historique: document.getElementById("pf-historique").value.trim(),
    obligation: document.getElementById("pf-obligation").value.trim(),
    carriere: document.getElementById("pf-carriere").value.trim(),
    specialisation: document.getElementById("pf-specialisation").value.trim(),
    caracteristiques, competences, capacites_speciales, armes,
    enc: numOrNull(document.getElementById("pf-enc").value),
    defense_cac: numOrNull(document.getElementById("pf-defcac").value),
    defense_dist: numOrNull(document.getElementById("pf-defdist").value),
    ecran_droit: type === "vaisseau" ? numOrNull(document.getElementById("pf-ecrandroit").value) : null,
    ecran_gauche: type === "vaisseau" ? numOrNull(document.getElementById("pf-ecrangauche").value) : null,
    adversite: numOrNull(document.getElementById("pf-adversite").value),
    sante_max: type === "sbires" ? null : numOrNull(document.getElementById("pf-santemax").value),
    stress_max: type === "sbires" ? null : numOrNull(document.getElementById("pf-stressmax").value),
    pv_individuel: type === "sbires" ? (+document.getElementById("pf-pv-individuel").value || 1) : null,
    nombre_sbires: type === "sbires" ? (+document.getElementById("pf-nombre-sbires").value || 1) : null,
    gabarit: type === "vaisseau" ? (+document.getElementById("pf-gabarit").value || 0) : null,
    vitesse: type === "vaisseau" ? (+document.getElementById("pf-vitesse").value || 0) : null,
    manoeuvrabilite: type === "vaisseau" ? (+document.getElementById("pf-manoeuvrabilite").value || 0) : null,
    hyperpropulseur: type === "vaisseau" ? document.getElementById("pf-hyperpropulseur").value.trim() : "",
    navordinateur: type === "vaisseau" ? document.getElementById("pf-navordinateur").value.trim() : "",
    capaciteSoute: type === "vaisseau" ? document.getElementById("pf-capacite-soute").value.trim() : "",
    equipageTxt: type === "vaisseau" ? document.getElementById("pf-equipage-txt").value.trim() : "",
    passagersTxt: type === "vaisseau" ? document.getElementById("pf-passagers-txt").value.trim() : "",
    autonomie: type === "vaisseau" ? document.getElementById("pf-autonomie").value.trim() : "",
    prixTxt: type === "vaisseau" ? document.getElementById("pf-prix-txt").value.trim() : "",
    rareteTxt: type === "vaisseau" ? document.getElementById("pf-rarete-txt").value.trim() : "",
    pointsCustomisation: type === "vaisseau" ? document.getElementById("pf-points-customisation").value.trim() : "",
    portrait: document.getElementById("pf-portrait-data").value || ""
  };

  const idx = DATA.personnages.findIndex(p => p.id === id);
  if (idx >= 0) DATA.personnages[idx] = obj; else DATA.personnages.push(obj);

  closeForm("form-personnage");
  persist();
}

function deletePersonnage(id) {
  if (!confirm("Supprimer ce personnage ?")) return;
  DATA.personnages = DATA.personnages.filter(p => p.id !== id);
  persist();
}

function exportOnePersonnage(id) {
  const p = DATA.personnages.find(x => x.id === id);
  if (!p) return;
  downloadSinglePersonnage(p);
}

// ---------------- Partage par QR code ----------------
// Le personnage est compressé (LZString) puis encodé dans le QR. La page
// "Ma fiche" (outils/ma-fiche.html) sait décompresser ce même format.
function showPersonnageQr(id) {
  const p = DATA.personnages.find(x => x.id === id);
  if (!p) return;
  const payload = LZString.compressToEncodedURIComponent(JSON.stringify(p));
  const url = location.origin + location.pathname.replace(/editeur\.html$/, "") + "outils/ma-fiche.html#import=" + encodeURIComponent(payload);
  document.getElementById("qr-modal-title").textContent = "QR — " + p.nom;
  const box = document.getElementById("qr-modal-code");
  box.innerHTML = "";
  new QRCode(box, { text: url, width: 260, height: 260, correctLevel: QRCode.CorrectLevel.L });
  document.getElementById("qr-modal-copy").onclick = () => copyToClipboard(url, "Lien copié");
  const warn = document.getElementById("qr-modal-warning");
  if (location.protocol === "file:") {
    warn.style.display = "";
    warn.textContent = "⚠ Site ouvert en local (file://) : ce lien ne s'ouvrira automatiquement que si le joueur a une copie du site à l'identique. Sinon, fais-lui plutôt scanner ce QR depuis la page « Ma fiche » elle-même (bouton Scanner), ou envoie-lui le lien copié tel quel.";
  } else if (url.length > 1900) {
    warn.style.display = "";
    warn.textContent = `⚠ Fiche volumineuse (${url.length} caractères) : le QR peut être difficile à scanner. Privilégie l'export JSON pour ce personnage si besoin.`;
  } else {
    warn.style.display = "none";
  }
  openForm("qr-modal");
}

function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(() => toast(msg || "Copié"), () => toast("Impossible de copier automatiquement"));
}

// ---------------- Scanner un QR pour mettre à jour une fiche (sens joueur -> MJ) ----------------
let editeurScanAnim = null;

function openScanUpdateForm() {
  openForm("scan-update-modal");
  startEditeurScan();
}

async function startEditeurScan() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = document.getElementById("scan-update-video");
    video.srcObject = stream;
    await video.play();
    editeurScanLoop();
  } catch (e) {
    toast("Caméra indisponible sur ce navigateur");
  }
}

function editeurScanLoop() {
  const video = document.getElementById("scan-update-video");
  const canvas = document.getElementById("scan-update-canvas");
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      stopEditeurScan();
      handleScannedPersonnage(code.data);
      return;
    }
  }
  editeurScanAnim = requestAnimationFrame(editeurScanLoop);
}

function stopEditeurScan() {
  if (editeurScanAnim) cancelAnimationFrame(editeurScanAnim);
  const video = document.getElementById("scan-update-video");
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  closeForm("scan-update-modal");
}

function decodeScannedText(raw) {
  const text = (raw || "").trim();
  const hashMatch = text.match(/#import=(.+)$/);
  const candidate = hashMatch ? decodeURIComponent(hashMatch[1]) : text;
  try {
    const parsed = JSON.parse(candidate);
    if (parsed && parsed.nom) return parsed;
    if (parsed && Array.isArray(parsed.personnages) && parsed.personnages.length) return parsed.personnages[0];
  } catch (e) { /* pas du JSON brut */ }
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(candidate);
    if (decompressed) {
      const parsed = JSON.parse(decompressed);
      if (parsed && parsed.nom) return parsed;
    }
  } catch (e) { /* échec silencieux */ }
  return null;
}

function handleScannedPersonnage(rawText) {
  const p = decodeScannedText(rawText);
  if (!p || !p.id) { toast("QR illisible ou fiche sans id — vérifie qu'elle vient bien de ce site"); return; }
  const idx = DATA.personnages.findIndex(x => x.id === p.id);
  if (idx >= 0) { DATA.personnages[idx] = p; toast(`Fiche « ${p.nom} » mise à jour`); }
  else { DATA.personnages.push(p); toast(`Fiche « ${p.nom} » ajoutée`); }
  persist();
}

// ============================================================
// LIEUX
// ============================================================
function renderLieuxList() {
  const c = document.getElementById("list-lieux");
  c.innerHTML = "";
  if (!DATA.lieux.length) { c.innerHTML = `<p class="section-note">Aucun lieu.</p>`; return; }
  DATA.lieux.forEach(l => {
    const zone = DATA.zones.find(z => z.id === l.zoneId);
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="info">
        <div class="t">${escapeHtml(l.nom)}</div>
        <div class="s">${escapeHtml(zone ? zone.nom : "sans zone")}</div>
      </div>
      <div class="actions">
        <a class="btn small" href="zones/lieu.html?id=${encodeURIComponent(l.id)}" target="_blank">Voir</a>
        <button class="btn small" onclick="openLieuForm('${l.id}')">Modifier</button>
        <button class="btn small danger" onclick="deleteLieu('${l.id}')">Supprimer</button>
      </div>`;
    c.appendChild(row);
  });
}

function addCaracteristiqueRow(label, valeur) {
  const c = document.getElementById("lf-caracteristiques");
  const row = document.createElement("div");
  row.className = "dyn-row";
  row.innerHTML = `
    <input type="text" class="cr-label" placeholder="Libellé (ex : Gravité)" value="${escapeHtml(label || "")}" style="flex:1;">
    <input type="text" class="cr-valeur" placeholder="Valeur" value="${escapeHtml(valeur || "")}" style="flex:2;">
    <button class="btn small danger rm" type="button" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(row);
}

let poiCounter = 0;
function addPointInteretRow(nom, image, description) {
  poiCounter++;
  const fileId = "poi-file-" + poiCounter;
  const c = document.getElementById("lf-points-interet");
  const row = document.createElement("div");
  row.className = "form-box active";
  row.style.borderLeftColor = "var(--amber)";
  row.innerHTML = `
    <div class="field-row">
      <div class="field" style="flex:2;"><label>Nom</label><input type="text" class="poi-nom" value="${escapeHtml(nom || "")}"></div>
    </div>
    <div class="field"><label>Image</label>
      <div class="file-drop" onclick="document.getElementById('${fileId}').click()">Cliquer pour choisir une image</div>
      <input type="file" id="${fileId}" accept="image/*" style="display:none">
      <img class="file-preview poi-preview ${image ? "show" : ""}" src="${image ? portraitSrc(image) : ""}">
      <input type="hidden" class="poi-image-data" value="${image || ""}">
    </div>
    <div class="field"><label>Description</label><textarea class="poi-description" style="min-height:70px;">${escapeHtml(description || "")}</textarea></div>
    <div class="toolbar"><button class="btn small danger" type="button" onclick="this.closest('.form-box').remove()">✕ Retirer ce point d'intérêt</button></div>
  `;
  c.appendChild(row);
  row.querySelector("#" + fileId).addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 700, 0.82, function (dataUrl) {
      row.querySelector(".poi-image-data").value = dataUrl;
      const prev = row.querySelector(".poi-preview");
      prev.src = dataUrl;
      prev.classList.add("show");
    });
  });
}

document.getElementById("lf-image-file").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  resizeImageFile(file, 1000, 0.85, function (dataUrl) {
    document.getElementById("lf-image-data").value = dataUrl;
    const preview = document.getElementById("lf-image-preview");
    preview.src = dataUrl;
    preview.classList.add("show");
  });
});

function openLieuForm(id) {
  fillSelect(document.getElementById("lf-zone"), DATA.zones, null);
  const l = id ? DATA.lieux.find(x => x.id === id) : null;
  document.getElementById("lf-title").textContent = l ? "Modifier : " + l.nom : "Nouveau lieu";
  document.getElementById("lf-id").value = id || "";
  document.getElementById("lf-nom").value = l ? l.nom : "";
  document.getElementById("lf-zone").value = l ? l.zoneId : (DATA.zones[0] ? DATA.zones[0].id : "");
  document.getElementById("lf-description").value = l ? l.description || "" : "";

  document.getElementById("lf-image-data").value = "";
  const preview = document.getElementById("lf-image-preview");
  preview.classList.remove("show");
  if (l && l.image) { preview.src = portraitSrc(l.image); preview.classList.add("show"); document.getElementById("lf-image-data").value = l.image; }

  document.getElementById("lf-caracteristiques").innerHTML = "";
  if (l && l.caracteristiques && l.caracteristiques.length) {
    l.caracteristiques.forEach(c => addCaracteristiqueRow(c.label, c.valeur));
  } else {
    // Nouveau lieu OU lieu existant sans caractéristiques : on propose la structure standard
    // (il suffit alors de remplir les valeurs).
    DEFAULT_LIEU_CARACTERISTIQUES.forEach(label => addCaracteristiqueRow(label, ""));
  }

  document.getElementById("lf-points-interet").innerHTML = "";
  (l && l.points_interet ? l.points_interet : []).forEach(p => addPointInteretRow(p.nom, p.image, p.description));

  openForm("form-lieu");
}

function saveLieu() {
  const nom = document.getElementById("lf-nom").value.trim();
  if (!nom) { toast("Le nom est obligatoire"); return; }
  const existingId = document.getElementById("lf-id").value;
  const id = existingId || uniqueId(nom, DATA.lieux.map(l => l.id));

  const caracteristiques = [];
  document.querySelectorAll("#lf-caracteristiques .dyn-row").forEach(row => {
    const label = row.querySelector(".cr-label").value.trim();
    const valeur = row.querySelector(".cr-valeur").value.trim();
    if (label) caracteristiques.push({ label, valeur });
  });

  const points_interet = [];
  document.querySelectorAll("#lf-points-interet .form-box").forEach((row, i) => {
    const pnom = row.querySelector(".poi-nom").value.trim();
    if (!pnom) return;
    points_interet.push({
      id: uid("poi"),
      nom: pnom,
      image: row.querySelector(".poi-image-data").value || "",
      description: row.querySelector(".poi-description").value.trim()
    });
  });

  const obj = {
    id, nom,
    zoneId: document.getElementById("lf-zone").value,
    description: document.getElementById("lf-description").value.trim(),
    image: document.getElementById("lf-image-data").value || "",
    caracteristiques, points_interet
  };
  const idx = DATA.lieux.findIndex(l => l.id === id);
  if (idx >= 0) DATA.lieux[idx] = obj; else DATA.lieux.push(obj);
  closeForm("form-lieu");
  persist();
}

function deleteLieu(id) {
  if (!confirm("Supprimer ce lieu ? Les personnages qui y sont rattachés ne seront pas supprimés.")) return;
  DATA.lieux = DATA.lieux.filter(l => l.id !== id);
  persist();
}

// ============================================================
// UNITÉS
// ============================================================
function renderUnitesList() {
  const c = document.getElementById("list-unites");
  c.innerHTML = "";
  if (!DATA.unites.length) { c.innerHTML = `<p class="section-note">Aucune unité.</p>`; return; }
  DATA.unites.forEach(u => {
    const org = DATA.organisations.find(o => o.id === u.orgId);
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="info">
        <div class="t">${escapeHtml(u.nom)}</div>
        <div class="s">${escapeHtml(org ? org.nom : "sans organisation")}</div>
      </div>
      <div class="actions">
        <a class="btn small" href="cellules/unite.html?id=${encodeURIComponent(u.id)}" target="_blank">Voir</a>
        <button class="btn small" onclick="openUniteForm('${u.id}')">Modifier</button>
        <button class="btn small danger" onclick="deleteUnite('${u.id}')">Supprimer</button>
      </div>`;
    c.appendChild(row);
  });
}

function openUniteForm(id) {
  fillSelect(document.getElementById("uf-org"), DATA.organisations, null);
  const u = id ? DATA.unites.find(x => x.id === id) : null;
  document.getElementById("uf-title").textContent = u ? "Modifier : " + u.nom : "Nouvelle unité";
  document.getElementById("uf-id").value = id || "";
  document.getElementById("uf-nom").value = u ? u.nom : "";
  document.getElementById("uf-org").value = u ? u.orgId : (DATA.organisations[0] ? DATA.organisations[0].id : "");
  document.getElementById("uf-description").value = u ? u.description || "" : "";
  openForm("form-unite");
}

function saveUnite() {
  const nom = document.getElementById("uf-nom").value.trim();
  if (!nom) { toast("Le nom est obligatoire"); return; }
  const existingId = document.getElementById("uf-id").value;
  const id = existingId || uniqueId(nom, DATA.unites.map(u => u.id));
  const obj = { id, nom, orgId: document.getElementById("uf-org").value, description: document.getElementById("uf-description").value.trim() };
  const idx = DATA.unites.findIndex(u => u.id === id);
  if (idx >= 0) DATA.unites[idx] = obj; else DATA.unites.push(obj);
  closeForm("form-unite");
  persist();
}

function deleteUnite(id) {
  if (!confirm("Supprimer cette unité ? Les personnages qui y sont rattachés ne seront pas supprimés.")) return;
  DATA.unites = DATA.unites.filter(u => u.id !== id);
  persist();
}

// ============================================================
// ZONES
// ============================================================
function renderZonesList() {
  const c = document.getElementById("list-zones");
  c.innerHTML = "";
  DATA.zones.forEach(z => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="info"><div class="t">${escapeHtml(z.nom)}</div><div class="s">${escapeHtml(z.description || "")}</div></div>
      <div class="actions">
        <a class="btn small" href="zones/amas-de-minos.html" target="_blank">Voir</a>
        <button class="btn small" onclick="openZoneForm('${z.id}')">Modifier</button>
        <button class="btn small danger" onclick="deleteZone('${z.id}')">Supprimer</button>
      </div>`;
    c.appendChild(row);
  });
}
function openZoneForm(id) {
  const z = id ? DATA.zones.find(x => x.id === id) : null;
  document.getElementById("zf-title").textContent = z ? "Modifier : " + z.nom : "Nouvelle zone";
  document.getElementById("zf-id").value = id || "";
  document.getElementById("zf-nom").value = z ? z.nom : "";
  document.getElementById("zf-description").value = z ? z.description || "" : "";
  openForm("form-zone");
}
function saveZone() {
  const nom = document.getElementById("zf-nom").value.trim();
  if (!nom) { toast("Le nom est obligatoire"); return; }
  const existingId = document.getElementById("zf-id").value;
  const id = existingId || uniqueId(nom, DATA.zones.map(z => z.id));
  const obj = { id, nom, description: document.getElementById("zf-description").value.trim() };
  const idx = DATA.zones.findIndex(z => z.id === id);
  if (idx >= 0) DATA.zones[idx] = obj; else DATA.zones.push(obj);
  closeForm("form-zone");
  persist();
}
function deleteZone(id) {
  if (!confirm("Supprimer cette zone ? Les lieux qui y sont rattachés ne seront pas supprimés.")) return;
  DATA.zones = DATA.zones.filter(z => z.id !== id);
  persist();
}

// ============================================================
// ORGANISATIONS
// ============================================================
function renderOrgsList() {
  const c = document.getElementById("list-orgs");
  c.innerHTML = "";
  DATA.organisations.forEach(o => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="info"><div class="t">${escapeHtml(o.nom)}</div><div class="s">${escapeHtml(o.description || "")}</div></div>
      <div class="actions">
        <a class="btn small" href="zones/rebellion-de-minos.html" target="_blank">Voir</a>
        <button class="btn small" onclick="openOrgForm('${o.id}')">Modifier</button>
        <button class="btn small danger" onclick="deleteOrg('${o.id}')">Supprimer</button>
      </div>`;
    c.appendChild(row);
  });
}
function openOrgForm(id) {
  const o = id ? DATA.organisations.find(x => x.id === id) : null;
  document.getElementById("of-title").textContent = o ? "Modifier : " + o.nom : "Nouvelle organisation";
  document.getElementById("of-id").value = id || "";
  document.getElementById("of-nom").value = o ? o.nom : "";
  document.getElementById("of-description").value = o ? o.description || "" : "";
  openForm("form-org");
}
function saveOrg() {
  const nom = document.getElementById("of-nom").value.trim();
  if (!nom) { toast("Le nom est obligatoire"); return; }
  const existingId = document.getElementById("of-id").value;
  const id = existingId || uniqueId(nom, DATA.organisations.map(o => o.id));
  const obj = { id, nom, description: document.getElementById("of-description").value.trim() };
  const idx = DATA.organisations.findIndex(o => o.id === id);
  if (idx >= 0) DATA.organisations[idx] = obj; else DATA.organisations.push(obj);
  closeForm("form-org");
  persist();
}
function deleteOrg(id) {
  if (!confirm("Supprimer cette organisation ? Les unités qui y sont rattachées ne seront pas supprimées.")) return;
  DATA.organisations = DATA.organisations.filter(o => o.id !== id);
  persist();
}

// ============================================================
// SAUVEGARDE
// ============================================================
document.getElementById("import-file").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  importDataFromFile(file, async (ok) => {
    if (ok) { DATA = await loadData(); refreshAll(); toast("Import réussi"); }
    else toast("Fichier invalide");
  });
});

document.getElementById("merge-file").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  mergeDataFromFile(file, async (ok, rapport) => {
    if (ok) {
      DATA = await loadData();
      refreshAll();
      const total = Object.values(rapport).reduce((s, r) => s + r.ajoutes, 0);
      const ignores = Object.values(rapport).reduce((s, r) => s + r.ignores, 0);
      toast(`Import en complément : ${total} élément(s) ajouté(s)${ignores ? `, ${ignores} déjà présent(s) ignoré(s)` : ""}`, 4000);
    } else {
      toast("Fichier invalide");
    }
  });
  e.target.value = "";
});

document.getElementById("sync-file").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  upsertDataFromFile(file, async (ok, rapport) => {
    if (ok) {
      DATA = await loadData();
      refreshAll();
      const ajoutes = Object.values(rapport).reduce((s, r) => s + r.ajoutes, 0);
      const maj = Object.values(rapport).reduce((s, r) => s + r.mis_a_jour, 0);
      toast(`Synchronisation : ${maj} fiche(s) mise(s) à jour, ${ajoutes} ajoutée(s)`, 4000);
    } else {
      toast("Fichier invalide");
    }
  });
  e.target.value = "";
});

async function doReset() {
  if (!confirm("Réinitialiser TOUTES les données aux données de départ ? Cette action est irréversible (pensez à exporter avant si besoin).")) return;
  await resetData();
  DATA = await loadData();
  refreshAll();
  toast("Données réinitialisées");
}

async function doRemoveByPrefix() {
  const prefix = document.getElementById("prefix-remove-input").value.trim();
  if (!prefix) { toast("Indiquez un préfixe d'id"); return; }
  const matches = DATA.personnages.filter(p => p.id.startsWith(prefix));
  if (!matches.length) { toast(`Aucun personnage avec l'id commençant par « ${prefix} »`); return; }
  if (!confirm(`Supprimer ${matches.length} personnage(s) dont l'id commence par « ${prefix} » ? Cette action est irréversible (pensez à exporter avant si besoin).`)) return;
  DATA.personnages = DATA.personnages.filter(p => !p.id.startsWith(prefix));
  await saveData(DATA);
  refreshAll();
  toast(`${matches.length} personnage(s) supprimé(s)`);
}

// ============================================================
function refreshAll() {
  renderPersonnagesList();
  renderLieuxList();
  renderUnitesList();
  renderZonesList();
  renderOrgsList();
}

async function initEditeur() {
  DATA = await loadData();
  refreshAll();
}
initEditeur();
