// Custom commands — keep this file small and documented (skill: run-e2e).

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Logs in as the test admin (.env.test) once per run, cached via cy.session. */
      login(): Chainable<void>;
    }
  }
}

Cypress.Commands.add("login", () => {
  cy.session(
    "admin",
    () => {
      cy.visit("/admin/login");
      cy.get("[data-cy=login-email]").type(Cypress.env("ADMIN_EMAIL"));
      cy.get("[data-cy=login-password]").type(Cypress.env("ADMIN_PASSWORD"), { log: false });
      cy.get("[data-cy=login-submit]").click();
      cy.get("[data-cy=admin-dashboard-title]").should("be.visible");
    },
    { cacheAcrossSpecs: true }
  );
});

export {};
