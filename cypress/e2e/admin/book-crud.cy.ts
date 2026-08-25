// Cycle de vie complet d'un livre créé par la suite (slug préfixé cy- pour ne
// jamais entrer en collision avec le seed).
//
// Les tests de ce fichier S'ENCHAÎNENT volontairement : recréer un livre à
// chaque test coûterait ~5 s (encodage sharp des variantes). Le prix à payer,
// c'est qu'un échec en cours de route laisse un livre derrière lui — d'où le
// `before` de nettoyage, qui rend chaque run indépendant du précédent.

const SLUG = "cy-livre-test";
const TITLE_FR = "Cy Livre Test";
const TITLE_EN = "The Book of Tests";

describe("CRUD livre (admin)", () => {
  before(() => {
    cy.removeBookIfPresent(SLUG);
  });

  beforeEach(() => {
    cy.login();
  });

  it("crée un livre complet (FR/EN, couverture, 4e de couverture) et redirige vers l'édition", () => {
    cy.visit("/admin/livres/nouveau");

    cy.get("[data-cy=book-form-title-fr]").type(TITLE_FR);
    cy.get("[data-cy=book-form-synopsis-fr]").type(
      "Un synopsis de test écrit par Cypress, suffisamment long pour être réaliste."
    );
    cy.get("[data-cy=book-form-title-en]").type(TITLE_EN);
    cy.get("[data-cy=book-form-synopsis-en]").type(
      "A test synopsis written by Cypress, long enough to feel realistic."
    );
    cy.get("[data-cy=book-form-status]").select("published");

    cy.get("[data-cy=book-form-cover]").selectFile("cypress/fixtures/cover-upload.jpg");
    cy.get("[data-cy=book-form-back-cover]").selectFile("cypress/fixtures/back-cover-upload.jpg");

    cy.get("[data-cy=book-form-submit]").click();

    // Redirection vers la page d'édition du livre créé (id = uuid). Timeout long
    // assumé : sharp encode trois variantes avant que l'action ne réponde.
    cy.url({ timeout: 30000 }).should("match", /\/admin\/livres\/[a-z0-9-]+$/);
    cy.get("[data-cy=admin-edit-title]").should("contain", TITLE_FR);
    cy.get("[data-cy=status-badge]").should("have.attr", "data-status", "published");
    cy.get("[data-cy=book-form-current-cover]").should("be.visible");
    cy.get("[data-cy=book-form-current-back-cover]").should("be.visible");
  });

  it("rend le livre visible côté public (FR et EN) avec sa carte retournable", () => {
    cy.visit("/fr/projets");
    cy.get(`[data-cy=book-card-${SLUG}]`).should("contain", TITLE_FR).click();
    cy.get("[data-cy=project-title]").should("contain", TITLE_FR);
    cy.get("[data-cy=project-cover]").should("be.visible");

    // recto par défaut, verso après clic
    cy.get("[data-cy=project-cover-card]").should("have.attr", "data-face", "front");
    cy.get("[data-cy=project-cover-flip]").click();
    cy.get("[data-cy=project-cover-card]").should("have.attr", "data-face", "back");
    cy.get("[data-cy=project-back-cover]").should("exist");

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

  it("remplace le 4e de couverture depuis la page d'édition", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${SLUG}]`).click();

    // Les images sont des data URI : on compare un extrait, pas la chaîne entière.
    cy.get("[data-cy=book-form-current-back-cover]")
      .invoke("attr", "src")
      .then((before) => {
        const sample = String(before).slice(0, 200);

        cy.get("[data-cy=book-form-back-cover]").selectFile("cypress/fixtures/cover-upload.jpg");
        cy.get("[data-cy=book-form-submit]").click();
        cy.get("[data-cy=book-form-success]").should("be.visible");

        cy.reload();
        cy.get("[data-cy=book-form-current-back-cover]")
          .invoke("attr", "src")
          .then((after) => {
            expect(String(after).slice(0, 200)).to.not.equal(sample);
          });
      });
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
    // et il ne reste rien de lui dans le fichier de contenu
    cy.storedBook(SLUG).should("be.null");
  });
});

export {};
