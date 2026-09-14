// ============================================================
// MOTEUR DE DÉS NARRATIFS FFG — simulation des faces des dés spéciaux
// ============================================================
// Symboles : s=succès, f=échec, a=avantage, t=menace, tr=triomphe, d=désastre

const DICE_FACES = {
  ability:     [{}, { s: 1 }, { s: 1 }, { s: 2 }, { a: 1 }, { a: 1 }, { a: 2 }, { s: 1, a: 1 }],
  proficiency: [{}, { s: 1 }, { s: 1 }, { s: 2 }, { s: 2 }, { a: 1 }, { a: 1 }, { a: 2 }, { tr: 1 }, { s: 1, a: 1 }, { s: 1, a: 1 }, { a: 2 }],
  difficulty:  [{}, { f: 1 }, { f: 2 }, { t: 1 }, { t: 1 }, { t: 1 }, { f: 1, t: 1 }, { t: 2 }],
  challenge:   [{}, { f: 1 }, { f: 1 }, { f: 2 }, { f: 2 }, { t: 1 }, { t: 1 }, { t: 1 }, { t: 2 }, { f: 1, t: 1 }, { f: 1, t: 1 }, { d: 1 }],
  boost:       [{}, {}, { s: 1 }, { s: 1, a: 1 }, { a: 2 }, { a: 1 }],
  setback:     [{}, {}, { f: 1 }, { f: 1 }, { t: 1 }, { t: 1 }]
};

function rollOneDie(type) {
  const faces = DICE_FACES[type];
  return faces[Math.floor(Math.random() * faces.length)];
}

// pool = { ability, proficiency, difficulty, boost, setback, challenge }
function rollDicePoolFFG(pool) {
  const totals = { s: 0, f: 0, a: 0, t: 0, tr: 0, d: 0 };
  Object.keys(pool).forEach(type => {
    const count = pool[type] || 0;
    for (let i = 0; i < count; i++) {
      const face = rollOneDie(type);
      totals.s += face.s || 0;
      totals.f += face.f || 0;
      totals.a += face.a || 0;
      totals.t += face.t || 0;
      totals.tr += face.tr || 0;
      totals.d += face.d || 0;
    }
  });

  // Un Triomphe compte aussi comme un succès ; un Désastre compte aussi comme un échec.
  // Les avantages nets comptent le Triomphe/Désastre pour 3 (convention du Réseau Minos,
  // cohérente avec le tableau de bord de la cellule de Kaiya).
  const netSucces = (totals.s + totals.tr) - (totals.f + totals.d);
  const netAvantage = (totals.a + 3 * totals.tr) - (totals.t + 3 * totals.d);

  return {
    ...totals,
    netSucces,
    netAvantage,
    reussite: netSucces > 0
  };
}
