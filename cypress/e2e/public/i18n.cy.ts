// « Une clé ajoutée dans l'un DOIT exister dans l'autre » est une convention non
// négociable du projet (AGENTS.md) : jusqu'ici rien ne la vérifiait. Le premier
// test la couvre à la source, les suivants sur le rendu.

describe("Internationalisation", () => {
  it("garde exactement les mêmes clés dans fr.json et en.json", () => {
    cy.task<{ fr: string[]; en: string[] }>("messageKeys").should((cles) => {
      expect(cles.fr, "clés présentes en FR mais pas en EN (et inversement)").to.deep.equal(
        cles.en
      );
    });
  });

  it("bascule de langue en restant sur la même fiche livre", () => {
    cy.visit("/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=locale-switcher-en]").click();
    cy.url().should("include", "/en/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-title]").should("contain", "The Hanging Gardens");

    cy.get("[data-cy=locale-switcher-fr]").click();
    cy.url().should("include", "/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-title]").should("contain", "Les Jardins suspendus");
  });

  it("traduit le libellé du retournement de couverture", () => {
    cy.visit("/en/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-cover-flip]").should("contain", "See the back cover").click();
    cy.get("[data-cy=project-cover-flip]").should("contain", "See the front cover");

    cy.visit("/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-cover-flip]").should("contain", "4e de couverture");
  });
});
