// ============================================================
// PARTAGE PAR QR — construction sûre du contenu + rendu du QR,
// avec repli automatique si la fiche est trop volumineuse.
// Partagé entre l'éditeur (MJ) et la page Ma fiche (joueur).
// ============================================================

// Marge de sécurité sous la limite réelle du générateur QR (niveau L, ~2953 octets
// en mode "byte" — nos chaînes compressées mélangent majuscules/minuscules/symboles,
// donc pas d'optimisation alphanumérique possible côté bibliothèque).
const QR_MAX_SAFE_LENGTH = 2700;

// Construit le texte à encoder, en réduisant progressivement le contenu de la fiche
// si nécessaire (historique, puis descriptions de capacités/détails d'armes, puis un
// résumé minimal ne gardant que l'essentiel jouable). urlPrefix (optionnel) est ajouté
// tel quel avant la partie compressée.
function buildQrText(p, urlPrefix) {
  const essentiel = {
    id: p.id, nom: p.nom, type: p.type, uniteId: p.uniteId,
    race: p.race, carriere: p.carriere, specialisation: p.specialisation,
    caracteristiques: p.caracteristiques, competences: p.competences,
    enc: p.enc, defense_cac: p.defense_cac, defense_dist: p.defense_dist,
    sante_max: p.sante_max, stress_max: p.stress_max
  };
  const variants = [
    p,
    { ...p, historique: "" },
    { ...p, historique: "", capacites_speciales: (p.capacites_speciales || []).map(c => ({ nom: c.nom, description: "" })) },
    { ...p, historique: "", capacites_speciales: [], armes: (p.armes || []).map(a => ({ nom: a.nom, competence: a.competence, degat: a.degat, critique: a.critique })) },
    essentiel
  ];
  for (let i = 0; i < variants.length; i++) {
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(variants[i]));
    const text = (urlPrefix || "") + compressed;
    if (text.length <= QR_MAX_SAFE_LENGTH) {
      return { text, trimmed: i > 0, essentielOnly: i === variants.length - 1, length: text.length };
    }
  }
  return null;
}

// Génère le QR dans containerEl à partir du résultat de buildQrText, et affiche un
// message clair dans warnEl selon le cas (rien à signaler / réduit / trop gros / erreur).
function renderQrOrWarn(containerEl, warnEl, result) {
  containerEl.innerHTML = "";
  if (!result) {
    warnEl.style.display = "";
    warnEl.textContent = "⚠ Cette fiche est trop volumineuse pour tenir dans un QR, même réduite. Utilise « Copier le lien » ou « Exporter » (fichier JSON) à la place.";
    return false;
  }
  try {
    new QRCode(containerEl, { text: result.text, width: 320, height: 320, correctLevel: QRCode.CorrectLevel.L });
  } catch (e) {
    console.error(e);
    warnEl.style.display = "";
    warnEl.textContent = "⚠ Erreur de génération du QR — utilise « Copier le lien » à la place.";
    return false;
  }
  if (result.essentielOnly) {
    warnEl.style.display = "";
    warnEl.textContent = "ℹ Fiche très volumineuse : seul l'essentiel jouable (caractéristiques, compétences, PV/Stress/Défense) tient dans ce QR — armes, capacités et historique sont omis ici mais restent dans l'export JSON complet.";
  } else if (result.trimmed) {
    warnEl.style.display = "";
    warnEl.textContent = "ℹ Fiche volumineuse : l'historique (et si besoin les descriptions de capacités/armes) a été omis de ce QR pour qu'il reste scannable. Ces informations restent intactes dans l'export JSON complet.";
  } else if (result.length > 1200) {
    warnEl.style.display = "";
    warnEl.textContent = `⚠ QR assez dense (${result.length} caractères) : agrandis la fenêtre du navigateur ou utilise « Copier le lien » si le scan échoue.`;
  } else {
    warnEl.style.display = "none";
  }
  return true;
}
