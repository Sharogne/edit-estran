// Test de charge du catalogue — hors de cypress/e2e/, donc jamais exécuté par
// `npm run e2e`. Lancement dédié : `npm run perf` (seed de 50 livres + build +
// run). Voir le skill `run-e2e`, section « Test de charge ».
//
// Pourquoi ce test existe : les images de cette variante vivent dans un fichier
// JSON, pas sur un disque. Le risque n'a jamais été la base de données, c'est le
// POIDS DE LA PAGE.
//
// Il a changé de nature. Les couvertures étaient inlinées dans le HTML : chaque
// image y apparaissait deux fois (balise `<img>` et charge utile RSC), la liste
// pesait ~1,6 Mo à 50 livres, et ni le cache navigateur ni le chargement différé
// n'étaient possibles. Elles passent maintenant par /media, qui les décode à la
// volée depuis le contenu déjà en mémoire.
//
// L'assertion qui a des dents est donc devenue : AUCUNE data URI dans le HTML.
// Une régression d'une ligne — repasser une image stockée à un composant au lieu
// de son URL — ramènerait tout le poids d'un coup, sans qu'aucun test
// fonctionnel ne bronche.
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
  /** Poids du HTML de la liste, en Ko. Mesuré : ~99 (~1600 quand les images y étaient). */
  listeKo: 250,
  /** Poids du HTML d'une fiche, en Ko. Mesuré : ~22 (~580 avant). */
  ficheKo: 80,
  /** Poids du tableau de bord admin (50 vignettes), en Ko. Mesuré : ~95 (~1630 avant). */
  adminKo: 250,
  /** Réponse serveur de la liste (rendu dynamique + lecture mémoire), en ms. Mesuré : ~92. */
  listeTtfbMs: 1500,
  /** Réponse serveur d'une fiche, en ms. Mesuré : ~26. */
  ficheTtfbMs: 1000,
  /** Réponse de /media : décodage base64 d'une image déjà en mémoire, en ms. Mesuré : ~28. */
  mediaTtfbMs: 800,
  /** Poids d'une variante carte servie par /media, en Ko. Mesuré : ~42. */
  carteKo: 90,
  /** Poids d'une variante pleine taille, en Ko. Mesuré : ~81. */
  couvertureKo: 180,
  /** Chargement complet dans le navigateur, en ms. Mesuré : ~402. */
  chargementMs: 5000,
  /** Plus longue tâche bloquante pendant le défilement, en ms. Mesuré : ~99. */
  longueTacheMs: 500,
};

const ko = (octets: number) => Math.round(octets / 1024);

const mesures: string[] = [];
function noter(libelle: string, valeur: string) {
  mesures.push(`${libelle.padEnd(34)} ${valeur}`);
  cy.log(`**${libelle}** : ${valeur}`);
}

/** Les URLs /media distinctes citées par une réponse HTML. */
function urlsMedia(html: string): string[] {
  return [...new Set(html.match(/\/media\/[^"'\\ ]+\.webp/g) ?? [])];
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

  it("sert la liste des projets sans une seule image dans le HTML", () => {
    cy.request("/fr/projets").then((reponse) => {
      const totalKo = ko(reponse.body.length);
      const images = urlsMedia(reponse.body);

      noter("Liste — HTML total", `${totalKo} Ko`);
      noter("Liste — images citées", `${images.length}`);
      noter("Liste — réponse serveur", `${reponse.duration} ms`);

      // LE garde-fou : une image inlinée est une image qu'aucun cache ne peut
      // reprendre, et qui pèse deux fois (HTML + charge RSC).
      expect(reponse.body, "aucune image inlinée dans le HTML").to.not.contain("data:image/");
      expect(images, "une carte par livre publié").to.have.length(NB_PUBLIES);
      expect(totalKo, "poids total de la liste").to.be.lessThan(BUDGET.listeKo);
      expect(reponse.duration, "réponse serveur").to.be.lessThan(BUDGET.listeTtfbMs);
    });
  });

  it("sert chaque variante dans son budget de poids et de temps", () => {
    cy.request("/fr/projets").then((liste) => {
      // Une carte du seed de CHARGE, repérée par l'id du livre : les deux livres
      // du seed déterministe ouvrent le catalogue, et leur artwork géométrique se
      // compresse ~15 fois mieux qu'une photographie. Mesurer la première carte
      // venue donnerait donc un chiffre flatteur, et un budget sans dents.
      const carte = urlsMedia(liste.body).find((url) => url.includes("/seed-perf-livre-"));
      expect(carte, "au moins une carte de charge à mesurer").to.be.a("string");

      // L'assertion ci-dessus garantit la présence ; TypeScript ne la lit pas.
      cy.request(carte!).then((reponse) => {
        const poids = ko(reponse.headers["content-length"] as unknown as number);
        noter("Media — variante carte", `${poids} Ko en ${reponse.duration} ms`);
        expect(reponse.headers["content-type"]).to.eq("image/webp");
        expect(reponse.headers["cache-control"], "cache immuable").to.contain("immutable");
        expect(poids, "poids d'une carte").to.be.lessThan(BUDGET.carteKo);
        expect(reponse.duration, "réponse de /media").to.be.lessThan(BUDGET.mediaTtfbMs);
      });
    });

    cy.request("/fr/projets/perf-livre-001").then((fiche) => {
      const couverture = urlsMedia(fiche.body).find((url) => url.includes("/cover-"));
      expect(couverture, "la fiche cite sa couverture pleine taille").to.be.a("string");
      cy.request(couverture!).then((reponse) => {
        const poids = ko(reponse.headers["content-length"] as unknown as number);
        noter("Media — couverture de fiche", `${poids} Ko en ${reponse.duration} ms`);
        expect(poids, "poids d'une couverture").to.be.lessThan(BUDGET.couvertureKo);
      });
    });
  });

  it("garde une fiche livre légère malgré recto et verso", () => {
    cy.request("/fr/projets/perf-livre-001").then((reponse) => {
      const totalKo = ko(reponse.body.length);
      const images = urlsMedia(reponse.body);

      noter("Fiche — HTML total", `${totalKo} Ko`);
      noter("Fiche — images citées", `${images.length}`);
      noter("Fiche — réponse serveur", `${reponse.duration} ms`);

      expect(reponse.body, "aucune image inlinée dans le HTML").to.not.contain("data:image/");
      expect(totalKo, "poids de la fiche").to.be.lessThan(BUDGET.ficheKo);
      expect(reponse.duration, "réponse serveur").to.be.lessThan(BUDGET.ficheTtfbMs);
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
      // Le catalogue a été parcouru de bout en bout, donc tout a fini par se
      // charger : ce chiffre dit le poids réseau d'une visite complète, PAS que
      // le chargement est différé — cette propriété-là se vérifie sur l'attribut
      // `loading` (cypress/e2e/public/media.cy.ts).
      const images = win.performance
        .getEntriesByType("resource")
        .filter((entree) => entree.name.includes("/media/")) as PerformanceResourceTiming[];
      const reseauKo = ko(images.reduce((somme, image) => somme + image.transferSize, 0));

      noter("Navigateur — DOMContentLoaded", `${Math.round(nav.domContentLoadedEventEnd)} ms`);
      noter("Navigateur — chargement complet", `${Math.round(nav.loadEventEnd)} ms`);
      noter("Navigateur — images téléchargées", `${images.length} pour ${reseauKo} Ko`);
      noter("Défilement — tâches > 50 ms", `${taches.length}`);
      noter("Défilement — pire tâche", `${Math.round(pire)} ms`);

      expect(nav.loadEventEnd, "chargement complet").to.be.lessThan(BUDGET.chargementMs);
      expect(pire, "plus longue tâche bloquante").to.be.lessThan(BUDGET.longueTacheMs);
    });
  });

  it("garde le tableau de bord admin utilisable avec 50 vignettes", () => {
    cy.login();
    cy.request("/admin").then((reponse) => {
      noter("Admin — HTML total", `${ko(reponse.body.length)} Ko`);
      noter("Admin — réponse serveur", `${reponse.duration} ms`);
      expect(reponse.body, "aucune image inlinée dans le HTML").to.not.contain("data:image/");
      expect(ko(reponse.body.length), "poids du tableau de bord").to.be.lessThan(BUDGET.adminKo);
    });

    cy.visit("/admin");
    // 50 livres de charge + les 3 du seed (2 publiés + 1 brouillon)
    cy.get("[data-cy=admin-book-list] a").should("have.length", NB_LIVRES + 3);
  });
});

export {};
