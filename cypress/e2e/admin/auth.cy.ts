describe("Authentification admin", () => {
  it("redirige les visiteurs anonymes vers la page de connexion", () => {
    cy.visit("/admin");
    cy.url().should("include", "/admin/login");
    cy.get("[data-cy=login-title]").should("be.visible");

    cy.visit("/admin/livres/nouveau");
    cy.url().should("include", "/admin/login");
  });

  it("refuse des identifiants invalides", () => {
    cy.visit("/admin/login");
    cy.get("[data-cy=login-email]").type(Cypress.env("ADMIN_EMAIL"));
    cy.get("[data-cy=login-password]").type("mauvais-mot-de-passe");
    cy.get("[data-cy=login-submit]").click();
    cy.get("[data-cy=login-error]").should("contain", "Identifiants invalides");
    cy.url().should("include", "/admin/login");
  });

  it("connecte l'éditeur avec les bons identifiants puis le déconnecte", () => {
    cy.visit("/admin/login");
    cy.get("[data-cy=login-email]").type(Cypress.env("ADMIN_EMAIL"));
    cy.get("[data-cy=login-password]").type(Cypress.env("ADMIN_PASSWORD"), { log: false });
    cy.get("[data-cy=login-submit]").click();

    cy.get("[data-cy=admin-dashboard-title]").should("be.visible");
    cy.url().should("match", /\/admin$/);
    // le seed contient 3 livres (2 publiés + 1 brouillon), tous visibles dans l'admin
    cy.get("[data-cy=admin-book-row-les-jardins-suspendus]").should("be.visible");
    cy.get("[data-cy=admin-book-row-manuscrit-inacheve]").should("be.visible");

    cy.get("[data-cy=admin-logout]").click();
    cy.url().should("include", "/admin/login");

    // la session est bien détruite
    cy.visit("/admin");
    cy.url().should("include", "/admin/login");
  });
});
