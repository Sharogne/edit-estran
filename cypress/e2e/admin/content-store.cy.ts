// Ce que cette variante introduit : aucune base, aucun dossier d'uploads — les
// images sont recompressées en WebP puis inlinées dans content.json. Ces tests
// assertent sur ce qui est RÉELLEMENT écrit dans le fichier (tâche Node
// `storedBook`), pas seulement sur ce qu'une page affiche.
//
// Comme le CRUD, ces tests s'enchaînent pour ne payer l'encodage qu'une fois.

const SLUG = "cy-store";
const SANS_VERSO = "cy-sans-verso";
const TITRE = "Cy Store";

/** Champs attendus dans content.json. Volontairement exhaustif : c'est ce qui a
 *  attrapé un spread qui recopiait le livre entier dans la mise à jour. */
const CHAMPS_ATTENDUS = [
  "backCoverImage",
  "coverCard",
  "coverImage",
  "createdAt",
  "id",
  "publishedAt",
  "purchaseUrl",
  "slug",
  "sortOrder",
  "status",
  "translations",
  "updatedAt",
];

/** Plafond appliqué par src/lib/images.ts à chaque variante stockée. */
const MAX_STORED_BYTES = 250 * 1024;

// Le slug n'est plus saisi : il découle du titre, d'où des titres en « Cy … ».
function creerLivre(titre: string, avecVerso: boolean) {
  cy.visit("/admin/livres/nouveau");
  cy.get("[data-cy=book-form-title-fr]").type(titre);
  cy.get("[data-cy=book-form-synopsis-fr]").type("Synopsis FR pour vérifier le stockage.");
  cy.get("[data-cy=book-form-title-en]").type(`${titre} (EN)`);
  cy.get("[data-cy=book-form-synopsis-en]").type("EN synopsis to check what gets stored.");
  cy.publier();
  cy.get("[data-cy=book-form-cover]").selectFile("cypress/fixtures/cover-upload.jpg");
  if (avecVerso) {
    cy.get("[data-cy=book-form-back-cover]").selectFile("cypress/fixtures/back-cover-upload.jpg");
  }
  cy.get("[data-cy=book-form-submit]").click();
  cy.attendCreation();
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
    creerLivre(TITRE, true);

    cy.storedBook(SLUG).should((livre) => {
      expect(livre, "le livre est bien dans content.json").to.not.equal(null);
      const book = livre!;

      expect(book.fields, "forme de l'entrée stockée").to.deep.equal(CHAMPS_ATTENDUS);
      expect(book.status).to.eq("published");
      expect(book.publishedAt, "date de parution posée à la publication").to.be.a("string");
      expect(book.titles).to.deep.equal({ fr: TITRE, en: `${TITRE} (EN)` });

      for (const variante of ["coverCard", "coverImage", "backCoverImage"] as const) {
        const image = book[variante];
        expect(image, variante).to.not.equal(null);
        expect(image!.prefix, `${variante} est une data URI WebP`).to.eq("data:image/webp;base64,");
        expect(image!.bytes, `${variante} sous le plafond`).to.be.at.most(MAX_STORED_BYTES);

        // Le cadrage se décide à l'encodage, plus dans le CSS : c'est le fichier
        // stocké qui doit être au format 2:3, sinon `object-cover` se remet à
        // rogner arbitrairement ce que l'éditeur n'a jamais vu.
        expect(image!.size, `${variante} : en-tête WebP lisible`).to.not.equal(null);
        const { width, height } = image!.size!;
        expect(width / height, `${variante} stocké au format 2:3`).to.be.closeTo(2 / 3, 0.01);
      }
      // la variante des listes reste nettement plus légère que la pleine taille
      expect(book.coverCard!.bytes).to.be.lessThan(book.coverImage!.bytes);
    });
  });

  it("range un nouveau livre en fin de catalogue", () => {
    // L'ordre ne se saisit plus dans le formulaire : il se règle au
    // glisser-déposer (spec book-order). Un livre créé prend donc le dernier
    // rang, ce qui est le comportement le moins surprenant.
    cy.task<string[]>("storedSlugs").then((slugs) => {
      cy.wrap(slugs).should("include", SLUG);
    });

    cy.visit("/fr/projets");
    cy.get("[data-cy=projects-grid] [data-cy^=book-card-]").then(($cartes) => {
      const ordre = [...$cartes].map((carte) => carte.getAttribute("data-cy"));
      expect(
        ordre.indexOf(`book-card-${SLUG}`),
        "le nouveau livre est après ceux du seed"
      ).to.be.greaterThan(ordre.indexOf("book-card-les-jardins-suspendus"));
    });
  });

  it("conserve les images quand on édite sans fournir de fichier", () => {
    cy.storedBook(SLUG).then((avant) => {
      const initial = avant!;

      cy.visit("/admin");
      cy.get(`[data-cy=admin-book-row-${SLUG}]`).click();
      // Le livre est publié, donc son titre est verrouillé : on modifie un champ
      // qui reste éditable, l'objet du test étant l'intégrité des images.
      cy.get("[data-cy=book-form-purchase-url]").clear().type("https://libraire.test/cy-store");
      cy.get("[data-cy=book-form-submit]").click();
      cy.get("[data-cy=book-form-success]").should("be.visible");

      cy.storedBook(SLUG).should((apres) => {
        const final = apres!;
        expect(final.purchaseUrl, "le champ édité a bien changé").to.eq(
          "https://libraire.test/cy-store"
        );
        // Régression connue : un spread mal placé recopiait tout l'ancien livre.
        expect(final.coverImage!.bytes).to.eq(initial.coverImage!.bytes);
        expect(final.coverCard!.bytes).to.eq(initial.coverCard!.bytes);
        expect(final.backCoverImage!.bytes).to.eq(initial.backCoverImage!.bytes);
        expect(final.status).to.eq(initial.status);
        expect(final.slug).to.eq(initial.slug);
      });
    });
  });

  it("accepte un livre sans 4e de couverture et n'affiche alors aucun retournement", () => {
    creerLivre("Cy Sans Verso", false);

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
