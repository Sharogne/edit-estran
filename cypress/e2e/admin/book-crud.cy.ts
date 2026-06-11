// Cycle de vie complet d'un livre créé par la suite (slug préfixé cy- pour ne
// jamais entrer en collision avec le seed). Les tests de ce fichier s'enchaînent.

const SLUG = "cy-livre-test";
const TITLE_FR = "Le Livre des tests";
const TITLE_EN = "The Book of Tests";

describe("CRUD livre (admin)", () => {
  beforeEach(() => {
    cy.login();
  });

  it("crée un livre complet (FR/EN, couverture, previews) et redirige vers l'édition", () => {
    cy.visit("/admin/livres/nouveau");

    cy.get("[data-cy=book-form-title-fr]").type(TITLE_FR);
    cy.get("[data-cy=book-form-synopsis-fr]").type(
      "Un synopsis de test écrit par Cypress, suffisamment long pour être réaliste."
    );
    // le slug est auto-suggéré depuis le titre FR…
    cy.get("[data-cy=book-form-slug]").should("have.value", "le-livre-des-tests");
    // …mais on le contrôle explicitement
    cy.get("[data-cy=book-form-slug]").clear().type(SLUG);

    cy.get("[data-cy=book-form-title-en]").type(TITLE_EN);
    cy.get("[data-cy=book-form-synopsis-en]").type(
      "A test synopsis written by Cypress, long enough to feel realistic."
    );
    cy.get("[data-cy=book-form-status]").select("published");

    cy.get("[data-cy=book-form-cover]").selectFile("cypress/fixtures/cover-upload.jpg");
    cy.get("[data-cy=book-form-previews]").selectFile([
      "cypress/fixtures/preview-upload-1.jpg",
      "cypress/fixtures/preview-upload-2.jpg",
    ]);

    cy.get("[data-cy=book-form-submit]").click();

    // redirection vers la page d'édition du livre créé
    cy.url({ timeout: 30000 }).should("match", /\/admin\/livres\/[a-z0-9]+$/);
    cy.get("[data-cy=admin-edit-title]").should("contain", TITLE_FR);
    cy.get("[data-cy=status-badge]").should("have.attr", "data-status", "published");
    cy.get("[data-cy=book-form-current-cover]").should("be.visible");
    cy.get("[data-cy=admin-preview-item]").should("have.length", 2);
  });

  it("rend le livre visible côté public (FR et EN)", () => {
    cy.visit("/fr/projets");
    cy.get(`[data-cy=book-card-${SLUG}]`).should("contain", TITLE_FR).click();
    cy.get("[data-cy=project-title]").should("contain", TITLE_FR);
    cy.get("[data-cy=project-cover]").should("be.visible");
    cy.get("[data-cy=project-preview-page]").should("have.length", 2);

    cy.visit(`/en/projets/${SLUG}`);
    cy.get("[data-cy=project-title]").should("contain", TITLE_EN);
  });

  it("modifie le synopsis et répercute le changement côté public", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${SLUG}]`).click();

    cy.get("[data-cy=book-form-synopsis-fr]")
      .clear()
      .type("Synopsis modifié par Cypress — édition vérifiée de bout en bout.");
    cy.get("[data-cy=book-form-submit]").click();
    cy.get("[data-cy=book-form-success]").should("be.visible");

    cy.visit(`/fr/projets/${SLUG}`);
    cy.get("[data-cy=project-synopsis]").should("contain", "Synopsis modifié par Cypress");
  });

  it("réordonne puis supprime des pages de preview", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${SLUG}]`).click();

    // mémorise l'image de la 2e page, la fait passer en 1re position
    cy.get("[data-cy=admin-preview-item]")
      .eq(1)
      .find("img")
      .invoke("attr", "src")
      .then((secondSrc) => {
        cy.get("[data-cy=admin-preview-item]").eq(1).find("[data-cy=admin-preview-up]").click();
        cy.get("[data-cy=admin-preview-item]")
          .eq(0)
          .find("img")
          .invoke("attr", "src")
          .should("eq", secondSrc);
      });

    // supprime la 1re page → il n'en reste qu'une
    cy.get("[data-cy=admin-preview-item]").eq(0).find("[data-cy=admin-preview-delete]").click();
    cy.get("[data-cy=admin-preview-item]").should("have.length", 1);

    // répercuté côté public
    cy.visit(`/fr/projets/${SLUG}`);
    cy.get("[data-cy=project-preview-page]").should("have.length", 1);
  });

  it("ajoute une page de preview depuis la page d'édition", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${SLUG}]`).click();

    cy.get("[data-cy=admin-preview-add-input]").selectFile(
      "cypress/fixtures/preview-upload-1.jpg"
    );
    cy.get("[data-cy=admin-preview-add-submit]").click();
    cy.get("[data-cy=admin-preview-item]").should("have.length", 2);
  });

  it("dépublie le livre : il disparaît du site public", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${SLUG}]`).click();
    cy.get("[data-cy=book-form-status]").select("draft");
    cy.get("[data-cy=book-form-submit]").click();
    cy.get("[data-cy=book-form-success]").should("be.visible");

    cy.request({ url: `/fr/projets/${SLUG}`, failOnStatusCode: false })
      .its("status")
      .should("eq", 404);
    cy.visit("/fr/projets");
    cy.get(`[data-cy=book-card-${SLUG}]`).should("not.exist");
  });

  it("supprime le livre définitivement", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${SLUG}]`).click();
    // Cypress accepte automatiquement window.confirm
    cy.get("[data-cy=admin-delete-book]").click();

    cy.url({ timeout: 30000 }).should("match", /\/admin$/);
    cy.get(`[data-cy=admin-book-row-${SLUG}]`).should("not.exist");
    cy.request({ url: `/fr/projets/${SLUG}`, failOnStatusCode: false })
      .its("status")
      .should("eq", 404);
  });
});
