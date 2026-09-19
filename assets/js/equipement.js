// ============================================================
// ÉQUIPEMENT — recherche, filtres, affichage inline
// + valeurs complétées à la main (Encombrement, Points de modification)
//   sauvegardées dans le navigateur (localStorage), indépendamment
//   du référentiel figé EQUIPEMENT_DATA.
// ============================================================

const EQUIP_OVERRIDES_KEY = "minos_equip_overrides_v1";
let eqSelectedId = null;
let eqOverrides = {};

function eqLoadOverrides() {
  try {
    eqOverrides = JSON.parse(localStorage.getItem(EQUIP_OVERRIDES_KEY)) || {};
  } catch (e) {
    eqOverrides = {};
  }
}

function eqSaveOverrides() {
  try {
    localStorage.setItem(EQUIP_OVERRIDES_KEY, JSON.stringify(eqOverrides));
  } catch (e) {
    toast("Échec de la sauvegarde (stockage plein ?)");
  }
}

function eqSetOverride(id, field, value) {
  const v = value.trim();
  if (!eqOverrides[id]) eqOverrides[id] = {};
  if (v === "") {
    delete eqOverrides[id][field];
    if (Object.keys(eqOverrides[id]).length === 0) delete eqOverrides[id];
  } else {
    eqOverrides[id][field] = v;
  }
  eqSaveOverrides();
  toast("Enregistré");
  eqRenderListOnly(); // met à jour les badges Enc dans la liste sans perdre le focus du champ
}

function eqExportOverrides() {
  const count = Object.keys(eqOverrides).length;
  if (!count) { toast("Aucune valeur à exporter pour l'instant"); return; }
  const blob = new Blob([JSON.stringify(eqOverrides, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reseau-minos-equipement.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`${count} objet(s) exporté(s)`);
}

function eqImportOverrides(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    let incoming;
    try {
      incoming = JSON.parse(e.target.result);
    } catch (err) {
      toast("Fichier JSON invalide");
      return;
    }
    let added = 0;
    for (const id in incoming) {
      if (!EQUIPEMENT_DATA.some(it => it.id === id)) continue; // ignore les id inconnus (base d'objets différente)
      eqOverrides[id] = Object.assign({}, eqOverrides[id] || {}, incoming[id]);
      added++;
    }
    eqSaveOverrides();
    eqRenderListOnly();
    if (eqSelectedId) eqSelect(eqSelectedId); // rafraîchit le détail si un objet est ouvert
    toast(`Import réussi : ${added} objet(s) fusionné(s)`);
  };
  reader.readAsText(file);
}

function eqResetOverrides() {
  if (!Object.keys(eqOverrides).length) { toast("Rien à réinitialiser"); return; }
  if (!confirm("Effacer toutes les valeurs d'encombrement / HP saisies dans ce navigateur ? Pensez à exporter avant si besoin.")) return;
  eqOverrides = {};
  eqSaveOverrides();
  eqRenderListOnly();
  if (eqSelectedId) eqSelect(eqSelectedId);
  toast("Valeurs réinitialisées");
}

function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window._eqToastTimer);
  window._eqToastTimer = setTimeout(() => t.classList.remove("show"), 1600);
}

function eqInit() {
  eqLoadOverrides();

  const selCat = document.getElementById("eq-categorie");
  EQUIPEMENT_CATEGORIES.forEach(c => {
    selCat.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  });

  const selPub = document.getElementById("eq-public");
  EQUIPEMENT_PUBLICS.forEach(p => {
    selPub.innerHTML += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
  });

  document.getElementById("eq-search").addEventListener("input", eqRender);
  selCat.addEventListener("change", eqRender);
  selPub.addEventListener("change", eqRender);
  document.getElementById("eq-tri").addEventListener("change", eqRender);

  document.getElementById("eq-import-file").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) eqImportOverrides(file);
    e.target.value = ""; // permet de réimporter le même fichier plus tard si besoin
  });

  eqRender();
}

function eqFormatCout(item) {
  if (item.cout === null) return item.coutTxt || "—";
  return item.cout.toLocaleString("fr-FR") + " cr.";
}

function eqFormatRarete(item) {
  return item.rareteTxt || "—";
}

function eqFilteredSorted() {
  const q = document.getElementById("eq-search").value.trim().toLowerCase();
  const cat = document.getElementById("eq-categorie").value;
  const pub = document.getElementById("eq-public").value;
  const tri = document.getElementById("eq-tri").value;

  let list = EQUIPEMENT_DATA.filter(it => {
    if (cat && !it.categories.includes(cat)) return false;
    if (pub && !it.publics.includes(pub)) return false;
    if (q) {
      const hay = (it.nomFr + " " + it.nomEn + " " + it.effet).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const rareteNum = it => (it.rarete === null ? -1 : it.rarete);
  const coutNum = it => (it.cout === null ? -1 : it.cout);

  switch (tri) {
    case "cout-asc": list.sort((a, b) => coutNum(a) - coutNum(b)); break;
    case "cout-desc": list.sort((a, b) => coutNum(b) - coutNum(a)); break;
    case "rarete-asc": list.sort((a, b) => rareteNum(a) - rareteNum(b)); break;
    case "rarete-desc": list.sort((a, b) => rareteNum(b) - rareteNum(a)); break;
    default: list.sort((a, b) => a.nomFr.localeCompare(b.nomFr, "fr")); break;
  }

  return list;
}

function eqRenderRow(it) {
  const ov = eqOverrides[it.id] || {};
  return `
    <div class="equip-row ${it.id === eqSelectedId ? "active" : ""}" onclick="eqSelect('${it.id}')">
      <div class="er-main">
        <div class="er-nom">${escapeHtml(it.nomFr)}</div>
        <div class="er-cats">${escapeHtml(it.categories.join(" · "))}</div>
      </div>
      <div class="er-meta">
        ${ov.enc ? `<span class="er-enc">Enc ${escapeHtml(ov.enc)}</span>` : ""}
        <span class="er-cout">${escapeHtml(eqFormatCout(it))}</span>
        <span class="er-rarete">R${escapeHtml(eqFormatRarete(it))}</span>
      </div>
    </div>
  `;
}

// Liste courante affichée, pour un refresh léger après édition sans re-filtrer
let eqCurrentList = [];

function eqRender() {
  eqCurrentList = eqFilteredSorted();
  document.getElementById("eq-count").textContent =
    `${eqCurrentList.length} objet${eqCurrentList.length > 1 ? "s" : ""} trouvé${eqCurrentList.length > 1 ? "s" : ""} sur ${EQUIPEMENT_DATA.length}`;
  eqRenderListOnly();
}

function eqRenderListOnly() {
  const box = document.getElementById("eq-list");
  if (!eqCurrentList.length) {
    box.innerHTML = `<p class="ed-empty" style="padding:14px 0;">Aucun objet ne correspond à ces critères.</p>`;
    return;
  }
  box.innerHTML = eqCurrentList.map(eqRenderRow).join("");
}

function eqSelect(id) {
  eqSelectedId = id;
  const it = EQUIPEMENT_DATA.find(x => x.id === id);
  const detail = document.getElementById("eq-detail");
  if (!it) {
    detail.innerHTML = `<p class="ed-empty">Sélectionnez un objet dans la liste pour afficher ses caractéristiques.</p>`;
    return;
  }
  const ov = eqOverrides[it.id] || {};

  detail.innerHTML = `
    <h3>${escapeHtml(it.nomFr)}</h3>
    <div class="ed-en">${escapeHtml(it.nomEn)}</div>
    <div class="ed-badges">
      ${it.categories.map(c => `<span class="tag-pill">${escapeHtml(c)}</span>`).join("")}
      <span class="badge ok">Coût ${escapeHtml(eqFormatCout(it))}</span>
      <span class="badge avarie">Rareté ${escapeHtml(eqFormatRarete(it))}</span>
    </div>
    <div class="ed-editable-row">
      <div class="ed-editable">
        <label>Encombrement</label>
        <input type="text" value="${escapeHtml(ov.enc || "")}" placeholder="—"
               onchange="eqSetOverride('${it.id}','enc', this.value)">
      </div>
      <div class="ed-editable">
        <label>Points de modification (HP)</label>
        <input type="text" value="${escapeHtml(ov.hp || "")}" placeholder="—"
               onchange="eqSetOverride('${it.id}','hp', this.value)">
      </div>
    </div>
    <p class="section-note" style="margin:-4px 0 14px;">Renseignés à la main depuis la page source ci-dessous — sauvegardés automatiquement dans ce navigateur.</p>
    ${nl2p(it.effet).replace(/<p>/g, '<p class="ed-effet-p" style="font-size:13px; color:var(--ink); line-height:1.6; margin:0 0 12px;">')}
    ${it.publics.length ? `<div class="section-note" style="margin:0 0 14px;"><strong style="color:var(--ink-dim);">Public cible :</strong> ${escapeHtml(it.publics.join(" · "))}</div>` : ""}
    ${it.lien ? `<a class="ed-link" href="${escapeHtml(it.lien)}" target="_blank" rel="noopener">Voir la fiche source ↗</a>` : ""}
  `;

  eqRenderListOnly();
}

document.addEventListener("DOMContentLoaded", eqInit);
