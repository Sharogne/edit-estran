describe("Fiche projet", () => {
  it("affiche tous les éléments d'un livre publié (FR)", () => {
    cy.visit("/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-title]").should("contain", "Les Jardins suspendus");
    cy.get("[data-cy=project-synopsis]").should("contain", "botaniste");
    cy.get("[data-cy=project-published]").should("be.visible");
    cy.get("[data-cy=project-cover]").should("be.visible");
    cy.get("[data-cy=project-back]").click();
    cy.url().should("include", "/fr/projets");
  });

  it("retourne la couverture pour montrer le 4e de couverture", () => {
    cy.visit("/fr/projets/les-jardins-suspendus");
    // le seed donne un 4e de couverture à ce livre
    cy.get("[data-cy=project-cover-card]").should("have.attr", "data-face", "front");
    cy.get("[data-cy=project-cover-flip]").click();

    cy.get("[data-cy=project-cover-card]").should("have.attr", "data-face", "back");
    cy.get("[data-cy=project-back-cover]").should("exist");

    // et on revient au recto
    cy.get("[data-cy=project-cover-flip]").click();
    cy.get("[data-cy=project-cover-card]").should("have.attr", "data-face", "front");
  });

  it("expose un contrôle de retournement accessible", () => {
    cy.visit("/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-cover-flip]")
      // un vrai <button> : focusable et activable au clavier par construction
      .should("match", "button")
      .and("have.attr", "aria-pressed", "false")
      .focus()
      .should("have.focus");

    // la face tournée vers l'arrière reste dans le DOM pour l'animation, mais
    // ne doit pas être annoncée par un lecteur d'écran
    cy.get("[data-cy=project-cover]").parent().should("have.attr", "aria-hidden", "false");
    cy.get("[data-cy=project-back-cover]").parent().should("have.attr", "aria-hidden", "true");

    cy.get("[data-cy=project-cover-flip]").click().should("have.attr", "aria-pressed", "true");
    cy.get("[data-cy=project-cover]").parent().should("have.attr", "aria-hidden", "true");
    cy.get("[data-cy=project-back-cover]").parent().should("have.attr", "aria-hidden", "false");
  });

  it("affiche la traduction anglaise", () => {
    cy.visit("/en/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-title]").should("contain", "The Hanging Gardens");
    cy.get("[data-cy=project-synopsis]").should("contain", "botanist");
  });

  it("répond 404 pour un slug inconnu", () => {
    cy.request({ url: "/fr/projets/n-existe-pas", failOnStatusCode: false })
      .its("status")
      .should("eq", 404);
    cy.visit("/fr/projets/n-existe-pas", { failOnStatusCode: false });
    cy.get("[data-cy=not-found-title]").should("be.visible");
    cy.get("[data-cy=not-found-home]").click();
    cy.url().should("match", /\/fr$/);
  });

  it("répond 404 pour un brouillon accédé directement", () => {
    cy.request({ url: "/fr/projets/manuscrit-inacheve", failOnStatusCode: false })
      .its("status")
      .should("eq", 404);
  });
});
