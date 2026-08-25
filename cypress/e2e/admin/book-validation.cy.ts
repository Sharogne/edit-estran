// Sans base de données, deux garanties que le moteur SQL offrait gratuitement
// sont devenues du code applicatif : l'unicité du slug (index unique → `some()`
// en JS) et le rejet des fichiers non-images. Ces tests les couvrent.
//
// Aucun cas de ce fichier ne doit écrire quoi que ce soit : chaque test vérifie
// aussi que le contenu stocké est resté intact.

const SEED_SLUG = "les-jardins-suspendus";

/** Remplit les champs obligatoires du formulaire, slug compris. */
function remplirFormulaire(slug: string) {
  cy.get("[data-cy=book-form-title-fr]").clear().type("Doublon de test");
  cy.get("[data-cy=book-form-synopsis-fr]").clear().type("Synopsis FR de contrôle.");
  cy.get("[data-cy=book-form-title-en]").clear().type("Test duplicate");
  cy.get("[data-cy=book-form-synopsis-en]").clear().type("Control EN synopsis.");
  cy.get("[data-cy=book-form-slug]").clear().type(slug);
}

describe("Règles de validation (admin)", () => {
  beforeEach(() => {
    cy.login();
  });

  it("refuse un slug déjà pris à la création, sans rien créer", () => {
    cy.task<string[]>("storedSlugs").then((avant) => {
      cy.visit("/admin/livres/nouveau");
      remplirFormulaire(SEED_SLUG);
      cy.get("[data-cy=book-form-submit]").click();

      cy.get("[data-cy=book-form-error]").should("contain", "déjà utilisé");
      // pas de redirection vers une page d'édition : rien n'a été créé
      cy.url().should("include", "/admin/livres/nouveau");
      cy.task<string[]>("storedSlugs").should("deep.equal", avant);
    });
  });

  it("refuse un slug déjà pris à l'édition et laisse le livre intact", () => {
    cy.visit("/admin");
    cy.get("[data-cy=admin-book-row-cartographie-du-silence]").click();

    cy.get("[data-cy=book-form-slug]").clear().type(SEED_SLUG);
    cy.get("[data-cy=book-form-submit]").click();
    cy.get("[data-cy=book-form-error]").should("contain", "déjà utilisé");
    cy.get("[data-cy=book-form-success]").should("not.exist");

    // L'erreur est levée DANS la mutation, donc le fichier n'est jamais réécrit.
    cy.storedBook("cartographie-du-silence").should((livre) => {
      expect(livre, "le livre existe toujours").to.not.equal(null);
      expect(livre!.slug).to.eq("cartographie-du-silence");
      expect(livre!.titles.fr).to.eq("Cartographie du silence");
    });
  });

  it("refuse un fichier qui n'est pas une image", () => {
    cy.visit("/admin/livres/nouveau");
    remplirFormulaire("cy-fichier-invalide");
    cy.get("[data-cy=book-form-cover]").selectFile({
      contents: Cypress.Buffer.from("ceci n'est pas une image"),
      fileName: "notes.txt",
      mimeType: "text/plain",
    });
    cy.get("[data-cy=book-form-submit]").click();

    cy.get("[data-cy=book-form-error]").should("contain", "Format non supporté");
    cy.storedBook("cy-fichier-invalide").should("be.null");
  });

  it("refuse un slug mal formé côté serveur, même si le garde-fou HTML est contourné", () => {
    cy.visit("/admin/livres/nouveau");
    remplirFormulaire("cy-slug-provisoire");
    // `pattern` empêche l'envoi côté navigateur : on le retire pour atteindre Zod.
    cy.get("[data-cy=book-form-slug]").invoke("removeAttr", "pattern");
    cy.get("[data-cy=book-form-slug]").clear().type("Slug Invalide !");
    cy.get("[data-cy=book-form-submit]").click();

    cy.get("[data-cy=book-form-error]").should("contain", "Slug invalide");
    cy.storedBook("cy-slug-provisoire").should("be.null");
  });
});

export {};
