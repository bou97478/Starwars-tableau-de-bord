// ============================================================
// RENDU — fonctions partagées pour construire le DOM à partir des données
// ============================================================

function qParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function portraitSrc(p) {
  if (!p) return "";
  if (p.startsWith("data:")) return p;
  return ROOT + p;
}

function el(tag, attrs, html) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nl2p(text) {
  if (!text) return "";
  return text.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

// ---------- Dés colorés ----------
function diceIconsHtml(yellow, green) {
  let html = '<span class="dice">';
  for (let i = 0; i < yellow; i++) html += '<span class="die-prof"></span>';
  for (let i = 0; i < green; i++) html += '<span class="die-ability"></span>';
  html += '</span>';
  return html;
}

// ---------- Grille de "nœuds" (zones/lieux, organisations/unités) ----------
function renderNodeGrid(container, items, opts) {
  // items: [{id, nom, description, tag, href, empty}]
  container.innerHTML = "";
  items.forEach(item => {
    const a = document.createElement("a");
    a.className = "node-card" + (item.empty ? " empty" : "");
    a.href = item.href;
    a.innerHTML = `
      ${item.idx ? `<div class="idx">${escapeHtml(item.idx)}</div>` : ""}
      <h3>${escapeHtml(item.nom)}</h3>
      <p>${escapeHtml(item.description) || "Fiche non renseignée."}</p>
      <span class="tag">${escapeHtml(item.tag || "")}</span>
    `;
    container.appendChild(a);
  });
}

// ---------- Galerie de personnages ----------
function renderCharGrid(container, personnages) {
  container.innerHTML = "";
  if (!personnages.length) {
    container.innerHTML = `<p class="section-note">Aucun personnage recensé pour l'instant.</p>`;
    return;
  }
  personnages.forEach(p => {
    const a = document.createElement("a");
    a.className = "char-card";
    a.href = ROOT + "personnages/personnage.html?id=" + encodeURIComponent(p.id);
    const roleLine = [p.carriere, p.specialisation].filter(Boolean).join(" — ");
    if (p.portrait) {
      a.innerHTML = `
        <img class="portrait" src="${portraitSrc(p.portrait)}" alt="${escapeHtml(p.nom)}">
        <div class="cap"><div class="name">${escapeHtml(p.nom)}</div><div class="role">${escapeHtml(roleLine)}</div></div>`;
    } else {
      a.innerHTML = `
        <div class="portrait placeholder">DOSSIER<br>NON OUVERT</div>
        <div class="cap"><div class="name">${escapeHtml(p.nom)}</div><div class="role">${escapeHtml(roleLine) || "rôle à confirmer"}</div></div>`;
    }
    container.appendChild(a);
  });
}

// ---------- Fiche personnage complète ----------
function renderCharacterSheet(container, p) {
  const roleLine = [p.race, p.carriere, p.specialisation].filter(Boolean).join(" · ");
  const isSbires = p.type === "sbires";
  const isVaisseau = p.type === "vaisseau";

  let statsHtml = `<p class="section-note">Non renseignées — à compléter.</p>`;
  let skillsHtml = "";
  if (isVaisseau) {
    statsHtml = `<div class="stat-grid">
        <div class="stat"><div class="label">Gabarit</div><div class="value">${p.gabarit ?? "—"}</div></div>
        <div class="stat"><div class="label">Vitesse</div><div class="value">${p.vitesse ?? "—"}</div></div>
        <div class="stat"><div class="label">Manœuvrabilité</div><div class="value">${p.manoeuvrabilite ?? 0}</div></div>
      </div>`;
    const rows = Object.keys(p.competences || {}).filter(k => p.competences[k] > 0).map(k => {
      const rang = p.competences[k];
      return `<div class="skill-row"><span class="sname">${escapeHtml(k)}</span>${diceIconsHtml(0, rang)}</div>`;
    }).join("");
    skillsHtml = rows
      ? `<div class="section-title"><h2>Compétences du vaisseau</h2><div class="rule"></div></div>
         <p class="section-note">Le rang de compétence est utilisé directement en dés de Capacité (pas de caractéristique de vaisseau).</p>
         <div class="skills">${rows}</div>`
      : `<div class="section-title"><h2>Compétences du vaisseau</h2><div class="rule"></div></div><p class="section-note">Aucune compétence renseignée.</p>`;
  } else if (isSbires) {
    const c = p.caracteristiques || {};
    statsHtml = `<div class="stat-grid">` + CARAC_ORDER.map(k => `
      <div class="stat">
        <div class="label">${CARAC_LABELS[k]}</div>
        <div class="value">${c[k] ?? 0}</div>
      </div>`).join("") + `</div>`;

    const nombre = p.nombre_sbires || 1;
    const rangAuto = Math.max(0, nombre - 1);
    const rows = Object.keys(p.competences || {}).map(k => {
      const carac = skillCarac(k);
      const { yellow, green } = dicePool(c[carac] || 0, rangAuto);
      return `<div class="skill-row"><span class="sname">${escapeHtml(k)} <span style="color:var(--ink-dim)">(${CARAC_LABELS[carac] || "?"})</span></span>${diceIconsHtml(yellow, green)}</div>`;
    }).join("");
    skillsHtml = rows
      ? `<div class="section-title"><h2>Compétences du groupe</h2><div class="rule"></div></div>
         <p class="section-note">Rang automatique = nombre de sbires − 1 (soit ${rangAuto} pour ${nombre} sbire(s)), combiné à la caractéristique — <span class="die-prof" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></span> Maîtrise · <span class="die-ability" style="width:9px;height:9px;display:inline-block;vertical-align:-1px;"></span> Capacité.</p>
         <div class="skills">${rows}</div>`
      : `<div class="section-title"><h2>Compétences du groupe</h2><div class="rule"></div></div><p class="section-note">Aucune compétence renseignée.</p>`;
  } else if (p.caracteristiques) {
    const c = p.caracteristiques;
    statsHtml = `<div class="stat-grid">` + CARAC_ORDER.map(k => `
      <div class="stat">
        <div class="label">${CARAC_LABELS[k]}</div>
        <div class="value">${c[k] ?? 0}</div>
      </div>`).join("") + `</div>`;

    const rows = Object.keys(p.competences || {})
      .filter(k => p.competences[k] > 0)
      .map(k => {
        const carac = skillCarac(k);
        const rang = p.competences[k];
        const { yellow, green } = dicePool(c[carac] || 0, rang);
        return `<div class="skill-row"><span class="sname">${escapeHtml(k)} <span style="color:var(--ink-dim)">(${CARAC_LABELS[carac] || "?"})</span></span>${diceIconsHtml(yellow, green)}</div>`;
      }).join("");
    skillsHtml = rows
      ? `<div class="section-title"><h2>Compétences entraînées</h2><div class="rule"></div></div>
         <p class="section-note">Dés de bassin — <span class="die-prof" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></span> Maîtrise · <span class="die-ability" style="width:9px;height:9px;display:inline-block;vertical-align:-1px;"></span> Capacité.</p>
         <div class="skills">${rows}</div>`
      : `<div class="section-title"><h2>Compétences entraînées</h2><div class="rule"></div></div><p class="section-note">Aucune compétence entraînée renseignée.</p>`;
  }

  const capacites = (p.capacites_speciales || []).length
    ? p.capacites_speciales.map(c => `<p><strong>${escapeHtml(c.nom)} :</strong> ${escapeHtml(c.description)}</p>`).join("")
    : `<p style="color:var(--ink-dim)">Aucune renseignée pour l'instant.</p>`;

  const armesHtml = (p.armes || []).length
    ? `<div class="id-block">` + p.armes.map(a => `
        <div class="id-row"><span class="k">${escapeHtml(a.nom)}${a.competence ? ` <span style="color:var(--ink-dim); font-weight:400;">(${escapeHtml(a.competence)})</span>` : ""}</span><span class="v">Dégât ${a.degat ?? "—"} · Critique ${escapeHtml(a.critique) || "—"}${a.attribut ? ` · ${escapeHtml(a.attribut)}` : ""}</span></div>
      `).join("") + `</div>`
    : `<p style="color:var(--ink-dim)">Aucune arme renseignée.</p>`;

  const encDefSante = isVaisseau
    ? `<div class="stat-grid">
        <div class="stat"><div class="label">Blindage</div><div class="value">${p.enc ?? "—"}</div></div>
        <div class="stat"><div class="label">Écran avant</div><div class="value">${p.defense_cac ?? "—"}</div></div>
        <div class="stat"><div class="label">Écran arrière</div><div class="value">${p.defense_dist ?? "—"}</div></div>
        <div class="stat"><div class="label">Écran droit</div><div class="value">${p.ecran_droit ?? "—"}</div></div>
        <div class="stat"><div class="label">Écran gauche</div><div class="value">${p.ecran_gauche ?? "—"}</div></div>
        <div class="stat"><div class="label">Adversité</div><div class="value">${p.adversite ?? "—"}</div></div>
        <div class="stat"><div class="label">Points de coque max.</div><div class="value">${p.sante_max ?? "—"}</div></div>
        <div class="stat"><div class="label">Stress mécanique max.</div><div class="value">${p.stress_max ?? "—"}</div></div>
      </div>`
    : isSbires
    ? `<div class="stat-grid">
        <div class="stat"><div class="label">Encaissement</div><div class="value">${p.enc ?? "—"}</div></div>
        <div class="stat"><div class="label">Défense (CàC / Dist.)</div><div class="value">${(p.defense_cac ?? "—")} / ${(p.defense_dist ?? "—")}</div></div>
        <div class="stat"><div class="label">Adversité</div><div class="value">${p.adversite ?? "—"}</div></div>
        <div class="stat"><div class="label">Points de blessure par sbire</div><div class="value">${p.pv_individuel ?? "—"}</div></div>
        <div class="stat"><div class="label">Nombre (groupe complet)</div><div class="value">${p.nombre_sbires ?? "—"}</div></div>
      </div>`
    : (p.enc !== null && p.enc !== undefined) || (p.sante_max !== null && p.sante_max !== undefined)
    ? `<div class="stat-grid">
        <div class="stat"><div class="label">Encaissement</div><div class="value">${p.enc ?? "—"}</div></div>
        <div class="stat"><div class="label">Défense (CàC / Dist.)</div><div class="value">${(p.defense_cac ?? "—")} / ${(p.defense_dist ?? "—")}</div></div>
        <div class="stat"><div class="label">Adversité</div><div class="value">${p.adversite ?? "—"}</div></div>
        <div class="stat"><div class="label">Points de blessure max.</div><div class="value">${p.sante_max ?? "—"}</div></div>
        <div class="stat"><div class="label">Stress max.</div><div class="value">${p.stress_max ?? "—"}</div></div>
      </div>`
    : `<p class="section-note">Non renseignés — à compléter.</p>`;

  container.innerHTML = `
    <div class="dossier-head">
      ${p.obligation ? `<div class="stamp">${escapeHtml(p.obligation)}</div>` : ""}
      <div class="eyebrow">Dossier personnage${isSbires ? " — groupe de sbires" : isVaisseau ? " — vaisseau" : ""}</div>
      <h1>${escapeHtml(p.nom)}</h1>
      <p class="lead">${escapeHtml(roleLine)}</p>
    </div>

    <div class="sheet">
      <div>
        <div class="sheet-portrait">
          ${p.portrait
            ? `<img src="${portraitSrc(p.portrait)}" alt="Portrait de ${escapeHtml(p.nom)}">`
            : `<div class="portrait placeholder" style="aspect-ratio:3/4;">PORTRAIT<br>NON FOURNI</div>`}
          <div class="frame-label">Réf. visuelle — source terrain</div>
        </div>

        ${p.obligation ? `<div class="obligation"><span>Obligation / Devoir : ${escapeHtml(p.obligation)}</span></div>` : ""}

        ${isVaisseau ? `
        <div class="id-block">
          <div class="id-row"><span class="k">Hyperpropulseur</span><span class="v">${escapeHtml(p.hyperpropulseur) || "—"}</span></div>
          <div class="id-row"><span class="k">Navordinateur</span><span class="v">${escapeHtml(p.navordinateur) || "—"}</span></div>
          <div class="id-row"><span class="k">Capacité de la soute</span><span class="v">${escapeHtml(p.capaciteSoute) || "—"}</span></div>
          <div class="id-row"><span class="k">Équipage</span><span class="v">${escapeHtml(p.equipageTxt) || "—"}</span></div>
          <div class="id-row"><span class="k">Passagers</span><span class="v">${escapeHtml(p.passagersTxt) || "—"}</span></div>
          <div class="id-row"><span class="k">Autonomie</span><span class="v">${escapeHtml(p.autonomie) || "—"}</span></div>
          <div class="id-row"><span class="k">Prix</span><span class="v">${escapeHtml(p.prixTxt) || "—"}</span></div>
          <div class="id-row"><span class="k">Rareté</span><span class="v">${escapeHtml(p.rareteTxt) || "—"}</span></div>
          <div class="id-row"><span class="k">Points de personnalisation</span><span class="v">${escapeHtml(p.pointsCustomisation) || "—"}</span></div>
        </div>
        ` : `
        <div class="id-block">
          <div class="id-row"><span class="k">Race</span><span class="v">${escapeHtml(p.race) || "—"}</span></div>
          <div class="id-row"><span class="k">Sexe</span><span class="v">${escapeHtml(p.sexe) || "—"}</span></div>
          <div class="id-row"><span class="k">Âge</span><span class="v">${escapeHtml(p.age) || "Inconnu"}</span></div>
          <div class="id-row"><span class="k">Taille</span><span class="v">${escapeHtml(p.taille) || "—"}</span></div>
          <div class="id-row"><span class="k">Motivation</span><span class="v">${escapeHtml(p.motivation) || "Non renseignée"}</span></div>
        </div>
        `}

        <div class="panel-box">
          <h4>Carrière / Spécialisation</h4>
          <p><strong>${escapeHtml(p.carriere) || "—"}</strong></p>
          ${p.specialisation ? `<div class="tag-list"><span class="tag-pill">${escapeHtml(p.specialisation)}</span></div>` : ""}
        </div>
      </div>

      <div>
        <div class="panel-box italic">
          <h4>Historique</h4>
          ${nl2p(p.historique) || `<p style="color:var(--ink-dim)">En attente de transmission.</p>`}
        </div>

        <div class="section-title"><h2>${isVaisseau ? "Vaisseau" : isSbires ? "Groupe" : "Caractéristiques"}</h2><div class="rule"></div></div>
        ${statsHtml}

        ${skillsHtml}

        <div class="section-title"><h2>${isVaisseau ? "Blindage / Écrans / Coque / Stress mécanique" : "Encaissement / Défense / " + (isSbires ? "Points de blessure par sbire" : "Points de blessure / Stress")}</h2><div class="rule"></div></div>
        ${encDefSante}

        <div class="panel-box">
          <h4>Capacités spéciales</h4>
          ${capacites}
        </div>

        <div class="panel-box">
          <h4>Armes / attaques</h4>
          ${armesHtml}
        </div>
      </div>
    </div>
  `;
}

function setBreadcrumb(container, items) {
  // items: [{label, href}] dernier élément = page courante (pas de lien)
  let html = `<a href="${ROOT}index.html">racine</a>`;
  items.forEach((it, i) => {
    html += `<span class="sep">/</span>`;
    if (i === items.length - 1) html += `<span class="here">${escapeHtml(it.label)}</span>`;
    else html += `<a href="${it.href}">${escapeHtml(it.label)}</a>`;
  });
  container.innerHTML = html;
}

// ---------- Fiche de lieu (planète) ----------
function renderLieuDetail(container, lieu) {
  // On affiche toujours la structure standard d'une fiche de planète : si le lieu n'a pas
  // encore de caractéristiques renseignées, on affiche quand même les libellés habituels
  // (Type, Terrain, Atmosphère, ...) avec une valeur vide, prêts à être complétés via l'éditeur.
  const caracList = (lieu.caracteristiques && lieu.caracteristiques.length)
    ? lieu.caracteristiques
    : DEFAULT_LIEU_CARACTERISTIQUES.map(label => ({ label, valeur: "" }));

  const caracHtml = `<div class="id-block">` + caracList.map(c => `
        <div class="id-row"><span class="k">${escapeHtml(c.label)}</span><span class="v">${escapeHtml(c.valeur) || "—"}</span></div>
      `).join("") + `</div>`;

  const poiHtml = (lieu.points_interet && lieu.points_interet.length)
    ? `<div class="section-title"><h2>Points d'intérêt</h2><div class="rule"></div></div>
       <div class="poi-list">` + lieu.points_interet.map(p => `
        <div class="poi-row">
          ${p.image ? `<img class="poi-img" src="${portraitSrc(p.image)}" alt="${escapeHtml(p.nom)}">` : `<div class="poi-img placeholder">IMAGE<br>NON FOURNIE</div>`}
          <div class="poi-body">
            <h4>${escapeHtml(p.nom)}</h4>
            <p>${escapeHtml(p.description) || `<span style="color:var(--ink-dim)">Aucune description.</span>`}</p>
          </div>
        </div>
      `).join("") + `</div>`
    : "";

  const fileExt = (lieu.image && lieu.image.startsWith("data:")) ? (lieu.image.match(/^data:image\/(\w+);/) || [,"jpg"])[1] : "jpg";
  const downloadName = slugify(lieu.nom) + "." + (fileExt === "jpeg" ? "jpg" : fileExt);

  container.innerHTML = `
    <div class="lieu-header">
      <div class="lieu-carac">${caracHtml}</div>
      <div class="lieu-image">
        ${lieu.image
          ? `<a href="${portraitSrc(lieu.image)}" download="${downloadName}" title="Télécharger l'image">
               <img src="${portraitSrc(lieu.image)}" alt="${escapeHtml(lieu.nom)}">
             </a>
             <a class="lieu-image-dl" href="${portraitSrc(lieu.image)}" download="${downloadName}">⬇ Télécharger l'image</a>`
          : `<div class="lieu-image-placeholder">IMAGE<br>NON FOURNIE</div>`}
      </div>
    </div>

    <div class="panel-box italic">
      <h4>Description</h4>
      ${nl2p(lieu.description) || `<p style="color:var(--ink-dim)">Aucune description pour l'instant.</p>`}
    </div>

    ${poiHtml}
  `;
}
