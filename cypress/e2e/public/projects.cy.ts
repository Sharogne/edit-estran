describe("Liste des projets", () => {
  it("liste uniquement les livres publiés", () => {
    cy.visit("/fr/projets");
    cy.get("[data-cy=projects-grid]").within(() => {
      cy.get("[data-cy=book-card-les-jardins-suspendus]").should("be.visible");
      cy.get("[data-cy=book-card-cartographie-du-silence]").should("be.visible");
      // le brouillon n'apparaît jamais
      cy.get("[data-cy=book-card-manuscrit-inacheve]").should("not.exist");
      // Les specs admin créent des livres à slug `cy-…` ; les exclure du compte
      // évite qu'un échec côté admin fasse tomber les specs publiques en cascade,
      // ce qui masquerait la vraie cause.
      cy.get("[data-cy^=book-card-]").not("[data-cy^=book-card-cy-]").should("have.length", 2);
    });
  });

  it("navigue de la liste vers la fiche d'un livre", () => {
    cy.visit("/fr/projets");
    cy.get("[data-cy=book-card-les-jardins-suspendus]").click();
    cy.url().should("include", "/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-title]").should("contain", "Les Jardins suspendus");
  });

  it("affiche la liste traduite en anglais", () => {
    cy.visit("/en/projets");
    cy.get("[data-cy=book-card-les-jardins-suspendus]").should("contain", "The Hanging Gardens");
    cy.get("[data-cy=nav-projects]").should("contain", "Projects");
  });
});
