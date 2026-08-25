// Le compte admin ne vit plus en base : il est lu depuis .env
// (ADMIN_EMAIL + ADMIN_PASSWORD_HASH_B64). Ces tests couvrent la garde d'accès.
// Les ids du seed sont déterministes (`seed-<slug>`), d'où l'URL d'édition en dur.

describe("Authentification admin", () => {
  it("protège toutes les pages du back office", () => {
    const pagesProtegees = [
      "/admin",
      "/admin/livres/nouveau",
      "/admin/livres/seed-les-jardins-suspendus",
    ];
    for (const page of pagesProtegees) {
      cy.visit(page);
      cy.url().should("include", "/admin/login");
    }
    cy.get("[data-cy=login-title]").should("be.visible");
  });

  it("refuse des identifiants invalides", () => {
    cy.visit("/admin/login");
    cy.get("[data-cy=login-email]").type(Cypress.env("ADMIN_EMAIL"));
    cy.get("[data-cy=login-password]").type("mauvais-mot-de-passe");
    cy.get("[data-cy=login-submit]").click();
    cy.get("[data-cy=login-error]").should("contain", "Identifiants invalides");
    cy.url().should("include", "/admin/login");
  });

  it("renvoie la même erreur pour une adresse inconnue (pas d'énumération de compte)", () => {
    cy.visit("/admin/login");
    cy.get("[data-cy=login-email]").type("inconnu@exemple.test");
    cy.get("[data-cy=login-password]").type("mauvais-mot-de-passe");
    cy.get("[data-cy=login-submit]").click();
    cy.get("[data-cy=login-error]").should("contain", "Identifiants invalides");
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

  it("répond 404 sur un livre inexistant plutôt que d'exposer une erreur", () => {
    cy.login();
    cy.request({ url: "/admin/livres/n-existe-pas", failOnStatusCode: false })
      .its("status")
      .should("eq", 404);
  });
});
