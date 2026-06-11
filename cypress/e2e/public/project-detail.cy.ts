describe("Fiche projet", () => {
  it("affiche tous les éléments d'un livre publié (FR)", () => {
    cy.visit("/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-title]").should("contain", "Les Jardins suspendus");
    cy.get("[data-cy=project-synopsis]").should("contain", "botaniste");
    cy.get("[data-cy=project-published]").should("be.visible");
    cy.get("[data-cy=project-cover]").should("be.visible");
    // le seed crée 3 pages de preview pour ce livre
    cy.get("[data-cy=project-previews]").within(() => {
      cy.get("[data-cy=project-preview-page]").should("have.length", 3);
    });
    cy.get("[data-cy=project-back]").click();
    cy.url().should("include", "/fr/projets");
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
