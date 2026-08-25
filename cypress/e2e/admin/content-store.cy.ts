// Ce que cette variante introduit : aucune base, aucun dossier d'uploads — les
// images sont recompressées en WebP puis inlinées dans content.json. Ces tests
// assertent sur ce qui est RÉELLEMENT écrit dans le fichier (tâche Node
// `storedBook`), pas seulement sur ce qu'une page affiche.
//
// Comme le CRUD, ces tests s'enchaînent pour ne payer l'encodage qu'une fois.

const SLUG = "cy-store";
const SANS_VERSO = "cy-sans-verso";
const TITRE = "Livre du store";

/** Champs attendus dans content.json. Volontairement exhaustif : c'est ce qui a
 *  attrapé un spread qui recopiait le livre entier dans la mise à jour. */
const CHAMPS_ATTENDUS = [
  "backCoverImage",
  "coverImage",
  "coverThumb",
  "createdAt",
  "id",
  "publishedAt",
  "slug",
  "sortOrder",
  "status",
  "translations",
  "updatedAt",
];

/** Plafond appliqué par src/lib/images.ts à chaque variante stockée. */
const MAX_STORED_BYTES = 250 * 1024;

function creerLivre(slug: string, titre: string, avecVerso: boolean) {
  cy.visit("/admin/livres/nouveau");
  cy.get("[data-cy=book-form-title-fr]").type(titre);
  cy.get("[data-cy=book-form-synopsis-fr]").type("Synopsis FR pour vérifier le stockage.");
  cy.get("[data-cy=book-form-title-en]").type(`${titre} (EN)`);
  cy.get("[data-cy=book-form-synopsis-en]").type("EN synopsis to check what gets stored.");
  cy.get("[data-cy=book-form-slug]").clear().type(slug);
  cy.get("[data-cy=book-form-status]").select("published");
  cy.get("[data-cy=book-form-sort-order]").clear().type("0");
  cy.get("[data-cy=book-form-cover]").selectFile("cypress/fixtures/cover-upload.jpg");
  if (avecVerso) {
    cy.get("[data-cy=book-form-back-cover]").selectFile("cypress/fixtures/back-cover-upload.jpg");
  }
  cy.get("[data-cy=book-form-submit]").click();
  cy.url({ timeout: 30000 }).should("match", /\/admin\/livres\/[a-z0-9-]+$/);
}

describe("Contenu réellement stocké", () => {
  before(() => {
    cy.removeBookIfPresent(SLUG);
    cy.removeBookIfPresent(SANS_VERSO);
  });

  after(() => {
    cy.removeBookIfPresent(SLUG);
    cy.removeBookIfPresent(SANS_VERSO);
  });

  beforeEach(() => {
    cy.login();
  });

  it("écrit trois variantes WebP inline et rien d'autre", () => {
    creerLivre(SLUG, TITRE, true);

    cy.storedBook(SLUG).should((livre) => {
      expect(livre, "le livre est bien dans content.json").to.not.equal(null);
      const book = livre!;

      expect(book.fields, "forme de l'entrée stockée").to.deep.equal(CHAMPS_ATTENDUS);
      expect(book.status).to.eq("published");
      expect(book.publishedAt, "date de parution posée à la publication").to.be.a("string");
      expect(book.titles).to.deep.equal({ fr: TITRE, en: `${TITRE} (EN)` });

      for (const variante of ["coverThumb", "coverImage", "backCoverImage"] as const) {
        const image = book[variante];
        expect(image, variante).to.not.equal(null);
        expect(image!.prefix, `${variante} est une data URI WebP`).to.eq("data:image/webp;base64,");
        expect(image!.bytes, `${variante} sous le plafond`).to.be.at.most(MAX_STORED_BYTES);
      }
      // la miniature des listes doit rester nettement plus légère que la pleine taille
      expect(book.coverThumb!.bytes).to.be.lessThan(book.coverImage!.bytes);
    });
  });

  it("respecte l'ordre d'affichage demandé", () => {
    // sortOrder 0 contre 1, 2, 3 pour le seed : le livre passe devant.
    // On compare des positions plutôt que la première carte, pour rester juste
    // même si une autre spec a laissé un livre `cy-` derrière elle.
    cy.visit("/fr/projets");
    cy.get("[data-cy=projects-grid] [data-cy^=book-card-]").then(($cartes) => {
      const slugs = [...$cartes].map((carte) => carte.getAttribute("data-cy"));
      expect(slugs.indexOf(`book-card-${SLUG}`)).to.be.greaterThan(-1);
      expect(slugs.indexOf(`book-card-${SLUG}`)).to.be.lessThan(
        slugs.indexOf("book-card-les-jardins-suspendus")
      );
    });
  });

  it("conserve les images quand on édite sans fournir de fichier", () => {
    cy.storedBook(SLUG).then((avant) => {
      const initial = avant!;

      cy.visit("/admin");
      cy.get(`[data-cy=admin-book-row-${SLUG}]`).click();
      cy.get("[data-cy=book-form-title-fr]").clear().type(`${TITRE} révisé`);
      cy.get("[data-cy=book-form-submit]").click();
      cy.get("[data-cy=book-form-success]").should("be.visible");

      cy.storedBook(SLUG).should((apres) => {
        const final = apres!;
        expect(final.titles.fr, "le titre a bien changé").to.eq(`${TITRE} révisé`);
        // Régression connue : un spread mal placé recopiait tout l'ancien livre.
        expect(final.coverImage!.bytes).to.eq(initial.coverImage!.bytes);
        expect(final.coverThumb!.bytes).to.eq(initial.coverThumb!.bytes);
        expect(final.backCoverImage!.bytes).to.eq(initial.backCoverImage!.bytes);
        expect(final.status).to.eq(initial.status);
        expect(final.slug).to.eq(initial.slug);
      });
    });
  });

  it("accepte un livre sans 4e de couverture et n'affiche alors aucun retournement", () => {
    creerLivre(SANS_VERSO, "Livre sans verso", false);

    cy.storedBook(SANS_VERSO).should((livre) => {
      expect(livre!.backCoverImage, "aucun verso stocké").to.equal(null);
      expect(livre!.coverImage, "la couverture, elle, est bien là").to.not.equal(null);
    });

    cy.visit(`/fr/projets/${SANS_VERSO}`);
    cy.get("[data-cy=project-cover]").should("be.visible");
    cy.get("[data-cy=project-cover-card]").should("have.attr", "data-face", "front");
    cy.get("[data-cy=project-cover-flip]").should("not.exist");
  });
});

export {};
