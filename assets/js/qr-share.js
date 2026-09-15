// ============================================================
// PARTAGE PAR QR — construction sûre du contenu + rendu du QR,
// avec repli automatique si la fiche est trop volumineuse.
// Partagé entre l'éditeur (MJ) et la page Ma fiche (joueur).
// ============================================================

// Marge de sécurité sous la limite réelle du générateur QR (niveau L, ~2953 octets),
// pour rester fiable à scanner même sur un écran (et pas juste "ne pas planter").
const QR_MAX_SAFE_LENGTH = 1800;

// Construit le texte à encoder, en réduisant progressivement le contenu de la fiche
// si nécessaire (historique, puis descriptions de capacités, puis détails d'armes).
// urlPrefix (optionnel) est ajouté tel quel avant la partie compressée.
function buildQrText(p, urlPrefix) {
  const variants = [
    p,
    { ...p, historique: "" },
    { ...p, historique: "", capacites_speciales: (p.capacites_speciales || []).map(c => ({ nom: c.nom, description: "" })) },
    { ...p, historique: "", capacites_speciales: [], armes: (p.armes || []).map(a => ({ nom: a.nom, competence: a.competence, degat: a.degat, critique: a.critique })) }
  ];
  for (let i = 0; i < variants.length; i++) {
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(variants[i]));
    const text = (urlPrefix || "") + compressed;
    if (text.length <= QR_MAX_SAFE_LENGTH) {
      return { text, trimmed: i > 0, length: text.length };
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
  if (result.trimmed) {
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
