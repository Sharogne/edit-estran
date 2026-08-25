// Référence du seed (scripts/seed-content.ts --e2e) : publiés =
// les-jardins-suspendus, cartographie-du-silence — brouillon = manuscrit-inacheve.

describe("Accueil", () => {
  it("affiche la page d'accueil française par défaut", () => {
    cy.visit("/");
    cy.url().should("include", "/fr");
    cy.get("[data-cy=home-title]").should("contain", "Des livres faits avec soin");
    cy.get("[data-cy=home-hero]").should("be.visible");
    cy.get("[data-cy=home-about]").should("be.visible");
    cy.get("[data-cy=footer]").should("be.visible");
  });

  it("montre les dernières parutions (livres publiés uniquement)", () => {
    cy.visit("/fr");
    cy.get("[data-cy=home-latest]").within(() => {
      cy.get("[data-cy=book-card-les-jardins-suspendus]").should("be.visible");
      cy.get("[data-cy=book-card-cartographie-du-silence]").should("be.visible");
      // Les specs admin créent des livres à slug `cy-…` ; les exclure du compte
      // évite qu'un échec côté admin fasse tomber les specs publiques en cascade,
      // ce qui masquerait la vraie cause.
      cy.get("[data-cy^=book-card-]").not("[data-cy^=book-card-cy-]").should("have.length", 2);
    });
  });

  it("navigue vers les projets via le CTA", () => {
    cy.visit("/fr");
    cy.get("[data-cy=home-cta]").click();
    cy.url().should("include", "/fr/projets");
    cy.get("[data-cy=projects-title]").should("be.visible");
  });

  it("bascule vers l'anglais avec le sélecteur de langue", () => {
    cy.visit("/fr");
    cy.get("[data-cy=locale-switcher-en]").click();
    cy.url().should("include", "/en");
    cy.get("[data-cy=home-title]").should("contain", "Books made with care");
    // retour en français
    cy.get("[data-cy=locale-switcher-fr]").click();
    cy.get("[data-cy=home-title]").should("contain", "Des livres faits avec soin");
  });
});
