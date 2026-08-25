// Une langue peut être laissée vide : le rendu reprend alors l'autre. Le repli
// est PAR CHAMP et se fait à la lecture — rien n'est recopié à l'écriture, sinon
// la donnée mentirait et une correction du français ne suivrait pas.

const SLUG = "cy-traduit-plus-tard";
const TITRE_FR = "Cy Traduit Plus Tard";
const SYNOPSIS_FR = "Ce livre n'a pas encore de version anglaise.";
const TITRE_EN = "Translated At Last";

describe("Repli de traduction", () => {
  before(() => {
    cy.removeBookIfPresent(SLUG);
  });

  after(() => {
    cy.removeBookIfPresent(SLUG);
  });

  beforeEach(() => {
    cy.login();
  });

  it("accepte un livre sans aucun contenu anglais", () => {
    cy.visit("/admin/livres/nouveau");
    cy.get("[data-cy=book-form-title-fr]").type(TITRE_FR);
    cy.get("[data-cy=book-form-synopsis-fr]").type(SYNOPSIS_FR);
    cy.get("[data-cy=book-form-status]").select("published");
    cy.get("[data-cy=book-form-cover]").selectFile("cypress/fixtures/cover-upload.jpg");
    cy.get("[data-cy=book-form-submit]").click();

    cy.url({ timeout: 30000 }).should("match", /\/admin\/livres\/[a-z0-9-]+$/);

    // Rien n'a été recopié : l'anglais est stocké vide, tel qu'il a été saisi.
    cy.storedBook(SLUG).should((livre) => {
      expect(livre!.titles.fr).to.eq(TITRE_FR);
      expect(livre!.titles.en, "l'anglais reste vide en base").to.eq("");
    });
  });

  it("sert le français sur les pages anglaises tant que la traduction manque", () => {
    cy.visit(`/en/projets/${SLUG}`);
    cy.get("[data-cy=project-title]").should("contain", TITRE_FR);
    cy.get("[data-cy=project-synopsis]").should("contain", SYNOPSIS_FR);

    // et la carte de la liste anglaise aussi
    cy.visit("/en/projets");
    cy.get(`[data-cy=book-card-${SLUG}]`).should("contain", TITRE_FR);
  });

  it("bascule sur l'anglais dès que la traduction est saisie", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${SLUG}]`).click();
    // Le formulaire montre bien le champ vide, pas le repli
    cy.get("[data-cy=book-form-title-en]").should("have.value", "").type(TITRE_EN);
    cy.get("[data-cy=book-form-submit]").click();
    cy.get("[data-cy=book-form-success]").should("be.visible");

    cy.visit(`/en/projets/${SLUG}`);
    cy.get("[data-cy=project-title]").should("contain", TITRE_EN);
    // Le synopsis, lui, n'est toujours pas traduit : le repli est par champ.
    cy.get("[data-cy=project-synopsis]").should("contain", SYNOPSIS_FR);

    // Le français n'a pas bougé
    cy.visit(`/fr/projets/${SLUG}`);
    cy.get("[data-cy=project-title]").should("contain", TITRE_FR);
  });
});

export {};
