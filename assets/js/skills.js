// Référentiel des compétences FFG (Edge of the Empire / Age of Rebellion / Force and Destiny)
// Chaque compétence est rattachée à une caractéristique.
const SKILLS_LIST = [
  // Vigueur
  { nom: "Athlétisme", carac: "vig" },
  { nom: "Résistance", carac: "vig" },
  { nom: "Corps à corps", carac: "vig" },
  { nom: "Pugilat", carac: "vig" },
  { nom: "Sabrelaser", carac: "vig" },
  // Agilité
  { nom: "Armes légères", carac: "agi" },
  { nom: "Armes lourdes", carac: "agi" },
  { nom: "Artillerie", carac: "agi" },
  { nom: "Coordination", carac: "agi" },
  { nom: "Discrétion", carac: "agi" },
  { nom: "Pilotage planétaire", carac: "agi" },
  { nom: "Pilotage spatial", carac: "agi" },
  // Intelligence
  { nom: "Art de la guerre", carac: "int" },
  { nom: "Astrogation", carac: "int" },
  { nom: "Informatique", carac: "int" },
  { nom: "Mécanique", carac: "int" },
  { nom: "Médecine", carac: "int" },
  { nom: "Bordure extérieure", carac: "int" },
  { nom: "Cultures", carac: "int" },
  { nom: "Education", carac: "int" },
  { nom: "Monde du noyau", carac: "int" },
  { nom: "Pègre", carac: "int" },
  { nom: "Xénobiologie", carac: "int" },
  // Ruse
  { nom: "Magouilles", carac: "rus" },
  { nom: "Perception", carac: "rus" },
  { nom: "Ressources", carac: "rus" },
  { nom: "Survie", carac: "rus" },
  { nom: "Système D", carac: "rus" },
  { nom: "Tromperie", carac: "rus" },
  // Volonté
  { nom: "Coercition", carac: "vol" },
  { nom: "Discipline", carac: "vol" },
  { nom: "Vigilance", carac: "vol" },
  { nom: "Sang-froid", carac: "vol" },
  // Présence
  { nom: "Calme", carac: "pre" },
  { nom: "Charme", carac: "pre" },
  { nom: "Commandement", carac: "pre" },
  { nom: "Négociation", carac: "pre" },
];

const CARAC_LABELS = {
  vig: "Vigueur", agi: "Agilité", int: "Intelligence",
  rus: "Ruse", vol: "Volonté", pre: "Présence"
};

const CARAC_ORDER = ["vig", "agi", "int", "rus", "vol", "pre"];

// Calcule le pool de dés FFG pour une compétence donnée.
// Règle officielle : dés totaux = max(carac, rang) ; dés de Maîtrise (jaune) = min(carac, rang) ;
// dés de Capacité (vert) = |carac - rang|
function dicePool(carac, rang) {
  carac = Number(carac) || 0;
  rang = Number(rang) || 0;
  const total = Math.max(carac, rang);
  const yellow = Math.min(carac, rang);
  const green = Math.abs(carac - rang);
  return { total, yellow, green };
}

function skillCarac(nomCompetence) {
  const found = SKILLS_LIST.find(s => s.nom === nomCompetence);
  return found ? found.carac : null;
}
