// L'adresse publique d'un livre n'est plus saisie : elle est dérivée du titre
// français, à défaut de l'anglais. Deux propriétés à protéger, et elles tirent
// dans des directions opposées :
//
//   - une coquille dans un titre doit pouvoir être corrigée SANS laisser une
//     URL fautive derrière elle ;
//   - une URL déjà publiée ne doit JAMAIS changer, sinon les liens partagés,
//     les favoris et l'indexation se cassent en silence.
//
// D'où la règle : le slug suit le titre tant que le livre n'a jamais été
// publié, puis il est figé.

const BROUILLON = "Cy Brouillon Coquile";
const BROUILLON_CORRIGE = "Cy Brouillon Corrige";
const PUBLIE = "Cy Publie Fige";
const DOUBLON = "Cy Doublon";
const SANS_FR = "Cy English Only";

/** Reproduit la dérivation attendue, pour éviter des slugs codés en dur partout. */
function slug(titre: string) {
  return titre
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function creer(options: {
  titreFr?: string;
  titreEn?: string;
  synopsis?: string;
  publier?: boolean;
}) {
  cy.visit("/admin/livres/nouveau");
  if (options.titreFr) cy.get("[data-cy=book-form-title-fr]").type(options.titreFr);
  if (options.titreEn) cy.get("[data-cy=book-form-title-en]").type(options.titreEn);
  cy.get("[data-cy=book-form-synopsis-fr]").type(options.synopsis ?? "Synopsis de contrôle.");
  if (options.publier) cy.get("[data-cy=book-form-status]").check();
  cy.get("[data-cy=book-form-submit]").click();
  cy.attendCreation();
}

describe("Adresse publique dérivée du titre", () => {
  const aNettoyer = [
    slug(BROUILLON),
    slug(BROUILLON_CORRIGE),
    slug(PUBLIE),
    slug(DOUBLON),
    `${slug(DOUBLON)}-2`,
    slug(SANS_FR),
  ];

  before(() => {
    aNettoyer.forEach((s) => cy.removeBookIfPresent(s));
  });

  after(() => {
    aNettoyer.forEach((s) => cy.removeBookIfPresent(s));
  });

  beforeEach(() => {
    cy.login();
  });

  it("dérive l'adresse du titre français, sans identifiant dans l'URL", () => {
    creer({ titreFr: PUBLIE, publier: true });

    cy.storedBook(slug(PUBLIE)).should((livre) => {
      expect(livre, "le livre existe sous l'adresse dérivée").to.not.equal(null);
      // Le garde-fou du besoin : aucun uuid ne doit transparaître dans l'URL.
      expect(livre!.slug).to.eq(slug(PUBLIE));
      expect(livre!.slug).to.not.contain(livre!.id);
    });

    cy.get("[data-cy=book-form-slug-preview]").should("contain", `/fr/projets/${slug(PUBLIE)}`);
    cy.request(`/fr/projets/${slug(PUBLIE)}`)
      .its("status")
      .should("eq", 200);
  });

  it("retombe sur le titre anglais quand le français est vide", () => {
    creer({ titreEn: SANS_FR, publier: true });
    cy.storedBook(slug(SANS_FR)).should((livre) => expect(livre!.slug).to.eq(slug(SANS_FR)));
  });

  it("suffixe l'adresse plutôt que de refuser un titre déjà utilisé", () => {
    creer({ titreFr: DOUBLON, publier: true });
    creer({ titreFr: DOUBLON, publier: true });

    // Le premier arrivé garde l'adresse nue, le second est suffixé.
    cy.storedBook(slug(DOUBLON)).should((livre) => expect(livre).to.not.equal(null));
    cy.storedBook(`${slug(DOUBLON)}-2`).should((livre) => {
      expect(livre, "le doublon reçoit sa propre adresse").to.not.equal(null);
      expect(livre!.titles.fr).to.eq(DOUBLON);
    });
  });

  it("laisse l'adresse suivre le titre tant que le livre est en brouillon", () => {
    creer({ titreFr: BROUILLON });
    cy.storedBook(slug(BROUILLON)).should((livre) => expect(livre).to.not.equal(null));

    // Correction de la coquille : aucune URL n'a circulé, l'adresse doit suivre.
    cy.get("[data-cy=book-form-title-fr]").clear().type(BROUILLON_CORRIGE);
    cy.get("[data-cy=book-form-submit]").click();
    cy.get("[data-cy=book-form-success]").should("be.visible");

    cy.storedBook(slug(BROUILLON_CORRIGE)).should((livre) => expect(livre).to.not.equal(null));
    cy.storedBook(slug(BROUILLON)).should("be.null");
  });

  it("annonce le gel du titre AVANT de publier, et laisse annuler", () => {
    const CONFIRMATION = "Cy Confirmation";
    cy.removeBookIfPresent(slug(CONFIRMATION));
    cy.visit("/admin/livres/nouveau");
    cy.get("[data-cy=book-form-title-fr]").type(CONFIRMATION);
    cy.get("[data-cy=book-form-synopsis-fr]").type("Synopsis de contrôle.");

    // Refus : on ne doit pas se retrouver en « publié » à son insu.
    cy.on("window:confirm", () => false);
    cy.get("[data-cy=book-form-status]").click();
    cy.get("[data-cy=book-form-status]").should("not.be.checked");
  });

  it("nomme le livre et la conséquence dans la confirmation", () => {
    const CONFIRMATION = "Cy Message Confirmation";
    const vus: string[] = [];
    cy.on("window:confirm", (texte) => {
      vus.push(texte);
      return false;
    });

    cy.visit("/admin/livres/nouveau");
    cy.get("[data-cy=book-form-title-fr]").type(CONFIRMATION);
    cy.get("[data-cy=book-form-status]").click();

    cy.wrap(null).should(() => {
      const message = vus.join(" ");
      expect(message, "le livre est nommé").to.contain(CONFIRMATION);
      expect(message, "la conséquence est explicite").to.contain("ne sera plus modifiable");
    });
  });

  it("explique le gel à venir tant que le livre est en brouillon", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${slug(BROUILLON_CORRIGE)}]`).click();

    cy.get("[data-cy=book-form-title-fr]").should("not.have.attr", "readonly");
    cy.get("[data-cy=book-form-title-fr-aide]")
      .should("contain", "se figera à la première publication")
      .and("contain", "corriger");
  });

  it("verrouille le champ titre une fois le livre publié", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${slug(PUBLIE)}]`).click();

    // readOnly et non disabled : un champ désactivé n'est pas envoyé avec le
    // formulaire, ce qui effacerait le titre à la première sauvegarde.
    cy.get("[data-cy=book-form-title-fr]").should("have.attr", "readonly");
    cy.get("[data-cy=book-form-title-fr-aide]")
      .should("contain", "verrouillé")
      .and("contain", `/fr/projets/${slug(PUBLIE)}`);

    // La traduction anglaise, elle, n'a aucune incidence sur l'adresse.
    cy.get("[data-cy=book-form-title-en]").should("not.have.attr", "readonly");
  });

  it("fige l'adresse côté serveur, pas seulement dans le formulaire", () => {
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${slug(PUBLIE)}]`).click();

    // Le verrou du champ est une aide à la saisie, pas une garantie : on le
    // contourne pour vérifier que la règle tient là où elle compte vraiment.
    cy.get("[data-cy=book-form-title-fr]").invoke("removeAttr", "readonly");
    cy.get("[data-cy=book-form-title-fr]").clear().type("Cy Titre Completement Different");
    cy.get("[data-cy=book-form-submit]").click();
    cy.get("[data-cy=book-form-success]").should("be.visible");

    // Le titre a changé, l'adresse non : les liens déjà partagés restent valides.
    cy.storedBook(slug(PUBLIE)).should((livre) => {
      expect(livre!.slug, "l'adresse publiée est figée").to.eq(slug(PUBLIE));
      expect(livre!.titles.fr).to.eq("Cy Titre Completement Different");
    });
    cy.request(`/fr/projets/${slug(PUBLIE)}`)
      .its("status")
      .should("eq", 200);
    cy.request({ url: "/fr/projets/cy-titre-completement-different", failOnStatusCode: false })
      .its("status")
      .should("eq", 404);
  });
});

export {};
