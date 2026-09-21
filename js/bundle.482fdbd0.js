/* ---- js/store.js ---- */
// Persistance locale (localStorage) — v1, prototype d'essai.
// v1.79 : l'application a été renommée "SoCalm" → "ViaCalma", mais ce préfixe technique reste
// VOLONTAIREMENT inchangé — c'est la clé sous laquelle les données de chaque personne qui a déjà
// utilisé l'app sont enregistrées sur son téléphone. Le changer romprait l'accès à tout ce qui a
// déjà été écrit (Journal, réglages, message vocal...) pour quiconque a déjà l'app installée, sans
// aucun bénéfice pour la personne qui l'utilise (invisible, jamais affiché). Un vrai déménagement
// des données vers un nouveau préfixe est possible plus tard si Johan le souhaite, mais resterait
// un chantier à part, avec sa propre logique de migration — pas un simple changement de texte.
const NS = "socalm.";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch (e) {
    // stockage indisponible (navigation privée, quota) — on continue sans persister
  }
}

const store = {
  getPrenom() { return read("prenom", ""); },
  setPrenom(v) { write("prenom", v); },

  onboardingDone() { return read("onboardingDone", false); },
  setOnboardingDone(v) { write("onboardingDone", v); },

  getCompliments() { return read("journal.compliments", []); },
  addCompliment(text) {
    const list = this.getCompliments();
    list.unshift({ text, date: new Date().toISOString() });
    write("journal.compliments", list);
  },

  getMaVersion(toolId) {
    return read("maVersion." + toolId, "");
  },
  setMaVersion(toolId, text) {
    write("maVersion." + toolId, text);
  },

  getFavoris(toolId) { return read("favoris." + toolId, 0); },
  setFavoris(toolId, n) { write("favoris." + toolId, n); },

  getCaseProgress(moduleSlug) { return read("progress." + moduleSlug, 0); },
  setCaseProgress(moduleSlug, index) { write("progress." + moduleSlug, index); },

  // getPointDepart/setPointDepart (mise en avant d'une catégorie entière depuis l'onboarding, v1.15)
  // retirés en v1.62 : jamais validés par Johan, et repérés par lui comme "ne proposant rien" de
  // concret — remplacés par une redirection directe vers le module suggéré (cf. js/screens/onboarding.js),
  // conforme au texte d'origine du cahier des charges (v0.74). Toute donnée déjà enregistrée sous la clé
  // localStorage "socalm.pointDepart" chez une personne qui utilisait déjà l'app devient simplement
  // inerte (plus lue nulle part) — sans effet ni erreur.

  getHomeView() { return read("homeView", "grille"); },
  setHomeView(v) { write("homeView", v); },

  // getOnboardingAnswer(field)/setOnboardingAnswer(field, value) (v1.89) retirées dans la même
  // session : deux questions facultatives d'onboarding (intensité, caractère situationnel/généralisé)
  // avaient été ajoutées pour capturer ces réponses, mais sans aucun usage réel derrière — Johan a
  // jugé, après coup, que ça ne valait pas de demander cet effort de réflexion à la personne sans rien
  // lui rendre en retour (cf. js/data/onboarding.js pour le détail). Toute donnée déjà écrite sous les
  // clés localStorage "socalm.onboarding.intensite"/"socalm.onboarding.caractere" devient inerte,
  // même principe que "socalm.pointDepart" (v1.62) et "socalm.expositions" (v1.87) ci-dessus.

  // Pays pour les numéros d'urgence affichés dans le flux "Moment difficile" (v1.80) — point A6 de
  // l'avis bêta-testeur de Claude (v1.63). France par défaut (comportement inchangé pour qui ne
  // touche jamais ce réglage) ; réglable à tout moment dans Paramètres. Cf. js/data/urgences.js pour
  // le détail des numéros par pays et js/screens/detresse.js pour leur affichage.
  getPays() { return read("pays", "france"); },
  setPays(v) { write("pays", v); },

  // Message vocal de confiance (v1.64) — enregistré par la personne pour elle-même, à réécouter
  // dans un moment difficile ; rattaché à l'outil "J'ai confiance, je tiens bon" et mis en priorité
  // dans le flux du bouton "Moment difficile". Un seul message actif à la fois : un nouvel
  // enregistrement remplace toujours l'ancien. Contrairement à write() ci-dessus (qui avale toute
  // erreur de quota en silence, choix acceptable pour une note de texte), setMessageVocal() ici
  // renvoie explicitement false en cas d'échec — un message de réconfort qui semblerait enregistré
  // mais serait en réalité perdu au moment d'une crise serait le pire scénario possible pour cette
  // fonction précise ; l'appelant doit pouvoir en informer clairement la personne plutôt que de la
  // laisser croire, à tort, que son message est bien sauvegardé.
  getMessageVocal() { return read("messageVocal", null); },
  setMessageVocal(dataUrl) {
    try {
      localStorage.setItem(NS + "messageVocal", JSON.stringify({ dataUrl, date: new Date().toISOString() }));
      return true;
    } catch (e) {
      return false;
    }
  },
  clearMessageVocal() {
    try { localStorage.removeItem(NS + "messageVocal"); } catch (e) { /* stockage indisponible */ }
  },

  // Bandeau d'invitation à enregistrer ce message, affiché une seule fois sur l'accueil juste après
  // l'onboarding (v1.64) — jamais réaffiché une fois vu ou écarté, qu'un message ait été enregistré
  // ou non entre-temps.
  getMessageVocalInviteVu() { return read("messageVocalInviteVu", false); },
  setMessageVocalInviteVu(v) { write("messageVocalInviteVu", v); },

  // Ancrage 5-4-3-2 (v0.45) : le critère de l'étape "vue" alterne à chaque usage (couleur / forme, point 2).
  getAncrageDernierCritere() { return read("ancrage.dernierCritere", null); },
  setAncrageDernierCritere(v) { write("ancrage.dernierCritere", v); },

  // Journal — liste des déclencheurs (v0.62).
  getDeclencheurs() {
    const list = read("journal.declencheurs", []);
    // Compat : anciennes entrées de test sans id (avant v1.35) — id de repli stable, dérivé de la date.
    return list.map(e => e.id ? e : { ...e, id: e.date });
  },
  addDeclencheur(text) {
    const list = this.getDeclencheurs();
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    list.unshift({ id, text, date: new Date().toISOString() });
    write("journal.declencheurs", list);
  },

  // Ressource "J'ai confiance, je tiens bon" (v0.54) : la phrase reçue de confiance de l'utilisateur,
  // écrite et conservée pour être relue au besoin — cœur de l'exercice, pas une simple note "Ma version".
  getPhraseConfiance() { return read("phraseConfiance", ""); },
  setPhraseConfiance(v) { write("phraseConfiance", v); },

  // Plan d'intention (v0.76, 3 champs v0.97, un plan par situation dès v1.35) :
  // un plan par déclencheur, indexé par son id — relisable et modifiable.
  getPlansDeclencheurs() { return read("journal.plansParDeclencheur", {}); },
  getPlanForDeclencheur(id) {
    const plans = this.getPlansDeclencheurs();
    return plans[id] || { reflexe: "", action: "" };
  },
  savePlanForDeclencheur(id, plan) {
    const plans = this.getPlansDeclencheurs();
    plans[id] = { reflexe: plan.reflexe || "", action: plan.action || "", date: new Date().toISOString() };
    write("journal.plansParDeclencheur", plans);
  },

  // Journal — "La vérification des attentes" (v0.70, échelle et synthèse v0.73) : noter une
  // prédiction ou une peur avant un événement, la vérifier après coup (texte libre + échelle 1-5,
  // ou évitement).
  // v1.88 : à la demande de Johan, une situation peut désormais être vérifiée PLUSIEURS fois — chaque
  // vérification devient une "tentative" dans un historique (`attempts`), plutôt qu'un statut
  // définitif "vérifiée" une seule fois. Voir addAttempt() ci-dessous.
  // Compat : les entrées vérifiées avant la v1.88 stockaient une vérification unique à plat
  // (verified/resultText/avoided/scale/petitPas/dateVerif, cf. historique juste au-dessus). Elles
  // sont ici présentées avec un `attempts` d'une seule tentative reconstituée à la volée, SANS
  // réécriture immédiate du localStorage (même principe que le repli d'id de getDeclencheurs() plus
  // haut) — la réécriture définitive n'a lieu que si une nouvelle action est faite sur cette entrée
  // (nouvelle tentative via addAttempt, ou ré-estimation via updatePredictionDifficulte).
  getPredictions() {
    const list = read("journal.predictions", []);
    return list.map(e => {
      if (e.attempts || !e.verified) return e;
      return {
        ...e,
        attempts: [{
          date: e.dateVerif || e.date,
          difficulteAvant: typeof e.difficulte === "number" ? e.difficulte : undefined,
          resultText: e.resultText || "",
          avoided: !!e.avoided,
          scale: e.avoided ? null : (e.scale != null ? e.scale : null),
          petitPas: e.petitPas || ""
        }]
      };
    });
  },
  addPrediction(text, confiance10, difficulte10) {
    const list = this.getPredictions();
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const entry = { id, text, date: new Date().toISOString(), verified: false };
    // Note de confiance sur 10 (v0.72), saisie dans l'outil "Je vérifie, je reprends la main" avant
    // l'événement — conservée avec la prédiction même si la vérification (v0.73) ne la réaffiche pas
    // encore : cohérent avec le protocole du modèle d'apprentissage inhibiteur (Craske et al., 2014,
    // v0.72 point 2), qui suppose une note avant pour mesurer l'écart plus tard.
    if (typeof confiance10 === "number") entry.confiance10 = confiance10;
    // Difficulté sur 10 (v1.87) : présente uniquement sur les entrées créées depuis "J'avance, une
    // marche à la fois" (échelle d'exposition) — sert à trier ces entrées en hiérarchie graduée sur
    // cet écran. Absente (undefined) pour toute prédiction créée directement depuis "Je vérifie, je
    // reprends la main", qui n'a pas cette notion. Fusion actée avec Johan (v1.87) : une situation de
    // l'échelle EST une prédiction comme une autre — "cocher affrontée" et "vérifier dans le Journal"
    // sont devenus la même action, vue sous deux angles (cf. cahier des charges v1.87).
    if (typeof difficulte10 === "number") entry.difficulte = difficulte10;
    list.unshift(entry);
    write("journal.predictions", list);
    return id;
  },
  // Journal — "Le fil de tes soirs" (v0.56, texte finalisé v0.63, consultation v0.76) : geste
  // quotidien, nommer les émotions traversées, sans agrégation ni synthèse (à la différence de la
  // vérification des attentes) — même architecture minimale que la boîte à compliments.
  getSoirs() { return read("journal.soirs", []); },
  addSoir(text) {
    const list = this.getSoirs();
    list.unshift({ text, date: new Date().toISOString() });
    write("journal.soirs", list);
  },

  // Journal — "Le bilan auto-écrit" (v0.63) : réflexion libre, amorcée par l'entrée la plus
  // ancienne encore disponible dans tout le Journal. Chaque bilan écrit devient lui-même, plus
  // tard, une entrée disponible pour une future amorce (v0.63, point 2).
  getBilans() { return read("journal.bilans", []); },
  addBilan(text) {
    const list = this.getBilans();
    list.unshift({ text, date: new Date().toISOString() });
    write("journal.bilans", list);
  },
  // Références des entrées déjà utilisées comme amorce (ex. "compliments:2026-08-01T..."), pour que
  // chaque amorce n'apparaisse qu'une fois — l'écart avec "aujourd'hui" grandit ainsi naturellement
  // à chaque nouveau bilan écrit, plutôt que de toujours réafficher la toute première entrée jamais
  // notée (v0.63, point 1 : "le recul s'installe de lui-même avec le temps").
  getBilanUsedRefs() { return read("journal.bilanUsed", []); },
  markBilanRefUsed(ref) {
    const list = this.getBilanUsedRefs();
    if (!list.includes(ref)) {
      list.push(ref);
      write("journal.bilanUsed", list);
    }
  },

  // Plan global "si ça revient" (v1.71) — outil "Mon petit plan, si ça revient", clôture du module
  // "Et dans trois mois ?". Même mécanique que les plans par déclencheur ci-dessus (réflexe + action,
  // intention de mise en œuvre de Gollwitzer), mais UN SEUL plan global, pas par déclencheur : ce
  // module ne part pas d'une situation déjà notée, donc pas de clé d'indexation par id comme
  // getPlanForDeclencheur/savePlanForDeclencheur — volontairement une paire de clés séparée plutôt que
  // réutiliser celles-ci avec un id inventé.
  getPlanRechute() { return read("planRechute", { reflexe: "", action: "" }); },
  setPlanRechute(plan) {
    write("planRechute", { reflexe: plan.reflexe || "", action: plan.action || "", date: new Date().toISOString() });
  },

  // Auto-évaluation de progression (v1.73) — nouvelle section du Journal, point 1 du volet clinique de
  // la relecture bêta-testeur (v1.63). Liste d'entrées horodatées ; chaque `answers` associe un id
  // d'item (cf. AUTOEVAL_ITEMS, js/screens/journal.js) à une réponse EN MOTS ("pas-vraiment" / "un-peu"
  // / "beaucoup") — jamais un score chiffré, jamais de somme ni de moyenne calculée, cohérent avec le
  // refus déjà acté de toute gamification (v0.7, v0.73). La plus récente en tête (même convention que
  // les autres listes du Journal), pour lire `entries[0]` comme "la dernière fois" sans trier.
  getAutoEvalEntries() { return read("journal.autoEval", []); },
  addAutoEvalEntry(answers) {
    const list = this.getAutoEvalEntries();
    list.unshift({ date: new Date().toISOString(), answers });
    write("journal.autoEval", list);
  },

  // Export de données (v1.75) — "premier filet" contre la perte du Journal au changement d'appareil
  // ou à la réinstallation (point A1 de l'avis bêta-testeur, v1.63). Parcourt directement toutes les
  // clés localStorage sous le préfixe "socalm." plutôt que d'énumérer les getters un par un : plusieurs
  // données sont indexées dynamiquement par outil (favoris.<id>, maVersion.<id>) ou par module
  // (progress.<slug>) — une liste écrite à la main se désynchroniserait à chaque nouvel outil ou
  // module ajouté (déjà arrivé plusieurs fois cette session). Inclut tout, y compris les réglages
  // techniques (prénom, vue d'accueil préférée, favoris) — décision de Johan (v1.75). Le message vocal
  // (`messageVocal`) est explicitement exclu : fichier audio volumineux, hors de propos pour un export
  // "ce que j'ai écrit" — décision de Johan également.
  exportAllData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (!fullKey || fullKey.indexOf(NS) !== 0) continue;
      const shortKey = fullKey.slice(NS.length);
      if (shortKey === "messageVocal") continue;
      const raw = localStorage.getItem(fullKey);
      try {
        data[shortKey] = JSON.parse(raw);
      } catch (e) {
        data[shortKey] = raw;
      }
    }
    return { app: "ViaCalma", exportDate: new Date().toISOString(), data };
  },

  // Échelle d'exposition : voir addPrediction() ci-dessus, champ `difficulte` (v1.87). Les méthodes
  // getExpositions()/addExposition()/toggleExpositionAffrontee()/removeExposition() introduites en
  // v1.86 ont été retirées lors de la fusion v1.87 — remplacées par le système de prédictions
  // existant plutôt que maintenu en parallèle. Toute donnée déjà écrite sous la clé localStorage
  // "socalm.expositions" chez qui aurait testé la v1.86 devient inerte (plus lue nulle part), comme
  // pour "socalm.pointDepart" en v1.62 ci-dessus — sans donnée perdue d'importance, cette version
  // n'ayant pas encore été livrée à un usage réel au moment de la fusion.

  // v1.88 (renommée depuis saveVerification, qui n'autorisait qu'une vérification unique) : ajoute
  // UNE TENTATIVE à l'historique de la situation, sans jamais effacer les précédentes — répéter la
  // vérification d'une même situation, plusieurs fois si besoin, est désormais le fonctionnement
  // normal de l'outil (demande de Johan, v1.88 ; cf. cahier des charges pour la justification
  // théorique : violation d'attente répétée contre le "renouvellement"/"réinstauration" de la peur,
  // Craske et al., 2014, et accumulation d'expériences de maîtrise, Bandura).
  // `difficulteAvant` capture la difficulté anticipée AU MOMENT de cette tentative précise (avant
  // qu'une éventuelle ré-estimation via updatePredictionDifficulte() ne la change pour la suite) —
  // nécessaire pour que l'historique reste lisible même après plusieurs ré-estimations successives.
  addAttempt(id, data) {
    const list = this.getPredictions();
    const entry = list.find(p => p.id === id);
    if (!entry) return;
    const attempts = entry.attempts ? entry.attempts.slice() : [];
    attempts.push({
      date: new Date().toISOString(),
      difficulteAvant: typeof entry.difficulte === "number" ? entry.difficulte : undefined,
      resultText: data.resultText || "",
      avoided: !!data.avoided,
      scale: data.avoided ? null : (data.scale || null),
      petitPas: data.petitPas || ""
    });
    entry.attempts = attempts;
    entry.verified = true;
    // Nettoyage des anciens champs à plat (v1.87 et avant), remplacés par `attempts` ci-dessus — une
    // entrée n'a plus besoin de les porter une fois passée par addAttempt() au moins une fois.
    delete entry.resultText;
    delete entry.avoided;
    delete entry.scale;
    delete entry.petitPas;
    delete entry.dateVerif;
    write("journal.predictions", list);
  },

  // v1.88 : ré-estimation de la difficulté anticipée, proposée juste après chaque tentative pour les
  // situations issues de "J'avance, une marche à la fois" (celles qui ont un champ `difficulte`) —
  // conforme à la théorie de l'auto-efficacité de Bandura, où l'attente d'efficacité personnelle se
  // met à jour après chaque expérience de maîtrise, plutôt que d'être fixée une fois pour toutes.
  // Met aussi à jour, de fait, le tri de l'échelle d'exposition (triée par `difficulte`).
  updatePredictionDifficulte(id, value) {
    if (typeof value !== "number") return;
    const list = this.getPredictions();
    const entry = list.find(p => p.id === id);
    if (!entry) return;
    entry.difficulte = value;
    write("journal.predictions", list);
  },

  // Outil "Je me tourne vers quelqu'un, je ne reste pas seul·e" (v1.91), compagnon du module
  // "soutien social" — liste de personnes de confiance qui s'accumule, sans suppression, même
  // principe que getDeclencheurs()/addDeclencheur() ci-dessus.
  getPersonnesConfiance() { return read("personnesConfiance", []); },
  addPersonneConfiance(nom, note) {
    const list = this.getPersonnesConfiance();
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    list.unshift({ id, nom, note: note || "", date: new Date().toISOString() });
    write("personnesConfiance", list);
  }
};

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  } catch (e) {
    return "";
  }
}

/* ---- js/util.js ---- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function navigate(route) {
  window.location.hash = route;
}

let toastTimer = null;
function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function backRow(label, onBack) {
  return `<div class="back-row"><button class="back" data-back>‹ ${escapeHtml(label)}</button></div>`;
}

function wireBack(root, handler) {
  const btn = root.querySelector("[data-back]");
  if (btn) btn.addEventListener("click", handler);
}

// Lien retour outil → psychoéducation (v1.42) : symétrique du lien module → outil déjà en place
// (cf. module.js, c.closing.link). Défini une seule fois ici (portée globale partagée, util.js)
// plutôt que dans chaque fiche outil, pour éviter tout risque de collision de nom entre fiches
// (cf. note technique v1.16/v1.28 sur les scripts classiques en portée globale).
function renderRelatedModuleLink(mod) {
  if (!mod) return "";
  return `
    <div class="closing-hint">Pour mieux comprendre ce qui t'arrive :</div>
    <a class="link-row" href="#/module/${mod.slug}" data-related-module-link>
      <div><div class="t">${escapeHtml(mod.title)}</div><div class="d">${escapeHtml(mod.desc)}</div></div>
      <span class="chev">›</span>
    </a>
  `;
}

function wireRelatedModuleLink(root) {
  const link = root.querySelector("[data-related-module-link]");
  if (link) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(link.getAttribute("href"));
    });
  }
}

// Grille de catégorie repliable par axe (v1.61), à la demande de Johan : sur l'onglet "Comprendre",
// avoir les 15 titres de modules tous visibles en même temps risquait de surcharger et d'angoisser la
// personne qui lit — beaucoup de titres de modules sont volontairement percutants pris un par un, mais
// s'accumulent mal en liste. Seuls les 4 intitulés d'axe (posés en v1.60 via `axisTitle` sur le premier
// module de chaque axe, cf. js/data/grid.js) sont visibles par défaut ; taper dessus déplie les modules
// de cet axe. "Fondateur" (aucun `axisTitle`, en tête de liste) reste toujours visible, jamais replié —
// c'est le point de départ recommandé de tout le module Comprendre. Un seul axe ouvert à la fois
// (Johan, v1.61) : en ouvrir un referme automatiquement celui qui était ouvert, pour rester le plus
// épuré possible. Générique : ne fait rien de spécial pour les catégories dont aucun outil ne porte
// `axisTitle` (Je respire, Je m'ancre, Mes ressources) — tous leurs outils tombent simplement dans le
// groupe "sans axe", rendu exactement comme avant.
function buildAxisGroups(tools) {
  const ungrouped = [];
  const groups = [];
  let current = null;
  tools.forEach(t => {
    if (t.axisTitle) {
      current = { key: t.id, title: t.axisTitle, tools: [t] };
      groups.push(current);
    } else if (current) {
      current.tools.push(t);
    } else {
      ungrouped.push(t);
    }
  });
  return { ungrouped, groups };
}

function renderToolCardHtml(t) {
  return `
    <button class="tool-card ${t.live ? "" : "locked"}" ${t.live ? `data-route="${t.route}"` : "disabled"}>
      ${escapeHtml(t.name)}
      ${t.live ? "" : `<span class="soon">à venir dans cette version d'essai</span>`}
    </button>
  `;
}

function renderAxisGroupedHtml(tools, openAxisKey) {
  const { ungrouped, groups } = buildAxisGroups(tools);
  const ungroupedHtml = ungrouped.map(renderToolCardHtml).join("");
  const groupsHtml = groups.map(g => `
    <button class="axis-toggle ${openAxisKey === g.key ? "open" : ""}" data-axis-toggle="${g.key}" aria-expanded="${openAxisKey === g.key ? "true" : "false"}">
      <span class="axis-toggle-title">${escapeHtml(g.title)}</span>
      <span class="chev">›</span>
    </button>
    ${openAxisKey === g.key ? g.tools.map(renderToolCardHtml).join("") : ""}
  `).join("");
  return ungroupedHtml + groupsHtml;
}

function wireAxisToggles(root, onToggle) {
  root.querySelectorAll("[data-axis-toggle]").forEach(btn => {
    btn.addEventListener("click", () => onToggle(btn.getAttribute("data-axis-toggle")));
  });
}

// Bouton discret de retour à l'accueil, en bas de chaque écran (v1.58, à la demande de Johan :
// "un bouton discret" retenu parmi les options proposées). Injecté une seule fois, de façon
// centralisée, après le rendu de chaque écran (cf. app.js, renderRoute) plutôt que dupliqué dans
// chaque fiche — un seul endroit à maintenir, aucun risque d'oubli sur un écran futur. Répond à un
// besoin différent du bouton de retour contextuel en haut de chaque écran (qui ne remonte qu'un
// niveau) : sortir directement vers l'accueil depuis n'importe quel écran, sans avoir à remonter la
// pile pas à pas. Volontairement discret (texte simple, couleur atténuée, pas de bouton plein) pour ne
// jamais concurrencer l'action principale de l'écran — en particulier sur les cases de module et leurs
// liens de clôture, où l'accent doit rester sur l'outil proposé, pas sur la sortie.
function injectHomeLink(root) {
  const screen = root.querySelector(".screen");
  if (!screen) return;
  screen.insertAdjacentHTML("beforeend", `<div class="home-link-discreet"><a href="#/" data-home-link>Retour à l'accueil</a></div>`);
  const link = screen.querySelector("[data-home-link]");
  if (link) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate("#/");
    });
  }
}

/* ---- js/data/onboarding.js ---- */
// Textes repris mot pour mot du cahier des charges
// (respiration v0.11/v0.81, accueil v0.10/v0.81, nom d'usage v0.12, cadeau v0.15, point de départ v0.74, grille v0.16/v0.46)
// Source : design/parcours-accueil-v1.html
//
// v1.89 : deux questions facultatives (intensité, caractère situationnel/généralisé) ajoutées ici puis
// retirées dans la même session, à la demande de Johan — les réponses n'étaient capturées pour
// aucun usage réel, et il a jugé que ça ne justifiait pas de demander cet effort de réflexion à la
// personne sans rien lui rendre en retour (même logique que la correction de "depart" en v1.62 :
// jamais une question sans débouché concret). Toute réponse déjà enregistrée sous les clés
// localStorage "socalm.onboarding.intensite"/"socalm.onboarding.caractere" chez qui aurait testé la
// v1.89 devient inerte (plus lue nulle part) — sans effet ni erreur, même principe que
// "socalm.pointDepart" (v1.62) et "socalm.expositions" (v1.87) plus haut dans l'historique du projet.
// À reprendre plus tard, si Johan le souhaite, en même temps qu'une vraie utilisation des réponses.

const onboardingSteps = [
  {
    id: "respiration",
    body: [
      "On commence doucement. Installe-toi si tu peux, le plus <strong>confortablement</strong> possible — assis, debout, ou même en marchant. On va juste respirer ensemble, une petite minute.",
      "<strong>Inspire</strong> par le nez... <span class=\"count\">2, 3, 4.</span><br><strong>Expire</strong> par la bouche, tu peux même laisser un léger bruit s'échapper, comme un ballon qui se dégonfle... <span class=\"count\">2, 3, 4, 5.</span>",
      "(répète le cycle 4 fois)"
    ],
    closing: "Voilà. Tu viens de faire quelque chose de concret pour toi."
  },
  {
    id: "accueil",
    avatar: "J",
    body: [
      "Bonjour, je m'appelle <span class=\"name-highlight\">Johan</span>. Je suis psychologue clinicien — et ton <span class=\"name-highlight\">compagnon de route</span>. Moi aussi, j'ai connu l'anxiété, les crises d'angoisse, et même la dépression. Aujourd'hui, elle a retrouvé sa juste place : elle est là quand il le faut, et elle me laisse vivre le reste du temps.",
      "Je n'ai aucun don particulier — juste des <strong>outils concrets</strong>, <strong>faciles</strong> à mettre en <strong>pratique</strong>, les mêmes que j'utilise avec mes patients, comme avec moi-même. Je te les partage ici."
    ]
  },
  {
    id: "nom",
    closing: "Comment veux-tu que je t'appelle ?",
    body: ["Prénom, pseudo, comme tu veux.", "Pour personnaliser un peu la suite — ou reste anonyme, c'est très bien aussi."],
    field: true,
    placeholder: "Ton prénom ou pseudo…",
    skip: "Je préfère ne pas dire"
  },
  {
    id: "cadeau",
    body: ["j'aimerais te faire un cadeau : un secret que j'ai appris sur ce chemin, et que j'utilise encore aujourd'hui."],
    mantra: "À chaque instant, je fais de mon mieux.<br>Chaque petit pas compte."
  },
  {
    // Suggestion module + outil (v0.74 du cahier des charges), corrigée en v1.62 : la version
    // construite en v1.15 ("proposition de Claude, pas encore validée par Johan") ne mettait en avant
    // qu'une catégorie entière d'outils (badge "Pour toi" sur "Je respire"/"Je m'ancre"/"Mes
    // ressources"), jamais confirmée par Johan et repérée par lui comme ne "proposant rien" de concret.
    // Le texte d'origine du cahier des charges (v0.74) était pourtant précis : chaque réponse doit
    // suggérer UN module de psychoéducation ET UN outil précis, pas une catégorie. Corrigé ici en
    // pointant directement vers la couverture du module suggéré — chacun des trois modules ci-dessous a
    // déjà, dans son propre lien de clôture, exactement l'outil prévu par le cahier des charges (Mon
    // cœur s'emballe → respiration ; J'imagine toujours le pire → ancrage ; Je ne gère pas mes émotions
    // → coussin des émotions), donc la personne y arrive naturellement en terminant le module, sans
    // rien construire de neuf pour l'outil. Toujours une suggestion, jamais un chemin fermé (v0.74) :
    // rien n'empêche de revenir à l'accueil ensuite (bouton retour ou lien discret de retour, v1.58).
    id: "depart",
    body: ["Ce qui te pèse le plus en ce moment, c'est plutôt…"],
    options: [
      { h: "Ton corps", d: "cœur qui s'emballe, tensions, sommeil", route: "#/module/neurologie-crise" },
      { h: "Tes pensées", d: "ça tourne en boucle, tu imagines le pire", route: "#/module/catastrophisme" },
      { h: "Tes émotions", d: "difficile à identifier, à exprimer, trop d'émotions, trop intense", route: "#/module/emotions" }
    ],
    skip: "Je préfère explorer moi-même",
    // v1.67 : reprend mot pour mot le 4e volet du texte d'intro de la page "Les fondements de
    // SoCalm" (finalisé v0.64, relu et corrigé par Johan v0.80) — jamais une nouvelle rédaction.
    // v1.79 : "SoCalm" → "ViaCalma" dans le texte lui-même, suite au renommage de l'application —
    // seul le nom a changé, la formulation validée par Johan reste identique par ailleurs.
    // Cette page n'existe encore nulle part dans l'appli (seule une maquette isolée,
    // design/ecran-fondements.html, jamais reliée) ; en attendant qu'elle soit construite, Johan a
    // choisi de placer ce seul paragraphe ici, en toute dernière chose avant d'entrer dans l'appli
    // (choix explicite entre plusieurs emplacements proposés — cf. cahier des charges v1.67).
    disclaimer: [
      "Dernière chose, importante : ViaCalma ne remplace pas une thérapie.",
      "Tu peux l'utiliser seul, ou en complément d'un accompagnement déjà en cours — certains outils peuvent même devenir un point de départ à amener à ton psy."
    ]
  }
];

/* ---- js/data/urgences.js ---- */
// Numéros d'urgence adaptés au pays (v1.80) — point A6 de l'avis bêta-testeur de Claude (v1.63) :
// l'app était unilingue française, avec des numéros (3114, 15, 112) spécifiques à la France,
// inadaptés à un usage belge/suisse/québécois. Décision de Johan (v1.80) : un réglage dans
// Paramètres (France par défaut, changeable à tout moment) — pas de question à l'onboarding, pas de
// détection automatique de la locale (jugée peu fiable : ex. un·e Québécois·e avec un téléphone
// configuré en "français (France)" ne serait pas détecté·e).
//
// IMPORTANT — texte à faire relire par Johan avant de le considérer définitif : seul le texte
// France ("3114... 15... 112") est le texte d'origine déjà validé (v0.67), inchangé ici. Les textes
// Belgique/Suisse/Québec sont un brouillon de Claude — numéros vérifiés par recherche web le
// 10 septembre 2026, formulation calquée au plus près sur la structure du texte français validé,
// mais jamais rédigés ni validés par Johan mot pour mot. Cf. cahier des charges v1.80 pour le détail
// des sources, et pour une ambiguïté relevée côté Belgique : deux services de prévention du suicide
// distincts trouvés en recherche (Centre de Prévention du Suicide, 0800 32 123 ; et SOS Suicide
// Belgique / ex-"Un pass dans l'impasse", 0800 777 40, rebrandé en février 2026) — Johan a choisi le
// premier (v1.80).
//
// Cas particulier Suisse : `ligneGratuite: null` (ni true ni false) — je n'ai pas trouvé de source
// fiable confirmant que l'appel au 143 est gratuit (contrairement aux numéros 0800 belge et 1-866
// québécois, gratuits par construction). Choix délibéré de ne rien affirmer plutôt que de risquer une
// information fausse sur un sujet aussi sensible : le texte suisse omet donc la mention "gratuit".
const PAYS_URGENCE = [
  {
    id: "france",
    label: "France",
    ligneEcoute: "3114",
    ligneNom: "numéro national de prévention du suicide",
    ligneGratuite: true,
    urgenceVitale: ["15", "112"]
  },
  {
    id: "belgique",
    label: "Belgique",
    ligneEcoute: "0800 32 123",
    ligneNom: "Centre de Prévention du Suicide",
    ligneGratuite: true,
    urgenceVitale: ["112"]
  },
  {
    id: "suisse",
    label: "Suisse",
    ligneEcoute: "143",
    ligneNom: "La Main Tendue",
    ligneGratuite: null,
    urgenceVitale: ["144", "112"]
  },
  {
    id: "quebec",
    label: "Québec",
    ligneEcoute: "1 866 APPELLE (1 866 277-3553)",
    ligneNom: "ligne québécoise de prévention du suicide",
    ligneGratuite: true,
    urgenceVitale: ["911"]
  }
];

function getPaysUrgence(id) {
  return PAYS_URGENCE.find(p => p.id === id) || PAYS_URGENCE[0];
}

// withNom : inclut ou non le nom de la ligne entre parenthèses — les deux variantes existaient déjà
// dans le texte France d'origine (v0.67) selon l'écran (cf. js/screens/detresse.js).
function formatUrgenceText(pays, withNom) {
  const gratuitTxt = pays.ligneGratuite === true ? "gratuit et disponible 24h/24" : "disponible 24h/24";
  const nomTxt = withNom ? ` (${pays.ligneNom})` : "";
  const urgenceTxt = pays.urgenceVitale.length > 1
    ? `le <b>${pays.urgenceVitale[0]}</b> ou le <b>${pays.urgenceVitale[1]}</b>`
    : `le <b>${pays.urgenceVitale[0]}</b>`;
  return `Le <b>${pays.ligneEcoute}</b>, ${gratuitTxt}${nomTxt}. En cas d'urgence vitale : ${urgenceTxt}.`;
}

/* ---- js/data/fondements.js ---- */
// Page "Les fondements de ViaCalma" (v1.82) — chantier resté en attente depuis v1.12/v1.67 : texte
// entièrement rédigé et validé par Johan dans le cahier des charges (niveau 1 finalisé v0.64, relu
// et corrigé par Johan v0.80 ; niveau 2 finalisé v0.66), mais jamais construit dans l'app faute de
// menu pour y accéder. Reprend mot pour mot le texte validé, seul "SoCalm" a été remplacé par
// "ViaCalma" (renommage v1.79, même traitement que pour le texte d'onboarding).
//
// Note sur le niveau 1 (v0.98 dans le cahier des charges) : le texte prévoyait d'omettre la première
// phrase du point 1 quand cette page suit un écran "Le principe" déjà lu — cet écran "Le principe"
// n'existe pas dans l'app construite à ce jour (jamais bâti), donc rien ne précède cette page qui
// répéterait déjà cette phrase. Le texte complet, non tronqué, est donc affiché ici — cohérent avec
// la logique déjà posée (l'omission n'a de sens QUE si la répétition existe réellement).
const FONDEMENTS_INTRO = [
  {
    title: "Transparence et choix personnel",
    body: [
      "Tout ce que tu trouves dans ViaCalma repose sur un contenu scientifique validé, éprouvé par des psychologues cliniciens et par leurs patients. Chaque outil s'appuie sur des recherches déjà validées en psychologie — je ne te promets pas de miracle, mais des petits pas concrets et évaluables vers un mieux-être.",
      "Je les ai choisis, et adaptés à ma façon, parce qu'ils ont fonctionné pour moi, et pour les personnes que j'accompagne. Tu n'as pas besoin de lire cette page pour qu'ils fonctionnent — elle est là pour qui veut comprendre le pourquoi."
    ]
  },
  {
    title: "Les trois piliers",
    body: [
      "ViaCalma repose sur trois piliers qui se complètent : t'informer, t'accompagner au quotidien, t'aider à agir. Comme un compagnon de tous les jours — pas seulement présent dans les moments de crise, mais à tes côtés dans la durée, pour que chaque petit pas compte vraiment.",
      "Ce qui est plus rare, c'est la manière dont je les ai construits : un journal qui ne compte rien, ne compare rien, ne t'impose aucune série à tenir — pensé pour te ressembler, pas pour te classer. Et une seule voix, la mienne, plutôt qu'un contenu générique ou généré automatiquement."
    ]
  },
  {
    title: "La juste place de l'angoisse",
    body: [
      "Un mot, avant de te laisser explorer. Le but de ViaCalma n'est pas de faire disparaître ton angoisse.",
      "Elle a un rôle : c'est un message, elle te prépare à agir, elle peut même t'apporter une vigilance utile, au bon moment. Le problème, ce n'est pas qu'elle existe — c'est quand elle prend trop de place, ou qu'elle se déclenche alors que rien ne le justifie vraiment.",
      "Ce que je te propose, ce sont des outils pour qu'elle fasse son travail, puis te laisse revenir au calme. C'est ce retour qui lui redonne sa juste place — ni une contrainte à subir, ni une absence à viser, mais un signal qu'on écoute, puis qu'on relâche."
    ]
  },
  {
    title: "Pas un remplacement de la thérapie",
    body: [
      "Dernière chose, importante : ViaCalma ne remplace pas une thérapie.",
      "Tu peux l'utiliser seul, ou en complément d'un accompagnement déjà en cours — certains outils peuvent même devenir un point de départ à amener à ton psy."
    ]
  }
];

const FONDEMENTS_THEMES = [
  {
    title: "Auto-efficacité et confiance en soi",
    body: "Pourquoi se sentir capable change tout — bien plus que la volonté seule. Ce qui construit ce sentiment : les petites réussites répétées, plutôt que les grandes.",
    authors: "Bandura, Deci & Ryan, Dweck"
  },
  {
    title: "Comprendre l'anxiété et la panique",
    body: "D'où vient une crise, pourquoi le corps réagit ainsi, et pourquoi ce n'est jamais dangereux en soi.",
    authors: "Beck, Clark, Cannon"
  },
  {
    title: "Le corps et la respiration",
    body: "Comment une respiration lente et une attention posée sur le corps aident réellement à retrouver le calme.",
    authors: "Jacobson, Kabat-Zinn, Lehrer & Gevirtz"
  },
  {
    title: "Les émotions",
    body: "Pourquoi elles ne se contrôlent pas, à quoi elles servent, et ce qui se passe quand on n'a pas appris à toutes les exprimer.",
    authors: "Darwin, Ekman, Barrett"
  },
  {
    title: "Les pensées et les ruminations",
    body: "Comment une pensée qui tourne en boucle s'installe, et ce qui aide vraiment à s'en détacher.",
    authors: "Beck, Burns, Nolen-Hoeksema, Borkovec"
  },
  {
    title: "Le sommeil",
    body: "Pourquoi l'inquiétude s'invite souvent au moment de s'endormir, et comment l'effort pour dormir peut devenir lui-même l'obstacle.",
    authors: "Espie, Harvey"
  },
  {
    title: "Le regard sur soi",
    body: "Apprendre à se parler avec la même bienveillance qu'on aurait pour quelqu'un qu'on aime, et pourquoi ce lien intérieur compte autant que les liens extérieurs.",
    authors: "Schwartz, Neff, Bowlby & Ainsworth"
  },
  {
    title: "Écrire et s'exprimer",
    body: "Pourquoi mettre des mots sur ce qu'on vit, même sans le partager à personne, change déjà quelque chose.",
    authors: "Pennebaker, Hayes, de Shazer"
  },
  {
    title: "La motivation au quotidien",
    body: "Ce qui aide à revenir vers un outil sans s'y sentir obligé, et pourquoi se projeter dans qui on sera plus tard peut aider dès aujourd'hui.",
    authors: "Gollwitzer, Hershfield, Reeve"
  }
];

const FONDEMENTS_PRECISION =
  "Certaines inspirations de l'app, comme la dichotomie du contrôle d'Épictète, viennent de la philosophie plutôt que de la recherche scientifique — un socle historique important pour les TCC elles-mêmes, mais une source différente de celles citées plus haut.";

// Niveau 3 — liste complète des références (v1.82) : RECONSTRUITE par Claude à partir de la section
// "Fondements théoriques retenus" de ce cahier des charges (seule source complète disponible), pas
// recopiée depuis un document séparé qui n'a pas pu être retrouvé — à vérifier par Johan, cf. le
// chantier v1.82 dans le cahier des charges pour le détail de cet écart et de la méthode d'extraction.
// 98 entrées (regroupant sous un même auteur les concepts qu'il a inspirés plusieurs fois), triées
// alphabétiquement, tags de version retirés pour l'affichage — conforme aux règles déjà actées (v0.66).
const FONDEMENTS_REFERENCES = [
  { ref: "Arnsten, 2009", concept: "stress aigu et cortex préfrontal" },
  { ref: "Baddeley", concept: "mémoire de travail et charge visuo-spatiale" },
  { ref: "Bandura", concept: "auto-efficacité et expérience vicariante; auto-efficacité de récupération" },
  { ref: "Barlow", concept: "distinction peur/anxiété anticipatoire" },
  { ref: "Barrett", concept: "granularité émotionnelle" },
  { ref: "Barsky", concept: "amplification somatique" },
  { ref: "Bateson", concept: "injonction paradoxale / double bind" },
  { ref: "Beck", concept: "TCC" },
  { ref: "Beck ; Burns", concept: "flèche descendante" },
  { ref: "Beck, 1979", concept: "raisonnement émotionnel" },
  { ref: "Bennett-Levy et al., 2004", concept: "expérience comportementale" },
  { ref: "Borkovec", concept: "distinction problèmes actuels/inquiétudes hypothétiques" },
  { ref: "Borkovec et al., 1983", concept: "temps d'inquiétude programmé" },
  { ref: "Bowlby ; Ainsworth", concept: "théorie de l'attachement et base de sécurité" },
  { ref: "Bryant, 1989", concept: "théorie de la savoration" },
  { ref: "Bushman, 2002", concept: "mythe de la catharsis" },
  { ref: "Cannon", concept: "combat/fuite" },
  { ref: "Carroll, 1978", concept: "inflation d'une probabilité perçue par l'imagination" },
  { ref: "Clark", concept: "modèle cognitif de la panique" },
  { ref: "Craske et al., 2014", concept: "modèle d'apprentissage inhibiteur de l'exposition" },
  { ref: "Darwin ; Ekman & Levenson", concept: "théorie fonctionnaliste des émotions" },
  { ref: "de Shazer", concept: "approche orientée solutions" },
  { ref: "Deci & Ryan", concept: "autodétermination" },
  { ref: "Dugas, Freeston, Ladouceur", concept: "intolérance à l'incertitude" },
  { ref: "Dweck", concept: "progression par l'effort / growth mindset" },
  { ref: "Ekman", concept: "six émotions de base; règles d'affichage" },
  { ref: "Engel, 1977", concept: "modèle biopsychosocial" },
  { ref: "Épictète", concept: "dichotomie du contrôle" },
  { ref: "Espie ; Broomfield & Espie", concept: "inhibition psychobiologique de l'insomnie et effort de sommeil" },
  { ref: "Eysenck", concept: "contrôle attentionnel" },
  { ref: "Festinger", concept: "comparaison sociale" },
  { ref: "Foa & Kozak, 1986", concept: "exposition graduée et traitement émotionnel" },
  { ref: "Frankl", concept: "intention paradoxale" },
  { ref: "Frijda", concept: "tendances à l'action" },
  { ref: "Gershon", concept: "système nerveux entérique" },
  { ref: "Gilbert", concept: "imagerie de la présence bienveillante en thérapie de la compassion" },
  { ref: "Gilbert & Wilson", concept: "négligence du système immunitaire psychologique" },
  { ref: "Gollwitzer, 1999", concept: "intentions de mise en œuvre" },
  { ref: "Harvey", concept: "modèle cognitif de l'insomnie" },
  { ref: "Hayes", concept: "évitement expérientiel / ACT" },
  { ref: "Hayes, ACT", concept: "défusion cognitive" },
  { ref: "Hebb", concept: "principe d'apprentissage associatif (loi de Hebb)" },
  { ref: "Hershfield, 2011", concept: "continuité avec le futur soi" },
  { ref: "Herz", concept: "lien direct olfaction-amygdale/hippocampe" },
  { ref: "Holmes, James, Coode-Bate & Deeprose, 2009", concept: "tâche visuo-spatiale et réduction des images intrusives" },
  { ref: "Jacobson", concept: "relaxation musculaire progressive" },
  { ref: "Kabat-Zinn", concept: "pleine conscience" },
  { ref: "Kagan", concept: "tempérament" },
  { ref: "Kahneman, 1973", concept: "modèle de l'attention à capacité limitée" },
  { ref: "Kanfer, 1970", concept: "autorégulation" },
  { ref: "Kelly", concept: "construits personnels et alternativisme constructif" },
  { ref: "Keltner & Haidt", concept: "fonctions sociales des émotions" },
  { ref: "Lang, 1979", concept: "théorie bio-informationnelle de l'imagerie" },
  { ref: "Lazarus ; Scherer", concept: "théorie de l'évaluation cognitive" },
  { ref: "Lehrer & Gevirtz, 2014", concept: "attention portée au cœur et cohérence cardiaque" },
  { ref: "Lieberman et al., 2007", concept: "étiquetage affectif" },
  { ref: "Masicampo & Baumeister", concept: "réduction de l'intrusion par un plan" },
  { ref: "Masten", concept: "résilience comme mécanisme ordinaire" },
  { ref: "Mayer ; Cryan & Dinan", concept: "axe intestin-cerveau" },
  { ref: "Meichenbaum", concept: "auto-instruction" },
  { ref: "Merton, 1948", concept: "prophétie auto-réalisatrice" },
  { ref: "Mowrer", concept: "théorie bifactorielle de l'évitement" },
  { ref: "Neff", concept: "auto-compassion" },
  { ref: "Nickerson", concept: "biais de confirmation" },
  { ref: "Nolen-Hoeksema, 1991", concept: "styles de réponse et rumination" },
  { ref: "Pavlov", concept: "conditionnement classique" },
  { ref: "Pennebaker & Beall, 1986", concept: "traitement inhibé des émotions; écriture expressive" },
  { ref: "Petty & Cacioppo", concept: "probabilité d'élaboration" },
  { ref: "Piaget", concept: "pensée magique" },
  { ref: "Preston & Colman, 2000", concept: "fiabilité des échelles de réponse" },
  { ref: "Pyszczynski, Greenberg & Solomon", concept: "théorie de la gestion de la terreur et distanciation temporelle" },
  { ref: "Rachman", concept: "voies d'acquisition de la peur" },
  { ref: "Rachman & de Silva, 1978", concept: "normalisation des pensées intrusives" },
  { ref: "Rachman & Shafran, 1999", concept: "fusion pensée-action" },
  { ref: "Rachman, 1980", concept: "théorie du traitement émotionnel" },
  { ref: "Reeve, 2009", concept: "communication autonomy-supportive et contrôlante" },
  { ref: "Reiss & McNally, 1985", concept: "sensibilité à l'anxiété" },
  { ref: "Rescorla & Wagner, 1972", concept: "erreur de prédiction en apprentissage associatif" },
  { ref: "Rozin & Royzman ; Baumeister et al.", concept: "biais de négativité" },
  { ref: "Salkovskis, 1985", concept: "modèle cognitif des pensées intrusives et des TOC" },
  { ref: "Schachter & Singer", concept: "attribution des émotions" },
  { ref: "Schwartz, B. (2004)", concept: "paradoxe du choix" },
  { ref: "Schwartz, R.C. (1995)", concept: "systèmes familiaux internes" },
  { ref: "Seligman et al., 2005", concept: "psychologie positive" },
  { ref: "Shapiro, EMDR", concept: "technique du lieu sûr et installation de ressource" },
  { ref: "Siegel", concept: "fenêtre de tolérance" },
  { ref: "Sokolov", concept: "réflexe d'orientation et habituation" },
  { ref: "Swann, 1983", concept: "théorie de l'auto-vérification" },
  { ref: "Sweller", concept: "charge cognitive" },
  { ref: "Treynor, Gonzalez & Nolen-Hoeksema, 2003", concept: "rumination/réflexion" },
  { ref: "Tulving ; Slamecka & Graf", concept: "spécificité de l'encodage et effet de génération" },
  { ref: "Watzlawick, Weakland, Fisch", concept: "théorie systémique de Palo Alto" },
  { ref: "Wegner", concept: "suppression de pensée et effet rebond" },
  { ref: "Wells", concept: "entraînement attentionnel et attention auto-focalisée en anxiété" },
  { ref: "White & Epston, 1990", concept: "externalisation narrative" },
  { ref: "Wolpe, 1958", concept: "désensibilisation systématique" },
  { ref: "Yerkes & Dodson", concept: "loi de l'activation optimale (loi de Yerkes-Dodson, 1908)" },
  { ref: "Zillmann, 1988", concept: "régulation de l'humeur par les médias" }
];

/* ---- js/data/journal-icons.js ---- */
// Icônes du Journal — extraites de design/ecran-journal.html, validées par Johan.
// PNG blanc sur fond transparent, ~160x160px.

const journalIcon_compliments = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAA/gklEQVR4nO29e3yU1bU3/n2eueZ+4SrQpsJUXgcLts8pzaGePmoJzSkUbXvGo5ZKK21afQsWLUd8e/o+crSCtVRRe3pirfjD2tbBVuRtaalVjCCiTZQiCbdwSSCBkITcZjKZ57Z+f8zeT3aGyYVLSICsz2d/kpl5Lnuv/d1rr7X22mtL6CYZ507Ux2/SeXj+2by3r9+A3us1kPr29+yzee/FTAPlh3Pd+QDdxU6EcwPSCJ0DjQBwhIaURgA4QkNKIwAcoSGlEQCO0JCSe6grcAGoP2tzxAAZQjpTAJ6tS2OwaTDem9zWVO8YAffASeSVw5fLQQKeLyKcDrgRgJ0jjeiAfVOyj3AEcOeZRgDYN3GJlwzCESCeJxoB4MApGXQjIDwPNKIDnhsNV6PsoqERCXhmNCL1zjOdKQClfkpvRIqiuNg1vBNl9r/NCq+Lq6CgwBsKhSQApKqqDMAl/C7qYCQ8I5Wexu+HcI0s/p7iMy8DaWPyb7JQxDrz7ygQCHiF63nbOdkAwOosto2XgeqiTtsZ32VFUVz8/6T7kutwNv171veKPwy2NCQAUBTFXVFRYQPA9OnT/R6PhzIzM/WysjIOQs50AEAoFJIBIBgM0ptvvikDALvWeaaqqi72nU1EPRorSZIkPE80KmQA8vTp0327du3qZN95AoGAXF1dbSC12yVlm1Jcl2y8UNJ3VFhYmLZjxw4TgIFu8DqDRNM0AEBVVZUEAOvXr08eeOJ7JFVV5bFjxxKQ4NWKFSucd/FrAoGA1+v1EgBEo1EZAK655pq05ubmrh07dphC23tr9/maAZz+vaAAVBTFDcDT0NBA48aNMwGgoqKCAFhgjSMi6ZZbbvFUVlaiqqrKZJVNQ0KiWKyeIqiQnZ3tb29vNwDEhXaYrCAUCnkPHTpE5eXlZgKPALrbbiOhCzvPCwaD6QD0qqoqQ1EUd2ZmJpWVlQEAVFV1GiQMGocURXFe0NbWJldXV9sAjFAo5KqsrHRVVVWZgUDAU11dbSiK4mLXGJqmoaqqSgoGg9Lzzz/vrqmpcbP2Srwd6AaqKbyS88IltNsC4CkuLk6LxWI6AJPV1QXACAaD3qqqKotd5y4oKHDX1NQMZNCddwBeSCNEqqioMJAY8e5jx445UqmwsNA/ZcoUz8mTJ63x48ejoaEBAGIApHXr1l05atQoz6c//emO9PR0bN26NbupqSnPMIx8l8vlISLd6/VmWZYVJaKWK6+88sR1113XGY1GpZaWFtfvfvc7fdmyZR0AdEmSCABKSko8s2fPtn/+8597ysrK4gJDbACoqqqKAHCpqupC/8Gu4vSFzMxMEZBcoklMgpkApIkTJ1rV1dVyeXm59eCDD9KDDz5IrG4SAHn+/Pme8vLyrLS0NDsjIwPbtm1Lr6mpuYKIPpqbm/sxt9vtsm3bJiK9s7OzOR6P106YMOHYjBkzIsePH5dzc3Opuro6csMNN7SyenhDoVCGYRjuzMzMrl//+tdRAAiFQq7169fbNTU1pqIovoqKiviZdur5JHkQi1RYWJgWCAR8EKaNkpISTygUypk3b95oJAaDdPvtt+cR0cfb2tqueuONN+5rbW1to3Og+vr6it/+9rfz2trapnZ1dU0F4OUN1jTNvWbNGh+6pZiox6XS605rV4rvXOjW/2TWLn4tAEiapslbtmzpMfhramqmENH/IqLA0aNHf3IubSYiam5u/vvOnTuvIaKpv/71rwv4+7/1rW9dtWDBgrELFy70z5kzJ5/1CQBIiqJ4hPqnKucLDylpMAEodoa0ZcsW9+rVq9OEd/ui0ehMIvrU3r17n0/ipU1EBi+WZZmWZZlEdFph3/Nr+f89aO/evY8Q0T9Fo1GFv5yI5NLSUg/vpGAw6GWdIQJxIKUHMBVF8YRCIT41SkTkIiIOSLz33ntTiUh5//33F3Z1dSVXVWyDwdtsJVGKtp/W7rq6uv07duy4mYiUGTNm5LJ+cGma5mUDkNcRlyoAJQCuZOD98pe/vJqIbti7d+9/JDFfZ8VgALQFxuq9FcuyeGfZwrOspOsc2rdv30Iiup7XZ9OmTb7y8nIP7wgGHi7VBtpWfq03GAxyaSuHw2FH8k6dOjXrxIkTRc3NzQ1CdUyhjqbwPR+Avbab84oBkrddbLdDBw4c+DkR3bB79+7reH3uueee3JKSEi79pBSgu2gAmEoSSMFg0KtpWiZ/UWNj45eI6Cu1tbUVAm+6iCjORjKxv3FWzobijPn8mTZ7rsHe5XTM7t27vxeLxb4gAlHoDM4wLsFdSe3jneNGYnp3qarqVhTFU1BQ4F+zZo2PiDwAoOv6P8fj8Vt27dq1Vmy3ZVl6QqUjogT4nLqfRbtty7L4vRzIFvvOEbMtLS1WZ2fngubm5hBrn6RpWqaiKOm8zaqqutkUPWgAPFMruD8rSPSrAQARkeu5557LX7RoUeO+fftmX3XVVVcC+B/hfXFWDy+7Txc+AwAMw0BLS0ul2+0+lJ6e3uL3++P8HaZpukzTdNu2LcfjcZ+u66PT09NnZWVl+ZPq5liH/N22beuyLBMAHwA0NzcvGTVq1B5Jkv62ffv2tL///e/2Pffco4dCIc/69eutUCiEQ4cOyRUVFSa6LUaZPVdiLibuxpA0TctesWJFK4C0hoaGuWPHjv0FgNGsPjq69cOU7QaAWCyGjo6O1zMzM+u8Xq/pdrstJLmVurq6fJFI5AoAV48aNeojgqXP3wP+Ltu2TVmWe/DBsqxvv/zyy/tvvfXWt37605+O7ujo6HzzzTe9kUhEb2trs6qrq+OqqvqZJW2l6HdOA7WS7VRfnomE69XZKE5ba9eudUDQ3NwcisfjNXw4spHPpR2XSo4YaG9v/8CyrJXxePzxgwcPLl22bNm/ABgzgMblV1ZWLrAs61EiWklEq44fP741SUp0MYngfGYShyzLam1sbPzOhAkTRgHAli1b/AUFBf7i4uLsUCjk0jRNDoVCLlVVM5HwG/pUVeXtdFQNInKxdv9zTU3Ns4KO18na6/BBbHdzc/PeeDz+WCwW+2lnZ+fP9uzZsxjAhAG0e/Rzzz33xYMHDz4Qj8cfJ6JHotHovuR2U/dMYLPPcSKihoaGvXV1dd/mD1uyZMk4rkIoiuJRFCVdVVU+YM5VR3TofEtAAJBCoZD7xz/+sf+qq65qr6ur+wKAm/Py8hampaWlIeFe8QOQbNs2ZFm2wSQQ+/yfTU1N2e+8884f5s+f/z5/6JgxYzJvueUW37Rp0+y2tjbk5OSgoaHBBcB88MEHY0L9DO5u4VRSUjJlxYoVXxk/frwUi8XuSUtL4x2q27YNWZa9RARJkroA+IkIjY2Nr3i93ifz8vLeJCL/LbfcIh06dEgCYFRUVFiqqqaXlZXFAFBxcbEnFotZZWVl9tq1a73f/OY3u1RVzfz1r3/9vTFjxpT4fL4rkXA/udBTCvkAIB6Pmz6f74fRaNT1yiuvbPv617++Vaw/MxR8tm1zyS3ruk7p6ekWAOTl5VktLS3mPffc08ON8tZbb6mKonze5/O1W5b1gNfrzbdtm2RZ1m3b9siyzPu8C4Dftm1b1/UnPB7Pe263+6X9+/dnL1myJP6Xv/xFYteIKkkqGlIJKANwa5rm5lPArl27bjEMo1bQQ6yk0UhERPv27XtJ1/XvRKPRm8UKHT582L9lyxZ/aWlpenFxsejCAZDQUURFH0z/Wrt2rZ+IfETkLS8vTxfv++CDD+aYplmyd+/e/y9JIvK6WVwqGIZRW1lZGQIAIvLMmzcvHYBr9uzZOZqmyYAj8d0AXEx3xO7du4MdHR1/MU2TNzwu6HiOXldfX3+Q1eXfxXY9++yzWeFwOG379u1pa9eu9TOLXJQ+ySSFQiFXaWmpZ926dRmrV6/OX758eR4S0ywAoL6+/otE9C0iaknVB9TtTSAiajl27Nid/N6bb7551KRJk9LQrQOfNwko0jkD8L777ssAgB07dkxqbW39Q1dXVxPrAFH08+mWdu/e/d9Hjhz5+rXXXutMrZqmZW/atMkXDoddYD6zXuoorjH2teYolZSUeHbv3u3duHFjuvB9fnV19TeOHj16j9AJzrRsWVaciKizs/PUnj17VgNIJyJJ0zR/UVFRRvJ0xK3n7du3B3RdrxTAxtUM2zTNGBHRgQMH/lpfX3/HK6+84riCSktL07ds2eInouQO4saPhw84wTBI1SdOu9esWeMrLS1N1zQtl3958ODBeUT0b8ePH/+A11FQR2zWVxSPxyPxeHz91q1bCwFI999/fw6GMwA1TfOGQiFXLBa70jAM3gGUJPUc/5RpmrcCyOYvD4fDaawTZSZV+LNFRvewrIPBoDeFXiLW08UkpJt/1jTNu2nTJh8l1ozdAMYfPnz4K4cOHfq7CDz2PwcPNTY27vj9739/RSAQ8JWUlKTPmTMn//Of//woAO6SkhKPJEl48cUXZxqGsTdZ0jEQ2kREuq4v/clPfjKet3v16tVplNAXnfoqiuJRVdXN2sbbl2x5nwY44RqXqqpuPng1TZM1TfOWlpY6A/CXv/zldCIqSjX4KDELEBFRV1fXESKaxZ6TmcTrIQGg2GAJgBQOh11EJBHRBCI6JIwsPu/YRNRJRHTw4MHlRMRHvmvZsmVZzAeVqmIyB1AoFPIWFhamITGtuNnfZGdxj4EiTNHiaoQcCoVcoVAo7a677sr7/ve/Pw3AqMWLFweJ6A4GuE7q6U+ziYgMw6iORqMTwVZsvvzlL09SVdUvSRKefvrpaV1dXXXJA41LlyNHjmzftWvXbN4wTdOyWbvFdspC29zJ7RH6SeR/Kl+d+Nct3IOlS5emLV682Bn4J06cKCwvL7+H11tQFWxhEJ3QdX0m4OijgwrA3h4mhUIhV3FxsU/wFbmYfiLt3r17PBGd1gGsQVy3uJMzMhwOc0ev6G/jTPYUFxf7mMWZNnv27I+CKey8AUw6cCl2JqsUTr1VVXXPmzdv9B133DERQDoAX3t7e0ky8FgbeJuOEdFHiE3HmqbJP/zhD6fE43HuVBadyFzH+lFJSckUJCS+O8npK9avt/r2Vc7UPycFg0FvSUmJR1gOdDc2Nt7Q1tamU2IaFmctPgs0tbS0fBIANE3zAnB8hOzvmdThrAAINko549yhUMgLAESUY1lWs9BxfPSbTOr9+dlnn70GTCotWLAgo6CgwM+fpShKOnffsMZ4hHq533777Ue2bt26atWqVV+58847J6BbSnA6UwDKwhQnBYNB75e+9KVx06dPzwDgeuqpp/758OHDr/UmzTZv3vwfnCeLFy/ONgyjJbnt1G3IPEpEciAQ8C1cuHC82O4zqe95Kpg9e3YOd5SzvpOJ6Z1btmy5vqmpifdj8moSWZbVdurUqU8AwKJFi/L5cwXpPbgALCwsTOMVZ52FV155JZeIoikqbRIR1dbWvrVkyZKPC+/g06ZHURTP3Llz8wRL1k1E8h133DFx//79fyCiDtM0W03TtEzT7DIMQ3/zzTdvQULH8Q8QeH0CMBAI+BRFSZ87d24eADdrV4aiKKMPHTr0B9YWUT8yTNM0nn/++TkAPJZldaRoO/cp/oyI5LvvvttZYZg9e3YO5+EQALBHH/PZC0isWwPAzp07MyorK/+L1V9cU+bti7333nufJCIpFArls/vdQqDJoAAwmSlceqCysvJlVllH3+OSr7m5+UkgsQivqqqf3eMC4Jo7d+7E+fPnZ7F3u4gos66urijxKOu0lXne+UREx48fnwYATB3w4BwAOGnSpDRhELgCgYCPBxB86UtfChw9enQra584tZJt29TQ0PAh/1/oJIOIKB6P/zcAPPbYYxnMhSFGmshnWt9BKEC3ypNs7GXu27fvUep2zYj6MDU3N9eXlpbmEJE0a9asLAAy+zvoAJQURfGwl+E3v/nNjUkA4UEDdOrUqf8BgMcffzy3qKgogz9TUZR0RVHSmZsFx44dG/WPf/zjX3oBnM0aLU5tLa2trQFN0+QzAF9fU7As/M4HiMSUbbz11lvzmpubTyYNst7qykH6CwBYunRpProljVtRFA8D41ACEEl/XZMmTUpjEppHyWQDQEtLy/eFiBvuRjOJiN54442bAGDmzJnZs2fPzknC0OAAUNM0WVXVXE3T0olossB4sm3bqVxjY+OvAGD79u1pgn4gIWHIeImFzXd1dX28ra1N1DlEq7mHxDFNs56I9lVUVEwHIN98882jMHADpFcACvqQA0YuDbm1+N577301EolwqSwOhlTgexYAHnnkkVGKouQoipJeUFDgnzVrVpaqqu6CggI/e/6QSUAh7s95F1dpmEriefTRR7MA+I4dO7aSiGKUUCvE/qHjx49/BgDYsuSZDoIBA5AzA0VFRRnLli2bAABsmkwO/6G6urrXAHgoEQEiKYri4R3K/FISAFRWVn4mFdjEqS4ej+umab5jWdb79fX1nwOABQsWjFVVNVOQfuc0BSOhTmQKDm+HD6qqujdv3pwBAES0gtVPbLMIQDIM43kgoRczH6UfSATjBoPBTACugoICv9BhQwFAx+eYBET+Gweja9u2bVkAUFdX999CH/O2m0RE995772hN07KZZOfP6a/+vQJQ9BuJ05IEAKFQKA0AXnvttbmGYTQLUss2TdNsaGjYs3LlSoWI3OxaR8cIBoNeSZIwf/78rL/+9a/fZI3Qk3yFBpN2USJ6rbq6+kdC/bz33nvv6FAo5FIUJZ0DRlB+zwiAzBfoEgNGk66TuGW+ffv2NAAgooeFujr1Nk0z1tzc/HsAWL16dT5XUdjAEw0OV3FxcTa6l9OGSgfk/eIIHMGt5YCkpKTEU1pamv6LX/xiZm1t7evxeLyLes5M+s6dO38DIJstU7qBXtWbAQHQLYZoA/Dw1QZN07x1dXXphmHcQN0OSpsr4LZt04YNG2ZTd3Sx0whVVf0MML4dO3Y8ySufJD25gvuWaZqLeaU2b96cEQ6H06h7t5v4V2Tk+egUKem5EmOk94knnhgHAPX19aWGYUSIKG4mFnsN0zQJgFxXV5eOxHp4X1LgfNV3sIApCeBBKBTKCYfDrqysrFFtbW3cz9tDPSKiL95+++2TuQstFApx6c/9jI50FXhwGvUAoLjQHwwGMx955JFRABCPx/czqcV1IduyrFYi+r9AwsPPnudGQtJkapqWO3ny5JwdO3asNAyjB/hEp2dbW9tKALlAwh2gaZp/1qxZWQMwNgYNgDwUCYD84osv5gHI0HU9mtQBP2FSfwzg+MVwHuo0VAXoXsaUVq1alUNEHiJaQkSt1D0VO05r1ve5jAcQdOvenn8ayWCWGpBQVHns25133pm1du3a3Hg8voASS21OBYgt3wCJ2DkkgMf9a6PXrl2bCwDl5eXLWF0NSlLko9GobprmvUAi6mT37t1edE+BAzE0Bg2A7K8bgKxpmp+IZNM0/+PYsWN/qqurqyKiFQAQCoUyuSsixXR2sRSuF4IbTKztrnA4nAkAx44d+6Ou6yYRWWz2s4mokYi+rWna+G984xsfARLTMNAjgmdAElAGEqsR3NGsqmruww8/fAUAGIZRzjCTvNnne6tWrcopLi72MQnqBeBlbggQUTEllumS9zt0nTp1qun48eMhAGChU064EQ8AFcBwoQEIAFAUJZ2tQ0tC8Om4VatWXQcAGzduTGfg817k0i/ZMOHt9xQXF/u2bNmSuWHDhn8S+t/RhU3TbAWApUuXTuQWP5jvUxAk/QJQApt2uHJ/3333jb377rszm5qa7rAs64gg/cg0TWPPnj2PC89w1haXLl2aRkTu+vr6zzEXSg/g8qiT999/fzYAPP3005lCPdw8miMpMuaCAlDc21FSUuIpKirKmDFjRq6madnEdFJN0/IhOHGTtp8ONaDOhgfgdU9yU3kXL17sA4CdO3feq+t6G3XbABYRNXZ1dWlz5szJX7Ro0Tgw4PWysSslyUBC6jDRKwGQH3jggTEulwuWZf2/VNIPQLamadmqqubyTkO3GwbHjh1bwy4Vw5PiDMBfBxLrioWFhWmhUMjLRlt2H8C4kBLQBSHihruU+KqOpmlubvEWFBT4+YqKwPSLqUiqqrpZ4C/Hg4eHvQEJp/OqVatyACBJCnKV6rDL5cLSpUsncr71oo6kJBlILG8Jnm3phz/8YQEAVywWe5kSSiffKknvv//+0ywgQWJTFADIy5cvH0WJRe5bdF0/QYmoEL6gbRERnThx4lsAcOedd2axjuZGD3cJuITAhP6AOFgAPO131k5eN4n59fyBQMDHl6XOY50udOG8l4VBJPEYxenTp2eoqupftmxZ1rZt275rmmYP53xXV9cHAHK/853vfIwts0qqqrrPZAoWN1PLmqZlL1682NfS0vKQYRjtlLRP9zvf+c5EwIlgcTqJBz6eOHFiFdf1GPgMIjIMw/gKAFDCchRDsvrs/D7K+QRebwWcocI7JXQbS6nqdD6ihy90EevOPzuRStOnT88oKSlJZ/0XEWY1yzTNeFNT028XL17sW758eV4K6Xeafi2SDMEKUhTFw10vRMT3Tzih20REH3zwQS4ScXoeML1tzZo1PkmSQEQhFqYk7vri0/AESZKQtPowUCAMlgQ80w5KZmxKidJHGWqgnU273QUFBf558+alS5KEkydP7hEAyI3LrQDwwgsvZPOAlRT8cajHBwBUUVFhAUAsFpN8Pl8nAE9TUxOPWpFs27YASNu2bZtz7bXXts+ZMycDiT23dllZGc9whdra2qvcbneucJ8OwNvU1HQzgMaXXnrJ9eKLL3IfW6+jYhhSsosm+X+RUuUdvFhzTEsAUFNTEzdN001E7q6urs+CtYXv2Ovo6Ch48sknb1ywYEHH9ddfLzqi+yVxxGLdunUZABCNRlcJWQqIK59lZWVXAAknNdjUxHeFnThx4nZm5YpTL+3ateu3SKRaAwtscDPj5Vyk37lKwL6kVH/F3Ue5GKVcnxKQ671MD3YDSOsZPJ3wCRuG8RIArFy5Mg9wDFNxQ5NDyenZnOyg7e3tEgB4vV63LMsuCDviLcuKx2KxDAByZWVlVJIklJWVyTNnzvQC0PPy8gxZlr1IZD0A2wPrnjBhwloAMSKS2dZNG0Ara+DFKBUuJ5JycnJsAJLP5zMA2AUFBbR58+YH/vVf/3UlWP9JkgSGF+Tn59sAXGxmTDlLpBKNBMDV2NgIADAMQ0SsAcD96quvfrG4uPjozTffnMc2gZOqqvaRI0f8oVBIbmlpyeM32LZtEZGvtrb2nddee22/8CwXe5cspNEdCuprmuyv2H2US25AVVRUmKqqymVlZRIAqqmpMWbMmPEkuqdhCQCi0egV4XB4jKIonZqmSUgIL86TXvniiFrucHzuuec+ffz48UrqXvPj0/BkADJfHQgGg96FCxf6AWSGw+F/PnHixDF2j02JWDIioq8AAF9m4yE/Qiq0i8UIOVPF/WKrc18FQlCtBAC/+MUvJoqGKTdUdV3/LQDU1taKYVrOczilkjzSvffeKwHA17/+9Xnjx48PWpZlyLIs27YtG4YRr6+v9wKgj3zkIzoAKS0tzd3Z2ekGEPvMZz4zady4cRMBxFnmBzkej3cePXqUAOD111+XAMhlZWVdAKiqqkpPUYcLSeciAfsrlxq5KioqzClTpjhup2g0Gu/q6joOJIxPRmQYRhcA8Lze/Hv0IwHdwWDQS4kkimhsbFxhWZZtWZaTNm3v3r1lbC+tOMLdt99+ex6rxA1sNDgJgD788MPf5OfnZzO9L5Vk6I+G0g841FJnOBU3ANecOXPy2aKBD0D6unXr7mLGJs9JSERUCiTSjKTgo0PJEpCmTZtmHThwwAUAOTk5XbIsc4AQADQ1Nb29cePGRiHlPwBImZmZNgAcPXo0B92gIgAYN25ceUtLS7tt273lpL6Y3DCXM9kAcOLEiXhVVZWpKIoNwExPTz8EACzVHaeBuKlOB+D69evtLVu2uMQHsr8EAG63+71Dhw61zpo1Sw4EAg6gTNO0kciA/xEgoZDy+8eMGdNBRFJlZaWMS3NqupyIdu3aZQif9alTp1bx3/iXpmnKAJCdnc1zRg7YCkZeXh4BQGdnpxdwwGQDwJVXXnkSgN7e3i4ZhiEBQCgUksrLy+0JEyZk27Y9hT3GeaFhGCPAuzSICyJLVVV58uTJEgBcc801ZvKFuq57AcDv9/fpEUgJwGuvvdYGgM7OzgwA6E4jB+Tl5Tnor6mpsQHIHR0d0q5du8ybbropPTs7++q+nj1CFz2JkswCIFdXVzszIXfFmKbpBYBPfOITfbqlUoLk4x//uAUAhmGkiQ9NQSYSkTISAMrPz0eyzgjAbm9v9wLAtGnTUiYmHKGLj8rKyqyTJ09y4+I0sizLA8B95MgR4EwlINiqh23bruQf+LTb2dkpgZ1+dPDgQWnq1Km+d99919/R0XEcidzQEnuxLMtyNkYMjUuFSFVVsS/l3NzcVHmj+8snnbg5xXdSZWUlT33mIJdLwYaGBj8ABINBAwBlZmbq2dnZ1qc//WnbMIyj+fn5b7D7IgCkEydO7Hn11VffRsLA6UsPPBdH9GDS5eTn648kANKRI0fElG++FNfANM3Rc+fODST5AU+jlAD8+9//LgOAy+WygJ7mtWVZMgBMmzaNgIQoTktLIwD48MMPvbt27Trc1NTU5XK5cgD48vPzN3zzm9/cunr16vxbbrmFn302Qhch8SXTmpoaE4A9duxYGYDNVDAAPbBCH3zwgTRhgpNfPWW/p/LL0cc+9jEAMNLS0joAgCXyBgBEIhEvAIRCIX5QnzRmzBh569at1pQpU/yvv/76uwUFBdMkSUo/evSoV9f1owCsHTt2RFglLkfJcUmQcEqpjW5AWSzooAe5XK6O+vr6htbWVu4vHrARQuXl5dwRHQESqOZTcFNT0xj+Hb8hFot5ampquqLRaMfevXtzPvnJTx4fPXp01ezZs08+9NBDGYqi5Kxfv945EXOELlri5y+L0S12RkaGqKoBANxudyeA9iuuuMLmZz+nemCf87PL5RKRLQPAuHHjbma7wsRLTQCoqqqyT506FZk9e7b/jjvumPLlL39ZnjBhwvGKiop29Bw1I3RxEtXV1fE4SDp06BAB8L3xxhsZ/AIumHw+XxcAGjdu3IAf7qzT8WzypmkuZ+t6fPMJj4b5OAAwS1cSsj3JmqY5e0T4noCzPPjvQq3HXopROINRXEAiE5bQ367s7Oz89evX3yaE5fdYC2Z5dZKf5VCyBJQASK2trT2ciSn8gAQADz74oITuiBa5sLDQt2LFCru6uloHIJWVldmFhYV+pqSO+AAvbiIAqKurM9hh1wAgl5SUeGfNmvVD/lm43gMATU1NEpu2B2yEyDwaur293czPzycp6fCxeDzuApxQG34St71jx44Ye5EUDAZdlZWVhiRJMSTttB+hi5bcLCoaSIDNPW3aNEyYMGEauvVCybIsikQiJgCMHj2aIpGIoy8iCQciYh3/VllZmR4KhVwvvfTSlsbGxn2yLHv4ZiQAeOmll8YDwJtvvmkBkAoLC/lBg84qSFVVlc5wy6XfUPnyBjNm73KKByRVVd2TJ0+2AdjTp0/3AzDHjBnjHByJRD+7W1tbjz333HMvE5F07Ngxfd68edwA7bOfHb1GURTPPffckwvAffLkyf9h6Rd4Xhe7srLyl3zTknBvfyk0zkUXGyod71zLUOttg6EHuoDuDGAPPfTQlUJEtElE1NHR8WcA/nA4LKYjHpAOCAB2RUWFnZubCyKyxowZ0y5sIHIBsILB4LeKiorGAgD7rV904/KSFpz62jNyMZKNRP+7q6qqjFmzZmV99atffUz4nZBYHYvJstyVk5Mjo58+TgVAALDS09MtSZKosbExYpom0L2JCLZtm+PHj28DgC984Qs8Ec+lCqIRSiJd1yUAKCoq8l199dVfZV9LAGQikhobGzts28aBAwf6xUUqK1gGgPLycjMcDnvfeuutcFtb2/tIGCwWAEmWZferr776KQByY2MjB+bFOqoHk4ZC5x1MkgDIXq+XAGDFihUtLOEAkOh/ubOz88g//vGPp8vLyz379u0zhPv6bTMHH4+AcW3YsCELAAzDeFLw8dhEZJ84cWLPCy+8wLNYic8YbrrUUOqAl6J+6AkGg15N0+TGxsZSYVO6SYkkRRuBRGqOpPzbKXVAkUTGSACknTt3ZhCRZJpm8olBfAseR7U36RlnM+JHADj8C1RV9fNk9dSTTCIi0zR3E5HEMuOKQi0lAHtDIwGgd999V3/++ed9tm0/YprmDvYg7oS0/vSnP30NABRFSU5ufr7LYFJ/hpGUdB2E74ey3oNFqereo+0nT5405s+fP9U0zYjwu2zbdrVhGN978MEH015//XVDVVVXqvv7e7EISikcDucAABG9nCQFqb29vYnlhfawlL7DcWSfC0jEGSEVn87l3UPNl95Kr2cFhkIh1+LFi31EJLe0tGxniQfEBJUVQOKQHnQfp5vyWX0xW0wKjrvvvjuTiKTt27d/r6OjI0LU44wMAjBq5syZ2SxLwlAz70ID8FKcgns7KQtIHCbpAgAi6nFIYywWsz744IMniEgWko6eUYpekTFuIbebd9WqVTmBQMBnGMab4nxvWZYdi8X2FRQU5LJMqUPNvBEADh4AJZ77MR6PvyFkyuXHbRzUNC3zvvvuyxDu6e2ZDiWj0WE0W7+TAFijR4+2q6ur45Ik9dgjIsuy5Pf7AzU1NVIwGDxta94IXVIkLVmyxCCiNEmSpsmynBxH4FqxYkXk85//vInupVeOrwEla+oxKoXTcmQgcQQVEaVZlrWLSUGLWAIi0zQPAUA4HB6OUnBEAp4HCUhEPgAwTXMrdZ9sxaXfqQceeGDMXXfdlSfyTTioEknP65XZYqdI/KgEAPLhw4f9ABCPx7cLPp+EVaLrXT//+c+/BDjJCIeaiRcKgP3RJQFATdPcAPDjH//4X6LRaANXv7gAMgzjCACw6TdVG5Pb2yeznAuEcx5cAPDwww9PBADLso4KCigfBbWlpaXpDKjDKTvoCADPEYDsACHJsqy3RBuAz4QARi1cuNAvCB/OLxndRu2AAdhrKS8v9xCRbFnWa5SIjnYOK4zH41RZWflzANA0jR+nytP9i6eFD7ek3edCl9oUzAUOj2J3aZrmBYBnnnlmXnt7e12S28XUdX2PJEngx3UMsJw1M91r1671A4BpmjFBAnJ94AARXUVE3lAo5OXTd9J5H8MNgOciIYcaMIPFDxc/Jam8vDydiD5GRG8z0BnCFExIHC4p8QN7BsDPswYgVFX1L1iwIIOIPJZlrRf9QDx/YGdn5y4AIKJ0JEZSOktk3p8UHAHg8Cqu3bt3ZwJAJBJ5ifWxeNoVGYaxlfkFU531cv4lIN9wxNcCT506dYDYyggbEWY0Gj20cePGOUDCiY3EOrF4dOdwA+C5APRcMuwPdbv6aq9rzZo1PgAgosmRSORt6nnQpN7W1taagI2TPb8/Xp2XKVjWNE1WFCX9/vvvzwmHw8XUk3gFq4nos0TkTXJMXqwdcrkAUGInZWUSkZ+IPkFE28Wpl/fx22+//b+TIp4HXQJC2I7nzPmGYTxuWVacGyNcTDc3N78JID0cDmeyETJcO2RkCu5ZXCyxOI4fP/4z1qf8gG6LiGJNTU2vUOIsQOd0deFYrsEDIHfLhEIhV2FhYRo7WTGLVZIfSmMTUTwSiZysqKj4d8DJE+w0ED0BN9QAPBcaKMNTzibDqPD6QNM0PwDU1NRMa2tr201EMeFU+wgR0TPPPHMtu1ZG9yGEZ9L2lDSgzuInWbL//U899dQEXdcfSFJSTW4V67o+CwDuuuuuPH4cAz/2lHvKh9h5PZgSMBXQhnrA8b5zJ7lc3GvWrPERkZuIPkVE5aJxSd1RUD8holHMPSOh+2SoMxlwZ8VMzlBnPViIAYRpmt9nFTbECluWdejUqVOfKy0tTV+wYEGGYIzwcJ2hlgYXGoDiUfZDBUAZcAY+HxAeBirfrl27HmZ91yn0aVdjY+OTnC9ilMucOXPyB3DWy3kBoIzuESMBifQcJSUlHgCjDh48+DolHNR81HQSEe3du3c5AJSWlqYLugL4CBzmEvBcptHhCECJ85yffQxA5lPvxo0bP82W2zq5r4/34549e64HnDV/p21J5yQPHgD5oXPspByHweFw2FVcXOx75513vpI0cmwiium6fqK2tlYFehxQzRerJWHRegSAF6C9ouRTVdVdUlLiISIpGo1ONE2zVjA4iNhJV7FY7L+IKIuBD+gpiAZihJw7AJOYCn5Kuqqq7rvuuiuPiDyxWOzbrOI8oREfRU3xePyTAKSFCxf6eeV7OdJ9BICDWPiZ0MFg0MuW0PDqq69eSUR1gg7v6PSxWOyRcDjsCoVCXlF3hLCBbQBbMs4LAB3xDfTIisVHUjoA6Lr+3SQQ8tHURkT/C936BoTnjgDwAhRVVd0FBQV+VVW5EMCWLVsmWZZ1Kqmv4kRELS0tTxKRS9O0dAZWF38GmBTlx7ieAa9S0kAbAVVV+dIagsGgd+7cuXnBYNDLDjl033jjjeOqq6s3JxklXBLGampqpgAJCVpQUOAXDJPhCMBzffawAiCvEwONGwD+9Kc/3cf6yol0JyJqa2vr3LFjx78BACWOb+P3A4L040A+Az6mpAF3VopTzmWwMP7y8nIPAGnPnj3fEIwRizXMIiLatWvXyzfeeOM4ACgoKPCn0AEvpJvisgKgoiie4uLibDaL5Tz33HNFSQLCJrbqEY/HH9E0Td6+fXsa36JRVFSUEQqFXKIxiZ6q1FkDcCAM73daUlXVvXTp0nwAIKJvk5DUSATh22+//RRniGCNQVEUz8yZM7MBeLi/8DwA4XIrHBhih8sAXMXFxdn8ON5wOPw16kkO+IhoJQAsWbJkHFLH9J1LSUnnY8SLPqVcACCi7xGRzoDHJaFNRPTaa6/9O4CsxYsX+wKBgK+wsDBNURRPIBDw8SlCkJAjIDyzIgaAOM5+7m753e9+99kUks8kImptbS1lfecB4BOXYM9T3VLSub6A+5XkgoICf0FBgX/16tX5rCH3MoPEFHxLFhHRG2+88TUAePTRR7NuvfXWcWIli4qKMubNm5fO6jfUHXo2ZSjWviVFUTxMTQIAFwuHc2/atIlHuASpe1uFbdu2IxSOHz/+MrvGg+4AVR4HcL7qnZIGAsD+GOqeOnVqFnWn7PDw/DINDQ3/xRqtCyDUiYgOHjw4G4BMidgyr6IoHlVV/dzkH4b7TIYzAGV0Sz+wv579+/dz8H3SNE0jSS2yTdPU6+rq3gVwBRG5uXuG94GwNWP4AlBRFI9gnns0TZOLi4uz2V4S3+HDh3/H9UAWPWNzK/nkyZNfBIBwOJwWDAa9w3ij+3AvjoHAw+qffvrpTADQdb2QEq4wg7rdLRYRmYZh0I9//OPPa5rGV6s8iqJ45s+fn5Xk4xtSAPYHTv5wR/+47bbbRi9atCifiDzf+MY3Pr5///5Xqee+AptLwsOHD98GAHy0ioEPw6BjL5YiZiPw8RMP2tvbP2cYRgsHHOc9P9WeiB4C4NY0LRPMtXLdddflsR1x8nl2laWkc7WCZTZ1Oua5GAWtqupoZn2Nqa+v/4fFSBiFum3bdPjw4dsB4KmnnholPMMlvD9VnYa608+KX+f43P7e6ebg03X9OsMwTjI+cyuXqHuh4AEA2LRpky8YDHqZq8YxPlgQcm95XoYNACWg19Aql6qq/ttuu220LMvYtGnTdaYp7uwjYqPSIKKO1tbW2wFgy5Yt3OEtArqHv0lVVf95Bs1wL1IKrwDvPzDdOZeDr7Oz81/YNlpnphHBp+v6fQDw+OOP5zJeu5Oe68L5H+Qp6Xya2SmLqqruH/zgB1MAIBqNfqW1tbWNMYIbJaZlWbau652tra23AUBpaWkOAB+XrHz1hHcCy8o11KC4oEVVVbdg5TrABNP/HnjggXEA0NnZ+VnLso6IBp8IPtM0lwDA4cOH/cJymviuwTKWUtJgApB7ynH//ffn8K2d+/bt+5wwBRMzUEwisnVd72hvb/83wJGEXu4n5JYd4LgHhhwUF7hIgUDAx0DoEqfH3bt3ewFA1/V/6gV8PLrlbgAgIi+6V7dwgeqfkgZbAvJnAwAWL16cDQCnTp2aH41GLSIyuE4orEme2r9//3cB+DZv3pwRCAS4XgIAEtsSMFw3+Aw6CIVjs+RgMJi5evXqNAD+HTt2zO0HfCUAwHa+icbjhdKnU9JgAxAi81goUBoAbN269RZBAjrTMRFRPB7vfOedd+4CACJyfIJse+hQr5AM5jpyf4WvKbsKCwvTli5dynlZ2NXV1cx4KBocnezvnQCwZcsWt2Awype8BOTAST64kGdU2rJlyz/t27fvL0kS0GK6SqS6uvrlRYsW5QMAcw2I2wAvNwC6wYI/ioqKMjiQNm3atNCyrJPiAE7S+RYBQGlpqYcNfhcAafbs2Tls/f2SlYDi5mVZUZR0FlUt8YzrAOQVK1Z89siRI++J4CNmoJimSaZpNh07dmwqkADhzTffPOoCMm3AjBT4OZgAlMQ9OevXr1+g63py/CURi+vTdf1uIAE+xm8n+ENQbYaUbxdi1KbyJwGA5/bbb88D4L7jjjsmVlZW/l4EId9zzL6LtbW1TQUAthcFF5BxwwGAUmFhYRqLyQSAzD/84Q93suU1Z8AmTcHfAwAWVOrofEmzkXwBgz5S0lB1osNYAO6ioqIMAOMOHDjwE8uybAZCO4m5diwWCwAADy0SO724uNgnRuwOcZvOqhCRFAqFvEm7zQDAxQfetm3bsk6ePLmXkogP2NbW1q4DBw7cAgALFizIwBBvBRBKShrySi1dujRtwYIFV/KEiMeOHftP0zR7ZOMUiU3HGSUlJR6hoziTPed5+ehCAhCLFi3KD4VCYwAgGAzydHd8ByIqKiomGIbReTr2Emw6derUiV27doWAxLR7nlcyLkkAihZZDjtpG01NTf9JRHExnlCUhtXV1dfwRoVCoUwgMbUUFRVlBAIBnzp0m564xOqN+gUha5MTY8n33BDRRynhUhFPLHDW1+vq6v4IYBwAsHA2r/Deoe7nYQlACUhsdGd56fwzZszI3bx5cwYAmKZ5H9NnzCQQmkREf/vb327gTGbJkNzojk8cyrad9RTM7ncBkEOhkJc774noKsuyOpJmBSeYtKGh4UUA/g0bNmQVFhamcec948NQGmzDGoAymEdfAI07EAj4Vq1a9VEA0HX9fja9mEK6CEfRfvfdd1d0dHRcAwA/+MEPxoMtSwlK93Ar/QIwGAx6v/a1r2XzDmpsbFQMw2il7iThHHwGEVE0Gn0GgLxhw4YsITROmjVrVtYwiypPSUNaKSGSBmD6W3FxcXYwGPTu3LkzAwB0Xf8/HHXCbjsi5mqIx+MniGgmAKxcuTJvOLSrj9Ir+Nig8bLQKGzYsGHC1q1bv9PZ2dlJiRCqHlFEjB+PA8Dx48czeEQLH3xz5szJX7hwoX8Y8SMlDWmleOwfByIfvaFQyDVz5szsX/3qV2MAIBKJPNDc3HyQdYAuAJIHNTQRUSEAPPHEE+N6ed+FcmADqUHW2/e8uDVNywYAIrq6qanpT8l6HnWfXEpE9CiQOEqD7fnlhpi4cw3s83CYEVLSUFbIxQDnZktsPAhVCgQCvvnz52fNmjUra82aNdkAUFpaqh4+fPivjPldAgj56T11LS0tN7IO9CYbItz5yt/dR716A2l/7p3+DBBO4vMdANbV1fEg0iARfcCaFxWWKeNERJFIxIrH4w8DwPbt29OmT5+ewcLTIARtSEmrUCMA7KVISX97BKHyfSIsbg1Tp06dUF1d/WwvICRd14+z4FaPpml+tvAuAQlpy73/wmYbV1JdkiVVKgD2dR/QOxClJN1UAiATkcyt/6qqqk+ZpvkBEZFpmk77iAUU1NbWvvz+++8vAoCNGzemCyqMyLfkeo/ogGdT+GjmmVYXLFiQwYwVt2maS3jHCGvIBhFRR0dH/P333//FtddeOwboTr7IQYDuAMzegCT18jkZiL0Bt6929cg0IOhovgMHDqyMxWJ7WFvExOCdRESnTp36KQB+iqkH3SFZycAeriUlDXWl+irOrju+YamoqCiDEukiQEQlyRKQg9EwDIpEIm+3t7dfDSQCXBl4nZUFpJ6WUgGoL0nYG3j76wT5sccey5AkCZs3bx4bj8f/ZhhGcltsy7IirIk/AgBJkrBp0yafYOFigO8dDiUlDXWl+qxwKBRyKYqSrqqqPxAI+AoKCvyBQMDHw5COHDkyb//+/a8LBgkP7eKduL+8vPwTQGLKEhbfz0QH7AG2pASPqQB4mmNZIKmwsDCNJfrGQw89NMU0zX8wkHGfJ1H3VgUiov8DJMLS5s+fnzVp0iTu43Opquo+z3t3RwDIO1SYft1AdwQH71weV7hu3bqxBw8efFIEISOdScPaw4cPrwOQ9olPfCJvgEfMutAde9ejCIp+fyBMRW6ea2/r1q0/6urqOizWlbVBJyKqq6vb/9Zbb90WCASyS0pKPHwAIrHp3BsIBHzTp0/PGAaO90sSgCIQZMF6lUQQMknoWrx4sS8SiSwXFXbWmTy2kAzDOLJy5co8Siz49yUx+gVfPwBM/szJ2aJgWda+WCwmSjte3zgRUWtr66/efffd8QAwY8aMXDbYxGeLhodrmDmc+wWgyJRekTkcSFVVuayszGIfJSTOoJULCgq8M2fONA4dOiRPnjw5Ky8vr+OZZ54xdV1f7vF4HgFgoXtvMbF7Ydt20/Llyyc/9thjHehjmlQURa6oqHDOulUU5bTrKioqbOH54ntk9j8l/QYAmaZpfuhyuT7G6kOyLPNnm0gA638OHDjw/auuuiq+dOnStGg0ara0tNiHDh2SY7GYVFVVZSS9b6Dun6EmO9WXg436gax9nlVRFCV99uzZOUBiDysA3+rVq9NKS0tHHzt27BXRKGHEU1JE33zzzYcokUrEXVxczIMXEAwGvUIeREfq8b+C9OUkQVARuCOd1c/D9q94AUjhcPiOrq4unhDSFuIdLSKi5ubmug0bNsynRKoSHkDKJfLFoOMNWAKKdNECMOkdACCzoE0/AOnUqVO/FWbi5NhCsizrBCXOtssQMnM5qxLodpk4WwH4jjSwnNnMQHKrqpop7q9gU7z/i1/84vja2to0YscfJJGzwtHW1vb3GTNmfIzd7xHycbvYcy+FXYAp6aIFoKCAi+9yAZDWrVuXAQBEVJq0ftyD4vF406pVq6axDd1p3/3ud8ey53gVRclh0tBJ1A4kNoFz8HFdUsj4KrFQKGnz5s0Zq1atmhaJRPYxwIuxjZZQh78BwGOPPea0hwNQ2At9IfpqBIBn0SBxk5KTsbOgoMCvaVo+AFRXV/+MiPYnSx1RGu7du/dXRDQKgPu73/3uWBaVnD537tyJM2fOzBZO/xR9gBDeDUVRPMuWLcu67rrr8ogoq6Gh4Ynk6Z+RSUQUi8UaLMvaDADhcDiTgQ7ouZYrAY4RdrFPwynpYgZgjyMD0G0NegG4582bl75gwYKM22+/vQAAiOglAQQGkRPGzl0379bX1xcAwKRJk9JKSkpyAPgURUnnVi/TEUXfm5Mvm20rwM6dO8dalvUye2anAD6TuredvnvrrbdOBxKxjHz65suFgLMF1cW+92P4hNafMwB7RePFRswSlZBwykppaWmkqqpcWFjoGTVqlL1nzx7KzMysf+SRR0ZJkvTvlmWtj0QiBwG4bds2JUkCAJ9t2zqAmRkZGX87efLkv65YseKKP/7xj+7S0lL/5MmTzczMzIyCggLPmDFj7Egk4s3OznYFg0EXAGnu3Lk+Xdc906dPzzAM48YrrrjiZVmWv2rbdhwAd5+YYJLTsqwyn8/3mZdeemnX2rVr/X/+85+l+vp6APCWlZWhuro6rqqqPH78+PSTJ09KAFBWVtaFXqzIi50uWgnIpRG6JaEMJKSIqqrum266KXfhwoV+Zk16v//9718BAD/4wQ9mm6b5/7gKRklHkhIRtbe3v/Dhhx9OYc/LDYVC4wOBAN9D6wKb7h977LEMIDGFNjU1PZ0sYdl0HyMiikajb7e0tLzIrueHPjoWM5d+vP5Aj4MBh7uP74wkoEgXLQBTHJ4ivpMTjzX0A5APHz7sv+2220YDQFdX1+8ci4CtPrDscREioubm5oqDBw/eyzfGh8PhTL7XoqSkJF1Y0Zjd2NgYZo/qEFw/jvFjmuYmVVVz2XMcAwMMyOJeX77cCDi5YIbD2XqDDsD+gHK2ILoQbpjeymmhTwBkIpIWLVo0DgA6Ojoebm9v59LQib0TEjiSruvP3n///TkAcN99943loWEAEI1G/6uxsbGJ3SOGh8UYiPe1tLSsCYfDaZqmudl+l1R5DyF8lnr5f7iWgfZvSrqUAdgrMOfPn5/Fk3ffc889uZZlvcCwIwYymEQUJSLq6OjYEIlEfsaZ9s4779za1dX1S2HK5YA1+ZRrmuZft27dWshucfWyfJfMp6EG0wgAL1DB9OnTM5YvX54HJHLl7d+//0cNDQ1HGHhiKcBFlmX9xrKsX7a1tbWzz3EuNU3T1ImIIpEI1dfXr2lqapoIQH7llVdyeT4X9B4eP9T8GAHghSyqqvp5mjcWHeMGgPLy8k9ZlvUqw1uMun2GBrGQ+BTAtLmkNE2zora29gsAMoGEc1lRlPSpU6dmCQfzjABQoMsSgIJi7woEAr7i4mIfyyovE9Goqqqq+1tbW7lhIubaM0g4ckJcZamtrV0fi8WuBBI5+G666aZcMN9hUVHR2KS13REAMrosAZhUvHyNd9myZVkA/KNGjco6fvz4NMMwKhi+xJTCPSSgaZonotGo8sQTT3wU6N4kLyzfiYdzj0jAJLpcAdhjCY999gSDQW9xcbGPHytLRKMrKyt/KoCOZyawiYi2bdu2kogmMl5KoVAoja9kJJ0WIEZRjwBQoHN9wXAF2Nkw0QFHQUGBn02h7rvuuiuvo6NjnGVZxwRjxFqzZs0nwXJWs8RKbmFql4Tniv8PdTuHBQAl4f9ekSkQ9X9JryT1f8mwIwIgK4oiZ2ZmUllZmQlAfuGFFzKvvvpqqaKiImfixIkd8+bN01VVla6//vquFStWSIqieNra2qzq6uo4em/3xciP/qgvfIjtPeuA1MtBAorFLYS4uwDIzIBIy8/P58txfJmMM9gtbBa6WNs9IgGHETlBDhDC64uLi71/+ctfzL5C9isqKqzTnnZp0xlLwBEA9k0SupklK4ric7lcbsuyYhUVFZaqqjIAlJWVifs9SLj3cqORKfg8F4mIpGAw6GUBA+IU4kRGCwx27hV8fZdTOeMpWGTgCKUgKREoaAHgO9BcAGRVVQHAXVZWZgOJXXvXX3+9vWLFChuA/Mc//pFP2b3RJRnTd6Y0MgX3Q4qiuNra2uTq6moTCSACibYk88L5LhgMerOzs107duzoywo+F14OVxp0HfBypGSm9gccGd26YF885bzv7fkX5YAdIDkAHJmC+6dkaZcMHCnFdVznGaF+aASA/VNvEo8r1yKJoJOYnpiSBMv5sqYRAA4iRSKRvqbREQBiBID9EdflUgFJQkLK9fgtEolImZmZBIxIuYHQiBHSN/UGwN4Amfz/QAA4YoSMUL8kglBK+r636/ujSxlgA6bhJAEH6kMaoYufHAk41KAbocucRgA4QkNK/z9evPtqp4oS2QAAAABJRU5ErkJggg==";
const journalIcon_declencheurs = "data:image/png;base64,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";
const journalIcon_filSoirs = "data:image/png;base64,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";
const journalIcon_bilan = "data:image/png;base64,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";
const journalIcon_verifAttentes = "data:image/png;base64,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";

// Icône de "Faire le point" (v1.92) — comble le manque signalé en v1.73 (l'écran réutilisait
// jusque-là journalIcon_bilan faute de maquette source dédiée). Contrairement aux cinq icônes
// ci-dessus, extraites d'une maquette de Johan, celle-ci a été dessinée par Claude (SVG en ligne,
// même style que les autres : trait blanc, angles arrondis, fond transparent, 160x160), faute de
// maquette source pour cette section. Quatre pistes proposées à Johan (boussole, appareil photo,
// miroir, sablier) ; boussole retenue — écho à la métaphore du "chemin" déjà filée dans toute
// l'app (v0.14) : faire le point comme on s'oriente sur sa route, sans jugement ni chiffre.

const journalIcon_faireLePoint = "data:image/png;base64,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";

/* ---- js/data/grid.js ---- */
// Grille d'outils — 4 catégories (v0.46), noms d'outils/modules repris du cahier des charges.
// live:true = écran réellement construit et navigable dans cette version d'essai.
// Les autres apparaissent grisées ("à venir") : honnêteté du squelette plutôt que des liens morts.

const categories = [
  {
    id: "je-respire",
    name: "Je respire",
    tools: [
      {
        id: "respiration-3-niveaux", name: "Je respire, je m'apaise en profondeur", live: true, route: "#/outil/respiration-3-niveaux",
        // Lien retour outil → psychoéducation (v1.42), symétrique du lien module → outil déjà en place
        // (fondateur pointe déjà vers cet outil, cf. js/data/fondateur.js). Discret, en bas d'écran,
        // jamais au milieu de l'exercice — cf. note d'usage instant présent (v0.48).
        relatedModule: { slug: "fondateur", title: "Je me sens anxieux·se, c'est quoi exactement ?", desc: "le module qui explique le mécanisme derrière cet exercice" }
      }
    ]
  },
  {
    id: "je-mancre",
    name: "Je m'ancre",
    tools: [
      { id: "mantra", name: "Le mantra", live: true, route: "#/outil/mantra" },
      {
        id: "ancrage-5432", name: "Je m'ancre, je suis là", live: true, route: "#/outil/ancrage-5432",
        // Lien retour outil → psychoéducation (v1.59), même principe que respiration-3-niveaux (v1.42).
        relatedModule: { slug: "fondateur", title: "Je me sens anxieux·se, c'est quoi exactement ?", desc: "le module qui explique pourquoi revenir au présent aide à apaiser l'angoisse" }
      },
      {
        id: "marche", name: "Je marche, je me libère", live: true, route: "#/outil/marche",
        relatedModule: { slug: "perte-controle", title: "J'ai peur de perdre le contrôle, est-ce vraiment possible ?", desc: "le module qui explique pourquoi une action simple aide à retrouver un sentiment de contrôle" }
      },
      {
        id: "odeur-rassurante", name: "J'inspire cette odeur, je reviens à moi", live: true, route: "#/outil/odeur-rassurante",
        relatedModule: { slug: "neurologie-crise", title: "Mon cœur s'emballe, je panique", desc: "le module qui explique le mécanisme d'une crise de panique" }
      },
      { id: "odeur-association", name: "Je sens cette odeur, je construis ma sérénité", live: true, route: "#/outil/odeur-association" }
    ]
  },
  {
    id: "comprendre",
    name: "Comprendre",
    // Regroupement par axe thématique (v1.60), à la demande de Johan, pour la clarté de lecture et la
    // recherche par symptôme (chantier noté en v1.58). Réorganisation purement visuelle — aucun module
    // déplacé de catégorie, renommé, ni retiré ; `tools` reste une liste plate consommée telle quelle
    // partout ailleurs dans le code (moduleCheck, relatedModule...), seul l'ORDRE change et un nouveau
    // champ optionnel `axisTitle` marque le premier module de chaque axe pour que home.js insère un
    // sous-titre avant sa carte (cf. js/screens/home.js). Fondateur reste seul en tête, sans sous-titre,
    // comme point de départ commun avant les quatre axes. Ordre des axes choisi par Johan : corps,
    // pensées, quotidien, émotions. Répartition arbitrée par Johan module par module (v1.60) : la
    // respiration reste dans l'axe corps, le sommeil rejoint le quotidien (pas les pensées ni le corps),
    // rumination du soir rejoint bien les 6 modules de l'axe pensées. Intitulés d'axe écrits par Johan.
    tools: [
      { id: "fondateur", name: "Je me sens anxieux·se, c'est quoi exactement ?", live: true, route: "#/module/fondateur" },

      // Axe corps (4)
      { id: "neurologie-crise", name: "Mon cœur s'emballe, je panique", live: true, route: "#/module/neurologie-crise", axisTitle: "Quand mon corps s'affole" },
      { id: "body-scan", name: "Je scanne mon corps en permanence, à l'affût du moindre symptôme, pourquoi ?", live: true, route: "#/module/body-scan" },
      { id: "symptomes-digestifs", name: "Mon anxiété me donne mal au ventre, me coupe l'appétit — c'est lié ?", live: true, route: "#/module/symptomes-digestifs" },
      { id: "respiration-module", name: "Pourquoi respirer m'aide vraiment à me calmer ?", live: true, route: "#/module/respiration-module" },

      // Axe pensées (6)
      { id: "evitement", name: "J'évite tout ce qui m'angoisse, est-ce que j'ai raison ?", live: true, route: "#/module/evitement", axisTitle: "Quand mes pensées m'angoissent" },
      { id: "anticipation-anxieuse", name: "J'ai peur de ce qui pourrait arriver, avant même que ça arrive", live: true, route: "#/module/anticipation-anxieuse" },
      { id: "pensees-intrusives", name: "J'ai des pensées qui me font peur et que je ne contrôle pas", live: true, route: "#/module/pensees-intrusives" },
      { id: "catastrophisme", name: "J'imagine toujours le pire, pourquoi ?", live: true, route: "#/module/catastrophisme" },
      { id: "perte-controle", name: "J'ai peur de perdre le contrôle, est-ce vraiment possible ?", live: true, route: "#/module/perte-controle" },
      { id: "rumination-soir", name: "Le soir, je rumine tout ce qui s'est mal passé, comment arrêter ?", live: true, route: "#/module/rumination-soir" },

      // Axe quotidien (3)
      { id: "declencheurs-personnels", name: "Pourquoi est-ce que ça m'angoisse, moi, alors que ça n'a pas l'air de déranger les autres ?", live: true, route: "#/module/declencheurs-personnels", axisTitle: "Quand le quotidien pèse" },
      { id: "anxiete-matin", name: "Je me réveille déjà anxieux·se, qu'est-ce que je fais ?", live: true, route: "#/module/anxiete-matin" },
      { id: "sommeil", name: "Je n'arrive pas à dormir tellement je suis anxieux·se, que faire ?", live: true, route: "#/module/sommeil" },
      // Nouveau module (v1.91), chantier "soutien social" — construit à la demande de Johan
      // ("on avance" → "Soutien social"), volontairement 100% local (pas de fonctionnalité "sociale"
      // au sens compte/serveur). Lien de clôture vers l'outil "personne-confiance" ci-dessous
      // (catégorie Mes ressources) — lien retour symétrique déjà en place sur cet outil.
      { id: "soutien-social", name: "Je m'isole quand je vais mal, est-ce que ça m'aide vraiment ?", live: true, route: "#/module/soutien-social" },

      // Axe émotions (1)
      { id: "emotions", name: "Je ne gère pas mes émotions, au secours...", live: true, route: "#/module/emotions", axisTitle: "Quand mes émotions débordent" }
    ]
  },
  {
    id: "mes-ressources",
    name: "Mes ressources",
    tools: [
      {
        // Placé en tête de "Mes ressources" depuis la v1.64 (auparavant 3e) : porte désormais aussi
        // le message vocal pour les moments difficiles (cf. js/screens/outil-phrase-confiance.js) —
        // Johan la considère comme la ressource la plus importante, à mettre en valeur (cahier des
        // charges v1.64), d'où cette remontée en premier dans la liste.
        id: "phrase-confiance", name: "J'ai confiance, je tiens bon", live: true, route: "#/outil/phrase-confiance",
        relatedModule: { slug: "anxiete-matin", title: "Je me réveille déjà anxieux·se, qu'est-ce que je fais ?", desc: "le module qui explique pourquoi l'angoisse est parfois plus forte au réveil" }
      },
      { id: "protecteur-critique", name: "Je me critique, je me réponds avec tendresse", live: true, route: "#/outil/protecteur-critique" },
      { id: "figure-aidante", name: "Je me confie, je me sens accompagné", live: true, route: "#/outil/figure-aidante" },
      { id: "coussin-emotions", name: "J'accueille mes émotions, je m'équilibre", live: true, route: "#/outil/coussin-emotions" },
      {
        id: "lieu-secure", name: "Je m'y réfugie, je me sens en sécurité", live: true, route: "#/outil/lieu-secure",
        relatedModule: { slug: "neurologie-crise", title: "Mon cœur s'emballe, je panique", desc: "le module qui explique pourquoi ton corps réagit ainsi en pleine crise" }
      },
      {
        id: "ecriture", name: "J'écris, je m'en libère", live: true, route: "#/outil/ecriture",
        relatedModule: { slug: "catastrophisme", title: "J'imagine toujours le pire, pourquoi ?", desc: "le module qui explique pourquoi ton cerveau invente toujours la pire des hypothèses" }
      },
      {
        id: "je-verifie", name: "Je vérifie, je reprends la main", live: true, route: "#/outil/je-verifie",
        relatedModule: { slug: "evitement", title: "J'évite tout ce qui m'angoisse, est-ce que j'ai raison ?", desc: "le module qui explique pourquoi éviter et vérifier soulagent tout de suite, mais nourrissent l'angoisse" }
      },
      // v1.86 : outil "hiérarchie d'exposition" — chantier resté explicitement de côté depuis l'avis
      // bêta-testeur (v1.63, point 2). NOM PROVISOIRE, à valider par Johan (cf. cahier des charges
      // v1.86) : convention "Je [verbe], je [résultat]" reprise des autres outils, écho volontaire à
      // "reprendre la main" déjà utilisé pour "Je vérifie..." et dans le texte de clôture du module
      // "évitement". Second outil (avec "Je vérifie, je reprends la main") relié à ce module.
      {
        id: "echelle-exposition", name: "J'avance, une marche à la fois", live: true, route: "#/outil/echelle-exposition",
        relatedModule: { slug: "evitement", title: "J'évite tout ce qui m'angoisse, est-ce que j'ai raison ?", desc: "le module qui explique le mécanisme de l'évitement et de l'exposition graduée" }
      },
      // Point 4 du volet clinique de la relecture bêta-testeur (v1.63), texte validé point par point
      // avec Johan (v1.71). Module de consolidation (pas un axe de "Comprendre"), d'où sa place ici.
      // Route "module" comme les fiches de "Comprendre" — le système de routes ne dépend pas de la
      // catégorie qui l'affiche, seulement du préfixe #/module/ ou #/outil/.
      { id: "trois-mois", name: "Et dans trois mois, ce sera comment ?", live: true, route: "#/module/trois-mois" },
      // Nouvel outil compagnon du module ci-dessus, atteint aussi depuis son lien de clôture — un
      // tout petit plan (réflexe + action), même mécanique que les plans par déclencheur du Journal
      // (intention de mise en œuvre, Gollwitzer), mais un plan unique et global, pas par déclencheur.
      { id: "plan-rechute", name: "Mon petit plan, si ça revient", live: true, route: "#/outil/plan-rechute" },
      // Nouvel outil compagnon du module "soutien social" ci-dessus (v1.91), atteint aussi depuis son
      // lien de clôture — même principe de lien retour bidirectionnel que les autres outils/modules
      // liés (cf. figure-aidante, echelle-exposition...). Liste de personnes de confiance, sans
      // suppression (cf. js/store.js, getPersonnesConfiance/addPersonneConfiance).
      {
        id: "personne-confiance", name: "Je me tourne vers quelqu'un, je ne reste pas seul·e", live: true, route: "#/outil/personne-confiance",
        relatedModule: { slug: "soutien-social", title: "Je m'isole quand je vais mal, est-ce que ça m'aide vraiment ?", desc: "le module qui explique pourquoi demander de l'aide est une compétence, pas une faiblesse" }
      }
    ]
  }
];

const journalMenu = [
  { id: "compliments", name: "La boîte à compliments", desc: "se rappeler de quoi tu es capable", live: true, route: "#/journal/compliments", icon: journalIcon_compliments },
  { id: "declencheurs", name: "La liste des déclencheurs", desc: "ta carte, redessinée petit à petit", live: true, route: "#/journal/declencheurs", icon: journalIcon_declencheurs },
  { id: "fil-soirs", name: "Le fil de tes soirs", desc: "nommer, sans expliquer", live: true, route: "#/journal/fil-soirs", icon: journalIcon_filSoirs },
  { id: "bilan", name: "Le bilan auto-écrit", desc: "relire, sans compteur ni score", live: true, route: "#/journal/bilan", icon: journalIcon_bilan },
  { id: "verif-attentes", name: "La vérification des attentes", desc: "noter une prédiction, la vérifier", live: true, route: "#/journal/verif-attentes", icon: journalIcon_verifAttentes },
  // Auto-évaluation de progression (v1.73), point 1 du volet clinique de la relecture bêta-testeur
  // (v1.63) — cf. js/screens/journal.js pour les items et js/store.js pour le stockage. Icône dédiée
  // ajoutée en v1.92 (boussole, cf. js/data/journal-icons.js) — remplace le placeholder provisoire
  // journalIcon_bilan utilisé depuis la v1.73, faute de maquette source à l'époque.
  { id: "auto-eval", name: "Faire le point", desc: "un instantané, de temps en temps, juste pour toi", live: true, route: "#/journal/auto-eval", icon: journalIcon_faireLePoint }
];

/* ---- js/data/grid-icons.js ---- */
// Icônes de la grille d'accueil (4 catégories) — assets déjà choisis et finalisés par Johan/Claude
// (design/icon_*_recolored.png, vérifiés dans design/icons_recolored_check.png).
// Redimensionnées ici pour rester légères dans le prototype, sans modification du dessin ni de la couleur.

const gridIcon_jeRespire = "data:image/png;base64,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";

const gridIcon_jeMancre = "data:image/png;base64,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";

const gridIcon_comprendre = "data:image/png;base64,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";

const gridIcon_mesRessources = "data:image/png;base64,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";

/* ---- js/data/fondateur.js ---- */
// Contenu repris mot pour mot du cahier des charges (module fondateur, v0.19-v0.20, v0.49, v1.02)
// Source : design/ecran-module-psychoeducation-fondateur.html

const fondateur = {
  slug: "fondateur",
  cover: {
    badge: "Comprendre",
    title: "Je me sens anxieux·se, c'est quoi exactement ?",
    desc: "Le module fondateur — <strong>pourquoi l'angoisse existe</strong>, comment elle se loge dans le corps, les pensées et le rapport au temps, et pourquoi la certitude de <strong>retrouver le calme</strong> compte plus que l'absence d'angoisse elle-même.",
    meta: "3 volets, 35 cases · ~4 min",
    volets: [
      "Qu'est-ce que l'angoisse, au juste ?",
      "Les lunettes de l'angoisse",
      "La certitude de revenir"
    ],
    related: "Ce module renvoie, en fin de lecture, vers un outil pratique en lien."
  },
  volets: [
    {
      num: 1,
      name: "Qu'est-ce que l'angoisse, au juste ?",
      color: "sage-dark",
      cases: [
        { text: "L'angoisse, l'anxiété, une crise de panique — tu les vis peut-être déjà, sans jamais t'être vraiment demandé ce qu'elles sont." },
        { text: "Une chose, d'abord : ce n'est pas un défaut. C'est une réaction normale du corps, quand il croit repérer un danger." },
        { text: "Une réaction qui nous accompagne depuis toujours — c'est elle qui a permis à l'espèce humaine de survivre, en évitant le danger à temps." },
        { text: "Ce système de détection n'est pas infaillible. Il lui arrive de se tromper — de sonner l'alarme pour rien." },
        { text: "Une fausse alerte, en soi, ce n'est pas grave." },
        { text: "Mais elle se loge quelque part. D'abord dans le corps — le souffle qui se raccourcit, le cœur qui s'emballe." },
        { text: "Elle se loge aussi dans la tête — une pensée qui s'impose, qu'on ne contrôle pas, et qui revient sans cesse." },
        { text: "Et elle se loge presque toujours hors de l'instant présent — tournée vers ce qui est déjà arrivé, à ressasser. Ou vers ce qui pourrait arriver, à anticiper." },
        { text: "Le corps, les pensées, le rapport au temps — trois terrains différents, un même mécanisme au fond." },
        { text: "Et c'est là, sur l'un de ces terrains ou sur plusieurs à la fois, que peut naître autre chose : la peur de ressentir à nouveau cette peur." },
        { text: "Cette peur-là peut, avec le temps, prendre toute la place — jusqu'à ce que ta vie entière tourne autour d'elle." },
        { text: "Cette application joue justement sur chacun de ces terrains — le corps, les pensées, le retour à l'instant présent. Pas pour faire disparaître l'angoisse : pour lui redonner sa juste place, et qu'elle redevienne ce qu'elle a toujours été — quelque chose de banal.", climax: true },
        { text: "Quelques mots qu'on va utiliser souvent ici, avec un sens précis." },
        { text: "L'anxiété : un malaise diffus, souvent tourné vers l'avenir — une inquiétude qui s'étire, sans toujours avoir d'objet précis." },
        { text: "L'angoisse : plus intense, plus incarnée dans le corps — le mot vient du latin angustia, l'étroitesse, comme une gorge qui se serre." },
        { text: "La crise d'angoisse, ou l'attaque de panique — les deux mots désignent la même chose : un pic soudain et intense, avec des sensations physiques fortes. Ça monte vite, et ça redescend aussi." },
        { text: "Trois mots d'une même famille — celle qu'on va apprendre, ensemble, à mieux connaître.", climax: true }
      ]
    },
    {
      num: 2,
      name: "Les lunettes de l'angoisse",
      color: "gold-dark",
      cases: [
        { text: "Quand on est anxieux, tout paraît anxiogène." },
        { text: "Comme si on portait des lunettes de l'angoisse." },
        { text: "Pense à ton plat préféré." },
        { text: "Maintenant imagine : nausée, ventre noué." },
        { text: "Même lui... donnerait envie de vomir." },
        { text: "L'angoisse, c'est le même processus." },
        { text: "Une chaise. Une table. Rien de spécial." },
        { text: "Avec les lunettes de l'angoisse, tout devient menaçant." },
        { text: "Mais ce ne sont que des lunettes." },
        { text: "Et ça, ça s'enlève." },
        { text: "Comme un ciel qui redevient bleu après une tempête.", climax: true }
      ]
    },
    {
      num: 3,
      name: "La certitude de revenir",
      color: "terracotta",
      cases: [
        { text: "Au risque de te surprendre, en elle-même, l'angoisse n'a jamais été le problème." },
        { text: "Ce qui pose vraiment problème, c'est autre chose : la crainte de ne pas pouvoir retrouver un état de calme et d'apaisement." },
        { text: "Peu importe la profondeur de la descente — même le fond du gouffre ne ferait pas peur, si on savait qu'à coup sûr, et dans un temps connu, on retrouverait la surface." },
        { text: "Il existe un vieux proverbe : tomber sept fois, se relever huit." },
        { text: "Tomber, même s'effondrer, ce n'est plus un problème dès l'instant où on est certain de pouvoir se relever — même si ça demande des efforts." },
        { text: "C'est exactement ce que cette application cherche à construire avec toi : pas l'absence d'angoisse, mais la certitude de revenir à un état de calme et d'apaisement, à chaque fois." },
        {
          text: "Et avec cette certitude retrouvée, l'angoisse peut redevenir ce qu'elle a toujours été en réalité : quelque chose de banal. Qui se vit, et qui s'oublie presque aussitôt.",
          climax: true,
          closing: {
            intro: "Pour t'apaiser, tu peux essayer :",
            links: [
              { title: "Je respire, je m'apaise en profondeur", desc: "l'exercice de respiration en trois niveaux", route: "#/outil/respiration-3-niveaux" },
              { title: "Je m'ancre, je suis là", desc: "l'ancrage par les cinq sens (5-4-3-2)", route: "#/outil/ancrage-5432" },
              { title: "Je marche, je me libère", desc: "la marche de nettoyage, pour évacuer par le mouvement", route: "#/outil/marche" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/evitement.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "évitement", v0.22-v0.23, anecdote
// enrichie v1.08) — source : design/ecran-module-psychoeducation-evitement.html (v1.09).
//
// Deux écarts, résolus sans bloquer, tous deux transparents dans la note propre du fichier témoin
// lui-même plutôt qu'entre deux sources différentes :
// 1. La couverture du témoin annonce encore "Ce module renvoie, en fin de lecture, vers un outil
//    pratique en lien (v0.32)" — mais la note d'en-tête du MÊME fichier dit explicitement l'inverse,
//    daté plus récemment (v1.09) : "Pas de lien de clôture [...] aucune ressource existante ne
//    correspond clairement au mécanisme d'exposition graduelle décrit ici. Décision actée (v1.09)."
//    La phrase de couverture est un reliquat non mis à jour ; la décision v1.09, plus récente et
//    explicite, est retenue — cover.related est donc laissé vide (aucune promesse de lien inventée).
//    MISE À JOUR v1.86 : ce manque est désormais comblé — l'outil "J'avance, une marche à la fois"
//    (hiérarchie d'exposition) a été construit et ajouté aux liens de clôture ci-dessous. cover.related
//    reste néanmoins vide : il concerne la carte de couverture du module, pas le texte de clôture.
// 2. Le témoin affiche "📖 5 cases + tableau + expérience" et "⏱ ~3 min" comme deux indications
//    séparées ; le gabarit réutilisé (déjà en place pour "fondateur") n'affiche qu'une seule ligne de
//    méta — les deux sont combinées en une phrase, sans perte d'information, plutôt que de dupliquer
//    le composant partagé pour ce seul module.
const evitement = {
  slug: "evitement",
  cover: {
    badge: "Comprendre",
    title: "J'évite tout ce qui m'angoisse, est-ce que j'ai raison ?",
    desc: "Module de l'axe pensées — pourquoi <strong>éviter et contrôler</strong> soulagent tout de suite mais <strong>nourrissent l'angoisse</strong> à long terme, sur les terrains externes et internes.",
    meta: "5 cases + tableau + expérience · ~3 min",
    volets: [],
    related: null
  },
  volets: [
    {
      num: 1,
      name: "Le mécanisme de l'évitement et du contrôle",
      color: "sage-dark",
      cases: [
        { text: "Face à un danger qu'on imagine, le cerveau invente des stratégies pour s'en protéger." },
        { text: "Deux grandes familles : éviter, ou contrôler." },
        { text: "Et deux terrains : ce qui vient de dehors — une situation, un lieu. Ou ce qui vient de dedans — une sensation, une émotion." },
        { text: "Le problème : ça soulage tout de suite... mais ça confirme au cerveau que le danger était réel." },
        { text: "La prochaine fois, l'alarme sonne encore plus fort.", climax: true },
        {
          panelClass: "case-panel-table",
          panelHtml: `
            <div class="ev-table-title">Deux familles, deux terrains</div>
            <div class="ev-table">
              <div class="ev-cell ev-corner"></div>
              <div class="ev-cell ev-head">Externe<span class="ev-sub">situation, lieu</span></div>
              <div class="ev-cell ev-head">Interne<span class="ev-sub">sensation, émotion</span></div>
              <div class="ev-cell ev-rowhead">Évitement</div>
              <div class="ev-cell">• Peur de la foule → éviter concerts, manifestations<br>• Peur de l'avion → ne jamais voler</div>
              <div class="ev-cell">• Peur d'un AVC → éviter le sport<br>• Peur d'une émotion forte → l'étouffer dans le chocolat</div>
              <div class="ev-cell ev-rowhead">Contrôle</div>
              <div class="ev-cell">• Peur du jugement → contrôler chaque conversation<br>• Peur de l'imprévu → tout planifier</div>
              <div class="ev-cell">• Peur de sa tristesse → ne jamais pleurer<br>• Peur de sa colère → toujours paraître calme</div>
            </div>
          `
        },
        {
          panelHtml: `
            <div class="anecdote">
              <div class="lbl">Mon expérience</div>
              <p>Petit, j'ai eu peur des chiens. Pas à cause d'une mauvaise expérience — à cause d'une phrase prononcée par mon père avec une grande émotion de peur.</p>
              <p>J'avais cinq ans. Je marchais avec mon père sur un trottoir, et j'ai vu un magnifique husky. Je me suis avancé pour le caresser. Mon père m'a retenu par le bras : « Attention, ces chiens-là peuvent te mordre le mollet. »</p>
              <p>Instantanément, j'ai senti la morsure sur ma jambe. Elle n'avait jamais eu lieu.</p>
              <p><span class="hl">Mon cerveau avait appris une règle : les chiens sont dangereux, ils mordent le mollet. Et par la suite, mon cerveau a ancré cette croyance dans ma mémoire associative, et il l'a appliquée à la lettre — à tous les chiens.</span> Même au chihuahua du voisin. Pas très rationnel, tu en conviendras.</p>
              <p>Dès que je croisais un chien, j'angoissais. Cœur qui bat, respiration courte. J'évitais toutes les situations où je risquais d'en croiser un.</p>
              <p>Pas facile à vivre. Et pire : en évitant, je privais mon cerveau de la seule chose qui aurait pu lui prouver le contraire : des chiens affectueux et inoffensifs.</p>
              <p>À 17 ans, je me suis fait un ami qui avait deux choses : un gros chien, et une piscine — bien pratique pour supporter les étés caniculaires de Grenoble. Pour me baigner, j'ai dû <span class="hl">confronter ma peur</span>.</p>
              <p>J'ai compris qu'un chien qui court vers toi en aboyant, parfois, c'est juste qu'il veut jouer. Petit à petit, un lien de confiance a grandi entre ce chien et moi.</p>
              <p><span class="hl">Ma peur des chiens s'est nettement améliorée</span> depuis, et <span class="hl">ma croyance a évolué</span> : maintenant je sais que certains chiens peuvent être dangereux et je sais m'en protéger, mais que la plupart sont très affectueux et joueurs.</p>
            </div>
          `,
          closing: {
            intro: "Pour reprendre la main sur l'évitement :",
            links: [
              { title: "Je vérifie, je reprends la main", desc: "noter ce que tu redoutes, pour comparer ensuite avec ce qui arrive vraiment", route: "#/outil/je-verifie" },
              // v1.86 : deuxième lien de clôture, ajouté à la liste existante — résout le manque
              // explicitement signalé par la note du fichier plus haut ("aucune ressource existante
              // ne correspond clairement au mécanisme d'exposition graduelle décrit ici", v1.09).
              { title: "J'avance, une marche à la fois", desc: "lister ce que tu évites, du plus facile au plus difficile, et avancer une marche à la fois", route: "#/outil/echelle-exposition" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/neurologie-crise.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "neurologie de la crise", v0.21,
// complété v0.22, case 8 du volet 2 reformulée v1.03) — source : design/ecran-module-
// psychoeducation-neurologie-crise.html. Aucun écart de contenu constaté entre les deux sources.
//
// Seul ajustement de forme (déjà fait pour "évitement", v1.48) : les deux indications séparées de la
// maquette ("📖 3 volets, 24 cases" et "⏱ ~3 min") sont combinées en une seule phrase, le gabarit
// partagé n'affichant qu'une seule ligne de méta.
//
// Corrigé (v1.50) : la case de clôture du volet 2 ("C'est physiquement impossible.") avait été omise
// du traitement climax (fond sage-dark + halo) lors de la construction initiale (v1.49) — la maquette
// témoin montre bien CE fond sur cette case, en plus de celui, déjà présent, de la case 8 du même
// volet (note Johan v0.83). Les deux sont désormais distinguées : la case 8 garde en plus l'emphase
// typographique propre à elle seule (texte agrandi et en gras, `emphasis: true`, gabarit étendu en
// v1.50), la case de clôture n'a que le fond et le halo, comme les autres clôtures de volet.
const neurologieCrise = {
  slug: "neurologie-crise",
  cover: {
    badge: "Comprendre",
    title: "Mon cœur s'emballe, je panique",
    desc: "Module de l'axe corps — <strong>le mécanisme d'une crise</strong> (l'amygdale, l'adrénaline, combattre/fuir/se figer), pourquoi ce n'est physiquement pas dangereux, et pourquoi ton cerveau peut, malgré tout, déclencher une fausse alerte.",
    meta: "3 volets, 24 cases · ~3 min",
    volets: [
      "Normaliser par le vécu déjà connu",
      "Le mécanisme : amygdale et adrénaline",
      "La fausse alerte, un exemple concret"
    ],
    related: "Ce module renvoie, en fin de lecture, vers un outil pratique en lien."
  },
  volets: [
    {
      num: 1,
      name: "Normaliser par le vécu déjà connu",
      color: "sage-dark",
      cases: [
        { text: "Tu as sûrement déjà ressenti ça : le cœur qui bat fort, la respiration courte, les mains moites, une envie de vomir, les jambes qui tremblent, la tête qui tourne." },
        { text: "La plupart du temps, ça ne te posait pas de problème." },
        { text: "Comme quand tu courais pour attraper un bus que tu voyais au loin." },
        { text: "Ou lors d'un premier rendez-vous." },
        { text: "Une réaction normale. Passagère. Et ça passait, en effet." },
        { text: "Aujourd'hui, ce n'est plus pareil." },
        { text: "Tu appelles ça une crise d'angoisse — ou une attaque de panique." },
        { text: "Et c'est très difficile à vivre.", climax: true }
      ]
    },
    {
      num: 2,
      name: "Le mécanisme : amygdale et adrénaline",
      color: "gold-dark",
      cases: [
        { text: "Ce cœur qui s'emballe ? Ce n'est pas un hasard." },
        { text: "C'est ton amygdale — un endroit de ton cerveau, un peu comme une sentinelle — qui vient de sonner l'alarme." },
        { text: "Elle croit percevoir un danger — pour ton corps, ou pour ton esprit." },
        { text: "Alors elle envoie un signal : action, maintenant." },
        { text: "Combattre. Fuir. Ou, si rien n'est possible... se figer." },
        { text: "L'adrénaline prépare tout ça : le cœur, les muscles, la respiration." },
        { text: "C'est pour ça que tu penses parfois : « je vais mourir » (danger pour le corps). Ou : « je deviens fou » (danger pour l'esprit)." },
        { text: "Crois le psychologue expérimenté que je suis : personne n'est jamais mort d'une attaque de panique.", climax: true, emphasis: true },
        { text: "Personne n'en est jamais devenu fou non plus." },
        { text: "C'est physiquement impossible.", climax: true }
      ]
    },
    {
      num: 3,
      name: "La fausse alerte, un exemple concret",
      color: "terracotta",
      cases: [
        { text: "Ton amygdale n'est pas toujours fiable." },
        { text: "Elle confond parfois un vrai danger... et une fausse alerte." },
        { text: "L'avion secoue. Turbulences." },
        { text: "Ton corps réagit comme si l'avion allait s'écraser." },
        { text: "Pourtant, c'est un phénomène banal — les avions sont conçus pour ça." },
        {
          text: "La croyance (« ça secoue, donc danger ») déclenche l'alarme. Pas les faits. Et cette croyance, même sans le moindre fait pour la confirmer, ton cerveau la vit comme parfaitement réelle.",
          climax: true,
          closing: {
            intro: "Pour t'apaiser, tu peux essayer :",
            links: [
              { title: "Je respire, je m'apaise en profondeur", desc: "l'exercice de respiration en trois niveaux", route: "#/outil/respiration-3-niveaux" },
              { title: "Je m'ancre, je suis là", desc: "l'ancrage par les cinq sens (5-4-3-2)", route: "#/outil/ancrage-5432" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/anticipation-anxieuse.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "anticipation anxieuse", v0.32, quatrième
// volet ajouté v0.69) — source : design/ecran-module-psychoeducation-anticipation-anxieuse.html (v1.09).
// Aucun écart de contenu constaté entre les deux sources.
//
// Un ajustement de forme, déjà appliqué à "évitement" (v1.48) et "neurologie de la crise" (v1.49) : les
// deux indications séparées de la maquette ("📖 4 volets, 32 cases" et "⏱ ~4 min") sont combinées en
// une seule phrase, le gabarit partagé n'affichant qu'une seule ligne de méta.
//
// Deux points spécifiques à ce module, tous deux confirmés par la maquette validée (v1.09) et pris en
// charge par deux nouveaux champs de case ajoutés au gabarit partagé (v1.50) :
// 1. La case 1.11 ("une compétence pas encore démontrée...", note Johan v0.90) reçoit, en plus du
//    traitement climax habituel (fond plein + halo), un texte agrandi et en gras — même emphase que la
//    case 2.8 de "neurologie de la crise" (note Johan v0.83). `emphasis: true`.
// 2. À la différence des trois modules déjà en ligne, où toute case climax utilise un sage-dark
//    constant quel que soit le volet, la maquette de CE module clôture chaque volet sur SA PROPRE
//    couleur d'identité (gold-dark pour le volet 2, terracotta pour le volet 3, slate pour le volet 4)
//    — un choix délibéré et validé (v1.09), pas une incohérence. `climaxBg` précise cette couleur ; le
//    volet 1 (déjà sage-dark) n'a pas besoin de le préciser, la valeur par défaut étant identique.
//
// Nouvelle couleur d'identité introduite pour le 4e volet, faute de 4e couleur déjà validée dans la
// palette (v1.09) : --slate (bleu-gris), déjà présente dans app.css (utilisée par l'outil "Je m'ancre").
const anticipationAnxieuse = {
  slug: "anticipation-anxieuse",
  cover: {
    badge: "Comprendre",
    title: "J'ai peur de ce qui pourrait arriver, avant même que ça arrive",
    desc: "Module de l'axe pensées — pourquoi <strong>l'attente fait parfois plus mal que l'événement</strong>, comment revenir au présent, distinguer ce qui dépend de toi, et vérifier l'écart entre ce que tu redoutes et ce qui arrive vraiment.",
    meta: "4 volets, 32 cases · ~4 min",
    volets: [
      "L'attente fait parfois plus mal",
      "Seul le présent existe",
      "Distinguer ce qui dépend de toi",
      "L'écart que personne ne calcule"
    ],
    related: "Ce module renvoie, en fin de lecture, vers un outil du Journal en lien."
  },
  volets: [
    {
      num: 1,
      name: "L'attente fait parfois plus mal",
      color: "sage-dark",
      cases: [
        { text: "Un événement à venir. Connu. Daté." },
        { text: "Bien avant qu'il arrive, l'angoisse s'installe déjà." },
        { text: "Les jours passent, la tension grandit — parfois plus forte que ce que l'événement lui-même provoquera." },
        { text: "Ton cerveau déteste l'incertitude, presque autant qu'un vrai danger." },
        { text: "Alors il tourne en boucle, cherchant à anticiper chaque scénario pour s'y préparer." },
        { text: "Sauf que ruminer un futur incertain n'apporte aucune réponse. Juste de la fatigue, avant même d'avoir commencé." },
        { text: "Il y a autre chose que cette anticipation oublie souvent." },
        { text: "Elle imagine l'événement — mais rarement toi, tel que tu seras, face à lui." },
        { text: "Les ressources que tu mobiliseras sur le moment, elle ne les voit jamais à l'avance." },
        { text: "Ton esprit se concentre sur ce qui pourrait mal tourner. Rarement sur ta capacité à y faire face." },
        { text: "Une compétence pas encore démontrée n'est pas une compétence absente. C'est une compétence en devenir.", climax: true, emphasis: true }
      ]
    },
    {
      num: 2,
      name: "Seul le présent existe",
      color: "gold-dark",
      cases: [
        { text: "Le passé n'existe plus. Le futur n'existe pas encore." },
        { text: "Seul un instant est réel : celui-ci, maintenant." },
        { text: "Un vieux principe, écrit il y a près de deux mille ans, déjà." },
        { text: "Pourtant, l'esprit voyage sans cesse hors du présent — vers un futur qu'il imagine, qu'il redoute." },
        { text: "Revenir au présent, ça s'apprend. Ça se pratique." },
        { text: "Poser son attention sur ce qui est là, maintenant : ce que tu vois, ce que tu entends, ce que tu sens sous tes pieds.", climax: true, climaxBg: "var(--gold-dark)" }
      ]
    },
    {
      num: 3,
      name: "Distinguer ce qui dépend de toi",
      color: "terracotta",
      cases: [
        { text: "Le courage de changer ce qui peut l'être. La force d'accepter ce qui ne peut pas l'être. Et la lucidité de distinguer les deux." },
        { text: "Ce qui va se passer, en partie, t'échappe." },
        { text: "Ta façon de t'y préparer, non." },
        { text: "Cette attente peut se transformer. Pas en absence d'inquiétude — en confiance : confiance en toi, en ta capacité à faire face à ce qui vient, quoi qu'il arrive.", climax: true, climaxBg: "var(--terracotta)" }
      ]
    },
    {
      num: 4,
      name: "L'écart que personne ne calcule",
      color: "slate",
      cases: [
        { text: "Avant un événement qui t'angoisse, ton esprit n'imagine pas juste un scénario. Il y croit." },
        { text: "Il calcule une probabilité — basée sur un vécu direct, ou une croyance jamais vérifiée, simplement transmise." },
        { text: "Demande-lui un chiffre : « 90% de chances que ça tourne mal. »" },
        { text: "L'événement arrive. Se déroule. Se termine." },
        { text: "Tu redoutais un blanc, un jugement, un échec complet." },
        { text: "Ce qui arrive, le plus souvent : une conversation banale, un oubli sans suite, un couac vite oublié." },
        { text: "Deux histoires différentes : celle anticipée, celle vécue." },
        { text: "Ton cerveau ne les compare jamais seul. La prochaine fois, il repart du même chiffre. Et la suivante aussi." },
        { text: "Une nuance : parfois, ce n'est pas une fausse alerte — l'anticipation elle-même façonne ce qu'elle redoutait. Comme une prophétie qu'on se fait à soi-même : un stress qui te fait bafouiller, un évitement qui confirme la peur — on donne vie à nos peurs. En prendre conscience, c'est déjà ne plus tomber dans le piège." },
        { text: "Reprends la main : note ce que tu redoutes, avant. Vérifie ce qui s'est vraiment passé, après." },
        {
          text: "Chaque écart devient une preuve — la tienne. Retrouve-la dans ton Journal.",
          climax: true,
          climaxBg: "var(--slate)",
          closing: {
            intro: "Pour reprendre la main :",
            links: [
              { title: "La vérification des attentes", desc: "dans ton Journal", route: "#/journal/verif-attentes" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/pensees-intrusives.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "pensées intrusives", v0.31) — source :
// design/ecran-module-psychoeducation-pensees-intrusives.html (v1.09). Aucun écart de contenu constaté
// entre les deux sources. Trois volets (10 + 6 + 9 cases), plus l'expérience personnelle de Johan (la
// peur de la mort et les calculs de réassurance) en clôture, en registre récit — même traitement que
// l'anecdote d'"évitement" (v1.48), sans passage mis en évidence (`.hl`) ici, la maquette n'en montrant
// aucun pour ce texte précis.
//
// Un ajustement de forme, déjà appliqué aux trois modules précédents : les deux indications séparées de
// la maquette ("📖 3 volets, 25 cases + expérience" et "⏱ ~4 min") combinées en une seule phrase.
//
// Écart constaté et résolu, du même type que celui déjà rencontré sur "évitement" (v1.48) : la maquette
// affiche, DANS l'encart "Ça peut aussi t'intéresser" de la couverture elle-même, le texte "Pas de lien
// de clôture (v0.32) — décision actée (v1.09)." — manifestement une note de production (numéros de
// version, jamais montrés ailleurs à l'utilisateur) qui a glissé dans l'emplacement visuel de l'encart
// plutôt qu'un vrai texte destiné à la personne qui utilise l'app. Résolu comme pour "évitement" :
// aucun encart inventé pour remplacer cette phrase, cover.related laissé vide — l'encart ne s'affiche
// simplement pas sur ce module, cohérent avec la décision de fond ("pas de lien de clôture", validée
// v1.09) que la phrase elle-même annonçait, seule sa mise en forme dans la maquette étant erronée.
const penseesIntrusives = {
  slug: "pensees-intrusives",
  cover: {
    badge: "Comprendre",
    title: "J'ai des pensées qui me font peur et que je ne contrôle pas, qu'est-ce que c'est ?",
    desc: "Module de l'axe pensées — pourquoi <strong>lutter contre une pensée la renforce</strong>, pourquoi une pensée n'est jamais un acte, et pourquoi la <strong>pensée magique</strong> peut revenir sous anxiété.",
    meta: "3 volets, 25 cases + expérience · ~4 min",
    volets: [
      "Le piège de la lutte",
      "Une pensée n'est pas un acte",
      "Les pensées magiques"
    ],
    related: null
  },
  volets: [
    {
      num: 1,
      name: "Le piège de la lutte",
      color: "sage-dark",
      cases: [
        { text: "Une pensée dérangeante ou inconfortable s'impose à toi. Tu voudrais qu'elle parte. Tout de suite." },
        { text: "Alors tu luttes. Tu la repousses." },
        { text: "Et elle revient. Plus fort. Plus souvent." },
        { text: "Pas un manque de volonté. Un mécanisme bien connu : plus tu chasses une pensée, plus ton cerveau la surveille — pour vérifier qu'elle n'est pas là." },
        { text: "Cette surveillance, c'est elle qui la ramène." },
        { text: "Essaie, là, maintenant : ne pense pas à une boîte de sardines." },
        { text: "... Trop tard." },
        { text: "Une pensée neutre ? Oubliée en une seconde." },
        { text: "Une pensée qu'on juge inacceptable, taboue, bizarre ? Elle s'accroche." },
        { text: "Ce n'est pas la pensée qui décide de revenir. C'est l'importance qu'on lui donne.", climax: true }
      ]
    },
    {
      num: 2,
      name: "Une pensée n'est pas un acte",
      color: "gold-dark",
      cases: [
        { text: "Toutes les pensées ont le droit d'exister. Même les pires. Même celles qui font honte." },
        { text: "Une pensée n'est pas un acte." },
        { text: "Comme le disait mon thérapeute : ce n'est pas le mot « chien » qui va te mordre." },
        { text: "Ton cerveau en génère des centaines, chaque jour. Absurdes, violentes, étranges. Chez tout le monde." },
        { text: "Ce qui rend une pensée « intrusive », ce n'est pas son contenu. C'est le jugement qu'on porte dessus." },
        { text: "Parfois, cette peur va plus loin : peur de passer à l'acte à cause d'une pensée qu'on ne veut surtout pas avoir. Une peur sans fondement — avoir une pensée ne mène jamais à l'acte.", climax: true, climaxBg: "var(--gold-dark)" }
      ]
    },
    {
      num: 3,
      name: "Les pensées magiques",
      color: "terracotta",
      cases: [
        { text: "Il existe une autre peur, cousine de celle-ci." },
        { text: "Croire qu'une pensée peut, à elle seule, faire arriver les choses." },
        { text: "Toucher du bois. Ne pas dire « tout va bien » trop fort, de peur d'attirer le mauvais sort. Tu connais sûrement ce réflexe." },
        { text: "Un vieux mode de pensée, hérité de l'enfance, où penser et agir se confondaient encore." },
        { text: "Sous anxiété, il peut revenir." },
        { text: "Et amplifier chaque pensée redoutée : « si j'y pense, ça va arriver. »" },
        { text: "Non. Penser à un accident ne le provoque pas." },
        { text: "Pas plus que penser à une boîte de sardines n'en fait apparaître une." },
        { text: "Si c'était vrai, avec toutes les fois où j'ai imaginé gagner au loto... je serais milliardaire !", climax: true, climaxBg: "var(--terracotta)" },
        {
          panelHtml: `
            <div class="anecdote">
              <div class="lbl">Mon expérience</div>
              <p>Il y a eu une période où la mort m'obsédait. Pas de façon abstraite — de façon concrète, presque quotidienne.</p>
              <p>Alors j'évitais. Les infos qui en parlaient, certaines conversations, certains films.</p>
              <p>Sauf que plus je fuyais, plus la pensée me rattrapait. Elle s'invitait n'importe quand — au réveil, dans les transports, parfois en pleine nuit, brutalement.</p>
              <p>Alors j'ai trouvé une parade. Un calcul, presque un rituel : « il me reste encore les trois quarts de ma vie à vivre. » C'est encore loin. Je me le répétais, dès que la pensée revenait — et il m'en fallait un peu plus, à chaque fois.</p>
              <p>Ce calcul ne réglait rien. Il confirmait, au contraire, que cette pensée méritait d'être prise très au sérieux — sinon, pourquoi je me donnerais tant de mal pour la calmer ?</p>
              <p>Ce chemin a été long.</p>
              <p>Bien sûr, aujourd'hui, la mort me fait encore un peu peur. Mais paradoxalement, elle ne m'empêche plus de vivre. Et je n'y pense que très rarement — sauf quand je dois te raconter cette anecdote !</p>
            </div>
          `,
          closing: {
            intro: "Pour ne plus lutter contre la pensée :",
            links: [
              { title: "J'écris, je m'en libère", desc: "l'exercice d'écriture, pour sortir la pensée de ta tête", route: "#/outil/ecriture" },
              { title: "Je vérifie, je reprends la main", desc: "noter ce que tu redoutes, pour comparer ensuite avec ce qui arrive vraiment", route: "#/outil/je-verifie" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/catastrophisme.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "catastrophisme", v0.24, 13 cases).
//
// Écart de source, résolu en faveur du cahier des charges : la maquette dédiée
// (design/ecran-module-psychoeducation-catastrophisme.html) est explicitement une PREMIÈRE ébauche —
// sa propre note dit ne montrer que "4 des 13 cases [...] pour valider le format bande dessinée avant
// de le dupliquer sur les 15 modules", antérieure à l'écran témoin complet et à la standardisation du
// gabarit (couleurs de fermeture, style des liens `.link-row`) déjà en place pour les quatre modules
// construits depuis. Les 13 cases proviennent donc du cahier des charges (texte complet, jamais mis en
// doute) ; seules la structure (case unique sans volets nommés, comme "évitement") et l'existence de
// deux liens de clôture viennent de cette ébauche, mise à jour avec le gabarit standard plutôt que
// reproduite telle quelle (couleurs de liens bespoke, barre de progression alternée non reprises).
//
// Les deux liens de clôture ("Je m'ancre, je suis là" et "Je respire, je m'apaise en profondeur, niveau
// 3 — la couleur de ton intention") sont validés par cette même ébauche ("Johan a validé les deux liens
// proposés"). Le second pointe directement vers le niveau 3 de l'outil de respiration (`/3`), pas vers
// sa page d'accueil — cohérent avec la maquette qui cite spécifiquement ce niveau, pas l'outil entier.
//
// Case 12 mise en valeur (fond sage-dark, halo) sans être la dernière case du module — la case 13, elle,
// clôt le module sur un fond cream classique, avec les liens en dessous (comme les autres modules à
// liens de clôture, distincts d'une case climax).
//
// Corrigé au passage (v1.52) : la barre de progression d'un module à volet unique et sans nom affiché
// sur la couverture (déjà "évitement") montre "Case i / total", pas "Volet 1 — i / total" — voir le
// commentaire dédié dans module.js.
const catastrophisme = {
  slug: "catastrophisme",
  cover: {
    badge: "Comprendre",
    title: "J'imagine toujours le pire, pourquoi ?",
    desc: "Pourquoi ton cerveau invente-t-il toujours <strong>la pire des hypothèses</strong> face à un silence ou un imprévu — et comment cette stratégie peut <strong>se reconstruire autrement</strong>.",
    meta: "13 cases · ~2 min",
    volets: [],
    related: "Ce module renvoie, en fin de lecture, vers un outil pratique en lien."
  },
  volets: [
    {
      num: 1,
      name: "J'imagine toujours le pire",
      color: "sage-dark",
      cases: [
        { text: "Un imprévu. Un silence. Un texto resté sans réponse." },
        { text: "Ton cerveau a besoin d'une explication. Le vide est plus difficile à supporter qu'une mauvaise nouvelle." },
        { text: "Alors il t'en donne une : la pire." },
        { text: "Pas parce qu'elle est la plus probable. Parce qu'elle comble le vide — et ça, ça rassure, un instant." },
        { text: "C'est une stratégie. Ton cerveau cherche une solution pour t'apaiser." },
        { text: "Sauf qu'à force de l'utiliser, cette solution devient elle-même le problème." },
        { text: "Elle t'angoisse plus qu'elle ne te calme." },
        { text: "Ton corps ne fait pas la différence entre imaginer et vivre." },
        { text: "Il réagit au scénario comme s'il était déjà arrivé." },
        { text: "Et plus tu l'imagines, plus il devient réel — à tes yeux." },
        { text: "Une hypothèse, parmi tant d'autres possibles, devient LA vérité." },
        { text: "Comme les <em>lunettes de l'angoisse</em> : ce que tu vois n'est qu'une version de la réalité. Pas la seule.", climax: true },
        {
          text: "Cette stratégie, ton cerveau l'a construite. Ce qui se construit peut se reconstruire — autrement.",
          closing: {
            intro: "Pour t'apaiser, tu peux essayer :",
            links: [
              { title: "Je m'ancre, je suis là", desc: "ancrage 5-4-3-2 — ramène l'attention au présent", route: "#/outil/ancrage-5432" },
              { title: "Je respire, je m'apaise en profondeur", desc: "niveau 3 — la couleur de ton intention", route: "#/outil/respiration-3-niveaux/3" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/perte-controle.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "peur de perdre le contrôle", v0.34) —
// source : design/ecran-module-psychoeducation-perte-controle.html. Aucun écart de contenu constaté
// entre les deux sources — mockup complet et cohérent, aucune ambiguïté à résoudre. Trois volets
// (6 + 5 + 12 cases), plus l'expérience personnelle de Johan (la petite caméra), placée en INTERLUDE
// entre les cases 2 et 3 du volet 2 — position exacte du cahier des charges, pas une clôture de module
// comme pour "évitement" et "pensées intrusives". Dernier module de l'axe pensées (6/6).
//
// Bogue trouvé et corrigé au passage (v1.53, voir le commentaire dédié dans module.js) : une case
// "planche" (panelHtml) intercalée au MILIEU d'un volet, comme cette anecdote, révèle que le compteur
// "i / total" comptait à tort toutes les entrées du volet, planches comprises — "évitement", déjà en
// ligne, affichait ainsi "Case 1 / 7" au lieu de "Case 1 / 5" depuis sa construction. Corrigé pour tous
// les modules à la fois.
//
// Deux liens de clôture, déjà validés (pas une proposition) — le texte source précise explicitement que
// ce module "se clôt directement sur le geste concret de nourrir le monstre positivement" : la boîte à
// compliments et le protecteur/critique (tous deux déjà en ligne).
//
// Encart "Ça peut aussi t'intéresser" : le texte de la maquette elle-même ("Dernier module de l'axe
// pensées (6/6) — se clôt directement sur deux outils validés (v0.32, v0.34)") mélange, comme pour
// "évitement" et "pensées intrusives", une note de production (numéros de version) avec le contenu réel
// destiné à la personne. Reformulé ici sans les numéros de version ni la mention d'avancement interne
// ("6/6"), dans le registre déjà établi pour les encarts des autres modules à lien de clôture (ex.
// "neurologie de la crise") — substance conservée (deux outils en lien), pas la note de production.
const perteControle = {
  slug: "perte-controle",
  cover: {
    badge: "Comprendre",
    title: "J'ai peur de perdre le contrôle, est-ce vraiment possible ?",
    desc: "Module de l'axe pensées — dernier module de cet axe. Pourquoi cette peur floue cache une peur plus précise, la sensation réelle de dépersonnalisation sous anxiété, et le petit monstre de l'angoisse, qui devient ce qu'on lui donne à manger.",
    meta: "3 volets, 23 cases + expérience · ~4 min",
    volets: [
      "Ce qui fait vraiment peur",
      "Pourquoi cette peur est si convaincante",
      "Le petit monstre de l'angoisse"
    ],
    related: "Ce module renvoie, en fin de lecture, vers deux outils pratiques en lien."
  },
  volets: [
    {
      num: 1,
      name: "Ce qui fait vraiment peur",
      color: "sage-dark",
      cases: [
        { text: "« Perdre le contrôle. » Une peur floue. Et une peur floue, c'est une peur difficile à combattre." },
        { text: "Alors creusons. Perdre le contrôle... et ensuite, qu'est-ce qui te fait vraiment peur ?" },
        { text: "Perdre le contrôle de son corps : s'évanouir, trembler, vomir — et que tout le monde te voie, te juge faible." },
        { text: "Perdre le contrôle de son esprit : devenir fou, ne plus jamais redevenir toi-même." },
        { text: "Perdre le contrôle de ses actes : dire ou faire quelque chose d'irréparable, blesser quelqu'un, t'humilier pour toujours." },
        { text: "Ce n'est pas « perdre le contrôle » qui fait peur. C'est ce que tu imagines juste après.", climax: true }
      ]
    },
    {
      num: 2,
      name: "Pourquoi cette peur est si convaincante",
      color: "gold-dark",
      cases: [
        { text: "Sous anxiété, tout paraît plus fragile — y compris toi-même." },
        { text: "Parfois, une sensation étrange s'ajoute : comme si tu te regardais de l'extérieur, un peu détaché de toi-même." },
        {
          panelHtml: `
            <div class="anecdote">
              <div class="lbl">Mon expérience</div>
              <p>Il y a eu une période où j'avais l'impression de vivre avec une petite caméra qui me suivait partout.</p>
              <p>Elle m'observait agir, interagir — de l'extérieur, un peu détachée de moi.</p>
              <p>Une partie de moi se demandait sans cesse ce que les autres pensaient. Une autre repassait déjà la scène, cherchant ce que j'aurais pu faire mieux.</p>
              <p>Trois endroits différents, où j'étais en même temps. Et il en manquait un seul.</p>
              <p>Celui où je n'étais jamais : l'instant présent.</p>
            </div>
          `
        },
        { text: "Une sensation réelle, provoquée par l'anxiété elle-même. Pas un signe qu'on est en train de perdre pied." },
        { text: "Alors l'esprit interprète cette sensation comme une preuve : « je sens que je perds le contrôle, donc je le perds. »" },
        { text: "Mais une sensation n'est pas une prédiction. Se sentir sur le point de perdre le contrôle ne prédit pas qu'on va le perdre.", climax: true, climaxBg: "var(--gold-dark)" }
      ]
    },
    {
      num: 3,
      name: "Le petit monstre de l'angoisse",
      color: "terracotta",
      cases: [
        { text: "Imagine un petit monstre. Discret, au début. À peine visible." },
        { text: "Il se nourrit d'une seule chose : tes pensées anxieuses." },
        { text: "Chaque pensée que tu nourris — que tu prends au sérieux, que tu ressasses — le nourrit, lui." },
        { text: "Et plus il mange, plus il grandit." },
        { text: "Jusqu'à ce que son estomac soit si plein qu'il ne puisse plus rien contenir." },
        { text: "Alors il vomit tout, d'un coup. C'est la crise d'angoisse." },
        { text: "La crise n'est pas un dérèglement soudain, sans raison. C'est la suite logique de tout ce qu'on lui a donné à manger, avant." },
        { text: "Il y a un secret derrière ce monstre : il n'est ni gentil ni méchant. Il devient ce que tu lui donnes à manger." },
        { text: "Nourri de pensées anxieuses, il déborde — et c'est la crise." },
        { text: "Nourri de pensées confiantes, d'encouragements, de petites victoires... il grandit dans l'autre sens. Il devient un allié." },
        { text: "Le même monstre. Juste nourri autrement." },
        {
          text: "Chaque compliment que tu notes, chaque petite victoire que tu gardes en mémoire — c'est un repas de plus pour la version alliée du monstre.",
          climax: true,
          climaxBg: "var(--terracotta)",
          closing: {
            intro: "Pour nourrir la version alliée du monstre :",
            links: [
              { title: "La boîte à compliments", desc: "dans ton Journal", route: "#/journal/compliments" },
              { title: "Je me critique, je me réponds avec tendresse", desc: "le protecteur/critique", route: "#/outil/protecteur-critique" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/declencheurs-personnels.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "déclencheurs personnels", v0.35) —
// source : design/ecran-module-psychoeducation-declencheurs-personnels.html. Aucun écart de contenu
// constaté, mockup complet et cohérent. Quatre volets courts (3 + 2 + 2 + 2 cases), pas d'anecdote
// personnelle (choix déjà acté). Chaque volet clôture sur SA PROPRE couleur d'identité (comme
// "anticipation anxieuse", v1.50) plutôt qu'un sage-dark constant — gold-dark, terracotta, puis une
// nouvelle couleur --slate pour le volet 4 (déjà introduite pour "anticipation anxieuse").
//
// Note de la maquette elle-même sur le "dernier module du plan" : le texte source (v0.35) disait "clôt
// l'ensemble des 14 modules" — vrai au moment de la rédaction, avant l'ajout de l'axe émotions (v0.56)
// qui porte le total à 15. Aucune conséquence sur le texte des cases lui-même (jamais affiché à
// l'utilisateur), seulement sur une note de production reformulée ci-dessous comme pour les modules
// précédents.
//
// Lien de clôture unique, déjà validé dans le texte source lui-même (pas une proposition) : "La liste
// des déclencheurs" du Journal, que le texte cite explicitement ("il s'accumule dans une liste,
// consultable depuis les outils").
//
// Encart "Ça peut aussi t'intéresser" reformulé sans les numéros de version ni la mention d'avancement
// interne ("15/15"), comme pour les modules précédents dans le même cas — substance conservée.
const declencheursPersonnels = {
  slug: "declencheurs-personnels",
  cover: {
    badge: "Comprendre",
    title: "Pourquoi est-ce que ça m'angoisse, moi, alors que ça n'a pas l'air de déranger les autres ?",
    desc: "Module de l'axe quotidien — pourquoi un déclencheur est <strong>appris et jamais universel</strong>, la différence entre interne et externe, et pourquoi le <strong>comparer aux autres n'a pas de sens</strong>.",
    meta: "4 volets, 9 cases · ~2 min",
    volets: [
      "Pourquoi ça, chez toi",
      "Interne ou externe",
      "Le piège de la comparaison",
      "Une carte qui se redessine"
    ],
    related: "Ce module renvoie, en fin de lecture, vers un outil du Journal en lien."
  },
  volets: [
    {
      num: 1,
      name: "Pourquoi ça, chez toi",
      color: "sage-dark",
      cases: [
        { text: "Un déclencheur n'est jamais universel, il est appris. Chaque personne a sa propre carte des menaces." },
        { text: "Elle peut venir de trois chemins, tout aussi valables : un vécu direct ; une peur observée chez un proche ; une simple mise en garde, jamais vérifiée par l'expérience." },
        { text: "Le tempérament et les croyances construites tôt (« je dois être irréprochable ») la façonnent aussi. Ce n'est pas un choix.", climax: true }
      ]
    },
    {
      num: 2,
      name: "Interne ou externe",
      color: "gold-dark",
      cases: [
        { text: "Déclencheur externe : une situation, un lieu, une personne." },
        { text: "Déclencheur interne : une sensation, une pensée, un souvenir — aussi réel, juste plus difficile à repérer.", climax: true, climaxBg: "var(--gold-dark)" }
      ]
    },
    {
      num: 3,
      name: "Le piège de la comparaison",
      color: "terracotta",
      cases: [
        { text: "« Ça n'a pas l'air de déranger les autres » : comparer sa réaction à celle des autres, c'est comparer deux cartes construites par deux histoires différentes. Ça n'a pas de sens." },
        { text: "Ton déclencheur n'est pas une preuve de faiblesse. C'est une trace de ton histoire.", climax: true, climaxBg: "var(--terracotta)" }
      ]
    },
    {
      num: 4,
      name: "Une carte qui se redessine",
      color: "slate",
      cases: [
        { text: "Ce qui a été appris peut être réappris. Mais d'abord, il faut en avoir conscience." },
        {
          text: "Note ton déclencheur dans le journal dès que tu le repères : il s'accumule dans une liste, consultable depuis les outils. C'est un premier pas — mais peut-être le plus important pour agir sur tes déclencheurs.",
          climax: true,
          climaxBg: "var(--slate)",
          closing: {
            intro: "Pour redessiner ta carte :",
            links: [
              { title: "La liste des déclencheurs", desc: "dans ton Journal", route: "#/journal/declencheurs" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/emotions.js ---- */
// Module "Je ne gère pas mes émotions, au secours..." — texte complet validé (v0.56, cahier des
// charges), premier module de l'axe émotions, nouvel axe distinct des axes corps et pensées déjà
// établis (v0.5). Écran témoin dédié : design/ecran-module-psychoeducation-emotions.html — validé,
// complet, texte identique mot pour mot au cahier des charges (vérifié ligne à ligne, v1.55).
//
// Pas d'anecdote personnelle sur ce module pour l'instant — reste ouvert si Johan souhaite en ajouter
// une plus tard (option A, v0.38) : aucune case panelHtml ici, à la différence d'évitement / pensées
// intrusives / perte de contrôle.
//
// Chaque volet clôture sur SA PROPRE couleur d'identité (climaxBg, v1.50) plutôt que sur un sage-dark
// uniforme — même choix que anticipation anxieuse / perte de contrôle / déclencheurs personnels.
//
// related-box de couverture (v1.55) : le texte de l'écran témoin ("Premier module d'un nouvel axe...
// Pas d'anecdote pour l'instant — reste ouvert (v0.38). Renvoie vers un autre module et vers un outil
// (v0.56).") est une note de production (versions, statut de construction) et non une phrase destinée
// à la personne qui utilise l'app — même schéma que pour évitement / pensées intrusives / perte de
// contrôle / déclencheurs personnels, résolu par l'omission de la boîte plutôt que par une reformulation
// qui n'ajouterait rien (la substance réelle — les deux liens de clôture — est déjà portée par les
// liens eux-mêmes en fin de module).
//
// Clôture à deux sections (v1.55, première apparition) : la case 4.4 valide DEUX phrases d'intro
// séparées, chacune suivie de son propre lien — cf. closing.sections dans module.js. Le lien vers le
// module "rumination-soir" (pas encore construit à ce stade du chantier, tâche #23) utilise
// moduleCheck: "rumination-soir" pour s'afficher grisé ("— à venir") tant que ce module n'est pas
// live:true dans js/data/grid.js, et deviendra automatiquement actif une fois ce module livré, sans
// modification de ce fichier — même principe que js/screens/journal.js pour le lien vers évitement
// avant sa construction. Le lien vers "coussin-emotions" (outil déjà en ligne) n'a pas besoin de cette
// vérification.
const emotions = {
  cover: {
    badge: "Comprendre",
    title: "Je ne gère pas mes émotions, au secours...",
    desc: "Premier module de l'axe émotions — pourquoi une émotion <strong>ne se contrôle pas, mais s'exprime</strong>, à quoi elle sert vraiment, et ce qui se passe quand une partie de la palette émotionnelle reste fermée.",
    meta: "4 volets, 14 cases",
    volets: [
      "Une émotion, ça ne se contrôle pas",
      "À quoi sert une émotion",
      "L'arc-en-ciel incomplet",
      "Quand la palette se referme"
    ],
    related: null
  },
  volets: [
    {
      num: 1,
      name: "Une émotion, ça ne se contrôle pas",
      color: "sage-dark",
      cases: [
        { text: "Tu ne choisis pas d'être triste, en colère, ou d'avoir peur. Une émotion, ça ne se contrôle pas : ça se vit, c'est tout." },
        { text: "Et c'est une bonne nouvelle : les émotions sont adaptatives. Elles ajustent ta réalité intérieure au mouvement du monde extérieur, et régulent tes relations aux autres." },
        { text: "Il n'existe pas d'émotions « négatives » ou « positives » — seulement des émotions adaptatives. Ce sont les événements que tu vis qui peuvent être agréables ou désagréables ; l'émotion, elle, n'est que l'outil de ton corps pour t'y adapter." },
        { text: "Ce qui se régule, en revanche, c'est son expression. Tu n'es pas obligé de te rouler par terre parce que tu es en colère — et l'expression saine de la colère n'est ni l'agressivité, ni la violence.", climax: true, climaxBg: "var(--sage-dark)" }
      ]
    },
    {
      num: 2,
      name: "À quoi sert une émotion",
      color: "gold-dark",
      cases: [
        { text: "Chaque émotion a une fonction. Elle met ton corps en mouvement — à l'intérieur, par un changement physiologique ; à l'extérieur, par une expression, comme un mouvement vers le monde." },
        { text: "D'abord, tu ressens l'émotion : c'est un message important sur ce que la situation te fait vivre. Puis elle te met en action, pour que tu puisses te rééquilibrer." },
        { text: "Il existe six émotions principales : la colère, la joie, le dégoût, la surprise, la tristesse, la peur. Même quand elles sont désagréables à vivre, elles restent essentielles pour t'adapter." },
        { text: "Elles régulent aussi tes relations aux autres — en te rapprochant, ou en te permettant de défendre ton territoire. Bien exprimées, elles garantissent des relations saines.", climax: true, climaxBg: "var(--gold-dark)" }
      ]
    },
    {
      num: 3,
      name: "L'arc-en-ciel incomplet",
      color: "terracotta",
      cases: [
        { text: "Mais parfois, on n'a pas appris — ou pas assez appris — à utiliser toute cette palette de couleurs émotionnelles." },
        { text: "On en utilise certaines, et on s'est appris, sans le vouloir, à s'interdire d'en ressentir ou d'en exprimer d'autres.", climax: true, climaxBg: "var(--terracotta)" }
      ]
    },
    {
      num: 4,
      name: "Quand la palette se referme",
      color: "slate",
      cases: [
        { text: "Ce qui ne trouve pas sa sortie ne disparaît pas pour autant — ça cherche une autre issue." },
        { text: "Chez certains, cette accumulation ressort sous forme d'angoisse : une tension diffuse, sans objet précis, comme un trop-plein qui n'a pas trouvé sa sortie." },
        { text: "Chez d'autres — ou en même temps — elle revient le soir, sous forme de pensées qui tournent en boucle. C'est souvent de ça qu'il s'agit, derrière une rumination." },
        {
          text: "Ce n'est pas « ne pas savoir gérer ses émotions ». C'est ne pas encore avoir retrouvé l'accès à toute la palette, et le chemin pour l'exprimer sainement.",
          climax: true,
          climaxBg: "var(--slate)",
          closing: {
            sections: [
              {
                intro: "Tu retrouveras ce mécanisme en détail dans :",
                links: [
                  { title: "Le soir, je rumine tout ce qui s'est mal passé", desc: "un autre module de psychoéducation", route: "#/module/rumination-soir", moduleCheck: "rumination-soir" }
                ]
              },
              {
                intro: "Pour retrouver l'accès à toute la palette :",
                links: [
                  { title: "J'accueille mes émotions, je m'équilibre", desc: "le coussin des émotions", route: "#/outil/coussin-emotions" },
                  { title: "J'ai confiance, je tiens bon", desc: "une phrase de confiance à te répéter, la tienne", route: "#/outil/phrase-confiance" }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/body-scan.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "body-scan", v0.28) — source :
// design/ecran-module-psychoeducation-body-scan.html. Aucun écart de contenu constaté entre les deux
// sources — mockup complet et cohérent. Deux volets (12 + 7 cases), plus l'expérience personnelle de
// Johan (hypervigilance et repli sur soi), placée en CLÔTURE du module, en registre récit — même
// position que pour "évitement" et "pensées intrusives" (contrairement à "peur de perdre le contrôle",
// dont l'anecdote est un interlude mi-volet). Aucun passage mis en évidence (`.hl`) dans cette anecdote,
// la maquette n'en montrant aucun pour ce texte précis — même constat que pour "pensées intrusives".
//
// Climax des deux volets sur le sage-dark par défaut (pas de climaxBg) — comme "fondateur" et
// "neurologie de la crise", à la différence des modules qui closent chaque volet sur sa propre couleur
// d'identité : la maquette valide bien un fond sage-dark identique pour les deux clôtures de volet ici.
//
// Lien de clôture, porté par l'anecdote elle-même plutôt que par une case numérotée séparée — première
// fois que panelHtml et closing coexistent sur la même case (le code de module.js les traite déjà
// indépendamment, aucune modification nécessaire) : "Je m'ancre, je suis là" (ancrage 5-4-3-2), déjà en
// ligne.
//
// Encart "Ça peut aussi t'intéresser" : le texte de la maquette ("Ce module renvoie, en fin de lecture,
// vers un outil pratique en lien (v0.32).") mélange une note de production (numéro de version) avec le
// contenu réel destiné à la personne — même schéma que pour "peur de perdre le contrôle". Reformulé sans
// le numéro de version, substance conservée (un outil en lien), registre déjà établi pour ce type
// d'encart.
const bodyScan = {
  slug: "body-scan",
  cover: {
    badge: "Comprendre",
    title: "Je scanne mon corps en permanence, à l'affût du moindre symptôme, pourquoi ?",
    desc: "Module de l'axe corps — pourquoi <strong>l'attention amplifie</strong> ce qu'elle cherche, comment une sensation banale devient une histoire de danger, et pourquoi scanner son corps est une forme de <strong>contrôle qui se retourne contre soi</strong>.",
    meta: "2 volets + expérience, 19 cases · ~3 min",
    volets: [
      "L'attention qui amplifie (et qui filtre, à raison)",
      "L'erreur d'interprétation et le cercle"
    ],
    related: "Ce module renvoie, en fin de lecture, vers un outil pratique en lien."
  },
  volets: [
    {
      num: 1,
      name: "L'attention qui amplifie (et qui filtre, à raison)",
      color: "sage-dark",
      cases: [
        { text: "Cœur qui bat un peu vite. Un point dans le dos. Une drôle de sensation dans le bras." },
        { text: "Tu scannes. En boucle. À la recherche du moindre signal." },
        { text: "Logique, en apparence : mieux vaut repérer le danger tôt." },
        { text: "Sauf qu'un corps produit des sensations en permanence. Digestion. Tension musculaire. Variations du rythme cardiaque. Douleur passagère." },
        { text: "La plupart du temps, personne n'y prête attention. Elles passent inaperçues." },
        { text: "Toi, tu les cherches. Et chercher change tout." },
        { text: "Concentre-toi une seconde sur ta langue, dans ta bouche. Tu la sens, maintenant ?" },
        { text: "Elle était pourtant là avant que tu n'y penses. L'attention ne se contente pas de détecter une sensation. Elle l'amplifie." },
        { text: "Regarde maintenant devant toi. Tu ne vois pas ton nez, pourtant il est bien là, dans ton champ de vision." },
        { text: "Ton cerveau le filtre depuis toujours. Volontairement." },
        { text: "Ne pas percevoir, ce n'est pas une faille. C'est ton corps qui fait bien son travail." },
        { text: "Il en va de même pour la plupart de tes sensations : ne pas les remarquer est le fonctionnement normal.", climax: true }
      ]
    },
    {
      num: 2,
      name: "L'erreur d'interprétation et le cercle",
      color: "gold-dark",
      cases: [
        { text: "Le problème n'est jamais la sensation qu'on remarque. C'est l'histoire qu'on choisit de lui raconter." },
        { text: "« Danger » est une des histoires possibles. Rarement la bonne." },
        { text: "Plus tu scannes, plus tu trouves. Plus tu trouves, plus tu interprètes en danger." },
        { text: "Plus tu t'inquiètes, plus tu scannes." },
        { text: "Le cercle se referme. Comme pour la respiration, en pleine crise." },
        { text: "Scanner, c'est une forme de contrôle. La même famille que celles qu'on a déjà vues." },
        { text: "Sauf que cette fois, ce n'est pas une situation qu'on surveille. C'est son propre corps.", climax: true },
        {
          panelHtml: `
            <div class="anecdote">
              <div class="lbl">Mon expérience</div>
              <p>Quand je souffrais de crises d'angoisse récurrentes, je vivais en état d'hypervigilance permanente — à me demander sans cesse si ce que je ressentais était normal, ou le signe d'un danger mortel, ou qui allait me faire basculer dans la folie sans retour possible.</p>
              <p>Je respirais mal, alors les vertiges revenaient souvent. Et chaque vertige me plongeait dans la même peur : perdre connaissance, en public.</p>
              <p>Je peux te le dire aujourd'hui : ça ne m'est jamais arrivé. Mais à l'époque, ça paraissait plus que plausible.</p>
              <p>Et je repartais pour un tour.</p>
              <p>Une douleur à la poitrine ? Une crise cardiaque, à coup sûr. Une tension dans le crâne ? Un signe précoce d'AVC. Une pensée intrusive ? La preuve que j'étais complètement fou.</p>
              <p>Je me laissais guider par mes peurs. Elles prenaient toute la place.</p>
              <p>Je restais enfermé dans le contrôle de mon monde intérieur — et dans la honte de ce que je vivais. Je me coupais de l'extérieur, de la vie, des autres.</p>
              <p>Exactement l'inverse de ce qu'il fallait faire.</p>
            </div>
          `,
          closing: {
            intro: "Pour t'apaiser, tu peux essayer :",
            links: [
              { title: "Je m'ancre, je suis là", desc: "l'ancrage par les cinq sens (5-4-3-2)", route: "#/outil/ancrage-5432" },
              { title: "Je marche, je me libère", desc: "la marche de nettoyage, pour sortir de l'hypervigilance corporelle", route: "#/outil/marche" },
              { title: "J'inspire cette odeur, je reviens à moi", desc: "un objet à l'odeur qui rassure, à respirer quand il le faut", route: "#/outil/odeur-rassurante" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/symptomes-digestifs.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "symptômes digestifs", v0.29) — source :
// design/ecran-module-psychoeducation-symptomes-digestifs.html. Dernier module de l'axe corps. Séquence
// unique de 13 cases (pas de volets, comme "évitement" et "catastrophisme") — pas d'anecdote personnelle
// (choix déjà acté dans le texte source lui-même).
//
// Lien de clôture confirmé par Johan à la relecture finale (v1.57) — proposé dans l'écran témoin sous
// réserve de confirmation ("Lien de clôture proposé, à confirmer [...] Dis-moi si ça te va", badge
// "proposition — à confirmer" sur la case 13), cohérent avec le texte de la case elle-même ("ralentir ta
// respiration apaise aussi ton ventre" pointe explicitement vers l'exercice de respiration en trois
// niveaux, déjà en ligne). Validation actée, plus une proposition.
//
// Encart "Ça peut aussi t'intéresser" : même schéma que "peur de perdre le contrôle" et "body-scan" — le
// texte de la maquette ("(v0.32)") mélange une note de production avec le contenu réel. Reformulé sans
// le numéro de version.
const symptomesDigestifs = {
  slug: "symptomes-digestifs",
  cover: {
    badge: "Comprendre",
    title: "Mon anxiété me donne mal au ventre, me coupe l'appétit — c'est lié ?",
    desc: "Module de l'axe corps, le dernier — le <strong>lien direct</strong> entre ton ventre et ton cerveau, pourquoi la digestion s'arrête en pleine alerte, et pourquoi <strong>ralentir ta respiration</strong> apaise aussi ton ventre.",
    meta: "13 cases, séquence unique · ~2 min",
    volets: [],
    related: "Ce module renvoie, en fin de lecture, vers un outil pratique en lien."
  },
  volets: [
    {
      num: 1,
      name: "Le lien entre ton ventre et ton cerveau",
      color: "sage-dark",
      cases: [
        { text: "Boule au ventre. Nausée. Plus faim du tout." },
        { text: "Tu te dis peut-être : « encore mon corps qui me trahit. »" },
        { text: "Tu as sûrement déjà ressenti ça avant un examen, un entretien, un premier rendez-vous. « Des papillons dans le ventre. »" },
        { text: "Ce n'est pas une expression en l'air. Ton ventre et ton cerveau se parlent, en permanence, par une ligne directe." },
        { text: "Le nerf vague, encore lui — celui qui ralentit ton cœur quand tu respires longuement." },
        { text: "Il relie aussi ton cerveau à ton intestin. Dans les deux sens." },
        { text: "Et ton intestin n'est pas un simple tuyau : il fabrique à lui seul la majorité de la sérotonine de ton corps." },
        { text: "Quand l'alarme sonne dans ta tête, ton ventre l'entend. Littéralement." },
        { text: "En pleine alerte, ton corps fait des choix. Combattre ou fuir, pas digérer." },
        { text: "Le sang part vers tes muscles. La digestion passe au second plan." },
        { text: "D'où la boule au ventre. D'où la faim qui disparaît." },
        { text: "Ce n'est pas « dans ta tête ». Ce n'est pas non plus juste « physique ». C'est les deux, au même endroit." },
        {
          text: "Bonne nouvelle : le nerf qui transmet l'alarme est le même qui peut la faire retomber. Ralentir ta respiration apaise aussi ton ventre.",
          climax: true,
          closing: {
            intro: "Pour t'apaiser, tu peux essayer :",
            link: { title: "Je respire, je m'apaise en profondeur", desc: "l'exercice de respiration en trois niveaux", route: "#/outil/respiration-3-niveaux" }
          }
        }
      ]
    }
  ]
};

/* ---- js/data/respiration-module.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "respiration", v0.26) — source :
// design/ecran-module-psychoeducation-respiration.html. Aucun écart de contenu constaté entre les deux
// sources — mockup complet et cohérent, lien de clôture déjà validé. Trois volets (5 + 6 + 8 cases),
// plus le témoignage personnel de Johan en clôture de module, registre récit — même position que
// "évitement", "pensées intrusives" et "body-scan".
//
// Nom de fichier et de variable distincts de js/data/respiration.js (déjà en ligne, données de l'OUTIL
// "Je respire, je m'apaise en profondeur") : ce fichier-ci est le MODULE de psychoéducation qui explique
// le mécanisme, pas l'exercice lui-même — les deux coexistent et se renvoient l'un à l'autre (le module
// clôt sur un lien vers l'outil).
//
// Climax des trois volets sur le sage-dark par défaut (pas de climaxBg) — comme "fondateur",
// "neurologie de la crise" et "body-scan" : la maquette valide bien un fond identique aux trois
// clôtures de volet, pas une couleur d'identité propre à chacun.
//
// Nouveauté visuelle (v1.56, voir css/app.css) : le témoignage isole une phrase entière en évidence
// ("Un petit pas est déjà un pas...") via une classe `.highlight` sur tout le paragraphe — à la
// différence du `.hl` en évidence partielle (un passage au milieu d'une phrase) déjà utilisé pour
// l'anecdote d'"évitement". Reprise du style exact de la maquette.
//
// Encart "Ça peut aussi t'intéresser" : le texte de la maquette ("(v0.32)") mélange une note de
// production avec le contenu réel — même schéma que "peur de perdre le contrôle", "body-scan" et
// "symptômes digestifs". Reformulé sans le numéro de version.
const respirationModule = {
  slug: "respiration-module",
  cover: {
    badge: "Comprendre",
    title: "Pourquoi respirer m'aide vraiment à me calmer ?",
    desc: "Module de l'axe corps — pourquoi <strong>« calme-toi »</strong> est une demande impossible, comment la respiration peut nourrir la crise... et comment <strong>ce même souffle</strong>, utilisé autrement, peut te permettre un <strong>retour au calme</strong>, avec un peu d'entraînement.",
    meta: "3 volets + témoignage, 19 cases · ~3 min",
    volets: [
      "L'injonction paradoxale du « calme-toi »",
      "Quand la respiration alimente la crise",
      "Le même souffle, dans l'autre sens"
    ],
    related: "Ce module renvoie, en fin de lecture, vers un outil pratique en lien."
  },
  volets: [
    {
      num: 1,
      name: "L'injonction paradoxale du « calme-toi »",
      color: "sage-dark",
      cases: [
        { text: "« Calme-toi. » Tu l'as sûrement déjà entendu." },
        { text: "Une phrase bien intentionnée. Mais impossible à obéir." },
        { text: "Personne ne devient calme sur commande. Pas plus qu'on ne devient spontané en se le demandant." },
        { text: "Et si ça ne marche pas, une pensée s'ajoute : « je n'y arrive même pas ». Tu culpabilises, en plus d'être anxieux·se." },
        { text: "Le problème n'a jamais été toi. C'est la demande elle-même qui est impossible à tenir.", climax: true }
      ]
    },
    {
      num: 2,
      name: "Quand la respiration alimente la crise",
      color: "gold-dark",
      cases: [
        { text: "Pendant une crise, ta respiration s'accélère. Elle se prépare à combattre ou fuir." },
        { text: "Mais respirer vite et court a un effet : ça déséquilibre l'oxygène et le CO2 dans ton sang." },
        { text: "Vertiges. Fourmillements. Souffle qui semble manquer." },
        { text: "Des sensations que tu interprètes comme un signe de danger." },
        { text: "Alors que c'est ta respiration elle-même qui les crée." },
        { text: "Le cercle se referme : la peur accélère le souffle, le souffle nourrit la peur.", climax: true }
      ]
    },
    {
      num: 3,
      name: "Le même souffle, dans l'autre sens",
      color: "terracotta",
      cases: [
        { text: "Pourtant, cette même respiration peut faire l'inverse." },
        { text: "Pas en la calmant par la pensée. En la ralentissant, directement." },
        { text: "Un nerf, un seul, relie ton cerveau à ton cœur, tes poumons, ton ventre : le nerf vague." },
        { text: "Quand il est actif, il freine. Le cœur ralentit. Les muscles se relâchent." },
        { text: "Tu peux l'activer par l'expiration. Plus elle est longue, plus le frein s'active. C'est mécanique." },
        { text: "Pas besoin d'y croire pour que ça marche. Ton corps répond, que tu y croies ou non." },
        { text: "Chaque respiration lente envoie un message à ton cerveau : ici, maintenant, on est en sécurité." },
        { text: "Le même souffle qui alimentait le cercle peut désormais le rompre.", climax: true },
        {
          panelHtml: `
            <div class="anecdote">
              <div class="lbl">Mon expérience</div>
              <p>À mon époque, une application comme celle-ci n'existait pas. Mais j'ai eu la chance de connaître un thérapeute dans mon entourage, qui m'a appris des techniques de respiration.</p>
              <p>Je dois te l'avouer : ça n'a pas été un résultat miraculeux dès la première fois.</p>
              <p>Mais suffisamment apaisant pour me donner envie de persévérer.</p>
              <p class="highlight">Un petit pas est déjà un pas. Et quand on est au plus mal, comme je l'étais, c'est déjà beaucoup.</p>
              <p>Alors j'ai répété. Encore. Et encore.</p>
              <p>Jusqu'à ce que ça devienne un réflexe.</p>
              <p>Aujourd'hui, je le fais presque sans y penser.</p>
            </div>
          `,
          closing: {
            intro: "Pour t'apaiser, tu peux essayer :",
            link: { title: "Je respire, je m'apaise en profondeur", desc: "l'exercice de respiration en trois niveaux", route: "#/outil/respiration-3-niveaux" }
          }
        }
      ]
    }
  ]
};

/* ---- js/data/anxiete-matin.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "anxiété du matin", v0.25) — source :
// design/ecran-module-psychoeducation-anxiete-matin.html. Aucun écart de contenu constaté entre les
// deux sources, y compris sur l'anecdote complète (vérifiée jusqu'à ses deux dernières phrases,
// "Mais l'interprétation que j'en fais..." / "Et ce que je construis..."). Séquence unique de 10 cases
// (pas de volets — même schéma que "évitement", "catastrophisme" et "symptômes digestifs"), plus
// l'expérience personnelle de Johan (la sensation dans le ventre) en clôture, registre récit.
//
// Pas de lien de clôture — décision déjà actée dans le texte source lui-même (v1.09) : le mécanisme
// décrit ici (biais de confirmation, mauvaise attribution d'une sensation physique) ne correspond
// directement à aucun outil existant de l'app. Même traitement que "évitement" et "pensées intrusives" :
// cover.related laissé vide, l'encart "Ça peut aussi t'intéresser" de la maquette ("Pas de lien de
// clôture (v0.32) — décision actée (v1.09).") étant une note de production plutôt qu'un texte destiné à
// la personne qui utilise l'app.
const anxieteMatin = {
  slug: "anxiete-matin",
  cover: {
    badge: "Comprendre",
    title: "Je me réveille déjà anxieux·se, qu'est-ce que je fais ?",
    desc: "Module de l'axe quotidien — pourquoi la question « qu'est-ce qui ne va pas ? » trouve toujours une réponse, le rôle du cortisol au réveil, et pourquoi une sensation n'est pas toujours ce qu'on croit.",
    meta: "10 cases + expérience · ~3 min",
    volets: [],
    related: null
  },
  volets: [
    {
      num: 1,
      name: "Le piège de la question, et le rappel physiologique",
      color: "sage-dark",
      cases: [
        { text: "Le réveil sonne. Et la première pensée arrive : « Qu'est-ce qui ne va pas aujourd'hui ? »" },
        { text: "Cette question a déjà la réponse en elle. Quelque chose ne va pas." },
        { text: "Alors ton cerveau se met au travail. Et il trouve. Toujours." },
        { text: "Un rendez-vous qui approche. Une phrase mal interprétée hier. Une fatigue." },
        { text: "Mille raisons possibles. Toutes choisies pour confirmer ce que tu cherchais déjà." },
        { text: "Et cette anxiété, tu la portes maintenant toute la journée." },
        { text: "Pourtant il existe une autre explication. Plus simple." },
        { text: "Le matin, ton cortisol grimpe naturellement. L'hormone qui t'aide à te réveiller." },
        { text: "Ton corps déclenche ce pic chaque matin. Danger ou pas." },
        { text: "Une activation. Pas forcément une alerte.", climax: true },
        {
          panelHtml: `
            <div class="anecdote">
              <div class="lbl">Mon expérience</div>
              <p>Pendant ma période d'angoisse, chaque matin je scannais mon corps. À la recherche d'un signe.</p>
              <p>Un signe qui prouverait ce que je croyais déjà : que j'étais angoissé.</p>
              <p>Mon signe le plus fidèle : une sensation bizarre dans le ventre.</p>
              <p>Dès que je le retrouvais — ou que j'en découvrais un nouveau — le verdict tombait aussitôt. J'étais angoissé. Et paradoxalement, c'était même un peu rassurant : je retrouvais du « connu » — un rituel, certes dysfonctionnel, mais familier.</p>
              <p>Mes pensées prenaient le relais pour trouver pourquoi. Et elles trouvaient. Toujours. J'étais très créatif.</p>
              <p>Puis un matin, une question a devancé les autres : et si ce n'était pas de l'angoisse ?</p>
              <p>J'ai mangé. La sensation s'est envolée avec la faim.</p>
              <p>Depuis, cette question est devenue un réflexe.</p>
              <p>Mes sensations sont réelles — je ne les remets pas en cause.</p>
              <p>Mais l'interprétation que j'en fais, c'est moi qui la construis.</p>
              <p>Et ce que je construis peut nourrir l'angoisse. Ou m'apaiser.</p>
            </div>
          `,
          closing: {
            intro: "Pour bien démarrer la journée :",
            links: [
              { title: "Le mantra", desc: "une phrase simple à te répéter", route: "#/outil/mantra" },
              { title: "Je m'ancre, je suis là", desc: "l'ancrage par les cinq sens (5-4-3-2)", route: "#/outil/ancrage-5432" },
              { title: "J'ai confiance, je tiens bon", desc: "une phrase de confiance à te répéter, la tienne", route: "#/outil/phrase-confiance" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/rumination-soir.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "rumination du soir", v0.33) — source :
// design/ecran-module-psychoeducation-rumination-soir.html. Aucun écart de contenu constaté entre les
// deux sources — mockup complet et cohérent. Trois volets (7 + 6 + 6 cases), pas d'anecdote personnelle
// (choix déjà acté dans le texte source lui-même). Distinct du module "sommeil" (ligne de partage
// réaffirmée dans le texte source, v0.33) — pas de chevauchement de contenu entre les deux.
//
// Chaque volet clôture sur sa propre couleur d'identité (sage-dark, gold-dark, terracotta) via
// `climaxBg` — comme "anticipation anxieuse", "peur de perdre le contrôle" et "déclencheurs personnels".
//
// Deux liens de clôture, déjà validés (v1.09) — "J'écris, je m'en libère" et "J'accueille mes émotions,
// je m'équilibre" — partageant une seule phrase d'intro ("Pour désamorcer la boucle :"), comme
// "neurologie de la crise" et "peur de perdre le contrôle" (closing.links, pas closing.sections : une
// seule section ici, à la différence du module "émotions"). Note du texte source : aucun des deux liens
// n'était cité nommément dans le texte du module lui-même — association ajoutée à la mise en mockup.
//
// PREMIÈRE MISE À JOUR RÉTROACTIVE ATTENDUE DE CE CHANTIER : le module "émotions" (construit avant
// celui-ci) pointe déjà vers "rumination-soir" via un lien marqué `moduleCheck` (v1.55) — dès que ce
// module passe à `live:true` dans js/data/grid.js (fait dans le cadre de cette construction), ce lien
// devient automatiquement actif sans qu'il soit nécessaire de retoucher js/data/emotions.js. Vérifié
// après construction.
//
// Encart "Ça peut aussi t'intéresser" : le texte de la maquette ("(v0.32)") mélange une note de
// production avec le contenu réel — même schéma que "peur de perdre le contrôle". Reformulé sans le
// numéro de version, substance conservée (des outils en lien).
const ruminationSoir = {
  slug: "rumination-soir",
  cover: {
    badge: "Comprendre",
    title: "Le soir, je rumine tout ce qui s'est mal passé, comment arrêter ?",
    desc: "Module de l'axe pensées — pourquoi <strong>rejouer sa journée sans fin</strong> ne change rien, la différence entre réflexion utile et ressassement, et pourquoi ce qui revient le soir est souvent une émotion qui n'a pas eu sa place dans la journée.",
    meta: "3 volets, 19 cases · ~3 min",
    volets: [
      "Les deux façons d'être malheureux pour toujours",
      "Deux façons de repasser sa journée",
      "Pourquoi ça revient"
    ],
    related: "Ce module renvoie, en fin de lecture, vers des outils pratiques en lien."
  },
  volets: [
    {
      num: 1,
      name: "Les deux façons d'être malheureux pour toujours",
      color: "sage-dark",
      cases: [
        { text: "Le soir, la journée repasse en boucle. Ce moment où tu as mal répondu. Cette phrase que tu regrettes." },
        { text: "Tu voudrais revenir en arrière. Faire autrement." },
        { text: "Impossible. Le passé ne se change pas." },
        { text: "Il existe deux façons d'être malheureux pour toujours : vouloir changer ce qui est déjà arrivé..." },
        { text: "... ou le rejouer sans fin dans sa tête, sans jamais rien y changer." },
        { text: "Un peu comme dans « Un jour sans fin » — ce film où le héros revit la même journée, encore et encore, incapable d'en sortir." },
        { text: "Ce qui le libère, à la fin, ce n'est pas de changer la journée. C'est de changer sa façon d'être, à l'intérieur d'elle.", climax: true, climaxBg: "var(--sage-dark)" }
      ]
    },
    {
      num: 2,
      name: "Deux façons de repasser sa journée",
      color: "gold-dark",
      cases: [
        { text: "Repasser une scène dans sa tête, ce n'est pas automatiquement un problème." },
        { text: "Se demander ce qui s'est passé, pour en tirer une leçon : ça, c'est utile." },
        { text: "Mais il y a une autre version, plus insidieuse : ressasser en se comparant, en se jugeant, sans jamais avancer." },
        { text: "« Je suis nul. » « J'aurais dû. » « Pourquoi je fais toujours ça. »" },
        { text: "Cette version-là n'apporte rien. Elle tourne, et elle use." },
        { text: "Se parler à soi-même comme à quelqu'un qu'on aime, plutôt qu'en juge — un premier pas pour l'arrêter.", climax: true, climaxBg: "var(--gold-dark)" }
      ]
    },
    {
      num: 3,
      name: "Pourquoi ça revient",
      color: "terracotta",
      cases: [
        { text: "Souvent, ce qui revient le soir, ce n'est pas vraiment « ce qui s'est passé »." },
        { text: "C'est une émotion qui n'a pas eu sa place dans la journée. Une colère avalée. Une tristesse mise de côté. Une honte tue." },
        { text: "Le soir, seul avec toi-même, elle refait surface — sous forme de pensées, en boucle." },
        { text: "Ce n'est pas un hasard, ni un défaut de caractère." },
        { text: "Une émotion qui n'a pas pu s'exprimer laisse une trace. Et cette trace cherche une sortie." },
        {
          text: "La nommer, l'écrire, en parler — un petit pas de plus pour désamorcer la boucle.",
          climax: true,
          climaxBg: "var(--terracotta)",
          closing: {
            intro: "Pour désamorcer la boucle :",
            links: [
              { title: "J'écris, je m'en libère", desc: "l'exercice d'écriture, pour une pensée qui tourne", route: "#/outil/ecriture" },
              { title: "J'accueille mes émotions, je m'équilibre", desc: "le coussin des émotions, rituel du soir", route: "#/outil/coussin-emotions" },
              { title: "Je m'ancre, je suis là", desc: "l'ancrage par les cinq sens (5-4-3-2), pour interrompre la boucle", route: "#/outil/ancrage-5432" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/sommeil.js ---- */
// Contenu repris mot pour mot du cahier des charges (module "sommeil", v0.27) — source :
// design/ecran-module-psychoeducation-sommeil.html. Aucun écart de contenu constaté sur le texte des
// cases. Deux volets (10 + 6 cases), plus "mon astuce" personnelle de Johan en registre "je" (reformulé
// v1.06 — "secret" remplacé par "astuce", plus concret et moins ludique), en INTERLUDE entre les cases
// 2.5 et 2.6 — position exacte du texte source, pas une clôture de module comme "body-scan" ou
// "respiration". Même encadré visuel que les anecdotes (`.anecdote`), réutilisé pour ce registre "je"
// distinct du registre récit.
//
// Petite incohérence RÉSOLUE dans la maquette elle-même : le méta-texte de couverture dit encore
// "2 volets + secret" alors que la note d'en-tête du même fichier documente explicitement le
// renommage validé "secret" → "astuce" (v1.06) — reliquat non mis à jour, corrigé ici en "astuce"
// (la décision la plus récente et explicite l'emporte, même principe déjà appliqué à "évitement").
//
// Climax des deux volets sur le sage-dark par défaut (pas de climaxBg) — comme "fondateur",
// "neurologie de la crise", "body-scan" et "respiration" : la clôture du volet 2 (case 2.6) est elle
// aussi en sage-dark dans la maquette, pas en gold-dark (couleur d'identité du volet 2).
//
// Trois liens de clôture confirmés par Johan à la relecture finale (v1.57) — proposés dans l'écran
// témoin sous réserve de confirmation ("Trois liens de clôture proposés, à confirmer", badge
// "proposition — à confirmer" sur la case 2.6), cohérents avec le texte : l'exercice d'écriture
// correspond directement au "laisser tomber, ce n'est pas important" de l'astuce, le lieu sécure et la
// respiration sont explicitement cités en case 1.10 ("les exercices de ce module", "la respiration peut
// la relâcher"). Validation actée, plus une proposition — même décision que "symptômes digestifs".
//
// Encart "Ça peut aussi t'intéresser" : la maquette dit "un outil pratique en lien" au singulier alors
// que trois liens sont proposés — reformulé au pluriel, numéro de version retiré (même schéma que les
// modules précédents à liens multiples).
const sommeil = {
  slug: "sommeil",
  cover: {
    badge: "Comprendre",
    title: "Je n'arrive pas à dormir tellement je suis anxieux·se, que faire ?",
    desc: "Module de l'axe corps — pourquoi <strong>chercher le sommeil</strong> l'empêche d'arriver, pourquoi les pensées du soir s'accrochent tant, et une question simple pour <strong>savoir laquelle mérite ton attention</strong>, ce soir.",
    meta: "2 volets + astuce, 16 cases · ~3 min",
    volets: [
      "L'injonction paradoxale du sommeil forcé",
      "Les pensées d'avant le coucher"
    ],
    related: "Ce module renvoie, en fin de lecture, vers des outils pratiques en lien."
  },
  volets: [
    {
      num: 1,
      name: "L'injonction paradoxale du sommeil forcé",
      color: "sage-dark",
      cases: [
        { text: "Tu te couches. Et la mission commence : « il faut que je dorme. »" },
        { text: "Une mission, avec un objectif, un effort, une échéance." },
        { text: "Mais le sommeil n'est pas un objectif qu'on atteint par la volonté. C'est l'état de détente et de lâcher-prise qui mène naturellement au sommeil." },
        { text: "Plus tu essaies, plus ton corps se tend. Et un corps tendu ne s'endort pas." },
        { text: "« Dors » fonctionne comme « calme-toi » : une injonction impossible à obéir sur commande." },
        { text: "Chercher le sommeil, c'est fabriquer la tension qui l'empêche." },
        { text: "Alors que faire, si vouloir dormir empêche de dormir ?" },
        { text: "Renoncer à l'objectif. Pas au lit, pas à la nuit — juste à l'obligation de résultat." },
        { text: "Autorise-toi à rester éveillé, sans lutter. C'est souvent ce qui fait venir le sommeil." },
        { text: "Si ce sont des pensées qui tournent en boucle, les exercices de ce module peuvent t'aider. Si c'est une tension dans le corps, la respiration peut la relâcher.", climax: true }
      ]
    },
    {
      num: 2,
      name: "Les pensées d'avant le coucher",
      color: "gold-dark",
      cases: [
        { text: "Une fois couché, une pensée s'invite. Un problème à régler. Une décision à prendre. Un mail resté sans réponse." },
        { text: "Ton cerveau la garde active, presque malgré toi." },
        { text: "Ce n'est pas un hasard : une tâche non résolue reste en tête bien plus qu'une tâche terminée. Un effet bien connu en psychologie (effet Zeigarnik)." },
        { text: "Ton cerveau n'essaie pas de te torturer. Il essaie, à sa manière, de ne rien oublier." },
        { text: "Mais la nuit ne t'offre aucune action possible sur la plupart de ces pensées." },
        {
          panelHtml: `
            <div class="anecdote">
              <div class="lbl">Mon astuce</div>
              <p>Mon astuce que j'utilise, moi, quand une pensée m'envahit le soir.</p>
              <p>Une seule question : est-ce utile d'y penser maintenant ? Est-ce que je peux trouver une solution, là, tout de suite ?</p>
              <p>Si oui, je m'autorise à y réfléchir, jusqu'à trouver une solution.</p>
              <p>Si non, je laisse tomber. Ce n'est pas important, pas maintenant.</p>
            </div>
          `
        },
        {
          text: "Le cerveau n'a pas besoin de résoudre chaque pensée. Juste de savoir laquelle mérite ton attention, ce soir.",
          climax: true,
          closing: {
            intro: "Pour t'apaiser, tu peux essayer :",
            links: [
              { title: "J'écris, je m'en libère", desc: "exercice d'écriture bornée, 15 minutes", route: "#/outil/ecriture" },
              { title: "Je m'y réfugie, je me sens en sécurité", desc: "le lieu sécure, visualisation guidée", route: "#/outil/lieu-secure" },
              { title: "Je respire, je m'apaise en profondeur", desc: "l'exercice de respiration en trois niveaux", route: "#/outil/respiration-3-niveaux" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/data/respiration.js ---- */
// Contenu repris mot pour mot du cahier des charges (v0.43-v0.44)
// Source : design/ecran-outil-respiration-3-niveaux.html

const respiration = {
  slug: "respiration-3-niveaux",
  title: "Je respire, je m'apaise en profondeur",
  usageBadge: "Outil de fond",
  levels: [
    {
      num: 1,
      h: "La respiration guidée",
      d: "suivre une courbe qui monte, tient, redescend",
      tag: "Suggéré",
      suggested: true,
      type: "curve",
      intro: "Pose ton doigt sur le point et suis son mouvement.",
      body: [
        "Inspire par le nez, en suivant la courbe qui monte... <span class=\"count\">2, 3, 4.</span>",
        "Bloque ta respiration, la courbe fait un plateau... <span class=\"count\">2, 3, 4.</span>",
        "Expire par la bouche, laisse échapper un léger souffle sonore et écoute-le, en suivant la courbe qui redescend... <span class=\"count\">2, 3, 4, 5, 6.</span>"
      ]
    },
    {
      num: 2,
      h: "Respirer par le cœur",
      d: "yeux fermés, attention posée sur le cœur",
      type: "heart",
      intro: "Ferme les yeux, si tu le souhaites. Pose <strong>ton attention sur ton cœur</strong> — comme si tu respirais à travers lui.",
      body: [
        "Inspire par le nez... <span class=\"count\">2, 3, 4.</span>",
        "Bloque ta respiration... <span class=\"count\">2, 3, 4.</span>",
        "Souffle par la bouche, avec un petit son, un soupir... <span class=\"count\">2, 3, 4, 5, 6.</span>"
      ]
    },
    {
      num: 3,
      h: "La couleur de ton intention",
      d: "un mot, une couleur, une visualisation",
      type: "choice",
      intro: "Avant de commencer, une question simple : qu'aimerais-tu ressentir en toi-même, ne serait-ce qu'un tout petit peu ?",
      introNote: "Rappelle-toi : un petit pas, c'est déjà un pas.",
      words: ["Calme", "Légèreté", "Détente", "Sécurité", "Solidité", "Énergie"],
      colors: [
        { from: "#e3f0de", to: "#b7cdb0", glow: "rgba(183,205,176,0.6)" },
        { from: "#faedc6", to: "#e8c98a", glow: "rgba(232,201,138,0.7)" },
        { from: "#f5e4d8", to: "#d9b8a0", glow: "rgba(217,184,160,0.6)" },
        { from: "#dcecf0", to: "#9fb8c2", glow: "rgba(159,184,194,0.6)" },
        { from: "#ecdfd2", to: "#c9a88f", glow: "rgba(201,168,143,0.6)" }
      ]
    },
    {
      // Écran E : respiration avec l'intention choisie au niveau 3
      num: "3b",
      type: "bubble",
      body: [
        "Inspire par le nez, et imagine que tu fais entrer cette couleur <strong>à travers ton cœur</strong>... <span class=\"count\">2, 3, 4.</span>",
        "Bloque ta respiration, et imagine cette <strong>intention qui prend sa place en toi</strong>... <span class=\"count\">2, 3, 4.</span>",
        "Souffle par la bouche, et laisse <strong>partir tout ce qui ne t'appartient plus</strong>... <span class=\"count\">2, 3, 4, 5, 6.</span>"
      ]
    }
  ]
};

/* ---- js/data/trois-mois.js ---- */
// Contenu "Et dans trois mois, ce sera comment ?" (v1.71) — module de consolidation et de prévention
// de la rechute, point 4 du volet clinique de la relecture bêta-testeur (v1.63). Texte travaillé avec
// Johan, point par point, volet par volet (cf. cahier des charges v1.71 pour l'historique complet des
// corrections et le détail des fondements mobilisés à chaque étape).
//
// Rangé dans "Mes ressources" plutôt que "Comprendre" (décision de Johan, v1.71) : ce module ne
// correspond à aucun des 4 axes de mécanisme déjà en place (corps/pensées/quotidien/émotions) — c'est
// un module de consolidation à part, pas une explication d'un symptôme précis.
//
// Couleurs de volet distinctes (sage-dark, gold-dark, terracotta), chaque climax clôturant sur SA
// PROPRE couleur d'identité via climaxBg — même principe déjà validé pour "anticipation anxieuse"
// (v1.09), pas une incohérence.
const troisMois = {
  slug: "trois-mois",
  cover: {
    badge: "Mes ressources",
    title: "Et dans trois mois, ce sera comment ?",
    desc: "Ce qui reste vrai même quand ça va mieux — et un petit plan à préparer maintenant, pour toi, si l'angoisse revient un jour.",
    meta: "3 volets, 21 cases · ~3 min",
    volets: ["Ce qui reste vrai", "Une remontée n'efface rien", "Ton petit plan, si ça revient"],
    related: ""
  },
  volets: [
    {
      num: 1,
      name: "Ce qui reste vrai",
      color: "sage-dark",
      cases: [
        { text: "Un jour, ça va mieux. Beaucoup mieux, même." },
        { text: "Et puis, un jour, elle repasse. Un peu, ou beaucoup." },
        { text: "Tu te dis peut-être : « Je croyais que c'était fini. Je repars de zéro. »" },
        { text: "Quelqu'un qui n'a jamais connu ce que tu as vécu vivrait ce même moment sans y penser deux fois — juste un mauvais moment, presque un non-événement, vite oublié." },
        { text: "Toi, tu as pris l'habitude d'additionner : « Ça y est, ça recommence. » Et ce réflexe, à lui seul, peut suffire à transformer une simple sensation en une anxiété durable." },
        { text: "Non. Tu ne repars pas de zéro." },
        { text: "L'angoisse ne disparaît jamais complètement — elle fait partie du fonctionnement naturel de l'humain." },
        { text: "Et un moment d'angoisse reste un moment qui passe, comme toujours — si tu le remets, à chaque fois, à sa juste place.", climax: true }
      ]
    },
    {
      num: 2,
      name: "Une remontée n'efface rien",
      color: "gold-dark",
      cases: [
        { text: "Un mauvais moment, une mauvaise journée, une mauvaise semaine — ça ne défait pas tous les efforts que tu as déjà faits, ni le chemin déjà parcouru." },
        { text: "Un pas qui titube ne te ramène pas au point de départ. Il te rapproche quand même, un peu plus, de là où tu vas." },
        { text: "Ce que tu as appris sur toi reste vrai, même les jours où tu n'arrives pas à t'en servir." },
        { text: "Retrouver ton calme, une fois, ce n'était pas un coup de chance. C'est une capacité. Elle est toujours là — comme le soleil continue de briller, même quand les nuages te le cachent." },
        { text: "Alors si ça revient : ce n'est pas reculer. C'est retraverser un chemin déjà parcouru une fois — donc déjà un peu plus familier." },
        { text: "Tu ne repars pas de la première case. Tu sais déjà où chercher." },
        { text: "Ce que tu as réussi une fois, tu peux le réussir encore. Ce n'est pas une promesse en l'air — c'est déjà arrivé.", climax: true, climaxBg: "var(--gold-dark)" }
      ]
    },
    {
      num: 3,
      name: "Ton petit plan, si ça revient",
      color: "terracotta",
      cases: [
        { text: "Une dernière chose, peut-être la plus utile : décider maintenant, à froid, ce que tu ferais si ça revenait." },
        { text: "Pas en pleine tempête, quand tout va déjà plus vite que toi. Maintenant, pendant que c'est calme." },
        { text: "Un peu comme un vêtement de pluie, préparé avant que le ciel ne se couvre — pas parce que tu es sûr·e qu'il pleuvra, juste pour être tranquille s'il pleut." },
        { text: "Ton réflexe n'a pas besoin d'être compliqué. Un tout petit geste, décidé à l'avance, suffit." },
        { text: "Comme ça, le jour où tu en as besoin, tu n'as rien à inventer. Il est déjà prêt, il t'attend.", climax: true, climaxBg: "var(--terracotta)" },
        {
          text: "À toi de préparer le tien, maintenant que tu es au calme.",
          closing: {
            intro: "Pour préparer ton petit plan :",
            link: { title: "Mon petit plan, si ça revient", desc: "un tout petit réflexe, décidé à l'avance", route: "#/outil/plan-rechute" }
          }
        }
      ]
    }
  ]
};

/* ---- js/data/soutien-social.js ---- */
// Module "soutien social" (v1.91) — chantier ouvert à la demande de Johan ("on avance" → "Soutien
// social"), pour construire quelque chose autour de l'isolement pendant l'anxiété, en restant 100%
// local (pas de fonctionnalité "sociale" au sens compte/serveur — juste de la psychoéducation + un
// outil local de préparation, cf. discussion avec Johan).
//
// Particularité de ce module par rapport à tous les précédents : c'est le premier dont le contenu a
// été RÉDIGÉ PAR CLAUDE (brouillon complet), pas par Johan lui-même — accord explicite de Johan avant
// rédaction ("Je te propose un brouillon complet à valider"). Le contenu ci-dessous n'est donc pas
// repris d'un cahier des charges existant : il a été validé volet par volet, phrase par phrase, avec
// Johan (relecture dictée), jusqu'à validation complète. Voir cahier-des-charges-decisions.md (v1.91)
// pour le détail du processus et les échanges qui ont fait évoluer chaque volet.
//
// Théories citées : mécanisme d'évitement / théorie bifactorielle de Mowrer (volet 1, déjà utilisée
// dans le module "évitement" et dans le Journal, v1.88) ; théorie de l'attachement, base de sécurité
// (Bowlby, Ainsworth — déjà citée dans l'app pour "certitude de retrouver le calme", v0.49) ; théorie
// de l'effet tampon du soutien social (Cohen & Wills — NOUVELLE citation pour ce projet) ; théorie de
// l'autodétermination, besoin de relation (Deci & Ryan — déjà citée ailleurs dans l'app) ; intentions
// de mise en œuvre (Gollwitzer — déjà citée pour les plans du Journal et "Mon petit plan, si ça
// revient").
//
// Anecdote personnelle de Johan (volet 4, dernière case, combinée avec le lien de clôture sur le même
// objet de case — même structure que "évitement", cf. js/data/evitement.js) : honte de la solitude,
// souffrance de ce sentiment de solitude, demande d'aide (famille puis psychothérapie), découverte
// que beaucoup de personnes partagent ces sentiments — ce qui crée du lien. Dictée par Johan, mise en
// forme par Claude, validée telle quelle ("je valide").
//
// Volet 2, point 2 reformulé à la demande de Johan pour clarifier "un retour possible" (ambigu : un
// retour à quoi ?) → "un retour possible à un état de calme", avec la phrase retournée pour la
// clarté.
//
// Volet 3, point 2 : écho volontaire ("chaque petit pas compte") au mantra de l'onboarding — confirmé
// intentionnel par Johan ("c'est fait exprès").
const soutienSocial = {
  slug: "soutien-social",
  cover: {
    badge: "Comprendre",
    title: "Je m'isole quand je vais mal, est-ce que ça m'aide vraiment ?",
    desc: "Module de l'axe quotidien — pourquoi s'isoler <strong>soulage sur le moment</strong> mais coûte cher sur la durée, ce que la présence d'un autre fait vraiment à ton corps, et pourquoi <strong>demander de l'aide</strong> est une compétence, pas une faiblesse.",
    meta: "4 volets, 11 cases + expérience · ~3 min",
    volets: [
      "Le réflexe de s'isoler",
      "Ce que la présence d'un autre fait à ton corps",
      "La honte qui empêche de demander",
      "Une petite marche, pas un grand saut"
    ],
    related: "Ce module renvoie, en fin de lecture, vers un outil de Mes ressources en lien."
  },
  volets: [
    {
      num: 1,
      name: "Le réflexe de s'isoler",
      color: "sage-dark",
      cases: [
        { text: "Quand l'anxiété monte, se replier peut sembler la seule solution : moins de monde, moins de risques, donc moins de stress." },
        { text: "C'est le même mécanisme que celui déjà vu avec l'évitement : ça semble soulager tout de suite, mais ça n'apprend jamais que la situation aurait pu bien se passer — et à force de se répéter, ça peut même renforcer l'idée que personne ne peut vraiment aider." },
        { text: "S'isoler n'est pas un défaut lié à une personnalité ou à un caractère : c'est une stratégie de protection, apprise, qui a peut-être déjà été utile — mais qui a un coût sur la durée.", climax: true }
      ]
    },
    {
      num: 2,
      name: "Ce que la présence d'un autre fait à ton corps",
      color: "gold-dark",
      cases: [
        { text: "Le corps se régule aussi grâce à la présence d'un autre : une voix calme, un visage familier peuvent, en quelques secondes, faire redescendre un système nerveux en alerte." },
        { text: "Ce n'est pas qu'une impression : la théorie de l'attachement (Bowlby, Ainsworth) montre qu'une présence fiable ne supprime pas la détresse sur le moment, mais garantit un retour possible à un état de calme — et c'est cette certitude, à elle seule, qui apaise." },
        { text: "Se sentir soutenu, même sans que rien ne change à la situation elle-même, réduit concrètement l'impact du stress sur le corps (Cohen & Wills, théorie de l'effet tampon du soutien social).", climax: true, climaxBg: "var(--gold-dark)" }
      ]
    },
    {
      num: 3,
      name: "La honte qui empêche de demander",
      color: "terracotta",
      cases: [
        { text: "« Je ne veux pas déranger », « les autres ont déjà leurs problèmes », « je devrais y arriver seul·e » — la honte s'invite facilement, surtout quand l'anxiété dure depuis longtemps." },
        { text: "Demander de l'aide n'est pas un aveu de faiblesse : c'est une compétence, comme une autre, qui se développe avec la pratique. Comme pour toute compétence, chaque petit pas compte : la gêne diminue peu à peu, et avec l'habitude vient un sentiment de confort." },
        { text: "Le besoin d'être relié aux autres est un besoin humain fondamental (Deci & Ryan), partagé par absolument tout le monde — pas une préférence, encore moins une faiblesse à corriger chez toi en particulier.", climax: true, climaxBg: "var(--terracotta)" }
      ]
    },
    {
      num: 4,
      name: "Une petite marche, pas un grand saut",
      color: "slate",
      cases: [
        { text: "Pas besoin de tout raconter, ni à tout le monde. Une seule personne, une seule phrase peuvent suffire : « là, ça ne va pas très fort. »" },
        { text: "Repère une personne, même une seule, vers qui te tourner — et prépare, à l'avance, ce que tu pourrais lui dire. Le jour où tu en auras besoin, tu n'auras pas à le chercher.", climax: true, climaxBg: "var(--slate)" },
        {
          panelHtml: `
            <div class="anecdote">
              <div class="lbl">Mon expérience</div>
              <p>Pendant la période où je faisais des crises d'angoisse, il m'était très difficile de demander de l'aide. Je valorisais mon indépendance, et j'avais honte à l'idée d'en avoir besoin — comme si ça voulait dire que j'étais faible.</p>
              <p>Alors je restais seul avec ça. Et cette solitude, autant que l'angoisse elle-même, me faisait souffrir.</p>
              <p>C'est la force de l'angoisse, plus que ma volonté, qui m'a poussé à demander de l'aide. D'abord dans ma famille : quelqu'un sur qui je savais pouvoir compter, à qui dire quand ça n'allait pas, avec qui faire les exercices de respiration. Puis un accompagnement professionnel, en psychothérapie, qui m'a énormément aidé.</p>
              <p><span class="hl">Le plus difficile n'était pas de trouver de l'aide — c'était de franchir la honte de dire que je me sentais seul, que je souffrais, que j'angoissais.</span> Et une fois ce pas franchi, j'ai découvert quelque chose que je ne savais pas encore : on est nombreux à ressentir exactement la même chose.</p>
              <p><span class="hl">Partager ce qu'il y a de plus difficile en nous, c'est aussi partager ce qu'il y a de plus humain.</span> Et c'est de là, plus que d'ailleurs, que sont nées certaines de mes amitiés les plus profondes, et des relations de soutien mutuel qui comptent encore aujourd'hui.</p>
            </div>
          `,
          closing: {
            intro: "Pour préparer ce lien, à l'avance :",
            links: [
              { title: "Je me tourne vers quelqu'un, je ne reste pas seul·e", desc: "noter une personne de confiance, et ce que tu pourrais lui dire", route: "#/outil/personne-confiance" }
            ]
          }
        }
      ]
    }
  ]
};

/* ---- js/screens/onboarding.js ---- */
let breathRaf = null;

function stopBreathAnim() {
  if (breathRaf) cancelAnimationFrame(breathRaf);
  breathRaf = null;
}

function startBreathAnim(root) {
  const seq = [
    { t: 0, label: "Inspire" },
    { t: 1000, label: "2" },
    { t: 2000, label: "3" },
    { t: 3000, label: "4" },
    { t: 4000, label: "Expire" },
    { t: 5000, label: "2" },
    { t: 6000, label: "3" },
    { t: 7000, label: "4" },
    { t: 8000, label: "5" }
  ];
  const label = root.querySelector("#breathLabel");
  if (!label) return;
  let start = null;
  function update(now) {
    if (start === null) start = now;
    const elapsed = (now - start) % 9000;
    let current = seq[0].label;
    for (const s of seq) if (elapsed >= s.t) current = s.label;
    if (label.textContent !== current) label.textContent = current;
    breathRaf = requestAnimationFrame(update);
  }
  breathRaf = requestAnimationFrame(update);
}

function render__onboarding(root, params) {
  stopBreathAnim();
  const stepIndex = Math.min(Math.max(parseInt(params.step || "0", 10) || 0, 0), onboardingSteps.length - 1);
  const step = onboardingSteps[stepIndex];
  const prenom = store.getPrenom();

  const dots = onboardingSteps.map((s, i) =>
    `<span class="${i === stepIndex ? "on" : ""}"></span>`
  ).join("");

  let inner = `<div class="dots">${dots}</div>`;

  if (step.id === "respiration") {
    inner += `
      <div class="breath-wrap"><div class="breath-circle"><span class="breath-label" id="breathLabel">Inspire</span></div></div>
      <div class="body-copy">
        ${step.body.map(p => `<p>${p}</p>`).join("")}
        <p class="closing">${step.closing}</p>
      </div>
      <div class="spacer"></div>
      <button class="btn-primary" data-next>Continuer</button>
    `;
  } else if (step.id === "accueil") {
    inner += `
      <div class="avatar">${step.avatar}</div>
      <div class="body-copy">${step.body.map(p => `<p>${p}</p>`).join("")}</div>
      <div class="spacer"></div>
      <button class="btn-primary" data-next>Continuer</button>
    `;
  } else if (step.id === "nom") {
    inner += `
      <div class="body-copy">
        <p class="closing">${step.closing}</p>
        <p>${step.body[1]}</p>
      </div>
      <input class="field" id="prenomInput" type="text" placeholder="${escapeHtml(step.placeholder)}" value="${escapeHtml(prenom)}">
      <div class="spacer"></div>
      <button class="btn-primary" data-next>Continuer</button>
      <button class="btn-secondary" data-skip-name>${step.skip}</button>
    `;
  } else if (step.id === "cadeau") {
    const prenomTxt = prenom ? escapeHtml(prenom) + ", " : "";
    inner += `
      <div class="body-copy"><p>${prenomTxt}${step.body[0]}</p></div>
      <div class="gift-card"><div class="mantra">${step.mantra}</div></div>
      <div class="spacer"></div>
      <button class="btn-primary" data-next>Continuer</button>
    `;
  } else if (step.id === "depart") {
    inner += `
      <div class="body-copy"><p>${step.body[0]}</p></div>
      ${step.options.map(o => `
        <button class="option" data-option data-route="${o.route}">
          <div class="h"><span class="ic">●</span>${escapeHtml(o.h)}</div>
          <div class="d">${escapeHtml(o.d)}</div>
        </button>
      `).join("")}
      <div class="spacer"></div>
      <button class="btn-secondary" data-next>${step.skip}</button>
      <div class="onboarding-disclaimer">
        ${step.disclaimer.map(p => `<p>${p}</p>`).join("")}
      </div>
    `;
  }

  root.innerHTML = `<div class="screen" id="onboardingScreen">${inner}</div>`;

  const goNext = () => {
    if (step.id === "nom") {
      const val = root.querySelector("#prenomInput").value.trim();
      if (val) store.setPrenom(val);
    }
    if (stepIndex >= onboardingSteps.length - 1) {
      store.setOnboardingDone(true);
      navigate("#/");
    } else {
      navigate("#/onboarding/" + (stepIndex + 1));
    }
  };

  root.querySelectorAll("[data-next]").forEach(b => b.addEventListener("click", goNext));
  const skipName = root.querySelector("[data-skip-name]");
  if (skipName) skipName.addEventListener("click", () => {
    store.setPrenom("");
    navigate("#/onboarding/" + (stepIndex + 1));
  });
  root.querySelectorAll("[data-option]").forEach(b => b.addEventListener("click", () => {
    // Ouvre directement sur le module suggéré (v1.62) plutôt que de simplement mémoriser un choix pour
    // l'accueil — la personne peut toujours revenir en arrière ensuite, rien n'est fermé (v0.74).
    store.setOnboardingDone(true);
    navigate(b.getAttribute("data-route"));
  }));

  if (step.id === "respiration") startBreathAnim(root);
}

function cleanup__onboarding() {
  stopBreathAnim();
}

const OnboardingScreen = { render: render__onboarding, cleanup: cleanup__onboarding };

/* ---- js/screens/home.js ---- */
// État de dépli des axes de "Comprendre" (v1.61) : en mémoire seulement, pas persisté en localStorage —
// volontaire, pour que chaque nouvelle arrivée sur l'accueil reparte sur un écran épuré (tout replié).
// Survit en revanche à une navigation aller-retour vers un module puis retour à l'accueil, tant que
// l'application n'est pas rechargée entièrement (variable au niveau du module, même principe que
// `activeToolScreen` dans outil-router.js).
let openAxis = null;

// Boucle de reconnaissance factuelle (v1.70), point 3 du volet clinique de la relecture bêta-testeur
// (v1.63) : chaque outil fonctionne isolément, rien ne dit jamais à la personne "voilà ce que tu as
// accompli". Bandura distingue la persuasion verbale comme source d'auto-efficacité, à côté de
// l'expérience de maîtrise elle-même — ce bandeau y répond, mais reste strictement factuel et
// déterministe (jamais un score, jamais une comparaison, jamais un jugement de performance), pour ne
// pas rouvrir le débat déjà tranché sur le refus de toute gamification compétitive (v0.7, v0.73).
//
// Portée choisie par Johan (v1.70) : uniquement le Journal (compliments, déclencheurs, fil des soirs,
// bilans), qui a déjà une date sur chaque entrée — pas les outils/modules, qui n'ont aujourd'hui aucun
// historique d'usage horodaté (juste une note "favoris" unique, sans date). Ajouter un tel historique
// aurait été une nouvelle catégorie de donnée conservée, même 100% locale, à ne pas faire sans
// validation explicite — non retenu pour cette première version.
//
// "La vérification des attentes" (prédictions) n'est volontairement pas comptée : contrairement aux
// quatre autres, y ajouter une entrée est un geste en deux temps (une prédiction notée, puis vérifiée
// plus tard) — mélanger ce comptage aux autres aurait compliqué la phrase sans bénéfice clair pour une
// première version. Pourra être ajouté plus tard si Johan le souhaite.
//
// TEXTE DES PHRASES : proposé par Claude en v1.70, validé tel quel par Johan en v1.74 ("ok je
// valide") — texte définitif, pas juste un brouillon.
function computeReconnaissanceHtml() {
  const WINDOW_DAYS = 7;
  const since = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const countSince = (list) => list.filter(e => {
    const t = Date.parse(e.date);
    return !isNaN(t) && t >= since;
  }).length;

  const sections = [
    { count: countSince(store.getCompliments()), label: n => n === 1 ? "noté un compliment" : `noté ${n} compliments` },
    { count: countSince(store.getDeclencheurs()), label: n => n === 1 ? "ajouté un déclencheur à ta carte" : `ajouté ${n} déclencheurs à ta carte` },
    { count: countSince(store.getSoirs()), label: n => n === 1 ? "rempli le fil de tes soirs" : `rempli le fil de tes soirs ${n} fois` },
    { count: countSince(store.getBilans()), label: n => n === 1 ? "écrit un bilan" : `écrit ${n} bilans` }
  ];

  const active = sections.filter(s => s.count > 0);
  if (active.length === 0) return "";

  const sentence = active.length === 1
    ? `Cette semaine, tu as ${active[0].label(active[0].count)}.`
    : `Cette semaine, tu es revenu·e ${active.reduce((sum, s) => sum + s.count, 0)} fois dans ton Journal.`;

  return `<div class="home-recognition">${sentence}</div>`;
}

// Invitation à l'auto-évaluation de progression (v1.73), point 1 du volet clinique de la relecture
// bêta-testeur (v1.63). Rythme validé par Johan : jamais plus d'une fois toutes les deux semaines —
// le bandeau n'apparaît que si la dernière auto-évaluation date d'au moins 15 jours, ou n'a jamais
// été faite (`getAutoEvalEntries()[0]` est la plus récente, cf. js/store.js). Pas de bouton pour
// l'écarter (à la différence de l'invitation au message vocal ci-dessus, vue une seule fois pour
// toujours) : ce rappel doit pouvoir revenir après le délai, un "vu" permanent ne conviendrait pas ici.
function computeAutoEvalInviteHtml() {
  const DELAY_DAYS = 15;
  const entries = store.getAutoEvalEntries();
  if (entries.length > 0) {
    const daysSince = (Date.now() - new Date(entries[0].date).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < DELAY_DAYS) return "";
  }
  return `<div class="home-autoeval-invite">Envie de <a data-route="#/journal/auto-eval" data-autoeval-link>faire le point</a> ? Un instantané rapide, de temps en temps, juste pour toi.</div>`;
}

function render__home(root) {
  const prenom = store.getPrenom();

  const journalSvg = `<svg viewBox="0 0 100 100" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M50 22 V82"/>
    <path d="M50 26 C 42 20, 30 18, 20 20 V78 C 30 76, 42 78, 50 84"/>
    <path d="M50 26 C 58 20, 70 18, 80 20 V78 C 70 76, 58 78, 50 84"/>
    <path d="M28 34 H42" stroke-width="4.2"/>
    <path d="M28 45 H42" stroke-width="4.2"/>
    <path d="M28 56 H40" stroke-width="4.2"/>
    <path d="M58 34 H72" stroke-width="4.2"/>
    <path d="M58 45 H72" stroke-width="4.2"/>
    <path d="M58 56 H70" stroke-width="4.2"/>
  </svg>`;

  const view = store.getHomeView();

  const catsHtmlListe = categories.map(cat => {
    return `
    <div class="cat-section">
      <h2>${escapeHtml(cat.name)}</h2>
      <div class="tool-grid">
        ${renderAxisGroupedHtml(cat.tools, openAxis)}
      </div>
    </div>
  `;
  }).join("");

  const tileIcons = {
    "je-respire": gridIcon_jeRespire,
    "je-mancre": gridIcon_jeMancre,
    "comprendre": gridIcon_comprendre,
    "mes-ressources": gridIcon_mesRessources
  };

  const catsHtmlGrille = `
    <div class="grid-tiles">
      ${categories.map(cat => `
          <button class="grid-tile grid-tile-${cat.id}" data-route="#/categorie/${cat.id}">
            <img class="grid-tile-icon" src="${tileIcons[cat.id] || ""}" alt="">
            <span class="grid-tile-name">${escapeHtml(cat.name)}</span>
          </button>
        `).join("")}
    </div>
  `;

  // Invitation discrète au message vocal (v1.64) : affichée une seule fois, juste après
  // l'onboarding, tant qu'aucun message n'a encore été enregistré et que l'invitation n'a pas déjà
  // été vue/écartée — jamais réintroduite ensuite, y compris si la personne enregistre un message
  // puis le supprime plus tard. Décision de Johan (cahier des charges v1.64) : ne rien demander
  // pendant l'onboarding lui-même (pas de permission micro à ce stade), mais mettre la fonction en
  // valeur dès l'arrivée sur l'accueil plutôt que de la laisser seulement dans "Mes ressources".
  const showInvite = !store.getMessageVocalInviteVu() && !store.getMessageVocal();
  const inviteHtml = showInvite ? `
    <div class="home-invite">
      <div class="home-invite-txt">Un endroit pour toi : tu peux <a data-route="#/outil/phrase-confiance" data-invite-link>enregistrer un message pour toi-même</a>, à réécouter dans les moments plus difficiles.</div>
      <button class="home-invite-dismiss" data-invite-dismiss aria-label="Plus tard">✕</button>
    </div>
  ` : "";

  const recognitionHtml = computeReconnaissanceHtml();
  const autoevalInviteHtml = computeAutoEvalInviteHtml();

  // Icône de recherche (v1.67, point A8) : dans l'en-tête, à côté du titre plutôt qu'une barre
  // toujours visible — choix de Johan (cahier des charges v1.67) pour rester cohérent avec le reste
  // de l'app, où chaque fonction a son propre écran dédié (#/recherche).
  const searchSvg = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round">
    <circle cx="42" cy="42" r="27"/>
    <line x1="62" y1="62" x2="88" y2="88"/>
  </svg>`;

  // Icône de réglages (v1.75) : dans l'en-tête, à côté de la loupe de recherche — ouvre l'écran
  // "Paramètres" (export de données pour l'instant). Décision de Johan (v1.75) plutôt qu'un bouton
  // dans le Journal ou dans "Mes ressources".
  const settingsSvg = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="50" cy="50" r="14"/>
    <path d="M50 20 V10 M50 90 V80 M80 50 H90 M10 50 H20 M71 29 L78 22 M22 78 L29 71 M71 71 L78 78 M22 22 L29 29"/>
  </svg>`;

  root.innerHTML = `
    <div class="screen">
      <div class="home-header-row">
        <h1 class="title">${prenom ? "Bonjour " + escapeHtml(prenom) : "ViaCalma"}</h1>
        <div class="home-header-actions">
          <button class="icon-btn" data-route="#/recherche" aria-label="Rechercher un outil ou un module">${searchSvg}</button>
          <button class="icon-btn" data-route="#/parametres" aria-label="Paramètres">${settingsSvg}</button>
        </div>
      </div>
      <div class="subtitle">stockage local uniquement</div>
      ${inviteHtml}
      ${recognitionHtml}
      ${autoevalInviteHtml}
      <div class="central-btn-section">
        <button class="cbtn-wrap" data-route="#/detresse">
          <span class="cbtn-ring"></span>
          <span class="cbtn-ring cbtn-ring-2"></span>
          <span class="cbtn"><span class="cbtn-txt">Moment difficile</span></span>
        </button>
      </div>
      <button class="journal-pill" data-route="#/journal">
        <span class="journal-badge">${journalSvg}</span>
        Mon journal
      </button>
      <div class="view-toggle" data-view-toggle>
        <button class="view-toggle-btn ${view === "grille" ? "on" : ""}" data-view="grille">Vue grille</button>
        <button class="view-toggle-btn ${view === "liste" ? "on" : ""}" data-view="liste">Vue liste</button>
      </div>
      <div class="proposal-flag">proposition à comparer — pas encore validée par Johan</div>
      ${view === "grille" ? catsHtmlGrille : catsHtmlListe}
      <div class="note">
        <strong>Version d'essai —</strong> seuls le module « Je me sens anxieux·se, c'est quoi exactement ? », l'outil « Je respire, je m'apaise en profondeur » et la boîte à compliments du Journal sont fonctionnels pour l'instant. Le reste de la grille arrive ensuite.
      </div>
    </div>
  `;

  root.querySelectorAll("[data-route]").forEach(b => {
    b.addEventListener("click", () => navigate(b.getAttribute("data-route")));
  });
  const inviteLink = root.querySelector("[data-invite-link]");
  if (inviteLink) inviteLink.addEventListener("click", () => store.setMessageVocalInviteVu(true));
  const inviteDismiss = root.querySelector("[data-invite-dismiss]");
  if (inviteDismiss) inviteDismiss.addEventListener("click", () => {
    store.setMessageVocalInviteVu(true);
    HomeScreen.render(root);
  });
  root.querySelectorAll("[data-view]").forEach(b => {
    b.addEventListener("click", () => {
      store.setHomeView(b.getAttribute("data-view"));
      HomeScreen.render(root);
    });
  });
  wireAxisToggles(root, (key) => {
    openAxis = openAxis === key ? null : key;
    HomeScreen.render(root);
  });
}

const HomeScreen = { render: render__home };

/* ---- js/screens/categorie.js ---- */
// Sous-écran d'une catégorie (utilisé uniquement par la vue "grille 2x2" de l'accueil, proposition à confirmer).
// Repli par axe (v1.61) : même état/logique que home.js, variable de module dédiée pour ne pas
// interférer avec l'accordéon de l'accueil si les deux écrans sont visités dans la même session.
let openAxisCat = null;

function render__categorie(root, params) {
  const cat = categories.find(c => c.id === params.id);
  if (!cat) { navigate("#/"); return; }

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Accueil</button></div>
      <h3 class="title title-md">${escapeHtml(cat.name)}</h3>
      <div class="tool-grid tool-grid-1col">
        ${renderAxisGroupedHtml(cat.tools, openAxisCat)}
      </div>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/"));
  root.querySelectorAll("[data-route]").forEach(b => {
    b.addEventListener("click", () => navigate(b.getAttribute("data-route")));
  });
  wireAxisToggles(root, (key) => {
    openAxisCat = openAxisCat === key ? null : key;
    CategoryScreen.render(root, params);
  });
}

const CategoryScreen = { render: render__categorie };

/* ---- js/screens/module.js ---- */
const MODULES = { fondateur, evitement, "neurologie-crise": neurologieCrise, "anticipation-anxieuse": anticipationAnxieuse, "pensees-intrusives": penseesIntrusives, catastrophisme, "perte-controle": perteControle, "declencheurs-personnels": declencheursPersonnels, emotions, "body-scan": bodyScan, "symptomes-digestifs": symptomesDigestifs, "respiration-module": respirationModule, "anxiete-matin": anxieteMatin, "rumination-soir": ruminationSoir, sommeil, "trois-mois": troisMois, "soutien-social": soutienSocial };

// Aplatit les volets en une liste unique de cases, avec les métadonnées
// nécessaires à la barre de progression et à la couleur du panneau.
//
// Comptage des cases "planches" à part (v1.53) : une case `panelHtml` (tableau, anecdote) n'est jamais
// comptée dans le "i / total" d'un volet — cohérent avec le principe déjà posé (v1.51, module.js) que
// ces cases n'affichent elles-mêmes aucune barre de progression, et avec la méta-description de chaque
// module, qui distingue toujours "cases" d'un côté et "tableau"/"expérience" de l'autre. Bogue trouvé
// en préparant "peur de perdre le contrôle" (dont l'anecdote s'intercale entre deux cases numérotées du
// volet 2, pas seulement en fin de volet comme "évitement" et "pensées intrusives") : le dénominateur
// (`caseCountInVolet`) comptait à tort TOUTES les entrées du volet, planches comprises — "évitement"
// affichait ainsi "Case 1 / 7" au lieu de "Case 1 / 5" (5 cases réelles, tableau et anecdote à part)
// depuis sa construction (v1.48). Corrigé pour tous les modules à la fois : seules les cases sans
// `panelHtml` sont comptées, qu'elles soient en fin de volet ou intercalées au milieu.
function flattenCases(mod) {
  const flat = [];
  mod.volets.forEach((volet, vIdx) => {
    const countable = volet.cases.filter(c => !c.panelHtml).length;
    let realIdx = 0;
    volet.cases.forEach((c) => {
      const isCountable = !c.panelHtml;
      flat.push({
        ...c,
        voletIndex: vIdx,
        voletNum: volet.num,
        voletName: volet.name,
        voletColor: volet.color,
        caseIndex: realIdx,
        caseCountInVolet: countable,
        caseNum: String(realIdx + 1).padStart(2, "0")
      });
      if (isCountable) realIdx++;
    });
  });
  return flat;
}

// Catégorie d'origine du module (v1.71) : jusqu'ici tous les modules vivaient dans "Comprendre", d'où
// le libellé "‹ Comprendre" écrit en dur. "Et dans trois mois ?" est le premier module rangé dans
// "Mes ressources" (décision de Johan, v1.71) — le libellé doit donc suivre la vraie catégorie plutôt
// que rester figé, sans rien changer pour les modules existants (tous toujours dans "Comprendre").
function categoryNameForSlug(slug) {
  const cat = categories.find(c => c.tools.some(t => t.id === slug));
  return cat ? cat.name : "Comprendre";
}

function renderCover(root, mod, slug) {
  const backLabel = categoryNameForSlug(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ ${escapeHtml(backLabel)}</button></div>
      <div class="cat-badge">${escapeHtml(mod.cover.badge)}</div>
      <h3 class="title">${escapeHtml(mod.cover.title)}</h3>
      <div class="cover-desc">${mod.cover.desc}</div>
      <div class="meta-row"><span>📖 ${escapeHtml(mod.cover.meta)}</span></div>
      <div class="volet-list">
        ${mod.cover.volets.map((v, i) => `
          <div class="row"><div class="n">${i + 1}</div><div class="t">${escapeHtml(v)}</div></div>
        `).join("")}
      </div>
      ${mod.cover.related ? `
        <div class="related-box">
          <div class="h">Ça peut aussi t'intéresser</div>
          ${escapeHtml(mod.cover.related)}
        </div>
      ` : ""}
      <div class="spacer"></div>
      <button class="btn-primary" data-start>Commencer</button>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/"));
  root.querySelector("[data-start]").addEventListener("click", () => {
    const startAt = store.getCaseProgress(slug) || 0;
    navigate(`#/module/${slug}/${startAt}`);
  });
}

function renderCase(root, mod, slug, index) {
  const flat = flattenCases(mod);
  const total = flat.length;
  const i = Math.min(Math.max(index, 0), total - 1);
  const c = flat[i];

  const colorVar = `var(--${c.voletColor})`;
  // v1.76 (mode sombre) : la fraction de progression (.frac) utilise une variable dédiée
  // "--frac-*" plutôt que colorVar directement — colorVar (couleur d'identité du volet) sert
  // aussi de FOND ailleurs (barre de progression juste à côté) et doit rester identique dans
  // les deux thèmes ; .frac, elle, est du TEXTE posé sur le fond de la page/carte, qui bascule
  // en sombre — --frac-* est donc claire par défaut (identique à colorVar en mode clair) mais
  // redéfinie en mode sombre vers une teinte plus lisible sur fond sombre (cf. app.css, bloc
  // @media (prefers-color-scheme: dark)).
  const fracColorVar = `var(--frac-${c.voletColor})`;
  const pct = ((c.caseIndex + 1) / c.caseCountInVolet) * 100;

  // Cases "planches" (panelHtml, v1.48) : contenu bespoke — tableau à double entrée, anecdote longue
  // — qui ne rentre pas dans le gabarit case-text centré (introduit pour le module "évitement", dont
  // le tableau et l'expérience personnelle ne sont, dans l'écran témoin validé, ni centrés ni colorés
  // comme les cases du mécanisme). Garde la même navigation (barre de progression, zones de tap,
  // glisser) que les cases ordinaires — seul l'habillage du panneau change.
  let panelInner, bg, border;
  if (c.panelHtml) {
    panelInner = c.panelHtml;
    bg = "transparent";
    border = "none";
  } else {
    let textColor, numColor;
    if (c.climax) {
      // La couleur de fond d'une case climax est, par défaut, un sage-dark constant (déjà en place pour
      // "fondateur" — validé même dans des volets gold-dark/terracotta) — mais l'écran témoin validé
      // d'"anticipation anxieuse" (v1.09) fait un choix différent pour CE module précis : chaque volet
      // clôture sur SA PROPRE couleur d'identité (gold-dark, terracotta, slate), pas sur un sage-dark
      // uniforme. c.climaxBg (v1.50), optionnel, permet cette exception sans toucher aux trois modules
      // déjà en ligne qui ne l'utilisent pas.
      bg = c.climaxBg || "var(--sage-dark)";
      textColor = "#fff";
      numColor = "#fff";
    } else if (c.caseIndex % 2 === 0) {
      bg = "var(--cream)";
      textColor = "var(--ink)";
      numColor = "var(--sage-dark)";
    } else {
      bg = "var(--gold)";
      textColor = "var(--gold-ink)";
      numColor = "var(--gold-ink)";
    }
    border = c.climax ? "none" : (c.caseIndex % 2 === 0 ? "1px solid var(--card-border)" : "none");
    // Emphase typographique supplémentaire (v1.50) : certaines cases climax précises, signalées par
    // Johan (note v0.83 pour neurologie de la crise, réappliquée v0.90 pour anticipation anxieuse),
    // reçoivent en plus un texte agrandi et en gras — distinct du traitement climax de base (fond +
    // halo), que toutes les autres cases climax gardent sans cet ajout.
    const emphasisStyle = c.emphasis ? " font-weight:800; font-size:21px;" : "";
    panelInner = `
      <div class="case-num" style="color:${numColor};">${c.caseNum}</div>
      <div class="case-text" style="color:${textColor};${emphasisStyle}">${c.text}</div>
    `;
  }

  // Un ou plusieurs liens de clôture (v1.49) : "neurologie de la crise" en cite deux (respiration et
  // ancrage), à la différence de "fondateur" qui n'en citait qu'un seul — closing.links (tableau)
  // accepté en plus de closing.link (un seul), pour ne rien changer au module déjà en ligne.
  //
  // Plusieurs sections de clôture distinctes (v1.55) : "émotions" est le premier module dont l'écran
  // témoin valide DEUX phrases d'intro séparées, chacune suivie de son propre lien ("Tu retrouveras ce
  // mécanisme en détail dans :" → module rumination du soir, puis "Pour retrouver l'accès à toute la
  // palette :" → coussin des émotions) — pas une seule intro partagée par plusieurs liens comme
  // "neurologie de la crise". closing.sections (tableau de {intro, links|link}) accepté en plus de la
  // forme à une seule section, pour ne rien changer aux six modules déjà en ligne qui l'utilisent.
  //
  // Lien vers un module pas encore construit (v1.55) : "émotions" renvoie vers "rumination du soir"
  // (module suivant dans la file de construction, pas encore livré) — repris du principe déjà en place
  // dans js/screens/journal.js pour le lien vers "évitement" avant sa construction : un lien dont la
  // cible n'est pas encore live (categories, js/data/grid.js) s'affiche grisé, avec " — à venir" ajouté
  // à la description, sans handler de clic — jamais un lien mort. link.moduleCheck (v1.55) déclenche
  // cette vérification ; le lien redevient automatiquement actif dès que le module cible passe à
  // live:true, sans repasser par ce fichier de données.
  const renderClosingLink = (l) => {
    if (l.moduleCheck) {
      const target = categories.flatMap(cat => cat.tools).find(t => t.id === l.moduleCheck);
      if (!target || !target.live) {
        return `
          <div class="link-row disabled">
            <div><div class="t">${escapeHtml(l.title)}</div><div class="d">${escapeHtml(l.desc)} — à venir</div></div>
          </div>
        `;
      }
    }
    return `
      <a class="link-row" href="${l.route}" data-link>
        <div><div class="t">${escapeHtml(l.title)}</div><div class="d">${escapeHtml(l.desc)}</div></div>
        <span class="chev">›</span>
      </a>
    `;
  };
  let closingHtml = "";
  if (c.closing) {
    if (c.closing.sections) {
      closingHtml = c.closing.sections.map(sec => `
        <div class="closing-hint">${escapeHtml(sec.intro)}</div>
        ${(sec.links || (sec.link ? [sec.link] : [])).map(renderClosingLink).join("")}
      `).join("");
    } else {
      const links = c.closing.links || (c.closing.link ? [c.closing.link] : []);
      closingHtml = `
        <div class="closing-hint">${escapeHtml(c.closing.intro)}</div>
        ${links.map(renderClosingLink).join("")}
      `;
    }
  }

  // Barre de progression masquée pour les cases "planches" (v1.51) : le tableau et l'anecdote
  // d'"évitement" (v1.48) n'en montrent aucune dans l'écran témoin validé (ni l'anecdote de "pensées
  // intrusives", même schéma) — cohérent avec la méta-description du module elle-même, qui distingue
  // déjà "cases" d'un côté et "tableau"/"expérience" de l'autre (jamais comptés ensemble). Bogue trouvé
  // en préparant "pensées intrusives" : le module "évitement", déjà en ligne, affichait par erreur
  // "Volet 1 — 7 / 7" sur son tableau et son anecdote — corrigé ici, sans toucher à la navigation
  // (retour, glisser, toucher pour avancer), absente elle aussi de la maquette sur ces écrans précis
  // mais nécessaire pour ne pas laisser la personne bloquée sans moyen d'avancer ou de revenir.
  // Étiquette de progression (v1.52) : un module à volet unique, sans découpage affiché sur la
  // couverture (déjà le cas pour "évitement", cover.volets vide) montre, dans son propre écran témoin,
  // "Case i / total" plutôt que "Volet 1 — i / total" — le mot "Volet" n'a pas de sens quand il n'y a
  // qu'une seule séquence de cases, jamais nommée comme un volet ailleurs dans l'app. Bogue trouvé en
  // préparant "catastrophisme" : "évitement", déjà en ligne, affichait "Volet 1 —" par erreur depuis sa
  // construction (v1.48) — corrigé ici pour les deux modules à la fois.
  const fracLabel = mod.volets.length === 1
    ? `Case ${c.caseIndex + 1} / ${c.caseCountInVolet}`
    : `Volet ${c.voletNum} — ${c.caseIndex + 1} / ${c.caseCountInVolet}`;
  const progressHtml = c.panelHtml ? "" : `
      <div class="case-progress">
        <div class="bar"><i style="width:${pct}%; background:${colorVar};"></i></div>
        <div class="frac" style="color:${fracColorVar};">${fracLabel}</div>
      </div>`;

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ ${escapeHtml(mod.cover.title)}</button></div>
      ${progressHtml}
      <div class="case-panel ${c.climax ? "climax" : ""} ${c.panelHtml ? (c.panelClass || "case-panel-plain") : ""}" style="background:${bg}; border:${border};" data-panel>
        ${c.climax ? '<div class="glow-ring"></div>' : ""}
        ${panelInner}
        <div class="case-tap-zone"><div class="z" data-prev></div><div class="z" data-next></div></div>
      </div>
      ${closingHtml}
      <div class="swipe-hint">${i < total - 1 ? "‹ toucher pour avancer ›" : "fin du module"}</div>
      ${i === total - 1 ? `
        <div class="home-link-discreet"><a href="#/module/${slug}/0" data-restart>Revenir au début</a></div>
      ` : ""}
    </div>
  `;

  store.setCaseProgress(slug, i);

  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/module/${slug}`));

  const goTo = (ni) => {
    if (ni < 0) { navigate(`#/module/${slug}`); return; }
    if (ni >= total) return;
    navigate(`#/module/${slug}/${ni}`);
  };

  root.querySelector("[data-prev]").addEventListener("click", () => goTo(i - 1));
  root.querySelector("[data-next]").addEventListener("click", () => goTo(i + 1));

  root.querySelectorAll("[data-link]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(link.getAttribute("href"));
    });
  });

  // v1.77 : lien discret "Revenir au début", affiché uniquement sur la toute dernière case du
  // module — jusqu'ici, seul le bouton "‹ [titre]" tout en haut de l'écran ramenait à la couverture,
  // sans jamais le proposer explicitement au moment précis où on termine. Va directement à la
  // première case (pas seulement à la couverture) : revoir à nouveau la couverture avant de retoucher
  // "Commencer" aurait repris la LECTURE LÀ OÙ ELLE A ÉTÉ LAISSÉE (déjà le comportement voulu de ce
  // bouton, cf. renderCover) — donc à la dernière case qu'on vient de quitter, pas au début.
  const restartLink = root.querySelector("[data-restart]");
  if (restartLink) {
    restartLink.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(restartLink.getAttribute("href"));
    });
  }

  // Glisser (swipe) pour avancer / reculer, en plus du tap.
  //
  // v1.77 : signalé par Johan comme ne fonctionnant pas sur un vrai téléphone, alors que le mécanisme
  // (validé depuis v1.14) se comportait correctement une fois simulé automatiquement — la différence
  // entre les deux, c'est qu'un vrai navigateur mobile peut intercepter un geste horizontal pour son
  // propre usage (retour à la page précédente au glisser depuis le bord, notamment iOS Safari) avant
  // que ce code ne le reçoive, ce qu'aucune simulation ne reproduit. Deux changements pour lever cette
  // ambiguïté au plus tôt, dès qu'un déplacement horizontal net est détecté, plutôt qu'en fin de
  // geste : `touch-action: pan-y` sur .case-panel (cf. app.css) indique au système que l'horizontal
  // est géré ici, et `touchmove` appelle `preventDefault()` dès que le geste est clairement horizontal
  // (pas simplement un défilement vertical, laissé intact pour les cases "planches" scrollables).
  let touchStartX = null;
  let touchStartY = null;
  let horizontalLock = false;
  const panel = root.querySelector("[data-panel]");
  panel.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    horizontalLock = false;
  }, { passive: true });
  panel.addEventListener("touchmove", (e) => {
    if (touchStartX === null) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (!horizontalLock && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      horizontalLock = true;
    }
    // Une fois le geste reconnu comme horizontal, on empêche explicitement le navigateur de le
    // récupérer pour lui-même (retour de page, etc.) — le défilement vertical, lui, reste intact
    // tant que ce verrou n'est pas posé.
    if (horizontalLock && e.cancelable) e.preventDefault();
  }, { passive: false });
  panel.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (horizontalLock && Math.abs(dx) > 40) goTo(dx < 0 ? i + 1 : i - 1);
    touchStartX = null;
    touchStartY = null;
    horizontalLock = false;
  }, { passive: true });
}

function render__module(root, params) {
  const mod = MODULES[params.slug];
  if (!mod) {
    root.innerHTML = `<div class="screen"><div class="empty-state">Module introuvable.</div></div>`;
    return;
  }
  if (params.index === undefined) {
    renderCover(root, mod, params.slug);
  } else {
    renderCase(root, mod, params.slug, parseInt(params.index, 10) || 0);
  }
}

const ModuleScreen = { render: render__module };

/* ---- js/screens/outil-respiration.js ---- */
let rafId = null;
function stopAnim() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function seq3(thirdLabel) {
  return [
    { t: 0, label: "Inspire" },
    { t: 1000, label: "2" }, { t: 2000, label: "3" }, { t: 3000, label: "4" },
    { t: 4000, label: "Bloque" },
    { t: 5000, label: "2" }, { t: 6000, label: "3" }, { t: 7000, label: "4" },
    { t: 8000, label: thirdLabel },
    { t: 9000, label: "2" }, { t: 10000, label: "3" }, { t: 11000, label: "4" }, { t: 12000, label: "5" }, { t: 13000, label: "6" }
  ];
}

function labelFor(seq, elapsed) {
  let current = seq[0].label;
  for (const s of seq) if (elapsed >= s.t) current = s.label;
  return current;
}

function renderSelection(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");
  const toolMeta = categories.flatMap(c => c.tools).find(t => t.id === slug);

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Je respire</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">${escapeHtml(respiration.title)}</h3>
      <div class="usage-badge">${escapeHtml(respiration.usageBadge)}</div>
      ${respiration.levels.filter(l => l.type !== "bubble").map(l => `
        <button class="level-card ${l.suggested ? "suggested" : ""}" data-level="${l.num}">
          <div class="level-num">${l.num}</div>
          <div class="level-txt">
            <div class="h">${escapeHtml(l.h)}</div>
            <div class="d">${escapeHtml(l.d)}</div>
            ${l.tag ? `<div class="level-tag">${escapeHtml(l.tag)}</div>` : ""}
          </div>
        </button>
      `).join("")}
      <div class="spacer"></div>
      ${toolMeta ? renderRelatedModuleLink(toolMeta.relatedModule) : ""}
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/"));
  root.querySelectorAll("[data-level]").forEach(b => {
    b.addEventListener("click", () => navigate(`#/outil/${slug}/${b.getAttribute("data-level")}`));
  });
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderSelection(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
  wireRelatedModuleLink(root);
}

// v1.85 : distance (en px) entre le doigt réel et le point affiché pendant le suivi tactile —
// le point "flotte" au-dessus du doigt (même principe que le curseur de texte iOS qui apparaît
// au-dessus du doigt) pour ne jamais être caché par lui. Cf. cahier des charges v1.85.
const CURVE_TOUCH_LIFT = 56;

function renderLevel1(root, slug, level) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Niveaux</button><span class="back">1 / 3</span></div>
      <div class="body-copy"><p>${escapeHtml(level.intro)}</p></div>
      <div class="phase-label" id="labelB">Inspire</div>
      <div class="curve-wrap">
        <div class="curve-track">
          <svg viewBox="0 0 256 210" preserveAspectRatio="none">
            <path id="curvePathRef" d="M0,35 L20,35 C57,35 94,175 128,175 C146,175 165,35 202,35 L256,35" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3.5" stroke-linecap="round"/>
          </svg>
          <svg viewBox="0 0 256 210" preserveAspectRatio="none">
            <path d="M0,35 L20,35 C57,35 94,175 128,175 C146,175 165,35 202,35 L256,35" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="curve-guide"></div>
        <div class="curve-stem" hidden></div>
        <div class="curve-marker"></div>
      </div>
      <div class="body-copy">${level.body.map(p => `<p>${p}</p>`).join("")}</div>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));

  const labelEl = root.querySelector("#labelB");
  const track = root.querySelector(".curve-track");
  const marker = root.querySelector(".curve-marker");
  const stem = root.querySelector(".curve-stem");
  const wrap = root.querySelector(".curve-wrap");
  const pathEl = root.querySelector("#curvePathRef");
  let sampleY = null;
  if (pathEl && pathEl.getTotalLength) {
    const totalLen = pathEl.getTotalLength();
    const N = 300;
    const samples = [];
    for (let i = 0; i <= N; i++) {
      const pt = pathEl.getPointAtLength(totalLen * i / N);
      samples.push({ x: pt.x, y: pt.y });
    }
    sampleY = function (x) {
      if (x <= samples[0].x) return samples[0].y;
      if (x >= samples[samples.length - 1].x) return samples[samples.length - 1].y;
      for (let k = 1; k < samples.length; k++) {
        if (samples[k].x >= x) {
          const a = samples[k - 1], b = samples[k];
          const u = (x - a.x) / ((b.x - a.x) || 1);
          return a.y + (b.y - a.y) * u;
        }
      }
      return samples[samples.length - 1].y;
    };
  }

  // v1.85 : suivi tactile réel. Tant que le doigt est posé sur la carte, le point affiché suit sa
  // position verticale — mais décalé de CURVE_TOUCH_LIFT px vers le haut, pour rester visible
  // au-dessus du doigt plutôt que caché dessous. Dès que le doigt est relâché, le point reprend
  // son mouvement automatique habituel (la courbe et le rythme, eux, ne s'arrêtent jamais : le
  // décompte Inspire/Bloque/Expire reste toujours mené par le temps, pas par le doigt).
  let dragY = null;
  function pointToLocalY(clientY) {
    const rect = wrap.getBoundingClientRect();
    return clientY - rect.top;
  }
  function onPointerDown(e) {
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    dragY = pointToLocalY(e.clientY);
    wrap.classList.add("dragging");
    stem.hidden = false;
  }
  function onPointerMove(e) {
    if (dragY === null) return;
    dragY = pointToLocalY(e.clientY);
  }
  function onPointerUp() {
    dragY = null;
    wrap.classList.remove("dragging");
    stem.hidden = true;
  }
  wrap.addEventListener("pointerdown", onPointerDown);
  wrap.addEventListener("pointermove", onPointerMove);
  wrap.addEventListener("pointerup", onPointerUp);
  wrap.addEventListener("pointercancel", onPointerUp);

  const seq = seq3("Expire");
  let start = null;
  function update(now) {
    if (start === null) start = now;
    const elapsed = (now - start) % 14000;
    const current = labelFor(seq, elapsed);
    if (labelEl.textContent !== current) labelEl.textContent = current;
    if (sampleY) {
      const scrollOffset = (elapsed / 14000) * 256;
      track.style.transform = "translateX(" + (-scrollOffset) + "px)";
      const sampleX = (128 + scrollOffset) % 256;
      const autoY = sampleY(sampleX);
      if (dragY !== null) {
        const liftedY = Math.max(10, Math.min(200, dragY - CURVE_TOUCH_LIFT));
        marker.style.top = liftedY + "px";
        stem.style.top = liftedY + "px";
        stem.style.height = Math.max(0, dragY - liftedY) + "px";
      } else {
        marker.style.top = autoY + "px";
      }
    }
    rafId = requestAnimationFrame(update);
  }
  rafId = requestAnimationFrame(update);
}

function renderLevel2(root, slug, level) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Niveaux</button><span class="back">2 / 3</span></div>
      <div class="body-copy"><p>${level.intro}</p></div>
      <div class="heart-wrap"><div class="heart-circle"><span class="heart-label" id="labelC">Inspire</span></div></div>
      <div class="body-copy">${level.body.map(p => `<p>${p}</p>`).join("")}</div>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  const labelEl = root.querySelector("#labelC");
  const seq = seq3("Souffle");
  let start = null;
  function update(now) {
    if (start === null) start = now;
    const elapsed = (now - start) % 14000;
    const current = labelFor(seq, elapsed);
    if (labelEl.textContent !== current) labelEl.textContent = current;
    rafId = requestAnimationFrame(update);
  }
  rafId = requestAnimationFrame(update);
}

function renderLevel3Choice(root, slug, level) {
  let chosenWord = sessionStorage.getItem("socalm.resp.word") || level.words[1];
  let chosenColorIdx = parseInt(sessionStorage.getItem("socalm.resp.colorIdx") || "1", 10);
  let customWord = "";

  function paint() {
    root.innerHTML = `
      <div class="screen">
        <div class="back-row"><button class="back" data-back>‹ Niveaux</button><span class="back">3 / 3</span></div>
        <div class="body-copy">
          <p>${escapeHtml(level.intro)}</p>
          <p style="font-style:italic; color:var(--sage-dark);">${escapeHtml(level.introNote)}</p>
        </div>
        <div>
          ${level.words.map(w => `<button class="word-chip ${w === chosenWord ? "chosen" : ""}" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`).join("")}
          <input class="word-chip custom" id="customWordInput" type="text" placeholder="ou le tien..." value="${escapeHtml(customWord)}">
        </div>
        <div class="body-copy"><p>Choisis une couleur qui représente cet état pour toi.</p></div>
        <div class="color-row">
          ${level.colors.map((c, i) => `
            <button class="color-dot ${i === chosenColorIdx ? "chosen" : ""}" data-color="${i}"
              style="background:radial-gradient(circle at 35% 30%, ${c.from}, ${c.to}); box-shadow:0 0 14px 4px ${c.glow};"></button>
          `).join("")}
        </div>
        <div class="spacer"></div>
        <button class="btn-primary" data-continue>Continuer</button>
      </div>
    `;
    root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
    root.querySelectorAll("[data-word]").forEach(b => b.addEventListener("click", () => {
      chosenWord = b.getAttribute("data-word");
      customWord = "";
      paint();
    }));
    const customInput = root.querySelector("#customWordInput");
    customInput.addEventListener("input", () => {
      customWord = customInput.value;
      if (customWord.trim()) chosenWord = customWord.trim();
    });
    root.querySelectorAll("[data-color]").forEach(b => b.addEventListener("click", () => {
      chosenColorIdx = parseInt(b.getAttribute("data-color"), 10);
      paint();
    }));
    root.querySelector("[data-continue]").addEventListener("click", () => {
      sessionStorage.setItem("socalm.resp.word", chosenWord || level.words[1]);
      sessionStorage.setItem("socalm.resp.colorIdx", String(chosenColorIdx));
      navigate(`#/outil/${slug}/3b`);
    });
  }
  paint();
}

function renderLevel3Bubble(root, slug, level) {
  const word = sessionStorage.getItem("socalm.resp.word") || "Légèreté";
  const colorIdx = parseInt(sessionStorage.getItem("socalm.resp.colorIdx") || "1", 10);
  const color = respiration.levels.find(l => l.type === "choice").colors[colorIdx];

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Niveaux</button><span class="back">3 / 3</span></div>
      <div class="body-copy"><p>Imagine ta couleur — <em>${escapeHtml(word)}</em> — enveloppée dans une bulle de lumière, juste devant ton cœur.</p></div>
      <div class="bubble-wrap">
        <div class="bubble" style="background: radial-gradient(circle at 35% 30%, ${color.from}, ${color.to});">
          <span class="bubble-word">${escapeHtml(word)}</span>
          <span class="heart-label" id="labelE" style="color:var(--gold-ink); text-shadow:none;">Inspire</span>
        </div>
      </div>
      <div class="body-copy">${level.body.map(p => `<p>${p}</p>`).join("")}</div>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}/3`));
  const labelEl = root.querySelector("#labelE");
  const seq = seq3("Souffle");
  let start = null;
  function update(now) {
    if (start === null) start = now;
    const elapsed = (now - start) % 14000;
    const current = labelFor(seq, elapsed);
    if (labelEl.textContent !== current) labelEl.textContent = current;
    rafId = requestAnimationFrame(update);
  }
  rafId = requestAnimationFrame(update);
}

function renderMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ ${escapeHtml(respiration.title)}</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_respiration(root, params) {
  stopAnim();
  const slug = params.slug;
  const step = params.step;

  if (!step) {
    renderSelection(root, slug);
    return;
  }
  if (step === "maversion") {
    renderMaVersion(root, slug);
    return;
  }
  if (step === "3b") {
    renderLevel3Bubble(root, slug, respiration.levels.find(l => l.type === "bubble"));
    return;
  }
  const levelNum = parseInt(step, 10);
  const level = respiration.levels.find(l => l.num === levelNum);
  if (!level) {
    renderSelection(root, slug);
    return;
  }
  if (level.type === "curve") renderLevel1(root, slug, level);
  else if (level.type === "heart") renderLevel2(root, slug, level);
  else if (level.type === "choice") renderLevel3Choice(root, slug, level);
}

function cleanup__outil_respiration() {
  stopAnim();
}

const OutilRespirationScreen = { render: render__outil_respiration, cleanup: cleanup__outil_respiration };

/* ---- js/screens/outil-mantra.js ---- */
// Le mantra — fiche outil, catégorie Je m'ancre. Texte finalisé (v0.37, simplifié v1.01).
// Gabarit repris de la maquette validée design/ecrans-outils-je-mancre.html (écran A).
let mantraRaf = null;
function stopMantraAnim() {
  if (mantraRaf) cancelAnimationFrame(mantraRaf);
  mantraRaf = null;
}

function startMantraAnim(root) {
  const el = root.querySelector("#mantraTxt");
  if (!el) return;
  const phrase1 = "À chaque instant, je fais de mon mieux.";
  const phrase2 = "Chaque petit pas compte.";
  let start = null;
  function update(now) {
    if (start === null) start = now;
    const elapsed = (now - start) % 8000;
    const current = elapsed < 4000 ? phrase1 : phrase2;
    if (el.textContent !== current) el.textContent = current;
    mantraRaf = requestAnimationFrame(update);
  }
  mantraRaf = requestAnimationFrame(update);
}

function renderMantraMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Je m'ancre</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">Le mantra</h3>
      <div class="usage-badge">Outil flash</div>
      <div class="body-copy">
        <p>Pose ton <strong>attention sur ton cœur</strong>. Respire avec moi.</p>
      </div>
      <div class="mantra-wrap">
        <div class="mantra-circle"><span class="mantra-txt" id="mantraTxt">À chaque instant, je fais de mon mieux.</span></div>
      </div>
      <div class="spacer"></div>
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/je-mancre"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderMantraMain(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));

  startMantraAnim(root);
}

function renderMantraMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Le mantra</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_mantra(root, params) {
  stopMantraAnim();
  const slug = params.slug;
  if (params.step === "maversion") {
    renderMantraMaVersion(root, slug);
    return;
  }
  renderMantraMain(root, slug);
}

function cleanup__outil_mantra() {
  stopMantraAnim();
}

const OutilMantraScreen = { render: render__outil_mantra, cleanup: cleanup__outil_mantra };

/* ---- js/screens/outil-ancrage.js ---- */
// Je m'ancre, je suis là — ancrage par les cinq sens (5-4-3-2), catégorie Je m'ancre.
// Texte et nom finalisés (v0.45). Gabarit repris de la maquette validée
// design/ecrans-outils-je-mancre.html (écran B).

function pickCritereVue() {
  const dernier = store.getAncrageDernierCritere();
  const prochain = dernier === "couleur" ? "forme" : "couleur";
  store.setAncrageDernierCritere(prochain);
  const adj = prochain === "couleur" ? "rouges" : "rondes";
  return `Nomme <strong>cinq</strong> choses ${adj} que tu <strong class="sense-verb">vois</strong> autour de toi.`;
}

function renderAncrageMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");

  const vueTxt = pickCritereVue();
  const toolMeta = categories.flatMap(c => c.tools).find(t => t.id === slug);

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Je m'ancre</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">Je m'ancre, je suis là</h3>
      <div class="body-copy">
        <p>Pose ton attention ici, maintenant. On va faire le tour de tes sens, un par un.</p>
      </div>
      <div class="sense-step">
        <div class="n n5">5</div>
        <div class="txt">
          <div class="h">${vueTxt}</div>
          <div class="d">critère tiré automatiquement par l'app à chaque usage — couleur ou forme</div>
        </div>
      </div>
      <div class="sense-step">
        <div class="n n4">4</div>
        <div class="txt">
          <div class="h"><strong class="sense-verb">Touche</strong> <strong>quatre</strong> choses différentes, et remarque leur texture.</div>
          <div class="d">le tissu de tes vêtements... une surface près de toi... le sol sous tes pieds... un objet dans ta poche.</div>
        </div>
      </div>
      <div class="sense-step">
        <div class="n n3">3</div>
        <div class="txt">
          <div class="h"><strong class="sense-verb">Écoute</strong> <strong>trois</strong> sons autour de toi.</div>
        </div>
      </div>
      <div class="sense-step">
        <div class="n n2">2</div>
        <div class="txt">
          <div class="h"><strong class="sense-verb">Sens</strong> <strong>deux</strong> odeurs autour de toi.</div>
          <div class="d">si tu as une odeur qui te rassure toujours sur toi, c'est le moment de la respirer.</div>
        </div>
      </div>
      <p class="ancrage-closing">Tu es là, ici et maintenant.</p>
      <div class="spacer"></div>
      ${toolMeta ? renderRelatedModuleLink(toolMeta.relatedModule) : ""}
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/je-mancre"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderAncrageMain(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
  wireRelatedModuleLink(root);
}

function renderAncrageMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Je m'ancre, je suis là</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_ancrage(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderAncrageMaVersion(root, slug);
    return;
  }
  renderAncrageMain(root, slug);
}

function cleanup__outil_ancrage() {}

const OutilAncrageScreen = { render: render__outil_ancrage, cleanup: cleanup__outil_ancrage };

/* ---- js/screens/outil-marche.js ---- */
// Je marche, je me libère — la marche de nettoyage, catégorie Je m'ancre.
// Texte finalisé (v0.40, anecdote ajoutée v0.41). Gabarit repris de la maquette validée
// design/ecrans-outils-je-mancre.html (écran C).

function renderMarcheMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");
  const toolMeta = categories.flatMap(c => c.tools).find(t => t.id === slug);

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Je m'ancre</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">Je marche, je me libère</h3>
      <div class="body-copy">
        <p><strong>Marche</strong>, comme tu peux, où tu peux. Pas besoin de destination — <strong>juste tes pas</strong>, et le sol sous tes pieds.</p>
        <p>À chaque pas, dépose ce qui ne t'appartient plus, et dis-toi :</p>
        <blockquote class="marche-phrase">« Je rends à la terre ce qui ne m'appartient plus. Je me libère de ce qui me pèse aujourd'hui. »</blockquote>
        <p>Puis, à chaque pas suivant, puise une force dans cette même terre, et réalise :</p>
        <blockquote class="marche-phrase">« Je puise dans la terre une force qui m'appartient. Je m'en remplis, un peu plus à chaque pas. »</blockquote>
      </div>
      <div class="anecdote">
        <div class="lbl">Mon expérience</div>
        <p>Pendant mes crises d'angoisse, mon plus grand problème n'était pas de rester assis à respirer — c'était de rester en place, tout court.</p>
        <p>Logique, en réalité : l'amygdale sonne l'alarme pour une seule raison, préparer une action — combattre, ou fuir. Rester immobile allait à l'encontre de tout ce que mon corps réclamait.</p>
        <p>Alors, au début, j'ai beaucoup utilisé cette marche. Presque comme un rituel : le même trajet, presque chaque jour.</p>
        <p>Un geste simple, à la portée de mon corps agité — bien plus que n'importe quel exercice qui demandait de m'arrêter.</p>
      </div>
      <div class="spacer"></div>
      ${toolMeta ? renderRelatedModuleLink(toolMeta.relatedModule) : ""}
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/je-mancre"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderMarcheMain(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
  wireRelatedModuleLink(root);
}

function renderMarcheMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Je marche, je me libère</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_marche(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderMarcheMaVersion(root, slug);
    return;
  }
  renderMarcheMain(root, slug);
}

function cleanup__outil_marche() {}

const OutilMarcheScreen = { render: render__outil_marche, cleanup: cleanup__outil_marche };

/* ---- js/screens/outil-odeur.js ---- */
// J'inspire cette odeur, je reviens à moi — objet à l'odeur rassurante, catégorie Je m'ancre.
// Texte et nom finalisés (v0.55), sous-titre retravaillé (v0.75). Gabarit repris de la
// maquette validée design/ecrans-outils-je-mancre.html (écran D).

function renderOdeurMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");
  const toolMeta = categories.flatMap(c => c.tools).find(t => t.id === slug);

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Je m'ancre</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">J'inspire cette odeur, je reviens à moi</h3>
      <div class="subtitle">Une odeur qui te rassure déjà — à respirer dès que tu en as besoin.</div>
      <div class="body-copy">
        <p><strong>Une odeur</strong> peut, à elle seule, te ramener au <strong>présent</strong>. Ce n'est pas un hasard : l'odorat est directement relié aux régions du cerveau qui gèrent la mémoire et les émotions.</p>
        <p>Choisis un objet à l'<strong>odeur qui te rassure</strong> — une huile essentielle, un parfum, un baume — et garde-le sur toi. Le jour où tu en as besoin, il te suffit de le <strong>respirer</strong>, quelques instants, pour te retrouver <strong>ici et maintenant</strong>.</p>
      </div>
      <div class="anecdote">
        <div class="lbl">Mon expérience</div>
        <p>Moi, c'est un petit pot avec du menthol et du camphre. Je le respire de temps en temps, pour me remettre dans le présent.</p>
      </div>
      <div class="spacer"></div>
      ${toolMeta ? renderRelatedModuleLink(toolMeta.relatedModule) : ""}
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/je-mancre"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderOdeurMain(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
  wireRelatedModuleLink(root);
}

function renderOdeurMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ J'inspire cette odeur, je reviens à moi</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_odeur(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderOdeurMaVersion(root, slug);
    return;
  }
  renderOdeurMain(root, slug);
}

function cleanup__outil_odeur() {}

const OutilOdeurScreen = { render: render__outil_odeur, cleanup: cleanup__outil_odeur };

/* ---- js/screens/outil-odeur-association.js ---- */
// Je sens cette odeur, je construis ma sérénité — l'ancrage olfactif par association, catégorie Je m'ancre.
// Texte et nom finalisés (v0.68), sous-titre retravaillé (v0.75). Gabarit repris de la
// maquette validée design/ecrans-outils-je-mancre.html (écran E).

function renderOdeurAssociationMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Je m'ancre</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">Je sens cette odeur, je construis ma sérénité</h3>
      <div class="subtitle">Une odeur neutre, à associer au calme petit à petit — pour qu'elle seule suffise, plus tard.</div>
      <div class="usage-note">Cet outil se construit dans le temps — les premières fois, il n'apporte rien encore. Continue quand même : c'est la répétition qui crée l'effet.</div>
      <div class="body-copy">
        <p>Choisis une <strong>odeur neutre</strong>, que tu n'utiliseras que pour cet usage — une huile essentielle, un parfum, n'importe quoi qui te soit facile à sentir régulièrement. Ce n'est pas pour ses vertus supposées : c'est ce que tu vas en faire qui compte.</p>
        <p>À la fin d'un exercice, au moment où tu sens <strong>le calme s'installer</strong>, <strong>respire cette odeur</strong>.</p>
        <p>Répète ce geste à chaque fois. Petit à petit, ton corps apprend à <strong>relier l'odeur et l'état</strong> — jusqu'à ce qu'elle seule suffise à te <strong>ramener vers ce calme</strong>.</p>
      </div>
      <div class="anecdote">
        <div class="lbl">Mon expérience</div>
        <p>Pendant longtemps, je ne l'ai pas fait exprès. Le cabinet de ma psychologue sentait la sauge — à force d'y retourner, cette odeur a fini par se lier, dans ma tête, au sentiment de me sentir écouté et apaisé.</p>
        <p>Plus tard, j'ai compris ce qui s'était passé, et j'ai recommencé volontairement avec certaines huiles essentielles — pas pour ce qu'on leur prête comme vertus, mais pour refaire ce même lien, à chaque fois que je retrouvais mon calme.</p>
      </div>
      <div class="spacer"></div>
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/je-mancre"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderOdeurAssociationMain(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
}

function renderOdeurAssociationMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Je sens cette odeur, je construis ma sérénité</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_odeur_association(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderOdeurAssociationMaVersion(root, slug);
    return;
  }
  renderOdeurAssociationMain(root, slug);
}

function cleanup__outil_odeur_association() {}

const OutilOdeurAssociationScreen = { render: render__outil_odeur_association, cleanup: cleanup__outil_odeur_association };

/* ---- js/screens/outil-protecteur.js ---- */
// Je me critique, je me réponds avec tendresse — le protecteur/critique, catégorie Mes ressources.
// Texte et nom finalisés (v0.48), sous-titre retravaillé (v0.75). Gabarit repris de la maquette
// design/ecrans-outils-mes-ressources.html (écran A).
//
// Écart constaté et corrigé, même vigilance que pour la marche de nettoyage (v1.30) et l'ancrage
// olfactif par association (v1.33) : la maquette tronque le 2e paragraphe (perd la précision
// "dans la famille, à l'école, par un professeur" et toute la phrase sur l'auto-vérification), et
// surtout OMET ENTIÈREMENT l'étape 2 de l'exercice ("Reconnais son intention... Dis-lui : « Je sais
// que tu essaies de me protéger. Merci, mais je n'ai plus besoin que tu le fasses comme ça. »").
// Le texte intégral du cahier des charges (v0.48) est utilisé ici, pas la version tronquée de la maquette.

function renderProtecteurMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Mes ressources</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">Je me critique, je me réponds avec tendresse</h3>
      <div class="subtitle">Quand une voix intérieure te juge — pour lui répondre avec douceur.</div>
      <div class="usage-note">Cet exercice se pratique mieux hors des moments de crise, pour construire sur la durée.</div>
      <div class="body-copy">
        <p>Le <strong>critique</strong>, c'est une part de toi qui s'active chaque fois que tu te juges — un cousin de la petite caméra qui t'observait de l'extérieur pendant tes crises.</p>
        <p>Personne n'y échappe : <strong>on le construit tous de la même façon</strong>. À force d'entendre les mêmes remarques — dans la famille, à l'école, par un professeur — on finit par y croire. Et plus on y croit, plus on cherche, sans le vouloir, à confirmer ces croyances — par le regard des autres, ou par soi-même.</p>
        <p>Voici la <strong>bonne nouvelle</strong> : avant de devenir critique, cette part de toi était <strong>protectrice</strong>. Elle essayait, à sa façon, de t'épargner une douleur — l'échec, le rejet, la honte. Le protecteur est encore là, sous le critique. <strong>On peut le retrouver</strong>.</p>
        <p>La prochaine fois que tu l'entends :</p>
      </div>
      <div class="field-lbl">Complète cette phrase, sans l'adoucir</div>
      <div class="field">« Le critique me dit que… »</div>
      <div class="field-lbl">Reconnais son intention</div>
      <div class="body-copy">
        <p>Il essaie de te protéger de quelque chose — l'échec, le rejet, la honte. Dis-lui :</p>
      </div>
      <div class="field">« Je sais que tu essaies de me protéger. Merci, mais je n'ai plus besoin que tu le fasses comme ça. »</div>
      <div class="field-lbl">Puis réponds-lui, la main sur le cœur</div>
      <div class="dialog-ex">
        <div class="crit"><span class="who">Il dit :</span> « Tu es nul, tu n'y arriveras jamais. »</div>
        <div class="ans"><span class="who">Tu réponds :</span> « Je fais de mon mieux, et c'est déjà beaucoup. »</div>
      </div>
      <div class="spacer"></div>
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderProtecteurMain(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
}

function renderProtecteurMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Je me critique, je me réponds avec tendresse</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_protecteur(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderProtecteurMaVersion(root, slug);
    return;
  }
  renderProtecteurMain(root, slug);
}

function cleanup__outil_protecteur() {}

const OutilProtecteurScreen = { render: render__outil_protecteur, cleanup: cleanup__outil_protecteur };

/* ---- js/screens/outil-figure-aidante.js ---- */
// Je me confie, je me sens accompagné — figure symbolique aidante, catégorie Mes ressources.
// Nom et sous-titre finalisés (v0.53, retravaillé v0.75). Gabarit ET texte repris de la maquette
// design/ecrans-outils-mes-ressources.html (écran B).
//
// Écart constaté entre la maquette et le texte original du cahier des charges (v0.53), signalé à
// Johan (v1.38) : la maquette ajoute "une figure symbolique protectrice" au 1er paragraphe, réécrit
// et fusionne le passage rayon de lumière/regard/respiration/étreinte avec une phrase ajoutée
// ("observe les réactions dans ton corps"), ajoute une phrase en fin de fiche ("Tu peux aussi faire
// appel à cette « personne »...") et omet la phrase "Ce qu'elle t'inspire est déjà un peu en toi —
// sinon, tu ne l'aurais jamais reconnu.". Après relecture, Johan choisit explicitement la version de
// la maquette (v1.39) — c'est donc ce texte, pas le texte original v0.53, qui est utilisé ci-dessous.

function renderFigureAidanteMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Mes ressources</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">Je me confie, je me sens accompagné</h3>
      <div class="subtitle">Une présence bienveillante à convoquer, pour ne pas te sentir seul·e.</div>
      <div class="body-copy">
        <p>Si tu devais être <strong>accompagné</strong> par quelqu'un qui te permette de te <strong>sentir bien, en confiance</strong> — une figure symbolique protectrice, quelqu'un qui possède les <strong>qualités que tu aimerais avoir</strong> aujourd'hui — qui serait-ce ?</p>
        <p>Une personne que tu connais, un personnage, même fictif, un animal, un objet que tu personnifies… Laisse venir, sans jugement.</p>
        <p><strong>À chaque fois que tu en sentiras le besoin</strong> : ferme les yeux, si tu veux. Imagine cette <strong>présence</strong> à tes côtés.</p>
      </div>
      <div class="glow-block">
        <p>Imagine un rayon de lumière qui vous relie par le cœur et qui vous alimente l'un l'autre. Si tu le souhaites, tu peux laisser s'échanger un regard d'amour entre toi et lui. Maintenant, laisse-toi respirer dans ce lien et observe les réactions dans ton corps. Si tu te sens suffisamment à l'aise, imagine que vous vous prenez dans les bras, l'un et l'autre.</p>
      </div>
      <div class="body-copy">
        <p>Tu peux aussi faire appel à cette « personne » à chaque fois que tu en as besoin, comme un soutien et même un conseiller bienveillant.</p>
      </div>
      <div class="anecdote">
        <div class="lbl">Mon expérience</div>
        <p>Moi, ma figure aidante est une oie sauvage. Quand j'en ai besoin, je me blottis contre elle, et elle m'entoure de ses ailes. Je sens sa douceur, son réconfort.</p>
      </div>
      <div class="spacer"></div>
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderFigureAidanteMain(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
}

function renderFigureAidanteMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Je me confie, je me sens accompagné</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_figure_aidante(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderFigureAidanteMaVersion(root, slug);
    return;
  }
  renderFigureAidanteMain(root, slug);
}

function cleanup__outil_figure_aidante() {}

const OutilFigureAidanteScreen = { render: render__outil_figure_aidante, cleanup: cleanup__outil_figure_aidante };

/* ---- js/screens/outil-phrase-confiance.js ---- */
// J'ai confiance, je tiens bon — phrase reçue de confiance, catégorie Mes ressources.
// Texte et nom finalisés (v0.54). Gabarit repris de la maquette
// design/ecrans-outils-mes-ressources.html (écran C).
//
// Écart constaté entre la maquette et le texte du cahier des charges (v0.54) : l'anecdote y perd
// la précision "dans la tempête de mes émotions et de mon angoisse" (2e paragraphe). Conformément à
// la règle posée par Johan le 31 août 2026 (v1.39, "les versions les plus récentes sont toujours les
// bonnes") — et au propre en-tête de ce fichier de maquette, qui indique avoir été produit à partir
// des textes déjà validés, donc postérieur à eux — la version de la maquette est retenue ici par
// défaut, signalée pour transparence plutôt que bloquée sur une question.
//
// Cette fiche a un champ central différent des autres outils : le cahier des charges (v0.54, point 4
// de la conception retenue) précise explicitement que la personne doit pouvoir noter SA PROPRE phrase
// ("Espace pour noter sa propre phrase, pas seulement lire celle de Johan"), pour la relire "chaque
// fois que tu en as besoin" — donc un champ persistant et réel, pas une simple illustration statique
// comme le "field" de la maquette le montre. D'où l'ajout de store.getPhraseConfiance/setPhraseConfiance,
// distinct du espace générique "Ma version" (qui reste disponible, pour toute autre note personnelle).

// Message vocal pour les moments difficiles (v1.64) — enregistrement par la personne, pour
// elle-même, réécouté en priorité depuis le bouton "Moment difficile" (cf. js/screens/detresse.js).
// Discussion complète et décisions de Johan consignées dans le cahier des charges (v1.64) : intégré
// ici plutôt qu'en outil séparé (et placé en tête de la fiche, avant le texte de la phrase de
// confiance, pour bien le mettre en valeur), jamais proposé pendant l'onboarding lui-même (juste une
// invitation discrète sur l'accueil ensuite, cf. home.js), 30 secondes maximum avec arrêt automatique
// et un seul message actif à la fois. Interaction revue sur retour de Johan ("pas assez claire") :
// un seul bouton rond au centre démarre ET arrête l'enregistrement (plutôt que deux boutons séparés),
// avec un anneau qui se remplit doucement autour de lui pendant les 30 secondes, plutôt qu'un
// décompte chiffré ou une barre horizontale sous le texte (pour rester dans le ton calme de l'app).
//
// État en mémoire seulement (comme openAxis ailleurs dans l'app) — remis à zéro par cleanup() dès
// qu'on quitte la fiche outil ; pas de sens à conserver un enregistrement en cours ou non sauvegardé
// d'une visite à l'autre.
let mvRecorder = null;
let mvStream = null;
let mvChunks = [];
let mvStopTimer = null;
let mvPendingDataUrl = null;
let mvScreenState = "idle"; // idle | recording | review | error
let mvErrorMsg = "";
let mvBusy = false;
// true quand on est en train de (ré)enregistrer alors qu'un message existe déjà (bouton "Remplacer
// ce message") : permet d'afficher le petit écran d'enregistrement même si `saved` est non nul.
let mvShowRecorder = false;

// Circonférence du cercle de progression (rayon 45 sur un viewBox 100 — cf. .mv-ring dans app.css) :
// 2 × π × 45 ≈ 282.7. Valeur reprise en JS pour piloter le remplissage (stroke-dashoffset).
const MV_RING_CIRCUMFERENCE = 282.7;

// Petit écran d'enregistrement (v1.64, revu sur retour de Johan "pas assez clair") : un seul bouton
// rond au centre sert à la fois à démarrer ET à arrêter l'enregistrement (au lieu d'un bouton
// "Enregistrer" séparé d'un bouton "Terminer" plus bas) ; un anneau autour du bouton se remplit
// doucement sur 30 secondes pendant l'enregistrement, plutôt qu'une barre horizontale sous le texte.
function renderRecordFocusHtml(recording) {
  return `
    <div class="mv-record-focus">
      <div class="mv-record-wrap">
        <svg class="mv-ring" viewBox="0 0 100 100">
          <circle class="mv-ring-bg" cx="50" cy="50" r="45"></circle>
          <circle class="mv-ring-fg" id="mvRingFg" cx="50" cy="50" r="45"></circle>
        </svg>
        <button class="mv-circle-btn ${recording ? "is-recording" : ""}" data-mv-toggle aria-label="${recording ? "Arrêter l'enregistrement" : "Commencer l'enregistrement"}">
          ${recording ? `<span class="mv-icon-stop"></span>` : `<span class="mv-icon-dot"></span>`}
        </button>
      </div>
      <div class="mv-record-caption">${recording ? "Appuie de nouveau pour terminer — 30 secondes maximum." : "Appuie pour commencer — 30 secondes maximum."}</div>
    </div>
  `;
}

function renderMessageVocalHtml() {
  const saved = store.getMessageVocal();

  if (mvScreenState === "recording") {
    return `
      <div class="mv-section">
        <div class="mv-title">Un message pour les moments difficiles</div>
        ${renderRecordFocusHtml(true)}
      </div>
    `;
  }

  if (mvScreenState === "review" && mvPendingDataUrl) {
    return `
      <div class="mv-section">
        <div class="mv-title">Un message pour les moments difficiles</div>
        <audio class="mv-audio" controls src="${mvPendingDataUrl}"></audio>
        <div class="mv-actions">
          <button class="btn-secondary" data-mv-retry>Recommencer</button>
          <button class="btn-primary" data-mv-save>Enregistrer ce message</button>
        </div>
      </div>
    `;
  }

  if (mvScreenState === "error") {
    return `
      <div class="mv-section">
        <div class="mv-title">Un message pour les moments difficiles</div>
        <div class="mv-error">${escapeHtml(mvErrorMsg || "Le micro n'est pas accessible. Tu peux l'autoriser dans les réglages de ton navigateur, puis réessayer.")}</div>
        <button class="btn-secondary" data-mv-retry>Réessayer</button>
      </div>
    `;
  }

  if (saved && !mvShowRecorder) {
    return `
      <div class="mv-section">
        <div class="mv-title">Ton message pour les moments difficiles</div>
        <audio class="mv-audio" controls src="${saved.dataUrl}"></audio>
        <button class="mv-link" data-mv-show-recorder>Remplacer ce message</button>
      </div>
    `;
  }

  return `
    <div class="mv-section">
      <div class="mv-title">Un message pour les moments difficiles</div>
      <p class="mv-intro">Enregistre un message court pour toi-même — quelque chose qui pourrait te remonter le moral dans un moment difficile. Reste bref : tu as 30 secondes.</p>
      <p class="mv-permission-hint">On va te demander d'autoriser le micro, juste pour cet enregistrement.</p>
      ${renderRecordFocusHtml(false)}
    </div>
  `;
}

function mvStopRecording() {
  if (mvStopTimer) { clearTimeout(mvStopTimer); mvStopTimer = null; }
  if (mvRecorder && mvRecorder.state !== "inactive") {
    try { mvRecorder.stop(); } catch (e) { /* déjà arrêté */ }
  }
}

async function mvStartRecording(root, slug) {
  if (mvBusy) return;
  mvBusy = true;
  mvErrorMsg = "";
  try {
    mvStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    mvScreenState = "error";
    mvErrorMsg = "Le micro n'est pas accessible. Tu peux l'autoriser dans les réglages de ton navigateur, puis réessayer.";
    mvBusy = false;
    renderPhraseConfianceMain(root, slug);
    return;
  }

  try {
    mvRecorder = new MediaRecorder(mvStream);
  } catch (e) {
    mvStream.getTracks().forEach(t => t.stop());
    mvStream = null;
    mvScreenState = "error";
    mvErrorMsg = "L'enregistrement audio n'est pas disponible sur ce navigateur.";
    mvBusy = false;
    renderPhraseConfianceMain(root, slug);
    return;
  }

  mvChunks = [];
  mvRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) mvChunks.push(e.data); };
  mvRecorder.onstop = () => {
    const blob = new Blob(mvChunks, { type: mvRecorder.mimeType || "audio/webm" });
    if (mvStream) { mvStream.getTracks().forEach(t => t.stop()); mvStream = null; }
    const reader = new FileReader();
    reader.onload = () => {
      mvPendingDataUrl = reader.result;
      mvScreenState = "review";
      mvBusy = false;
      renderPhraseConfianceMain(root, slug);
    };
    reader.readAsDataURL(blob);
  };

  mvRecorder.start();
  mvScreenState = "recording";
  renderPhraseConfianceMain(root, slug);
  mvStopTimer = setTimeout(mvStopRecording, 30000);
}

function wireMessageVocalSection(root, slug) {
  // Un seul bouton rond sert à démarrer ET à arrêter l'enregistrement (v1.64, revu à la demande de
  // Johan — l'ancienne version avait un bouton "Enregistrer" séparé d'un bouton "Terminer" plus bas,
  // jugée pas assez claire). On distingue les deux actions par l'état courant plutôt que par deux
  // boutons différents.
  const toggleBtn = root.querySelector("[data-mv-toggle]");
  if (toggleBtn) toggleBtn.addEventListener("click", () => {
    if (mvScreenState === "recording") {
      mvStopRecording();
    } else {
      mvStartRecording(root, slug);
    }
  });

  const showRecorderBtn = root.querySelector("[data-mv-show-recorder]");
  if (showRecorderBtn) showRecorderBtn.addEventListener("click", () => {
    mvShowRecorder = true;
    renderPhraseConfianceMain(root, slug);
  });

  const retryBtn = root.querySelector("[data-mv-retry]");
  if (retryBtn) retryBtn.addEventListener("click", () => {
    mvPendingDataUrl = null;
    mvErrorMsg = "";
    mvScreenState = "idle";
    renderPhraseConfianceMain(root, slug);
  });

  const saveBtn = root.querySelector("[data-mv-save]");
  if (saveBtn) saveBtn.addEventListener("click", () => {
    const ok = store.setMessageVocal(mvPendingDataUrl);
    mvPendingDataUrl = null;
    if (ok) {
      mvScreenState = "idle";
      mvShowRecorder = false;
      toast("Message enregistré");
    } else {
      mvScreenState = "error";
      mvErrorMsg = "Ton message n'a pas pu être enregistré (mémoire de l'appareil insuffisante). Essaie avec un message un peu plus court.";
    }
    renderPhraseConfianceMain(root, slug);
  });

  // Anneau qui se remplit doucement sur 30 secondes autour du bouton rond (v1.64) : posé à "vide"
  // (stroke-dashoffset = circonférence) dans le gabarit HTML puis étendu à "plein" (0) juste après
  // le rendu, pour que la transition CSS (durée posée ici en JS) parte bien de zéro plutôt que de
  // sauter instantanément au maximum — même technique que l'ancienne barre horizontale qu'il remplace.
  const ring = root.querySelector("#mvRingFg");
  if (ring) {
    ring.style.strokeDasharray = String(MV_RING_CIRCUMFERENCE);
    ring.style.strokeDashoffset = String(MV_RING_CIRCUMFERENCE);
    requestAnimationFrame(() => {
      ring.style.transitionDuration = "30s";
      ring.style.strokeDashoffset = "0";
    });
  }
}

function renderPhraseConfianceMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");
  const existing = store.getPhraseConfiance();
  const toolMeta = categories.flatMap(c => c.tools).find(t => t.id === slug);

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Mes ressources</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">J'ai confiance, je tiens bon</h3>
      ${renderMessageVocalHtml()}
      <div class="body-copy">
        <p>Il y a peut-être, quelque part en toi, une phrase que quelqu'un t'a dite un jour — un parent, un ami, un soignant, quelqu'un en qui tu avais confiance — et qui t'a aidé à tenir. Note-la ici, pour pouvoir te la redire chaque fois que tu en as besoin.</p>
      </div>
      <textarea class="field" id="phraseConfianceInput" placeholder="Écris ta phrase ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save-phrase>Enregistrer</button>
      <div class="anecdote">
        <div class="lbl">Mon expérience</div>
        <p>Moi, cette phrase, c'est ma psychologue qui me l'a offerte, un jour : « Fais-toi confiance, tu vas y arriver. »</p>
        <p>Il y a eu des moments où je n'arrivais pas vraiment à y croire. Et pourtant, aujourd'hui, je peux te dire qu'elle avait raison.</p>
        <p>Alors je te le dis aujourd'hui : fais-toi confiance, tu vas y arriver. Et ton moi de demain te le confirmera aussi, plus tard.</p>
      </div>
      <div class="spacer"></div>
      ${toolMeta ? renderRelatedModuleLink(toolMeta.relatedModule) : ""}
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderPhraseConfianceMain(root, slug);
    });
  });
  root.querySelector("[data-save-phrase]").addEventListener("click", () => {
    store.setPhraseConfiance(root.querySelector("#phraseConfianceInput").value);
    toast("Enregistré");
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
  wireRelatedModuleLink(root);
  wireMessageVocalSection(root, slug);
}

function renderPhraseConfianceMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ J'ai confiance, je tiens bon</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_phrase_confiance(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderPhraseConfianceMaVersion(root, slug);
    return;
  }
  renderPhraseConfianceMain(root, slug);
}

function cleanup__outil_phrase_confiance() {
  // Libère le micro et abandonne tout enregistrement non sauvegardé si on quitte la fiche outil
  // (v1.64) — cohérent avec le reste de l'app : une prise non validée n'est jamais conservée.
  // Important : on détache d'abord ondataavailable/onstop avant d'arrêter l'enregistreur. Sans ça,
  // le onstop (asynchrone, via FileReader) pourrait se déclencher APRÈS que la navigation a déjà
  // rendu un autre écran dans `root`, et écraserait cet écran avec le gabarit de cette fiche —
  // un enregistrement interrompu par un changement de page ne doit jamais tenter de se ré-afficher.
  if (mvStopTimer) { clearTimeout(mvStopTimer); mvStopTimer = null; }
  if (mvRecorder) {
    mvRecorder.ondataavailable = null;
    mvRecorder.onstop = null;
    if (mvRecorder.state !== "inactive") {
      try { mvRecorder.stop(); } catch (e) { /* déjà arrêté */ }
    }
    mvRecorder = null;
  }
  if (mvStream) { mvStream.getTracks().forEach(t => t.stop()); mvStream = null; }
  mvChunks = [];
  mvScreenState = "idle";
  mvPendingDataUrl = null;
  mvErrorMsg = "";
  mvBusy = false;
  mvShowRecorder = false;
}

const OutilPhraseConfianceScreen = { render: render__outil_phrase_confiance, cleanup: cleanup__outil_phrase_confiance };

/* ---- js/screens/outil-coussin.js ---- */
// J'accueille mes émotions, je m'équilibre — le coussin des émotions, catégorie Mes ressources.
// Texte et nom finalisés (v0.57). Gabarit repris de la maquette
// design/ecrans-outils-mes-ressources.html (écran D).
//
// Écarts constatés entre la maquette et le texte du cahier des charges (v0.57) : la maquette fusionne
// plusieurs phrases et en perd des fragments — "et où tu te sens en sécurité" (2e paragraphe),
// "de la couleur qui représente pour toi la sécurité et la protection" (réduit à "protectrice"),
// la phrase entière "Ou repasse ta journée, et identifie si des émotions sont encore présentes pour
// toi." (absente), et "une fois qu'elle a fait son travail" (fin de la phrase sur l'apaisement).
// Conformément à la règle posée par Johan (v1.39, "les versions les plus récentes sont toujours les
// bonnes") et à l'en-tête de ce fichier de maquette (produit à partir des textes déjà validés, donc
// postérieur à eux), la version de la maquette est retenue par défaut ici — signalée pour
// transparence, sans bloquer sur une question.

function renderCoussinMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Mes ressources</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">J'accueille mes émotions, je m'équilibre</h3>
      <div class="body-copy">
        <p><strong>Choisis un coussin</strong> que tu n'utiliseras que pour cet exercice.</p>
        <p>Chaque soir, ou chaque fois que tu en sens le besoin, <strong>prends un moment pour toi</strong>, dans un endroit où tu ne seras pas dérangé.</p>
        <p><strong>Connecte-toi</strong> à ta figure ressource, ou imagine que tu es entouré d'une <strong>bulle de lumière protectrice</strong>. Prends quelques respirations, en portant ton attention à travers ton cœur.</p>
        <p>Puis <strong>laisse venir les émotions</strong>, si tu en ressens. Observe-les. Laisse-leur le droit de s'exprimer — une émotion accueillie et exprimée s'apaise généralement d'elle-même.</p>
        <p><strong>Fais-toi confiance.</strong></p>
        <p>Tu peux utiliser le coussin pour taper dessus, pour crier dedans, ou le serrer fort dans tes bras, selon ton besoin. Utilise-le pour libérer ce que tu ressens maintenant, plutôt que pour rejouer ce qui t'a mis en colère.</p>
        <p>Sois créatif, et écoute ce qui te fait du bien.</p>
      </div>
      <div class="spacer"></div>
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderCoussinMain(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
}

function renderCoussinMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ J'accueille mes émotions, je m'équilibre</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_coussin(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderCoussinMaVersion(root, slug);
    return;
  }
  renderCoussinMain(root, slug);
}

function cleanup__outil_coussin() {}

const OutilCoussinScreen = { render: render__outil_coussin, cleanup: cleanup__outil_coussin };

/* ---- js/screens/outil-lieu-secure.js ---- */
// Je m'y réfugie, je me sens en sécurité — le lieu sécure, catégorie Mes ressources.
// Texte et nom finalisés (v0.59). Gabarit repris de la maquette
// design/ecrans-outils-mes-ressources.html (écran E).
//
// Écarts constatés entre la maquette et le texte du cahier des charges (v0.59) : "que tu connais"
// disparaît du 1er paragraphe ("un lieu réel, que tu connais, ou un lieu imaginé"), et surtout
// "rien ne peut t'atteindre" devient "rien de négatif ne peut t'atteindre" — un ajout qui nuance le
// sens (sécurité relative plutôt qu'absolue), pas une simple coupe. Conformément à la règle posée par
// Johan (v1.39, "les versions les plus récentes sont toujours les bonnes") et à l'en-tête de ce
// fichier de maquette (produit à partir des textes déjà validés, donc postérieur à eux), la version
// de la maquette est retenue par défaut ici — signalée pour transparence, sans bloquer sur une question.

function renderLieuSecureMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");
  const toolMeta = categories.flatMap(c => c.tools).find(t => t.id === slug);

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Mes ressources</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">Je m'y réfugie, je me sens en sécurité</h3>
      <div class="body-copy">
        <p>Ferme les yeux, si tu veux. Pense à <strong>un endroit</strong> où tu te sens totalement <strong>en sécurité</strong> — un lieu réel, ou un lieu imaginé, peu importe.</p>
        <p><strong>Regarde</strong> autour de toi. Qu'est-ce que tu vois ? Les couleurs, les formes, la lumière.</p>
        <p><strong>Écoute</strong>. Quels sons t'accompagnent, dans cet endroit ?</p>
        <p><strong>Remarque</strong> ce que tu ressens sur ta peau — une température, une texture, un contact.</p>
        <p><strong>Sens</strong>, s'il y a une odeur qui fait partie de ce lieu.</p>
        <p>Dans cet endroit, <strong>rien de négatif ne peut t'atteindre</strong>. Tu es <strong>en sécurité</strong>, complètement.</p>
        <p>Respire cette image à travers <strong>ton cœur</strong>, pour <strong>ancrer cette sensation</strong> en toi. Et laisse cette sensation grandir.</p>
      </div>
      <div class="spacer"></div>
      ${toolMeta ? renderRelatedModuleLink(toolMeta.relatedModule) : ""}
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderLieuSecureMain(root, slug);
    });
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
  wireRelatedModuleLink(root);
}

function renderLieuSecureMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Je m'y réfugie, je me sens en sécurité</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_lieu_secure(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderLieuSecureMaVersion(root, slug);
    return;
  }
  renderLieuSecureMain(root, slug);
}

function cleanup__outil_lieu_secure() {}

const OutilLieuSecureScreen = { render: render__outil_lieu_secure, cleanup: cleanup__outil_lieu_secure };

/* ---- js/screens/outil-ecriture.js ---- */
// J'écris, je m'en libère — exercice d'écriture, catégorie Mes ressources.
// Texte et nom finalisés (v0.60). Gabarit repris de la maquette
// design/ecrans-outils-mes-ressources.html (écran F).
//
// Écarts constatés entre la maquette et le texte du cahier des charges (v0.60) : "sans chercher à
// bien faire" disparaît du 2e paragraphe, et la phrase "Quand les 15 minutes sont passées, arrête —
// même en pleine phrase." n'apparaît nulle part dans la maquette (remplacée fonctionnellement par le
// minuteur lui-même). Conformément à la règle posée par Johan (v1.39, "les versions les plus
// récentes sont toujours les bonnes"), la version de la maquette est retenue pour le texte affiché —
// mais le COMPORTEMENT décrit par la phrase manquante (s'arrêter à la fin des 15 minutes) est bien
// implémenté : le champ d'écriture devient en lecture seule dès que le minuteur atteint 0:00.
//
// Fiche rendue réellement interactive, pas seulement illustrative (contrairement à d'autres fiches où
// le "field" reste une simple invite) : le minuteur "15:00" de la maquette est un vrai compte à rebours
// fonctionnel, le champ d'écriture est un vrai textarea, et le bouton "Refermer" vide réellement le
// texte. Point essentiel du cahier des charges (v0.60, point 4) : "Ce texte disparaît, il n'est pas
// gardé" — AUCUNE persistance dans le stockage local pour cette fiche, contrairement à "Ma version"
// ou à la phrase de confiance (v1.40) : le texte ne vit qu'en mémoire le temps de l'écran, jamais
// écrit dans localStorage, cohérent avec la confidentialité déjà actée (v0.3, v0.6) et avec le geste
// de clôture lui-même (pas seulement symbolique : réellement terminé).

const ECRITURE_DUREE_S = 15 * 60;
let ecritureIntervalId = null;

function formatEcritureTemps(secondes) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function stopEcritureTimer() {
  if (ecritureIntervalId) clearInterval(ecritureIntervalId);
  ecritureIntervalId = null;
}

function startEcritureCompteARebours(timerEl, inputEl, getRestantes, setRestantes) {
  stopEcritureTimer();
  ecritureIntervalId = setInterval(() => {
    const restant = getRestantes() - 1;
    setRestantes(restant);
    if (restant <= 0) {
      setRestantes(0);
      timerEl.textContent = formatEcritureTemps(0);
      timerEl.classList.add("done");
      inputEl.setAttribute("readonly", "readonly");
      stopEcritureTimer();
      return;
    }
    timerEl.textContent = formatEcritureTemps(restant);
  }, 1000);
}

function renderEcritureMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");

  let secondesRestantes = ECRITURE_DUREE_S;
  const toolMeta = categories.flatMap(c => c.tools).find(t => t.id === slug);

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Mes ressources</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">J'écris, je m'en libère</h3>
      <div class="usage-note">Cet exercice demande un peu de recul — il se pratique mieux hors des moments de crise aiguë.</div>
      <div class="body-copy">
        <p>Il y a peut-être, en ce moment, une pensée qui tourne en boucle — une peur, une idée obsédante, une rumination qui revient sans cesse.</p>
        <p>Donne-lui un moment, un vrai. Prends 15 minutes, et écris. Tout ce qui te passe par la tête sur ce sujet, sans filtre, sans te relire.</p>
      </div>
      <div class="timer-wrap"><div class="timer" id="ecritureTimer">${formatEcritureTemps(ECRITURE_DUREE_S)}</div></div>
      <textarea class="field" id="ecritureInput" placeholder="Écris ici, sans filtre…" style="min-height:110px;"></textarea>
      <button class="btn-primary" data-close>Refermer — mets-le dans la boîte</button>
      <p class="ecriture-closing">Ce texte disparaît, il n'est pas gardé. Tu lui as donné sa place. Pour aujourd'hui, c'est fait.</p>
      <div class="spacer"></div>
      ${toolMeta ? renderRelatedModuleLink(toolMeta.relatedModule) : ""}
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  const timerEl = root.querySelector("#ecritureTimer");
  const inputEl = root.querySelector("#ecritureInput");
  const getRestantes = () => secondesRestantes;
  const setRestantes = (v) => { secondesRestantes = v; };

  startEcritureCompteARebours(timerEl, inputEl, getRestantes, setRestantes);

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderEcritureMain(root, slug);
    });
  });
  root.querySelector("[data-close]").addEventListener("click", () => {
    inputEl.value = "";
    inputEl.removeAttribute("readonly");
    timerEl.classList.remove("done");
    setRestantes(ECRITURE_DUREE_S);
    timerEl.textContent = formatEcritureTemps(ECRITURE_DUREE_S);
    toast("Refermé — ce texte n'a pas été gardé");
    startEcritureCompteARebours(timerEl, inputEl, getRestantes, setRestantes);
  });
  root.querySelector("[data-maversion]").addEventListener("click", () => {
    stopEcritureTimer();
    navigate(`#/outil/${slug}/maversion`);
  });
  wireRelatedModuleLink(root);
}

function renderEcritureMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ J'écris, je m'en libère</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_ecriture(root, params) {
  stopEcritureTimer();
  const slug = params.slug;
  if (params.step === "maversion") {
    renderEcritureMaVersion(root, slug);
    return;
  }
  renderEcritureMain(root, slug);
}

function cleanup__outil_ecriture() {
  stopEcritureTimer();
}

const OutilEcritureScreen = { render: render__outil_ecriture, cleanup: cleanup__outil_ecriture };

/* ---- js/screens/outil-je-verifie.js ---- */
// Je vérifie, je reprends la main — dernier outil de "Mes ressources", troisième et dernier plan de
// l'intégration de la violation des attentes (v0.69). Texte et nom finalisés (v0.72). Gabarit repris
// de la maquette design/ecrans-outils-mes-ressources.html (écran G) : texte identique au cahier des
// charges, aucun écart constaté cette fois — seule la phrase de clôture "Note-le dans ton Journal.
// Tu reviendras vérifier, une fois l'événement passé." est répartie, dans la maquette, entre le
// titre et la description d'un lien-bouton plutôt qu'affichée comme une phrase continue : restructuration
// d'interface cohérente avec le lien module→outil déjà en place (renderRelatedModuleLink, v1.42),
// pas un écart de contenu.
//
// Pont direct vers "La vérification des attentes" du Journal (v1.45) : le champ "scénario précis"
// et la note "sur 10" ne sont pas de simples champs illustratifs — taper sur "Noter dans le Journal"
// enregistre réellement une nouvelle prédiction (store.addPrediction), consultable et vérifiable
// ensuite depuis le Journal, exactement comme le texte le promet ("Tu reviendras vérifier, une fois
// l'événement passé.").
//
// v1.93 — à la demande de Johan (suite au même changement sur "J'avance, une marche à la fois") :
// l'échelle de certitude passe de 1-10 à 0-10 — le 0 (certitude absolue que le scénario redouté
// N'arrivera PAS) est une valeur significative, symétrique à la raison déjà actée pour l'autre
// échelle (0 = absence totale de stress).

function renderJeVerifieMain(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");
  const toolMeta = categories.flatMap(c => c.tools).find(t => t.id === slug);

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Mes ressources</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">Je vérifie, je reprends la main</h3>
      <div class="usage-note">Un outil à utiliser à froid, dans les jours ou les heures qui précèdent un événement redouté — pas en pleine crise.</div>
      <div class="body-copy">
        <p>Quelque chose approche, et l'angoisse monte déjà.</p>
        <p>Qu'est-ce que tu redoutes ? Pas « que ça se passe mal » — le scénario précis auquel tu penses le plus.</p>
      </div>
      <textarea class="field" id="scenarioInput" placeholder="Écris le scénario précis…"></textarea>
      <div class="field-lbl">Sur une échelle allant de 0 à 10, à quel point tu es sûr·e que ça va arriver ?</div>
      <div class="scale-row scale-row-10" data-scale-row>
        ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `<div class="scale-dot" data-scale-value="${n}">${n}</div>`).join("")}
      </div>
      <a class="link-row" href="#/journal/verif-attentes/consulter" data-noter-link>
        <div><div class="t">Noter dans le Journal</div><div class="d">tu reviendras vérifier, une fois l'événement passé</div></div>
        <span class="chev">›</span>
      </a>
      <div class="body-copy" style="margin-top:8px;">
        <p style="font-style:italic; color:var(--sage-dark); text-align:center;">Noter ta peur, c'est déjà reprendre la main.</p>
      </div>
      <div class="spacer"></div>
      ${toolMeta ? renderRelatedModuleLink(toolMeta.relatedModule) : ""}
      <button class="ma-version" data-maversion><span class="ic">✎</span> Ma version — note personnelle</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderJeVerifieMain(root, slug);
    });
  });

  const scaleRow = root.querySelector("[data-scale-row]");
  scaleRow.querySelectorAll(".scale-dot").forEach(dot => {
    dot.addEventListener("click", () => {
      scaleRow.querySelectorAll(".scale-dot").forEach(d => d.classList.remove("chosen"));
      dot.classList.add("chosen");
    });
  });

  root.querySelector("[data-noter-link]").addEventListener("click", (e) => {
    e.preventDefault();
    const text = root.querySelector("#scenarioInput").value.trim();
    if (!text) {
      toast("Écris d'abord le scénario que tu redoutes");
      return;
    }
    const chosenDot = scaleRow.querySelector(".scale-dot.chosen");
    const confiance10 = chosenDot ? parseInt(chosenDot.getAttribute("data-scale-value"), 10) : undefined;
    store.addPrediction(text, confiance10);
    toast("Noté — tu pourras vérifier plus tard");
    navigate("#/journal/verif-attentes/consulter");
  });

  root.querySelector("[data-maversion]").addEventListener("click", () => navigate(`#/outil/${slug}/maversion`));
  wireRelatedModuleLink(root);
}

function renderJeVerifieMaVersion(root, slug) {
  const existing = store.getMaVersion(slug);
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Je vérifie, je reprends la main</button></div>
      <h3 class="title title-sm">Ma version</h3>
      <div class="body-copy"><p>Un espace discret pour noter ta propre façon de vivre cet exercice — ce qui marche pour toi, ce que tu adaptes.</p></div>
      <textarea class="field" id="maVersionInput" placeholder="Écris ici…">${escapeHtml(existing)}</textarea>
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate(`#/outil/${slug}`));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setMaVersion(slug, root.querySelector("#maVersionInput").value);
    toast("Enregistré");
  });
}

function render__outil_je_verifie(root, params) {
  const slug = params.slug;
  if (params.step === "maversion") {
    renderJeVerifieMaVersion(root, slug);
    return;
  }
  renderJeVerifieMain(root, slug);
}

function cleanup__outil_je_verifie() {}

const OutilJeVerifieScreen = { render: render__outil_je_verifie, cleanup: cleanup__outil_je_verifie };

/* ---- js/screens/outil-echelle-exposition.js ---- */
// J'avance, une marche à la fois (v1.86, fusion avec le système de prédictions v1.87) — outil
// "hiérarchie d'exposition", chantier resté explicitement de côté depuis l'avis bêta-testeur
// (v1.63, point 2).
//
// Nom et textes validés par Johan en v1.93 : tout gardé tel quel (brouillon de Claude depuis la
// v1.86), à une exception près — l'échelle de difficulté passe de 1-10 à 0-10 (cf. v1.93 ci-dessous).
//
// v1.93 — à la demande de Johan : l'échelle de difficulté anticipée (ici, et sa ré-estimation dans
// "La vérification des attentes" du Journal, cf. journal.js) passe de 1-10 à 0-10. Le 0 est
// significatif : il signifie l'absence totale de stress, utile en particulier lors d'une
// ré-estimation après une tentative (la situation peut devenir complètement apaisée, pas seulement
// "moins difficile"). N'affecte PAS l'échelle 1-10 de "Je vérifie, je reprends la main"
// (outil-je-verifie.js) — question différente (certitude qu'un scénario redouté va arriver), non
// mentionnée par Johan, laissée inchangée.
//
// v1.87 — retour de Johan après la v1.86 : la première version (liste + case à cocher "affrontée")
// n'organisait pas de véritable exposition — elle ne faisait qu'enregistrer qu'un temps avait passé.
// Le mécanisme réel, selon le modèle d'apprentissage inhibiteur (Craske et al., 2014), repose sur la
// VIOLATION D'UNE ATTENTE : une prédiction précise formulée avant l'événement, puis comparée à ce qui
// s'est réellement passé après coup — protocole déjà construit dans l'app ("Je vérifie, je reprends
// la main" + "La vérification des attentes" du Journal), mais jamais relié à cette échelle.
//
// Fusion actée avec Johan (v1.87) : une situation de l'échelle N'EST PLUS une liste séparée — c'est
// directement une entrée du système de prédictions (store.addPrediction, champ `difficulte` en plus).
// Ajouter une situation ici l'ajoute donc aussi à "La vérification des attentes" ; l'affronter et la
// vérifier se fait entièrement là-bas (formulaire déjà construit, résultat/échelle/évitement/petit
// pas) plutôt que dans une deuxième interface dupliquée ici. Cet écran reste la vue "hiérarchie" :
// ajouter une situation avec sa difficulté, et voir où en est chaque marche, triée de la plus facile
// à la plus difficile.
//
// v1.88 — à la demande de Johan : une situation peut être vérifiée plusieurs fois (historique complet
// par tentative, cf. store.addAttempt). Il n'y a donc plus d'état final "vérifiée" ici : chaque ligne
// affiche le nombre de tentatives et leur tendance, et propose toujours une action pour recommencer
// ("Vérifier" la première fois, "Nouvelle tentative" ensuite) — jamais un statut clos.

function renderEchelleExposition(root, slug) {
  const favN = store.getFavoris(slug);
  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= favN ? "on" : ""}" data-star="${n}" aria-label="Noter ${n} étoile${n > 1 ? 's' : ''} sur 5" aria-pressed="${n <= favN}">★</button>`
  ).join("");
  const toolMeta = categories.flatMap(c => c.tools).find(t => t.id === slug);

  const list = store.getPredictions()
    .filter(e => typeof e.difficulte === "number")
    .slice()
    .sort((a, b) => a.difficulte - b.difficulte);

  root.innerHTML = `
    <div class="screen">
      <div class="back-row">
        <button class="back" data-back>‹ Mes ressources</button>
        <div class="fav-row">${stars}</div>
      </div>
      <h3 class="title title-sm">J'avance, une marche à la fois</h3>
      <div class="usage-note">Un outil à construire librement, à ton rythme — rien ne t'oblige à avancer vite.</div>
      <div class="body-copy">
        <p>Note ici les situations que tu évites à cause de ton anxiété. Classe-les par difficulté : de la plus facile à la plus difficile.</p>
        <p>Commence par la plus facile — à ton rythme, sans jamais te forcer. Affronter une situation et vérifier ce qui s'est vraiment passé se fait dans "La vérification des attentes", dans ton Journal — chaque situation notée ici y apparaît automatiquement.</p>
      </div>

      <textarea class="field" id="expoTextInput" placeholder="Qu'est-ce que tu évites ?"></textarea>
      <div class="field-lbl">Sur une échelle allant de 0 à 10, à quel point cette situation est-elle difficile pour toi aujourd'hui ?</div>
      <div class="scale-row scale-row-10" data-scale-row>
        ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `<div class="scale-dot" data-scale-value="${n}">${n}</div>`).join("")}
      </div>
      <button class="btn-primary" data-add>Ajouter à mon échelle</button>

      <div class="exposition-list">
        ${list.length === 0
          ? `<div class="empty-state">Ta liste est vide pour l'instant. Ajoute une première situation, même petite.</div>`
          : list.map(e => {
            const attempts = e.attempts || [];
            const last = attempts.length > 0 ? attempts[attempts.length - 1] : null;
            const trend = attempts.map(a => a.avoided ? "évitée" : (a.scale != null ? a.scale + "/5" : "?")).join(", ");
            return `
            <div class="exposition-row">
              <div class="exposition-diff">${e.difficulte}</div>
              <div class="exposition-txt">
                ${escapeHtml(e.text)}
                ${last
                  ? `<span class="outcome-badge ${last.avoided ? "avoid" : (last.scale != null ? (last.scale <= 2 ? "soft" : (last.scale >= 4 ? "hard" : "")) : "")}">${last.avoided ? "Évitée" : (last.scale != null ? last.scale + "/5" : "Vérifiée")}</span>`
                  : ""}
                ${attempts.length > 0
                  ? `<div class="usage-note">${attempts.length} tentative${attempts.length > 1 ? "s" : ""}${attempts.length > 1 ? " : " + trend : ""}</div>`
                  : ""}
              </div>
              <button class="exposition-verify-btn" data-verify="${e.id}">${attempts.length === 0 ? "Vérifier" : "Nouvelle tentative"}</button>
            </div>
          `;
          }).join("")
        }
      </div>

      <div class="spacer"></div>
      ${toolMeta ? renderRelatedModuleLink(toolMeta.relatedModule) : ""}
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelectorAll("[data-star]").forEach(b => {
    b.addEventListener("click", () => {
      const n = parseInt(b.getAttribute("data-star"), 10);
      const current = store.getFavoris(slug);
      store.setFavoris(slug, current === n ? 0 : n);
      renderEchelleExposition(root, slug);
    });
  });

  const scaleRow = root.querySelector("[data-scale-row]");
  scaleRow.querySelectorAll(".scale-dot").forEach(dot => {
    dot.addEventListener("click", () => {
      scaleRow.querySelectorAll(".scale-dot").forEach(d => d.classList.remove("chosen"));
      dot.classList.add("chosen");
    });
  });

  root.querySelector("[data-add]").addEventListener("click", () => {
    const input = root.querySelector("#expoTextInput");
    const text = input.value.trim();
    if (!text) {
      toast("Écris d'abord la situation que tu évites");
      return;
    }
    const chosenDot = scaleRow.querySelector(".scale-dot.chosen");
    if (!chosenDot) {
      toast("Choisis un niveau de difficulté");
      return;
    }
    const difficulte = parseInt(chosenDot.getAttribute("data-scale-value"), 10);
    store.addPrediction(text, undefined, difficulte);
    toast("Ajouté à ton échelle");
    renderEchelleExposition(root, slug);
  });

  // "Vérifier" renvoie vers le Journal (formulaire déjà construit là-bas, pas dupliqué ici) — la
  // situation ciblée est signalée via sessionStorage pour que l'écran de destination l'ouvre et la
  // mette en évidence directement (cf. js/screens/journal.js), plutôt qu'une simple liste à parcourir.
  root.querySelectorAll("[data-verify]").forEach(b => {
    b.addEventListener("click", () => {
      sessionStorage.setItem("socalm.verifAttentes.focusId", b.getAttribute("data-verify"));
      navigate("#/journal/verif-attentes/consulter");
    });
  });

  wireRelatedModuleLink(root);
}

function render__outil_echelle_exposition(root, params) {
  renderEchelleExposition(root, params.slug);
}

function cleanup__outil_echelle_exposition() {}

const OutilEchelleExpositionScreen = { render: render__outil_echelle_exposition, cleanup: cleanup__outil_echelle_exposition };

/* ---- js/screens/outil-plan-rechute.js ---- */
// Mon petit plan, si ça revient (v1.71) — outil compagnon du module "Et dans trois mois ?", clôture
// de son volet 3. Décider maintenant, à froid, un tout petit réflexe pour plus tard — intention de
// mise en œuvre (Gollwitzer, déjà citée dans l'app pour les plans par déclencheur du Journal). Même
// mécanique à deux champs (réflexe/action) que ces plans, réutilisée à l'identique pour la cohérence
// visuelle — cf. .plan-block/.plan-field dans app.css — mais stockage séparé et global
// (store.getPlanRechute/setPlanRechute) : pas de situation précise déjà notée à laquelle rattacher ce
// plan-ci, à la différence des plans par déclencheur.

function renderPlanRechute(root, slug) {
  const plan = store.getPlanRechute();

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Mes ressources</button></div>
      <h3 class="title title-sm">Mon petit plan, si ça revient</h3>
      <div class="subtitle">Un tout petit réflexe, décidé à l'avance — pour ne rien avoir à inventer sur le moment.</div>
      <div class="body-copy">
        <p>Pas un plan compliqué. Juste une petite idée, prête à l'avance, pour le jour où l'angoisse remonte.</p>
      </div>
      <div class="plan-block">
        <div class="h">La prochaine fois que je sens l'angoisse remonter :</div>
        <div class="plan-field"><b>au lieu de faire</b><input type="text" class="plan-input" id="planReflexe" value="${escapeHtml(plan.reflexe)}" placeholder="…"></div>
        <div class="plan-field"><b>je peux faire</b><input type="text" class="plan-input" id="planAction" value="${escapeHtml(plan.action)}" placeholder="…"></div>
        <button class="btn-primary" data-save>Enregistrer</button>
      </div>
      <div class="spacer"></div>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelector("[data-save]").addEventListener("click", () => {
    store.setPlanRechute({
      reflexe: root.querySelector("#planReflexe").value,
      action: root.querySelector("#planAction").value
    });
    toast("Enregistré");
  });
}

function render__outil_plan_rechute(root, params) {
  renderPlanRechute(root, params.slug);
}

function cleanup__outil_plan_rechute() {}

const OutilPlanRechuteScreen = { render: render__outil_plan_rechute, cleanup: cleanup__outil_plan_rechute };

/* ---- js/screens/outil-personne-confiance.js ---- */
// Je me tourne vers quelqu'un, je ne reste pas seul·e (v1.91) — outil compagnon du module "Je
// m'isole quand je vais mal, est-ce que ça m'aide vraiment ?", clôture de son volet 4. Noter, à
// l'avance, une ou plusieurs personnes de confiance vers qui se tourner et ce qu'on pourrait leur
// dire — intention de mise en œuvre (Gollwitzer, déjà citée pour "Mon petit plan, si ça revient" et
// les plans par déclencheur du Journal). Reste 100% local : rien n'est envoyé ni partagé, jamais.
//
// Choix : liste qui s'accumule, sans suppression — même principe que "La liste des déclencheurs" du
// Journal (cf. js/screens/journal.js, renderDeclencheursConsult) plutôt qu'un champ unique comme
// "Mon petit plan, si ça revient" : on peut vouloir noter plusieurs personnes, pas une seule case à
// écraser à chaque fois.

function renderPersonneConfiance(root) {
  const entries = store.getPersonnesConfiance();

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Mes ressources</button></div>
      <h3 class="title title-sm">Je me tourne vers quelqu'un, je ne reste pas seul·e</h3>
      <div class="subtitle">Repère, à l'avance, vers qui te tourner — pour ne pas avoir à le chercher le jour où tu en as besoin.</div>
      <div class="body-copy">
        <p>Une personne, même une seule. Et si tu veux, ce que tu pourrais lui dire — une phrase simple suffit.</p>
        <p>Cette liste reste ici, sur cet appareil : elle n'est jamais partagée.</p>
      </div>
      <div class="plan-block">
        <div class="plan-field"><b>Une personne vers qui je peux me tourner</b><input type="text" class="plan-input" id="personneNom" placeholder="Un prénom, un lien…"></div>
        <div class="plan-field"><b>Ce que je pourrais lui dire</b><input type="text" class="plan-input" id="personneNote" placeholder="Facultatif…"></div>
        <button class="btn-primary" data-add>Ajouter</button>
      </div>
      ${entries.length === 0
        ? `<div class="empty-state">Ta liste est vide pour l'instant.</div>`
        : entries.map(e => `
          <div class="entry-row-wrap">
            <div class="entry-row">
              <div class="date">${formatDate(e.date)}</div>
              <div class="txt"><strong>${escapeHtml(e.nom)}</strong>${e.note ? " — " + escapeHtml(e.note) : ""}</div>
            </div>
          </div>
        `).join("")
      }
      <div class="spacer"></div>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/categorie/mes-ressources"));
  root.querySelector("[data-add]").addEventListener("click", () => {
    const nomInput = root.querySelector("#personneNom");
    const noteInput = root.querySelector("#personneNote");
    const nom = nomInput.value.trim();
    if (!nom) return;
    store.addPersonneConfiance(nom, noteInput.value.trim());
    toast("Ajouté à ta liste");
    renderPersonneConfiance(root);
  });
}

function render__outil_personne_confiance(root, params) {
  renderPersonneConfiance(root, params.slug);
}

function cleanup__outil_personne_confiance() {}

const OutilPersonneConfianceScreen = { render: render__outil_personne_confiance, cleanup: cleanup__outil_personne_confiance };

/* ---- js/screens/outil-router.js ---- */
// Aiguillage des routes #/outil/:slug vers la bonne fiche outil.
// Nécessaire car chaque écran classique déclare son propre "render" en portée globale
// (cf. note technique v1.16) : ce petit routeur garde une seule cible réelle par route,
// évitant d'ajouter directement de nouveaux patterns dans app.js à chaque nouvel outil.
let activeToolScreen = null;

function pickToolScreen(slug) {
  if (slug === "mantra") return OutilMantraScreen;
  if (slug === "ancrage-5432") return OutilAncrageScreen;
  if (slug === "marche") return OutilMarcheScreen;
  if (slug === "odeur-rassurante") return OutilOdeurScreen;
  if (slug === "odeur-association") return OutilOdeurAssociationScreen;
  if (slug === "protecteur-critique") return OutilProtecteurScreen;
  if (slug === "figure-aidante") return OutilFigureAidanteScreen;
  if (slug === "phrase-confiance") return OutilPhraseConfianceScreen;
  if (slug === "coussin-emotions") return OutilCoussinScreen;
  if (slug === "lieu-secure") return OutilLieuSecureScreen;
  if (slug === "ecriture") return OutilEcritureScreen;
  if (slug === "je-verifie") return OutilJeVerifieScreen;
  if (slug === "echelle-exposition") return OutilEchelleExpositionScreen;
  if (slug === "plan-rechute") return OutilPlanRechuteScreen;
  if (slug === "personne-confiance") return OutilPersonneConfianceScreen;
  return OutilRespirationScreen;
}

function render__outil_router(root, params) {
  activeToolScreen = pickToolScreen(params.slug);
  activeToolScreen.render(root, params);
}

function cleanup__outil_router() {
  if (activeToolScreen && typeof activeToolScreen.cleanup === "function") {
    activeToolScreen.cleanup();
  }
  activeToolScreen = null;
}

const OutilScreen = { render: render__outil_router, cleanup: cleanup__outil_router };

/* ---- js/screens/journal.js ---- */
function renderHome(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Retour</button></div>
      <h3 class="title title-md">Journal</h3>
      <div class="subtitle">stockage local uniquement</div>
      <div class="mantra-banner">
        <div class="lbl">Ton mantra</div>
        <div class="txt">À chaque instant, je fais de mon mieux.<br>Chaque petit pas compte.</div>
      </div>
      ${journalMenu.map(item => `
        <button class="menu-row ${item.live ? "" : "disabled"}" ${item.live ? `data-route="${item.route}"` : "disabled"}>
          <div class="ic"><img src="${item.icon}" alt=""></div>
          <div><div class="t">${escapeHtml(item.name)}</div><div class="d">${escapeHtml(item.desc)}${item.live ? "" : " — à venir"}</div></div>
          <div class="chev">›</div>
        </button>
      `).join("")}
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/"));
  root.querySelectorAll("[data-route]").forEach(b => b.addEventListener("click", () => navigate(b.getAttribute("data-route"))));
}

function renderComplimentsAdd(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">La boîte à compliments</h3>
      <div class="body-copy">
        <p>Un <strong>compliment</strong> qu'on t'a fait. Une <strong>petite victoire</strong> que tu as remarquée chez toi. Une <strong>pensée positive</strong> que tu t'es dite, sur toi-même.</p>
        <p><strong>Même minuscule, note-la ici. Elle compte.</strong></p>
      </div>
      <textarea class="field" id="complimentInput" placeholder="Écris ici…"></textarea>
      <button class="btn-primary" data-add>Ajouter</button>
      <button class="btn-secondary" data-consult>Voir mes compliments</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-consult]").addEventListener("click", () => navigate("#/journal/compliments/consulter"));
  root.querySelector("[data-add]").addEventListener("click", () => {
    const input = root.querySelector("#complimentInput");
    const text = input.value.trim();
    if (!text) return;
    store.addCompliment(text);
    toast("Ajouté à ta boîte à compliments");
    navigate("#/journal/compliments/consulter");
  });
}

function renderComplimentsConsult(root) {
  const entries = store.getCompliments();
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">La boîte à compliments</h3>
      <div class="body-copy">
        <p>Ouvre la boîte quand tu veux, ou quand tu as besoin de te rappeler de quoi tu es capable.</p>
        <p><strong>Souviens-toi de chaque moment et respire-le avec ton cœur.</strong></p>
      </div>
      ${entries.length === 0
        ? `<div class="empty-state">Ta boîte est vide pour l'instant.</div>`
        : entries.map(e => `
          <div class="entry-row"><div class="date">${formatDate(e.date)}</div><div class="txt">${escapeHtml(e.text)}</div></div>
        `).join("")
      }
      <div class="spacer"></div>
      <button class="btn-primary" data-add>Ajouter un compliment</button>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-add]").addEventListener("click", () => navigate("#/journal/compliments"));
}

function renderDeclencheursAdd(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">La liste des déclencheurs</h3>
      <div class="body-copy">
        <p>Quelque chose vient de te faire réagir — une situation, un lieu, une personne, ou peut-être une sensation, une pensée, un souvenir.</p>
        <p>Note-le ici, dès que tu le remarques. Pas besoin de l'expliquer, juste de le nommer.</p>
      </div>
      <textarea class="field" id="declencheurInput" placeholder="Écris ici…"></textarea>
      <button class="btn-primary" data-add>Ajouter</button>
      <button class="btn-secondary" data-consult>Voir ma liste</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-consult]").addEventListener("click", () => navigate("#/journal/declencheurs/consulter"));
  root.querySelector("[data-add]").addEventListener("click", () => {
    const input = root.querySelector("#declencheurInput");
    const text = input.value.trim();
    if (!text) return;
    store.addDeclencheur(text);
    toast("Ajouté à ta liste des déclencheurs");
    navigate("#/journal/declencheurs/consulter");
  });
}

function renderDeclencheursConsult(root) {
  const entries = store.getDeclencheurs();
  const plansMap = store.getPlansDeclencheurs();

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">La liste des déclencheurs</h3>
      <div class="body-copy">
        <p>Voici <strong>ta carte</strong>, celle que tu redessines petit à petit.</p>
        <p>Relis-la quand tu veux mieux comprendre ce qui te touche — ce n'est pas une preuve de faiblesse, c'est une trace de ton histoire.</p>
      </div>
      ${entries.length === 0
        ? `<div class="empty-state">Ta liste est vide pour l'instant.</div>`
        : entries.map(e => {
          const hasPlan = !!plansMap[e.id];
          const plan = store.getPlanForDeclencheur(e.id);
          return `
          <div class="entry-row-wrap">
            <div class="entry-row">
              <div class="date">${formatDate(e.date)}</div>
              <div class="txt">${escapeHtml(e.text)}</div>
            </div>
            <button class="plan-toggle-btn ${hasPlan ? "has-plan" : ""}" data-plan-toggle="${e.id}">${hasPlan ? "✓ Plan enregistré" : "Je change ma façon de réagir"}</button>
            <div class="plan-block" data-plan-block="${e.id}" hidden>
              <div class="h">Est-ce qu'un même genre de situation revient, dans ce que tu as noté ?<br>Si tu le repères, tu peux te préparer un petit plan, pour la prochaine fois — une idée pour faire différemment, même un tout petit changement, minuscule :</div>
              <div class="plan-field"><b>La prochaine fois que je suis confronté à</b><div class="plan-situation-fixed">${escapeHtml(e.text)}</div></div>
              <div class="plan-field"><b>au lieu de faire</b><input type="text" class="plan-input" data-plan-field="reflexe" value="${escapeHtml(plan.reflexe)}" placeholder="…"></div>
              <div class="plan-field"><b>je peux faire</b><input type="text" class="plan-input" data-plan-field="action" value="${escapeHtml(plan.action)}" placeholder="…"></div>
              <button class="btn-primary" data-save-plan="${e.id}">Enregistrer</button>
            </div>
          </div>
        `;
        }).join("")
      }
      <div class="spacer"></div>
      <button class="btn-primary" data-add>Ajouter un déclencheur</button>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-add]").addEventListener("click", () => navigate("#/journal/declencheurs"));

  root.querySelectorAll("[data-plan-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-plan-toggle");
      const block = root.querySelector(`[data-plan-block="${id}"]`);
      if (block) block.hidden = !block.hidden;
    });
  });

  root.querySelectorAll("[data-save-plan]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-save-plan");
      const block = root.querySelector(`[data-plan-block="${id}"]`);
      const newPlan = {
        reflexe: block.querySelector("[data-plan-field='reflexe']").value,
        action: block.querySelector("[data-plan-field='action']").value
      };
      store.savePlanForDeclencheur(id, newPlan);
      toast("Enregistré");
      renderDeclencheursConsult(root);
      const reopened = root.querySelector(`[data-plan-block="${id}"]`);
      if (reopened) reopened.hidden = false;
    });
  });
}

// Phrase de tête générique "Aujourd'hui" / "Hier" / "Il y a X jours" — partagée par "La vérification
// des attentes" et "Le bilan auto-écrit", toutes deux construites sur une phrase "Il y a [X jours],
// tu ... ". "Il y a aujourd'hui" ou "Il y a hier" ne fonctionnent pas grammaticalement, contrairement
// à "Il y a X jours" — corrigé suite à la remarque de Johan (v1.45), la fonction porte donc
// elle-même le "Il y a" quand il s'applique, plutôt que de le préfixer systématiquement à l'appel.
function departPhraseJours(iso) {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return "Hier";
  return `Il y a ${jours} jours`;
}

function renderVerifAttentesAjouter(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">La vérification des attentes</h3>
      <div class="body-copy">
        <p>Une prédiction, une peur pour ce qui s'en vient ? Note ce que tu redoutes, maintenant.</p>
        <p>Tu pourras vérifier plus tard ce qui s'est vraiment passé.</p>
      </div>
      <textarea class="field" id="predictionInput" placeholder="Écris ici…"></textarea>
      <button class="btn-primary" data-add>Noter</button>
      <button class="btn-secondary" data-consult>Voir mes vérifications</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-consult]").addEventListener("click", () => navigate("#/journal/verif-attentes/consulter"));
  root.querySelector("[data-add]").addEventListener("click", () => {
    const input = root.querySelector("#predictionInput");
    const text = input.value.trim();
    if (!text) return;
    store.addPrediction(text);
    toast("Noté — tu pourras vérifier plus tard");
    navigate("#/journal/verif-attentes/consulter");
  });
}

// v1.88 : id de la situation pour laquelle proposer, juste après l'enregistrement d'une tentative,
// de re-noter la difficulté anticipée (état transitoire, effacé dès qu'on valide ou qu'on choisit
// "Plus tard" — jamais persisté, remis à zéro à chaque arrivée fraîche sur cet écran par render()).
// Le texte affiché dans ce bloc a deux variantes (cf. renderVerifAttentesConsult, `lastAttemptAvoided`) :
// la variante "normale" affirme que la personne gagne du terrain sur son angoisse en ne l'évitant
// pas (théorie de l'évitement à deux facteurs de Mowrer — c'est le non-évitement répété, pas la note,
// qui casse l'habitude d'évitement) — donc une variante distincte, sans cette affirmation, est
// nécessaire quand la tentative qui vient d'être enregistrée est justement une situation évitée.
// v1.93 : l'échelle de ré-estimation passe de 1-10 à 0-10, à la demande de Johan — le 0 (absence
// totale de stress) est une valeur significative pour une ré-estimation après une tentative, cf.
// outil-echelle-exposition.js pour le détail.
let pendingReanticipationId = null;

// Phrase de synthèse déterministe (v0.73) : jamais un score, jamais générée par IA — trois variantes
// figées, choisies selon la majorité des vérifications notées (l'évitement en est exclu, point 8).
// v1.88 : reçoit désormais la liste à plat de TOUTES les tentatives (across attempts), plutôt que les
// prédictions elles-mêmes — une situation vérifiée plusieurs fois compte donc pour plusieurs points de
// données, cohérent avec l'esprit "voir une vraie tendance" derrière la répétition.
function renderSyntheseVerifAttentes(scored) {
  if (scored.length < 5) return "";
  const total = scored.length;
  const bas = scored.filter(p => p.scale <= 2).length;
  const haut = scored.filter(p => p.scale >= 4).length;
  let txt;
  if (bas > total / 2) {
    txt = "Depuis que tu vérifies tes prédictions, c'est arrivé plus souvent plus doucement que prévu.";
  } else if (haut > total / 2) {
    txt = "Depuis que tu vérifies tes prédictions, la réalité a souvent rejoint, ou dépassé, ce que tu redoutais. C'est une chose importante à savoir sur toi — et peut-être à explorer plus loin, seul·e ou accompagné·e.";
  } else {
    txt = "Depuis que tu vérifies tes prédictions, chaque situation s'est passée différemment — parfois plus doucement, parfois non. C'est aussi une preuve : rien n'est jamais totalement écrit à l'avance.";
  }
  return `
    <div class="synth-block">
      <div class="lbl">Depuis que tu vérifies tes prédictions</div>
      <div class="txt">${txt}</div>
    </div>
  `;
}

function renderVerifAttentesConsult(root) {
  const entries = store.getPredictions();
  // v1.88 : chaque tentative de chaque situation compte pour la synthèse (voir commentaire de la
  // fonction ci-dessus), plutôt qu'un seul point de données par situation.
  const scored = entries.flatMap(p => p.attempts || []).filter(a => !a.avoided && typeof a.scale === "number");

  // Le module "J'évite tout ce qui m'angoisse, est-ce que j'ai raison ?" n'est pas encore construit
  // (cf. js/data/grid.js) : lien affiché tel quel dans le texte validé (v0.73), mais grisé "à venir"
  // en attendant, sur le même principe déjà appliqué aux entrées non construites de la grille (v0.43).
  const evitementModule = categories.flatMap(c => c.tools).find(t => t.id === "evitement");
  const evitementLive = evitementModule && evitementModule.live;

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">La vérification des attentes</h3>
      ${renderSyntheseVerifAttentes(scored)}
      ${entries.length === 0
        ? `<div class="empty-state">Rien à vérifier pour l'instant.</div>`
        : entries.map(p => {
          const attempts = p.attempts || [];
          const hasDifficulte = typeof p.difficulte === "number";
          const lastAttemptAvoided = pendingReanticipationId === p.id && attempts.length > 0 && !!attempts[attempts.length - 1].avoided;
          return `
          <div class="entry-row-wrap">
            <div class="entry-row">
              <div class="date">${formatDate(p.date)}</div>
              <div class="txt">${escapeHtml(p.text)}</div>
              ${hasDifficulte ? `<div class="usage-note">Difficulté anticipée aujourd'hui : ${p.difficulte}/10</div>` : ""}
            </div>
            ${attempts.map((a, i) => `
              <div class="plan-block">
                <div class="h">✓ Tentative ${i + 1} — ${formatDate(a.date)}
                  ${a.avoided
                    ? `<span class="outcome-badge avoid">Évité</span>`
                    : (a.scale != null ? `<span class="outcome-badge ${a.scale <= 2 ? "soft" : (a.scale >= 4 ? "hard" : "")}">${a.scale}/5</span>` : "")}
                </div>
                ${typeof a.difficulteAvant === "number" ? `<div class="plan-field"><b>Difficulté anticipée avant cette tentative</b>${a.difficulteAvant}/10</div>` : ""}
                ${a.resultText ? `<div class="plan-field">${escapeHtml(a.resultText)}</div>` : ""}
                ${a.petitPas ? `<div class="plan-field"><b>Un petit pas envisagé</b>${escapeHtml(a.petitPas)}</div>` : ""}
              </div>
            `).join("")}
            ${pendingReanticipationId === p.id ? `
              <div class="plan-block" data-reanticipation-block="${p.id}">
                <div class="h">${lastAttemptAvoided
                  ? "Cette fois, tu l'as évitée. Ça arrivera encore, ça fait partie du chemin — à quel point cette situation te semble difficile aujourd'hui ?"
                  : "Maintenant que tu viens de le faire : à quel point cette situation te semble difficile aujourd'hui ?"}</div>
                <div class="usage-note">${lastAttemptAvoided
                  ? "L'éviter aujourd'hui ne remet rien en cause de ce que tu as déjà accompli. Le chemin est devant toi, fais-toi confiance et avance à ton rythme."
                  : "Rappelle-toi, chaque pas est important, la note n'est pas importante, c'est la progression sur le long terme qui compte. Chaque pas, même plus petit, je gagne du terrain sur mon angoisse."}</div>
                <div class="scale-row scale-row-10" data-reanticipation-scale="${p.id}">
                  ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `<div class="scale-dot" data-scale-value="${n}">${n}</div>`).join("")}
                </div>
                <button class="btn-primary" data-save-reanticipation="${p.id}">Valider</button>
                <button class="btn-secondary" data-skip-reanticipation="${p.id}">Plus tard</button>
              </div>
            ` : `
              <button class="plan-toggle-btn" data-verif-toggle="${p.id}">${attempts.length === 0 ? "Vérifier" : "Nouvelle tentative"}</button>
              <div class="plan-block" data-verif-block="${p.id}" hidden>
                <div class="h">${departPhraseJours(p.date)}, tu redoutais que <em>« ${escapeHtml(p.text)} »</em>.<br>Qu'est-ce qui s'est passé, vraiment ?</div>
                <textarea class="field" data-verif-field="resultText" placeholder="Écris ici…" style="margin-bottom:8px;"></textarea>
                <div class="field-lbl">Comparé à ce que tu redoutais, comment ça s'est passé ?</div>
                <div class="scale-row" data-scale-row="${p.id}">
                  <div class="scale-dot" data-scale-value="1">1</div>
                  <div class="scale-dot" data-scale-value="2">2</div>
                  <div class="scale-dot" data-scale-value="3">3</div>
                  <div class="scale-dot" data-scale-value="4">4</div>
                  <div class="scale-dot" data-scale-value="5">5</div>
                </div>
                <div class="scale-labels"><span>bien plus doux que prévu</span><span>bien pire que prévu</span></div>
                <div class="chip-row"><button class="chip" data-avoid-toggle="${p.id}">Je l'ai évité</button></div>
                <div class="avoid-block" data-avoid-block="${p.id}" hidden>
                  <div class="usage-note">C'est une information tout aussi précieuse.</div>
                  ${evitementLive
                    ? `<a class="link-row" href="#/module/evitement"><div><div class="t">J'évite tout ce qui m'angoisse, est-ce que j'ai raison ?</div><div class="d">pourquoi éviter peut renforcer une peur sans jamais la vérifier</div></div><span class="chev">›</span></a>`
                    : `<div class="link-row disabled"><div><div class="t">J'évite tout ce qui m'angoisse, est-ce que j'ai raison ?</div><div class="d">pourquoi éviter peut renforcer une peur sans jamais la vérifier — à venir</div></div><span class="chev">›</span></div>`}
                  <a class="link-row" href="#/outil/respiration-3-niveaux" data-respiration-link="${p.id}"><div><div class="t">Je respire, je m'apaise en profondeur</div><div class="d">un moment pour respirer, avant de continuer, si besoin</div></div><span class="chev">›</span></a>
                  <div class="field-lbl">À quoi ressemblerait un tout petit pas vers cette situation, la prochaine fois ?</div>
                  <textarea class="field" data-verif-field="petitPas" placeholder="(champ facultatif)"></textarea>
                </div>
                <p class="reflection-note" data-reflection-note="${p.id}">Si ça s'est passé comme tu le redoutais, ou pire : ton inquiétude a-t-elle pu y jouer un rôle ?</p>
                <button class="btn-primary" data-save-verif="${p.id}">Enregistrer</button>
              </div>
            `}
          </div>
        `;
        }).join("")
      }
      <div class="spacer"></div>
      <button class="btn-primary" data-add>Noter une prédiction</button>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-add]").addEventListener("click", () => navigate("#/journal/verif-attentes"));

  // v1.87 : arrivée depuis "J'avance, une marche à la fois" (échelle d'exposition) — la situation
  // visée est signalée par sessionStorage (une entrée parmi d'autres dans cette liste, pas de
  // troisième segment de route dédié) : on ouvre directement son formulaire de vérification et on
  // l'amène à l'écran, plutôt que de laisser chercher dans la liste.
  const focusId = sessionStorage.getItem("socalm.verifAttentes.focusId");
  if (focusId) {
    sessionStorage.removeItem("socalm.verifAttentes.focusId");
    const focusToggle = root.querySelector(`[data-verif-toggle="${focusId}"]`);
    if (focusToggle) {
      const focusBlock = root.querySelector(`[data-verif-block="${focusId}"]`);
      if (focusBlock) focusBlock.hidden = false;
      focusToggle.closest(".entry-row-wrap").scrollIntoView({ block: "center" });
    }
  }

  root.querySelectorAll("[data-verif-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-verif-toggle");
      const block = root.querySelector(`[data-verif-block="${id}"]`);
      if (block) block.hidden = !block.hidden;
    });
  });

  root.querySelectorAll("[data-scale-row]").forEach(row => {
    row.querySelectorAll(".scale-dot").forEach(dot => {
      dot.addEventListener("click", () => {
        row.querySelectorAll(".scale-dot").forEach(d => d.classList.remove("chosen"));
        dot.classList.add("chosen");
        const id = row.getAttribute("data-scale-row");
        const avoidBtn = root.querySelector(`[data-avoid-toggle="${id}"]`);
        const avoidBlock = root.querySelector(`[data-avoid-block="${id}"]`);
        if (avoidBtn) avoidBtn.classList.remove("on");
        if (avoidBlock) avoidBlock.hidden = true;
      });
    });
  });

  root.querySelectorAll("[data-avoid-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-avoid-toggle");
      const nowOn = !btn.classList.contains("on");
      btn.classList.toggle("on", nowOn);
      const avoidBlock = root.querySelector(`[data-avoid-block="${id}"]`);
      const reflectionNote = root.querySelector(`[data-reflection-note="${id}"]`);
      if (avoidBlock) avoidBlock.hidden = !nowOn;
      if (reflectionNote) reflectionNote.hidden = nowOn;
      if (nowOn) {
        const row = root.querySelector(`[data-scale-row="${id}"]`);
        if (row) row.querySelectorAll(".scale-dot").forEach(d => d.classList.remove("chosen"));
      }
    });
  });

  root.querySelectorAll("[data-respiration-link]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(link.getAttribute("href"));
    });
  });

  root.querySelectorAll("[data-save-verif]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-save-verif");
      const block = root.querySelector(`[data-verif-block="${id}"]`);
      const avoided = root.querySelector(`[data-avoid-toggle="${id}"]`).classList.contains("on");
      const chosenDot = block.querySelector(`[data-scale-row="${id}"] .scale-dot.chosen`);
      const scale = chosenDot ? parseInt(chosenDot.getAttribute("data-scale-value"), 10) : null;
      if (!avoided && scale == null) {
        toast("Choisis une note, ou « Je l'ai évité »");
        return;
      }
      store.addAttempt(id, {
        resultText: block.querySelector("[data-verif-field='resultText']").value,
        avoided,
        scale,
        petitPas: block.querySelector("[data-verif-field='petitPas']").value
      });
      toast("Enregistré");
      // v1.88 : juste après une tentative, on propose de re-noter la difficulté anticipée — mais
      // seulement pour les situations issues de l'échelle d'exposition (celles qui ont un champ
      // `difficulte`) ; une prédiction notée depuis "Je vérifie, je reprends la main" n'a pas cette
      // notion et se referme normalement, comme avant.
      const entry = store.getPredictions().find(p => p.id === id);
      pendingReanticipationId = (entry && typeof entry.difficulte === "number") ? id : null;
      renderVerifAttentesConsult(root);
    });
  });

  root.querySelectorAll("[data-reanticipation-scale]").forEach(row => {
    row.querySelectorAll(".scale-dot").forEach(dot => {
      dot.addEventListener("click", () => {
        row.querySelectorAll(".scale-dot").forEach(d => d.classList.remove("chosen"));
        dot.classList.add("chosen");
      });
    });
  });

  root.querySelectorAll("[data-save-reanticipation]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-save-reanticipation");
      const row = root.querySelector(`[data-reanticipation-scale="${id}"]`);
      const chosenDot = row.querySelector(".scale-dot.chosen");
      if (!chosenDot) {
        toast("Choisis un niveau de difficulté");
        return;
      }
      store.updatePredictionDifficulte(id, parseInt(chosenDot.getAttribute("data-scale-value"), 10));
      toast("Enregistré");
      pendingReanticipationId = null;
      renderVerifAttentesConsult(root);
    });
  });

  root.querySelectorAll("[data-skip-reanticipation]").forEach(btn => {
    btn.addEventListener("click", () => {
      pendingReanticipationId = null;
      renderVerifAttentesConsult(root);
    });
  });
}

// Journal — "Le journal du soir" / "Le fil de tes soirs" (v0.56, texte v0.63, consultation v0.76).
// Deux noms distincts pour deux moments distincts, tous deux repris mot pour mot du cahier des
// charges : "Le journal du soir" au moment de nommer (le geste quotidien), "Le fil de tes soirs" à
// la consultation (relire, sans but autre que de se souvenir) — pas un écart, les deux titres sont
// bien précisés séparément dans le texte source (v0.63 puis v0.76).
function renderSoirAjouter(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">Le journal du soir</h3>
      <div class="body-copy">
        <p>Avant de fermer la journée, prends un instant.</p>
        <p>Quelles émotions as-tu traversées aujourd'hui ? Une colère, une joie, une peur, une tristesse, un dégoût, une surprise... ou plusieurs à la fois.</p>
        <p>Nomme-les, simplement. Tu n'as rien d'autre à en faire.</p>
        <p>Ce que tu as nommé aujourd'hui a moins de raisons de revenir cette nuit.</p>
      </div>
      <textarea class="field" id="soirInput" placeholder="Écris ici…"></textarea>
      <button class="btn-primary" data-add>Noter</button>
      <button class="btn-secondary" data-consult>Voir le fil de tes soirs</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-consult]").addEventListener("click", () => navigate("#/journal/fil-soirs/consulter"));
  root.querySelector("[data-add]").addEventListener("click", () => {
    const input = root.querySelector("#soirInput");
    const text = input.value.trim();
    if (!text) return;
    store.addSoir(text);
    toast("Noté");
    navigate("#/journal/fil-soirs/consulter");
  });
}

// "Hier soir" / "Avant-hier soir" / "Il y a X soirs", repris tel quel de l'écran témoin validé
// (design/ecrans-journal.html, écran 6) — "Ce soir" ajouté pour le cas non illustré dans la maquette
// (une entrée notée puis relue le jour même).
function libelleSoir(iso) {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (jours <= 0) return "Ce soir";
  if (jours === 1) return "Hier soir";
  if (jours === 2) return "Avant-hier soir";
  return `Il y a ${jours} soirs`;
}

function renderFilSoirsConsult(root) {
  const entries = store.getSoirs();
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">Le fil de tes soirs</h3>
      <div class="body-copy">
        <p>Voici les soirs que tu as traversés, l'un après l'autre.</p>
        <p>Relis-les si tu en as envie, sans autre but que de te souvenir.</p>
      </div>
      ${entries.length === 0
        ? `<div class="empty-state">Rien à relire pour l'instant.</div>`
        : entries.map(e => `
          <div class="entry-row"><div class="date">${libelleSoir(e.date)}</div><div class="txt">${escapeHtml(e.text)}</div></div>
        `).join("")
      }
      <div class="spacer"></div>
      <button class="btn-primary" data-add>Noter ce soir</button>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-add]").addEventListener("click", () => navigate("#/journal/fil-soirs"));
}

// Journal — "Le bilan auto-écrit" (v0.63). Rassemble l'entrée la plus ancienne encore disponible
// dans tout le Journal (compliment, déclencheur, soir nommé, prédiction non encore vérifiée, ou un
// bilan déjà écrit) — chaque entrée ne sert d'amorce qu'une fois (store.markBilanRefUsed), pour que
// le recul grandisse naturellement à chaque nouveau bilan plutôt que de rejouer toujours la même.
function getBilanCandidats() {
  const used = new Set(store.getBilanUsedRefs());
  const candidats = [];
  store.getCompliments().forEach(e => candidats.push({ ref: "compliments:" + e.date, text: e.text, date: e.date }));
  store.getDeclencheurs().forEach(e => candidats.push({ ref: "declencheurs:" + e.id, text: e.text, date: e.date }));
  store.getSoirs().forEach(e => candidats.push({ ref: "soirs:" + e.date, text: e.text, date: e.date }));
  store.getBilans().forEach(e => candidats.push({ ref: "bilans:" + e.date, text: e.text, date: e.date }));
  store.getPredictions().filter(p => !p.verified).forEach(p => candidats.push({ ref: "predictions:" + p.id, text: p.text, date: p.date }));
  return candidats
    .filter(c => !used.has(c.ref))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function renderBilan(root) {
  const dispo = getBilanCandidats();
  const amorce = dispo.length > 0 ? dispo[0] : null;

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">Le bilan auto-écrit</h3>
      ${amorce ? `
        <div class="body-copy">
          <p>${departPhraseJours(amorce.date)}, tu as écrit :</p>
        </div>
        <div class="quote-block">« ${escapeHtml(amorce.text)} »</div>
        <div class="body-copy"><p>Qu'est-ce que tu remarques, en le relisant aujourd'hui ?</p></div>
      ` : `
        <div class="body-copy">
          <p>C'est la première fois que tu ouvres cet espace.</p>
          <p>Ce que tu écris aujourd'hui, tu pourras le relire plus tard — comme un point de départ.</p>
          <p>Qu'est-ce qui t'amène ici, en ce moment ?</p>
        </div>
      `}
      <textarea class="field" id="bilanInput" placeholder="Écris ici…"></textarea>
      <button class="btn-primary" data-add>Écrire</button>
      <div class="spacer"></div>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-add]").addEventListener("click", () => {
    const input = root.querySelector("#bilanInput");
    const text = input.value.trim();
    if (!text) return;
    if (amorce) store.markBilanRefUsed(amorce.ref);
    store.addBilan(text);
    toast("Écrit — tu pourras le relire plus tard");
    navigate("#/journal");
  });
}

// Auto-évaluation de progression (v1.73) — point 1 du volet clinique de la relecture bêta-testeur
// (v1.63). 5 items repris des grands axes déjà couverts par les modules de l'app elle-même (pas un
// instrument clinique existant reformulé : aucune ambiguïté de droit d'auteur, et vocabulaire déjà
// cohérent avec le reste de l'app). Échelle en mots, jamais un chiffre — décision déjà actée avec
// Johan (structure et texte d'intro validés tels quels, cf. cahier des charges v1.73).
//
// Tout le texte ci-dessous (titre, intro, 5 items, échelle, écrans de résultat) validé tel quel par
// Johan en v1.94 — resté en file d'attente depuis la v1.73 (structure approuvée, texte jamais
// retravaillé point par point), repris et validé sans aucune modification.
const AUTOEVAL_ITEMS = [
  { id: "tension", label: "Tension dans le corps" },
  { id: "ruminations", label: "Pensées qui reviennent en boucle, difficiles à arrêter" },
  { id: "calme", label: "Facilité à retrouver ton calme quand tu en as besoin" },
  { id: "irritabilite", label: "Irritabilité, sensation d'être à fleur de peau" },
  { id: "catastrophe", label: "Peur qu'un événement grave arrive" }
];
const AUTOEVAL_SCALE = [
  { id: "pas-vraiment", label: "Pas vraiment" },
  { id: "un-peu", label: "Un peu" },
  { id: "beaucoup", label: "Beaucoup" }
];

function renderAutoEval(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">Faire le point</h3>
      <div class="body-copy">
        <p>Faire le point, de temps en temps. Rien à réussir ici, pas de note, pas de comparaison avec qui que ce soit — juste un instantané de comment tu te sens, pour toi seul·e.</p>
      </div>
      ${AUTOEVAL_ITEMS.map(item => `
        <div class="autoeval-item">
          <div class="field-lbl">${escapeHtml(item.label)}</div>
          <div class="chip-row" data-autoeval-row="${item.id}">
            ${AUTOEVAL_SCALE.map(s => `<button class="chip" data-autoeval-choice="${s.id}">${escapeHtml(s.label)}</button>`).join("")}
          </div>
        </div>
      `).join("")}
      <button class="btn-primary" data-save>Enregistrer</button>
      <div class="spacer"></div>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));

  root.querySelectorAll("[data-autoeval-row]").forEach(row => {
    row.querySelectorAll("[data-autoeval-choice]").forEach(btn => {
      btn.addEventListener("click", () => {
        row.querySelectorAll("[data-autoeval-choice]").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
      });
    });
  });

  root.querySelector("[data-save]").addEventListener("click", () => {
    const previous = store.getAutoEvalEntries()[0] || null;
    const answers = {};
    let allAnswered = true;
    AUTOEVAL_ITEMS.forEach(item => {
      const row = root.querySelector(`[data-autoeval-row="${item.id}"]`);
      const chosen = row.querySelector(".chip.on");
      if (!chosen) { allAnswered = false; return; }
      answers[item.id] = chosen.getAttribute("data-autoeval-choice");
    });
    if (!allAnswered) {
      toast("Réponds à chaque ligne pour enregistrer");
      return;
    }
    store.addAutoEvalEntry(answers);
    renderAutoEvalResultat(root, previous, answers);
  });
}

// Comparaison strictement factuelle avec la dernière fois (pas de tendance ni de moyenne calculée) —
// même logique de "fait constaté, jamais un jugement" que la boucle de reconnaissance factuelle
// (v1.70). Rien à comparer la toute première fois : simple message de clôture.
function renderAutoEvalResultat(root, previous, answers) {
  const scaleLabel = (id) => AUTOEVAL_SCALE.find(s => s.id === id).label;

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Journal</button></div>
      <h3 class="title title-md">Faire le point</h3>
      ${previous ? `
        <div class="body-copy"><p>Voilà, c'est noté. Voici ce qui a changé depuis la dernière fois :</p></div>
        ${AUTOEVAL_ITEMS.filter(item => previous.answers[item.id]).map(item => `
          <div class="entry-row">
            <div class="date">${escapeHtml(item.label)}</div>
            <div class="txt">La dernière fois, tu avais dit <strong>${escapeHtml(scaleLabel(previous.answers[item.id]))}</strong> — aujourd'hui, <strong>${escapeHtml(scaleLabel(answers[item.id]))}</strong>.</div>
          </div>
        `).join("")}
      ` : `
        <div class="body-copy">
          <p>Voilà, c'est noté.</p>
          <p>La prochaine fois que tu feras le point, tu pourras voir ce qui a changé depuis aujourd'hui.</p>
        </div>
      `}
      <div class="spacer"></div>
      <button class="btn-primary" data-done>Retour au Journal</button>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/journal"));
  root.querySelector("[data-done]").addEventListener("click", () => navigate("#/journal"));
}

function render__journal(root, params) {
  if (!params.section) {
    renderHome(root);
  } else if (params.section === "auto-eval") {
    renderAutoEval(root);
  } else if (params.section === "bilan") {
    renderBilan(root);
  } else if (params.section === "compliments" && params.sub === "consulter") {
    renderComplimentsConsult(root);
  } else if (params.section === "compliments") {
    renderComplimentsAdd(root);
  } else if (params.section === "declencheurs" && params.sub === "consulter") {
    renderDeclencheursConsult(root);
  } else if (params.section === "declencheurs") {
    renderDeclencheursAdd(root);
  } else if (params.section === "verif-attentes" && params.sub === "consulter") {
    // v1.88 : on repart d'un état propre à chaque arrivée fraîche sur cet écran (depuis le menu, un
    // retour, ou le lien "Vérifier" de l'échelle d'exposition) — la proposition de ré-estimation ne
    // doit jamais réapparaître au hasard d'une navigation ultérieure ; elle ne vit que le temps d'un
    // aller-retour direct après l'enregistrement d'une tentative (cf. renderVerifAttentesConsult).
    pendingReanticipationId = null;
    renderVerifAttentesConsult(root);
  } else if (params.section === "verif-attentes") {
    renderVerifAttentesAjouter(root);
  } else if (params.section === "fil-soirs" && params.sub === "consulter") {
    renderFilSoirsConsult(root);
  } else if (params.section === "fil-soirs") {
    renderSoirAjouter(root);
  } else {
    renderHome(root);
  }
}

const JournalScreen = { render: render__journal };

/* ---- js/screens/recherche.js ---- */
// Recherche (v1.67), point A8 de la relecture bêta-testeur (v1.63) : un champ de recherche texte
// libre pour retrouver rapidement un outil ou un module, plutôt que de devoir parcourir les 4
// catégories de l'accueil ou déplier les axes de "Comprendre" un par un. Portée validée par Johan
// (cahier des charges v1.67) : les 28 outils/modules des 4 catégories (js/data/grid.js, `categories`)
// et les 5 entrées du Journal (`journalMenu`) — pas la page des fondements ni le flux détresse, qui
// ne sont pas des destinations qu'on "cherche" de la même façon.
//
// Comparaison insensible à la casse ET aux accents (normalizeSearch) : beaucoup de titres de modules
// sont volontairement longs et riches en accents ("anxiété", "cœur", "évite"...) — taper sans accent
// sur un clavier mobile est courant et ne doit pas empêcher de trouver un résultat.

function normalizeSearch(str) {
  return String(str)
    .replace(/œ/g, "oe").replace(/Œ/g, "Oe") // "cœur" doit se trouver en tapant "coeur" (v1.67)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function buildSearchIndex() {
  const items = [];
  categories.forEach(cat => {
    cat.tools.forEach(t => {
      items.push({ name: t.name, route: t.route, section: cat.name, live: t.live });
    });
  });
  journalMenu.forEach(j => {
    items.push({ name: j.name, route: j.route, section: "Mon journal", live: j.live });
  });
  return items;
}

const searchIndex = buildSearchIndex();

function renderSearchResultsHtml(query) {
  const q = normalizeSearch(query.trim());
  if (!q) {
    return `<div class="search-hint">Tape le nom d'un outil ou d'un module pour le retrouver — pas besoin des accents.</div>`;
  }
  const matches = searchIndex.filter(it => normalizeSearch(it.name).includes(q));
  if (matches.length === 0) {
    return `<div class="search-hint">Aucun résultat pour « ${escapeHtml(query.trim())} ».</div>`;
  }
  return matches.map(it => `
    <button class="menu-row ${it.live ? "" : "disabled"}" ${it.live ? `data-route="${it.route}"` : "disabled"}>
      <div><div class="t">${escapeHtml(it.name)}</div><div class="d">${escapeHtml(it.section)}${it.live ? "" : " — à venir"}</div></div>
      <div class="chev">›</div>
    </button>
  `).join("");
}

function wireSearchResults(root) {
  root.querySelectorAll("#searchResults [data-route]").forEach(b => {
    b.addEventListener("click", () => navigate(b.getAttribute("data-route")));
  });
}

function render__recherche(root) {
  root.innerHTML = `
    <div class="screen">
      ${backRow("Accueil")}
      <h1 class="title title-sm">Rechercher</h1>
      <input class="field" type="search" id="searchInput" placeholder="Nom d'un outil, d'un module…" autocomplete="off" aria-label="Rechercher un outil ou un module">
      <div class="search-results" id="searchResults">${renderSearchResultsHtml("")}</div>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/"));
  wireSearchResults(root);

  const input = root.querySelector("#searchInput");
  const resultsEl = root.querySelector("#searchResults");
  input.addEventListener("input", () => {
    resultsEl.innerHTML = renderSearchResultsHtml(input.value);
    wireSearchResults(root);
  });

  // Focus direct (v1.67) : cet écran n'a qu'une seule action possible en y arrivant, autant y placer
  // le clavier tout de suite plutôt que d'attendre un premier tap sur le champ.
  input.focus();
}

const RechercheScreen = { render: render__recherche };

/* ---- js/screens/parametres.js ---- */
// Écran "Paramètres" (v1.75) — nouveau, créé pour porter l'export de données (point A1 de l'avis
// bêta-testeur, v1.63 : "perte de données au changement d'appareil"). Aucun écran de réglages
// n'existait jusqu'ici dans l'app ; celui-ci pourra accueillir d'autres réglages plus tard (mode
// sombre, etc.) si Johan le souhaite — décision de Johan (v1.75) plutôt que de loger l'export dans le
// Journal ou "Mes ressources".
//
// v1.80 : ajout du réglage "Numéros d'urgence" (pays) — point A6 de l'avis bêta-testeur de Claude
// (v1.63), décision de Johan (v1.80) de loger ce choix ici plutôt qu'à l'onboarding ou par détection
// automatique de la locale. Cf. js/data/urgences.js pour le détail des numéros par pays et les
// sources ; cahier des charges v1.80 pour l'ambiguïté relevée côté Belgique et le texte encore en
// attente de relecture par Johan pour la Belgique/Suisse/Québec.
//
// v1.82 : lien vers la page "Les fondements de ViaCalma" — chantier resté en attente depuis v1.12
// faute de système de menu ; logé ici plutôt que de construire un menu séparé pour l'occasion, même
// logique que les deux réglages précédents.

function render__parametres(root) {
  const currentPays = store.getPays();
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Accueil</button></div>
      <h3 class="title title-md">Paramètres</h3>
      <div class="body-copy">
        <p>Tes données restent uniquement sur cet appareil — rien n'est jamais envoyé ailleurs.</p>
        <p>Si tu changes de téléphone, ou que tu réinstalles l'app, sans sauvegarde, tout serait perdu. Tu peux exporter une copie de ce que tu as écrit, à conserver de ton côté.</p>
      </div>
      <button class="btn-primary" data-export>Exporter mes données</button>

      <div class="spacer"></div>
      <div class="cat-section">
        <h2>Numéros d'urgence</h2>
        <div class="body-copy">
          <p>Le bouton "Moment difficile" affiche un numéro de prévention du suicide et un numéro d'urgence vitale. Choisis ton pays pour qu'ils soient adaptés.</p>
        </div>
        ${PAYS_URGENCE.map(p => `
          <button class="option ${p.id === currentPays ? "chosen" : ""}" data-pays-option data-pays="${p.id}">
            <div class="h"><span class="ic">●</span>${escapeHtml(p.label)}</div>
          </button>
        `).join("")}
      </div>

      <div class="spacer"></div>
      <div class="cat-section">
        <h2>À propos</h2>
        <button class="option" data-route="#/fondements">
          <div class="h"><span class="ic">●</span>Les fondements de ViaCalma</div>
          <div class="d">Pourquoi cette app est construite comme elle l'est, et les recherches sur lesquelles elle s'appuie.</div>
        </button>
      </div>

      <div class="spacer"></div>
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/"));
  root.querySelector("[data-route]").addEventListener("click", (e) => navigate(e.currentTarget.getAttribute("data-route")));
  root.querySelector("[data-export]").addEventListener("click", () => {
    const payload = store.exportAllData();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `viacalma-export-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Export téléchargé");
  });

  root.querySelectorAll("[data-pays-option]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-pays");
    store.setPays(id);
    root.querySelectorAll("[data-pays-option]").forEach(o => o.classList.toggle("chosen", o.getAttribute("data-pays") === id));
    toast(`Numéros mis à jour pour : ${getPaysUrgence(id).label}`);
  }));
}

const ParametresScreen = { render: render__parametres };

/* ---- js/screens/fondements.js ---- */
// Page "Les fondements de ViaCalma" (v1.82) — chantier resté en attente depuis v1.12 : texte
// entièrement rédigé et validé par Johan (cahier des charges), jamais construit dans l'app faute de
// menu pour y accéder. Accessible depuis "Paramètres" (v1.82) — pas de système de menu séparé
// construit pour l'occasion, cohérent avec le choix déjà fait d'y loger l'export de données (v1.75)
// et les numéros d'urgence (v1.80) plutôt que d'ouvrir ce chantier séparé.
//
// Structure en 3 écrans (niveaux), reprenant la structure à 3 niveaux déjà actée dans le cahier des
// charges (v0.64/v0.66) : introduction (voie centrale, lue en entier), regroupement thématique (voie
// périphérique, lecture rapide), liste complète des références (pour qui veut vérifier dans le
// détail) — navigation simple, un écran à la fois, pas de glisser (contenu bien plus court qu'un
// module de psychoéducation, l'aller-retour au clic suffit).

function renderIntro(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Paramètres</button></div>
      <h3 class="title title-md">Les fondements de ViaCalma</h3>
      <div class="subtitle">Pourquoi cette app est construite comme elle l'est</div>
      ${FONDEMENTS_INTRO.map(section => `
        <div class="body-copy" style="margin-bottom: 18px;">
          <p style="font-weight: 700; color: var(--ink); margin-bottom: 6px;">${escapeHtml(section.title)}</p>
          ${section.body.map(p => `<p>${escapeHtml(p)}</p>`).join("")}
        </div>
      `).join("")}
      <button class="btn-primary" data-next>Voir les grands thèmes</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/parametres"));
  root.querySelector("[data-next]").addEventListener("click", () => navigate("#/fondements/themes"));
}

function renderThemes(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Les fondements</button></div>
      <h3 class="title title-md">Les grands thèmes</h3>
      <div class="subtitle">Quelques chercheurs clés derrière chaque thème</div>
      ${FONDEMENTS_THEMES.map(t => `
        <div class="cat-section">
          <h2>${escapeHtml(t.title)}</h2>
          <div class="body-copy"><p>${escapeHtml(t.body)}</p></div>
          <div class="usage-note">D'après ${escapeHtml(t.authors)}.</div>
        </div>
      `).join("")}
      <div class="usage-note">${escapeHtml(FONDEMENTS_PRECISION)}</div>
      <button class="btn-primary" data-next>Voir la liste complète des références</button>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/fondements"));
  root.querySelector("[data-next]").addEventListener("click", () => navigate("#/fondements/references"));
}

function renderReferences(root) {
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Les grands thèmes</button></div>
      <h3 class="title title-md">Toutes les références</h3>
      <div class="subtitle">${FONDEMENTS_REFERENCES.length} références, par ordre alphabétique</div>
      <div class="fondements-ref-list">
        ${FONDEMENTS_REFERENCES.map(r => `
          <div class="fondements-ref">
            <span class="fondements-ref-name">${escapeHtml(r.ref)}</span>
            <span class="fondements-ref-concept">${escapeHtml(r.concept)}</span>
          </div>
        `).join("")}
      </div>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => navigate("#/fondements/themes"));
}

function render__fondements(root, params) {
  if (params.step === "themes") { renderThemes(root); return; }
  if (params.step === "references") { renderReferences(root); return; }
  renderIntro(root);
}

const FondementsScreen = { render: render__fondements };

/* ---- js/screens/detresse.js ---- */
// Flux du bouton central / gestion de la détresse (v0.2, révisé v0.15-v0.16,
// message de cadrage finalisé v0.67, mockup ecran-bouton-central.html, v1.12).
// Tous les textes visibles sont repris mot pour mot du cahier des charges.
// Minuterie d'avancement automatique, tap pour continuer plus vite, et
// omission de la "rotation" entre plusieurs outils (un seul outil réellement
// en ligne pour l'instant) : choix d'implémentation de Claude, à confirmer.

let detresseTimer = null;
function clearDetresseTimer() {
  if (detresseTimer) clearTimeout(detresseTimer);
  detresseTimer = null;
}

// Bannière de numéros d'urgence (v1.80) — texte adapté au pays choisi dans Paramètres (défaut :
// France, comportement inchangé pour qui ne touche jamais ce réglage). Remplace les 3 blocs
// identiques auparavant écrits en dur avec les numéros français uniquement. Cf. js/data/urgences.js.
function renderEmergencyStrip(withNom) {
  const pays = getPaysUrgence(store.getPays());
  return `
      <div class="emergency-strip">
        <div class="lbl">Besoin d'aide tout de suite ?</div>
        <div class="txt">${formatUrgenceText(pays, withNom)}</div>
      </div>`;
}

function pickHistoryRedirect() {
  const eligibleCatIds = ["je-respire", "je-mancre"];
  const rated = [];
  categories.filter(c => eligibleCatIds.includes(c.id)).forEach(cat => {
    cat.tools.forEach(t => {
      if (t.live) {
        const n = store.getFavoris(t.id);
        if (n > 0) rated.push({ tool: t, n });
      }
    });
  });
  rated.sort((a, b) => b.n - a.n);
  return rated.length > 0 ? rated[0].tool : null;
}

function renderCadrage(root) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearDetresseTimer();
    navigate("#/detresse/redirection");
  };

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Accueil</button></div>
      <div class="framing-box" data-advance>
        <p>Tu es là, maintenant — et tu as fait le geste de venir chercher de l'aide. C'est déjà beaucoup.</p>
        <p><strong>Fais-toi confiance.</strong> <strong>Ça va passer.</strong> Je vais t'accompagner avec un outil pour t'aider à retrouver ton calme.</p>
      </div>
      <div class="tap-hint" data-advance>toucher pour continuer</div>
      <div class="spacer"></div>
      ${renderEmergencyStrip(true)}
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", (e) => {
    e.stopPropagation();
    done = true;
    clearDetresseTimer();
    navigate("#/");
  });
  root.querySelectorAll("[data-advance]").forEach(el => el.addEventListener("click", finish));
  detresseTimer = setTimeout(finish, 5000);
}

function renderRedirection(root) {
  const tool = pickHistoryRedirect();
  const hasHistory = !!tool;
  const target = hasHistory ? `#/outil/${tool.id}` : "#/detresse/respiration-accueil";

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearDetresseTimer();
    navigate(target);
  };

  // Message vocal personnel (v1.64) : s'il existe, on le propose en priorité, avant la
  // redirection automatique habituelle — décision de Johan, cahier des charges v1.64. Contrairement
  // au reste de cet écran, PAS d'avance automatique sur minuteur ici : un message de 30 secondes
  // coupé net par un minuteur de 3,2s irait à l'encontre de l'objectif (le laisser vraiment écouter).
  const message = store.getMessageVocal();
  if (message) {
    root.innerHTML = `
      <div class="screen">
        <div class="back-row"><button class="back" data-back>‹ Accueil</button></div>
        <h3 class="title title-md">Ton message pour toi</h3>
        <div class="subtitle">Le message que tu avais enregistré pour ce genre de moment.</div>
        <div class="detresse-mv-card">
          <div class="lbl">Ton message</div>
          <audio class="mv-audio" controls src="${message.dataUrl}"></audio>
        </div>
        <button class="btn-primary" data-continue>Continuer</button>
        <div class="mv-rerecord-link"><a href="#/outil/phrase-confiance" data-rerecord>Ce message ne te parle plus ? Tu pourras en enregistrer un autre, à un moment plus calme.</a></div>
        <div class="spacer"></div>
        ${renderEmergencyStrip(false)}
      </div>
    `;
    root.querySelector("[data-back]").addEventListener("click", (e) => {
      e.stopPropagation();
      done = true;
      navigate("#/");
    });
    root.querySelector("[data-continue]").addEventListener("click", finish);
    root.querySelector("[data-rerecord]").addEventListener("click", (e) => {
      e.preventDefault();
      done = true;
      navigate("#/outil/phrase-confiance");
    });
    return;
  }

  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Accueil</button></div>
      <h3 class="title title-md">Redirection automatique</h3>
      <div class="subtitle">${hasHistory
        ? "L'app alterne parmi tes 2-3 outils les mieux notés."
        : "Aucune étoile notée encore — c'est la respiration d'accueil qui prend le relais."}</div>
      <div class="detresse-card" data-advance>
        <div class="lbl">Tu es dirigé·e vers</div>
        <div class="t">${hasHistory ? escapeHtml(tool.name) : "L'exercice de respiration d'onboarding"}</div>
        <div class="d">${hasHistory
          ? "l'un de tes outils les mieux notés — un choix déjà fait par toi, dans un moment plus calme, pour ne pas avoir à en faire un nouveau maintenant."
          : "le même que celui du tout premier écran de l'app — un repère déjà connu, même si c'est la première fois que la détresse te fait chercher de l'aide ici."}</div>
      </div>
      <div class="tap-hint" data-advance>toucher pour continuer</div>
      <div class="spacer"></div>
      ${renderEmergencyStrip(false)}
    </div>
  `;

  root.querySelector("[data-back]").addEventListener("click", (e) => {
    e.stopPropagation();
    done = true;
    clearDetresseTimer();
    navigate("#/");
  });
  root.querySelectorAll("[data-advance]").forEach(el => el.addEventListener("click", finish));
  detresseTimer = setTimeout(finish, 3200);
}

function renderRespirationAccueil(root) {
  const step = onboardingSteps.find(s => s.id === "respiration");
  root.innerHTML = `
    <div class="screen">
      <div class="back-row"><button class="back" data-back>‹ Accueil</button></div>
      <div class="breath-wrap"><div class="breath-circle"><span class="breath-label" id="breathLabel">Inspire</span></div></div>
      <div class="body-copy">
        ${step.body.map(p => `<p>${p}</p>`).join("")}
        <p class="closing">${step.closing}</p>
      </div>
      <div class="spacer"></div>
    </div>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => {
    stopBreathAnim();
    navigate("#/");
  });
  startBreathAnim(root);
}

function render__detresse(root, params) {
  clearDetresseTimer();
  stopBreathAnim();
  if (params.step === "redirection") { renderRedirection(root); return; }
  if (params.step === "respiration-accueil") { renderRespirationAccueil(root); return; }
  renderCadrage(root);
}

function cleanup__detresse() {
  clearDetresseTimer();
  stopBreathAnim();
}

const DetresseScreen = { render: render__detresse, cleanup: cleanup__detresse };

/* ---- js/screens/splash.js ---- */
// Écran de lancement — "Cette application vous est proposée par :" + logo de Johan.
// S'affiche à chaque lancement de l'application (chargement de la page),
// avant l'écran normal (onboarding ou accueil selon l'état du stockage local).

function render__splash(root, onDone) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    onDone();
  };

  root.innerHTML = `
    <div class="splash-screen" data-splash>
      <div class="splash-credit">Cette application vous est proposée par&nbsp;:</div>
      <img class="splash-logo" src="assets/logo-johan-raiz.png" alt="Johan Raiz, psychologue">
      <div class="splash-hint">toucher pour continuer</div>
    </div>
  `;

  root.querySelector("[data-splash]").addEventListener("click", finish);
  const timer = setTimeout(finish, 2600);
}

const SplashScreen = { render: render__splash };

/* ---- js/app.js ---- */
const root = document.getElementById("app");
let currentScreen = null;

const routes = [
  { pattern: /^\/onboarding\/?(\d+)?$/, screen: OnboardingScreen, params: m => ({ step: m[1] }) },
  { pattern: /^\/module\/([a-z0-9-]+)\/(\d+)$/, screen: ModuleScreen, params: m => ({ slug: m[1], index: m[2] }) },
  { pattern: /^\/module\/([a-z0-9-]+)$/, screen: ModuleScreen, params: m => ({ slug: m[1] }) },
  { pattern: /^\/outil\/([a-z0-9-]+)\/([a-z0-9]+)$/, screen: OutilScreen, params: m => ({ slug: m[1], step: m[2] }) },
  { pattern: /^\/outil\/([a-z0-9-]+)$/, screen: OutilScreen, params: m => ({ slug: m[1] }) },
  { pattern: /^\/journal\/([a-z0-9-]+)\/([a-z0-9-]+)$/, screen: JournalScreen, params: m => ({ section: m[1], sub: m[2] }) },
  { pattern: /^\/journal\/([a-z0-9-]+)$/, screen: JournalScreen, params: m => ({ section: m[1] }) },
  { pattern: /^\/journal\/?$/, screen: JournalScreen, params: () => ({}) },
  { pattern: /^\/categorie\/([a-z0-9-]+)$/, screen: CategoryScreen, params: m => ({ id: m[1] }) },
  { pattern: /^\/detresse\/?([a-z-]+)?$/, screen: DetresseScreen, params: m => ({ step: m[1] }) },
  { pattern: /^\/recherche\/?$/, screen: RechercheScreen, params: () => ({}) },
  { pattern: /^\/parametres\/?$/, screen: ParametresScreen, params: () => ({}) },
  { pattern: /^\/fondements\/([a-z]+)$/, screen: FondementsScreen, params: m => ({ step: m[1] }) },
  { pattern: /^\/fondements\/?$/, screen: FondementsScreen, params: () => ({}) },
  { pattern: /^\/?$/, screen: HomeScreen, params: () => ({}) }
];

function resolveRoute() {
  let hash = window.location.hash.replace(/^#/, "");
  if (!hash) hash = "/";

  if (!store.onboardingDone() && !hash.startsWith("/onboarding")) {
    window.location.hash = "#/onboarding/0";
    return null;
  }

  for (const route of routes) {
    const m = hash.match(route.pattern);
    if (m) return { screen: route.screen, params: route.params(m) };
  }
  return { screen: HomeScreen, params: {} };
}

function renderRoute() {
  const resolved = resolveRoute();
  if (!resolved) return; // redirection en cours

  if (currentScreen && typeof currentScreen.cleanup === "function") {
    currentScreen.cleanup();
  }
  currentScreen = resolved.screen;
  window.scrollTo(0, 0);
  resolved.screen.render(root, resolved.params);
  // Bouton discret de retour à l'accueil (v1.58) : partout sauf sur l'accueil lui-même (inutile) et
  // pendant l'onboarding (parcours de configuration initiale, pas encore de "chez soi" à rejoindre —
  // et onboardingDone n'étant pas encore posé, un clic y ramènerait de toute façon aussitôt).
  if (resolved.screen !== HomeScreen && resolved.screen !== OnboardingScreen) {
    injectHomeLink(root);
  }
}

// Bug trouvé pendant les tests de "J'écris, je m'en libère" (v1.44) : le splash appelle renderRoute
// en callback après son propre délai interne. Si un hashchange survenait entre-temps (rare en usage
// réel, le splash bloque l'interaction, mais possible via un lien profond ou en tests automatisés),
// ce callback rejouait un rendu de la route COURANTE par-dessus l'écran déjà affiché — remettant par
// exemple le minuteur de l'exercice d'écriture à zéro sans raison. Un callback dédié, distinct du
// gestionnaire de hashchange normal, ignore ce rendu de rattrapage si un écran a déjà été rendu
// entre-temps — sans jamais bloquer les navigations ultérieures normales (hashchange continue
// d'appeler renderRoute directement, sans passer par ce garde-fou).
function onSplashDone() {
  if (currentScreen) return;
  renderRoute();
}

function boot() {
  function start() {
    SplashScreen.render(root, onSplashDone);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
boot();
window.addEventListener("hashchange", renderRoute);

