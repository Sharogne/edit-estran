// Test de charge du catalogue — hors de cypress/e2e/, donc jamais exécuté par
// `npm run e2e`. Lancement dédié : `npm run perf` (seed de 50 livres + build +
// run). Voir le skill `run-e2e`, section « Test de charge ».
//
// Pourquoi ce test existe : cette variante inline les images dans le HTML. Le
// risque n'est donc pas la base de données, c'est le POIDS DE LA PAGE. Une
// erreur d'une ligne — servir `coverImage` (900 px) au lieu de `coverThumb`
// (320 px) dans les listes — multiplierait le poids par ~8 sans qu'aucun test
// fonctionnel ne bronche. C'est précisément ce que les budgets ci-dessous
// attrapent.
//
// Le seed de charge utilise des images à entropie photographique : l'artwork
// géométrique des autres seeds se compresse ~15 fois mieux qu'une vraie
// couverture et donnerait des mesures flatteuses, donc inutiles.

const NB_LIVRES = 50;
/** Les 50 livres de charge + les 2 livres publiés du seed déterministe. */
const NB_PUBLIES = NB_LIVRES + 2;

/**
 * Budgets. Les valeurs nominales mesurées sont en commentaire ; les seuils
 * gardent de la marge pour ne pas rougir sur une machine plus lente.
 */
const BUDGET = {
  /** Poids total du HTML de la liste, en Ko. Mesuré : ~1600. */
  listeKo: 2500,
  /**
   * Poids image DISTINCT par livre sur la liste, en Ko. Mesuré : ~14.
   * L'assertion qui a des dents : servir `coverImage` (900 px) au lieu de
   * `coverThumb` (320 px) ferait passer ce chiffre à ~115.
   */
  imageParLivreKo: 40,
  /**
   * Apparitions de chaque data URI dans le HTML. Mesuré : 2 — une dans le
   * `<img src>`, une dans la charge utile RSC que Next embarque pour
   * l'hydratation. C'est le prix, documenté, de l'inline : la moitié du poids
   * image de la page est un doublon. Ce budget alerte si ça empire.
   */
  occurrencesParImage: 2,
  /** Réponse serveur de la liste (rendu dynamique + lecture mémoire), en ms. Mesuré : ~210. */
  listeTtfbMs: 1500,
  /** Poids du HTML d'une fiche (recto + verso 900 px inline), en Ko. Mesuré : ~580. */
  ficheKo: 900,
  /**
   * Apparitions de chaque image sur une fiche. Mesuré : 3 pour la couverture —
   * `<img src>`, charge RSC, et un `<link rel="preload">` produit par la prop
   * `priority` de next/image. Précharger une data URI ne sert à rien : les
   * octets sont déjà dans le document. Retirer `priority` de BookCoverFlip
   * économiserait ~110 Ko par fiche.
   */
  occurrencesFiche: 3,
  /** Réponse serveur d'une fiche, en ms. Mesuré : ~70. */
  ficheTtfbMs: 1000,
  /** Chargement complet dans le navigateur, en ms. Mesuré : ~500. */
  chargementMs: 5000,
  /** Plus longue tâche bloquante pendant le défilement, en ms. Mesuré : ~140. */
  longueTacheMs: 500,
  /** Poids du tableau de bord admin (50 vignettes), en Ko. Mesuré : ~1630. */
  adminKo: 2500,
};

const ko = (octets: number) => Math.round(octets / 1024);

/** Décompose la part « images » d'une réponse HTML, doublons compris. */
function analyseImages(html: string) {
  const uris = html.match(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g) ?? [];
  const distinctes = new Set(uris);
  const total = uris.reduce((somme, uri) => somme + uri.length, 0);
  const distinct = [...distinctes].reduce((somme, uri) => somme + uri.length, 0);
  return {
    totalKo: ko(total),
    distinctKo: ko(distinct),
    doublonKo: ko(total - distinct),
    occurrences: distinctes.size ? uris.length / distinctes.size : 0,
    nombre: distinctes.size,
  };
}

const mesures: string[] = [];
function noter(libelle: string, valeur: string) {
  mesures.push(`${libelle.padEnd(34)} ${valeur}`);
  cy.log(`**${libelle}** : ${valeur}`);
}

describe(`Charge du catalogue (${NB_LIVRES} livres)`, () => {
  after(() => {
    // Récapitulatif dans la sortie du run, même quand tout est vert : ces
    // chiffres ne servent à rien s'il faut déplier chaque assertion pour eux.
    cy.task(
      "log",
      `\n  Mesures — ${NB_PUBLIES} livres publiés, images de poids photographique\n` +
        `  ${"─".repeat(58)}\n  ${mesures.join("\n  ")}\n`
    );
  });

  it("a bien le catalogue de charge en place", () => {
    cy.task<string[]>("storedSlugs").should((slugs) => {
      const charge = slugs.filter((slug) => slug.startsWith("perf-livre-"));
      expect(charge, `le seed de charge doit contenir ${NB_LIVRES} livres`).to.have.length(
        NB_LIVRES
      );
    });
  });

  it("sert la liste des projets dans son budget de poids et de temps", () => {
    cy.request("/fr/projets").then((reponse) => {
      const totalKo = ko(reponse.body.length);
      const img = analyseImages(reponse.body);
      const parLivre = img.distinctKo / img.nombre;

      noter("Liste — HTML total", `${totalKo} Ko`);
      noter("Liste — images distinctes", `${img.distinctKo} Ko sur ${img.nombre} images`);
      noter("Liste — doublons RSC", `+${img.doublonKo} Ko`);
      noter("Liste — image par livre", `${parLivre.toFixed(1)} Ko`);
      noter("Liste — réponse serveur", `${reponse.duration} ms`);

      expect(img.nombre, "une miniature par livre publié").to.eq(NB_PUBLIES);
      expect(totalKo, "poids total de la liste").to.be.lessThan(BUDGET.listeKo);
      expect(parLivre, "poids image par livre").to.be.lessThan(BUDGET.imageParLivreKo);
      expect(img.occurrences, "apparitions de chaque image dans le HTML").to.be.at.most(
        BUDGET.occurrencesParImage
      );
      expect(reponse.duration, "réponse serveur").to.be.lessThan(BUDGET.listeTtfbMs);
    });
  });

  it("affiche les 50 livres et reste fluide au défilement", () => {
    cy.visit("/fr/projets", {
      onBeforeLoad(win) {
        // Armé avant le chargement : les tâches longues de l'hydratation et du
        // décodage des images comptent autant que celles du défilement.
        (win as unknown as { __longTasks: number[] }).__longTasks = [];
        new win.PerformanceObserver((liste) => {
          for (const entree of liste.getEntries()) {
            (win as unknown as { __longTasks: number[] }).__longTasks.push(entree.duration);
          }
        }).observe({ entryTypes: ["longtask"] });
      },
    });

    cy.get("[data-cy=projects-grid] [data-cy^=book-card-]").should("have.length", NB_PUBLIES);

    // Défilement complet, puis retour en haut.
    cy.scrollTo("bottom", { duration: 1500 });
    cy.get("[data-cy=projects-grid] [data-cy^=book-card-]").last().should("be.visible");
    cy.scrollTo("top", { duration: 800 });

    cy.window().then((win) => {
      const nav = win.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const taches = (win as unknown as { __longTasks: number[] }).__longTasks;
      const pire = taches.length ? Math.max(...taches) : 0;

      noter("Navigateur — DOMContentLoaded", `${Math.round(nav.domContentLoadedEventEnd)} ms`);
      noter("Navigateur — chargement complet", `${Math.round(nav.loadEventEnd)} ms`);
      noter("Défilement — tâches > 50 ms", `${taches.length}`);
      noter("Défilement — pire tâche", `${Math.round(pire)} ms`);

      expect(nav.loadEventEnd, "chargement complet").to.be.lessThan(BUDGET.chargementMs);
      expect(pire, "plus longue tâche bloquante").to.be.lessThan(BUDGET.longueTacheMs);
    });
  });

  it("garde une fiche livre dans son budget malgré recto et verso inline", () => {
    cy.request("/fr/projets/perf-livre-001").then((reponse) => {
      const totalKo = ko(reponse.body.length);
      const img = analyseImages(reponse.body);

      noter("Fiche — HTML total", `${totalKo} Ko`);
      noter("Fiche — images distinctes", `${img.distinctKo} Ko sur ${img.nombre} images`);
      noter("Fiche — doublons", `+${img.doublonKo} Ko`);
      noter("Fiche — occurrences par image", `${img.occurrences.toFixed(1)}`);
      noter("Fiche — réponse serveur", `${reponse.duration} ms`);

      expect(totalKo, "poids de la fiche").to.be.lessThan(BUDGET.ficheKo);
      expect(img.occurrences, "apparitions de chaque image").to.be.at.most(BUDGET.occurrencesFiche);
      expect(reponse.duration, "réponse serveur").to.be.lessThan(BUDGET.ficheTtfbMs);
    });
  });

  it("garde le tableau de bord admin utilisable avec 50 vignettes", () => {
    cy.login();
    cy.request("/admin").then((reponse) => {
      noter("Admin — HTML total", `${ko(reponse.body.length)} Ko`);
      noter("Admin — réponse serveur", `${reponse.duration} ms`);
      expect(ko(reponse.body.length), "poids du tableau de bord").to.be.lessThan(BUDGET.adminKo);
    });

    cy.visit("/admin");
    // 50 livres de charge + les 3 du seed (2 publiés + 1 brouillon)
    cy.get("[data-cy=admin-book-list] a").should("have.length", NB_LIVRES + 3);
  });
});

export {};
