// Custom commands — keep this file small and documented (skill: run-e2e).

/** Light-weight projection of a stored book, returned by the `storedBook` task. */
export type StoredBookProbe = {
  id: string;
  slug: string;
  status: string;
  sortOrder: number;
  publishedAt: string | null;
  purchaseUrl: string | null;
  fields: string[];
  coverThumb: { prefix: string; bytes: number } | null;
  coverImage: { prefix: string; bytes: number } | null;
  backCoverImage: { prefix: string; bytes: number } | null;
  titles: { fr: string | null; en: string | null };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Logs in as the test admin (.env.test) once per run, cached via cy.session. */
      login(): Chainable<void>;
      /**
       * Deletes a book by slug if it is still there. Admin specs create books with
       * `cy-` prefixed slugs; a spec that fails mid-way would otherwise leave one
       * behind and take the next run down with it.
       */
      removeBookIfPresent(slug: string): Chainable<void>;
      /** Reads a book out of content.json (null when absent). Retries under `.should()`. */
      storedBook(slug: string): Chainable<StoredBookProbe | null>;
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
    {
      cacheAcrossSpecs: true,
      // Without this, a restored-but-dead session (spec that logged out, changed
      // SESSION_SECRET) surfaces as a puzzling failure deep inside the first
      // admin assertion instead of simply logging in again.
      validate() {
        cy.request("/admin").its("body").should("include", "admin-dashboard-title");
      },
    }
  );
});

Cypress.Commands.add("removeBookIfPresent", (slug: string) => {
  cy.login();
  cy.visit("/admin");
  // Wait for the list (or the empty state) before probing the DOM.
  cy.get("[data-cy=admin-book-list], [data-cy=admin-empty]").should("exist");
  cy.get("body").then(($body) => {
    if ($body.find(`[data-cy=admin-book-row-${slug}]`).length === 0) return;
    cy.get(`[data-cy=admin-book-row-${slug}]`).click();
    // Cypress auto-accepts window.confirm
    cy.get("[data-cy=admin-delete-book]").click();
    cy.url({ timeout: 30000 }).should("match", /\/admin$/);
  });
});

Cypress.Commands.add("storedBook", (slug: string) => {
  return cy.task<StoredBookProbe | null>("storedBook", slug);
});

export {};
