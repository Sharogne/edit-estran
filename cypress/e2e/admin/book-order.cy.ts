// L'ordre du catalogue ne se saisit plus dans le formulaire : il se règle au
// glisser-déposer dans le tableau de bord. Deux chemins mènent au même résultat
// et doivent donc être couverts tous les deux — le glisser natif ne fonctionne
// ni au clavier ni au tactile, la poignée est le seul recours.
//
// Ces tests ne créent aucun livre : ils permutent ceux du seed, et le second
// remet l'ordre d'origine.

const JARDINS = "les-jardins-suspendus";
const CARTOGRAPHIE = "cartographie-du-silence";

/** Slugs des livres du tableau de bord, dans l'ordre affiché. */
function ordreAffiche() {
  return cy
    .get("[data-cy=admin-book-list] [data-cy^=admin-book-item-]")
    .then(($items) =>
      [...$items].map((item) => item.getAttribute("data-cy")!.replace("admin-book-item-", ""))
    );
}

/** Glisser natif HTML5 : la logique s'appuie sur l'état React, pas sur dataTransfer. */
function glisser(source: string, cible: string) {
  cy.get(`[data-cy=admin-book-item-${source}]`).trigger("dragstart");
  cy.get(`[data-cy=admin-book-item-${cible}]`).trigger("dragover");
  cy.get(`[data-cy=admin-book-item-${cible}]`).trigger("drop");
  cy.get(`[data-cy=admin-book-item-${source}]`).trigger("dragend");
}

describe("Ordre du catalogue", () => {
  beforeEach(() => {
    cy.login();
  });

  it("part de l'ordre du seed", () => {
    cy.visit("/admin");
    ordreAffiche().should("deep.equal", [JARDINS, CARTOGRAPHIE, "manuscrit-inacheve"]);
  });

  it("réordonne au glisser-déposer et l'écrit dans le contenu", () => {
    cy.visit("/admin");
    glisser(CARTOGRAPHIE, JARDINS);

    ordreAffiche().should("deep.equal", [CARTOGRAPHIE, JARDINS, "manuscrit-inacheve"]);

    // L'affichage optimiste ne suffit pas : le rang doit être persisté.
    cy.storedBook(CARTOGRAPHIE).should((livre) => expect(livre!.sortOrder).to.eq(0));
    cy.storedBook(JARDINS).should((livre) => expect(livre!.sortOrder).to.eq(1));

    // …et se voir sur le catalogue public
    cy.visit("/fr/projets");
    cy.get("[data-cy=projects-grid] [data-cy^=book-card-]").then(($cartes) => {
      const ordre = [...$cartes].map((carte) => carte.getAttribute("data-cy"));
      expect(ordre.indexOf(`book-card-${CARTOGRAPHIE}`)).to.be.lessThan(
        ordre.indexOf(`book-card-${JARDINS}`)
      );
    });

    // L'ordre survit à un rechargement : il vient bien du serveur.
    cy.visit("/admin");
    ordreAffiche().should("deep.equal", [CARTOGRAPHIE, JARDINS, "manuscrit-inacheve"]);
  });

  it("réordonne au clavier depuis la poignée", () => {
    cy.visit("/admin");
    // Remet l'ordre d'origine, cette fois sans souris.
    cy.get(`[data-cy=admin-book-handle-${CARTOGRAPHIE}]`).focus().type("{downarrow}");

    ordreAffiche().should("deep.equal", [JARDINS, CARTOGRAPHIE, "manuscrit-inacheve"]);
    cy.storedBook(JARDINS).should((livre) => expect(livre!.sortOrder).to.eq(0));
    cy.storedBook(CARTOGRAPHIE).should((livre) => expect(livre!.sortOrder).to.eq(1));
  });

  it("ne déplace rien au-delà des bornes de la liste", () => {
    cy.visit("/admin");
    // Le premier ne peut pas monter, le dernier ne peut pas descendre.
    cy.get(`[data-cy=admin-book-handle-${JARDINS}]`).focus().type("{uparrow}");
    cy.get("[data-cy=admin-book-handle-manuscrit-inacheve]").focus().type("{downarrow}");

    ordreAffiche().should("deep.equal", [JARDINS, CARTOGRAPHIE, "manuscrit-inacheve"]);
    cy.get("[data-cy=admin-reorder-error]").should("not.exist");
  });
});

export {};
