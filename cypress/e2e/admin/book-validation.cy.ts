// Les garanties que le moteur SQL offrait gratuitement sont devenues du code
// applicatif. Ce fichier couvre les REFUS ; la dérivation des adresses et leur
// unicité vivent dans book-slug.cy.ts.
//
// Aucun cas de ce fichier ne doit écrire quoi que ce soit : chaque test vérifie
// aussi que le contenu stocké est resté intact.

/**
 * Remplit les champs du formulaire. L'adresse n'est plus saisie : elle découle
 * du titre français, d'où des titres commençant par « Cy » pour continuer à
 * produire des slugs `cy-…` que les specs publiques savent ignorer.
 */
function remplirFormulaire(titre: string) {
  cy.get("[data-cy=book-form-title-fr]").clear().type(titre);
  cy.get("[data-cy=book-form-synopsis-fr]").clear().type("Synopsis FR de contrôle.");
  cy.get("[data-cy=book-form-title-en]").clear().type("Control title");
  cy.get("[data-cy=book-form-synopsis-en]").clear().type("Control EN synopsis.");
}

describe("Règles de validation (admin)", () => {
  beforeEach(() => {
    cy.login();
  });

  it("refuse un fichier qui n'est pas une image, sans l'envoyer", () => {
    cy.visit("/admin/livres/nouveau");
    remplirFormulaire("Cy Fichier Invalide");
    cy.get("[data-cy=book-form-cover]").selectFile({
      contents: Cypress.Buffer.from("ceci n'est pas une image"),
      fileName: "notes.txt",
      mimeType: "text/plain",
    });

    // Le rejet est immédiat, côté navigateur : pas d'aller-retour serveur et
    // surtout pas d'envoi inutile. Le champ est vidé dans la foulée.
    cy.get("[data-cy=book-form-error-cover]")
      .should("be.visible")
      .and("contain", "Format non supporté");
    cy.get("[data-cy=book-form-cover]").should("have.value", "");
    cy.storedBook("cy-fichier-invalide").should("be.null");
  });

  it("refuse une image abîmée ou déguisée par son extension, sans l'envoyer", () => {
    cy.visit("/admin/livres/nouveau");
    remplirFormulaire("Cy Image Abimee");

    // Type MIME parfaitement valide, contenu qui n'en est pas un : sous Windows
    // `file.type` vient de l'extension, pas des octets. Sans décodage avant
    // envoi, sharp lève côté serveur et l'éditeur reçoit la page d'erreur de
    // Next — écran noir, saisie perdue.
    cy.get("[data-cy=book-form-cover]").selectFile({
      contents: Cypress.Buffer.from("ÿØÿ pas vraiment un JPEG"),
      fileName: "couverture.jpg",
      mimeType: "image/jpeg",
    });

    cy.get("[data-cy=book-form-error-cover]").should("be.visible").and("contain", "illisible");
    cy.get("[data-cy=book-form-cover]").should("have.value", "");
    cy.get("[data-cy=book-form-submit]").should("be.enabled");
    cy.storedBook("cy-image-abimee").should("be.null");
  });

  it("refuse un livre sans titre ni synopsis dans aucune langue", () => {
    cy.visit("/admin/livres/nouveau");
    cy.get("[data-cy=book-form-submit]").click();

    // Les champs traduits ne sont plus `required` en HTML : c'est le serveur qui
    // impose « au moins une langue », et son message doit être explicite.
    cy.get("[data-cy=book-form-error]").should("contain", "au moins une langue");
    // Rien n'a été créé : le catalogue est inchangé.
    cy.task<string[]>("storedSlugs").should("have.length", 3);
  });

  it("refuse un lien d'achat non http(s) et nomme le champ en français", () => {
    cy.visit("/admin/livres/nouveau");
    remplirFormulaire("Cy Lien Invalide");
    // `javascript:alert(1)` est une URL absolue valide : le navigateur la laisse
    // passer. C'est donc bien au serveur de refuser — sans quoi ce lien finirait
    // dans un href sur la fiche publique.
    cy.get("[data-cy=book-form-purchase-url]").clear().type("javascript:alert(1)");
    cy.get("[data-cy=book-form-submit]").click();

    cy.get("[data-cy=book-form-error]").should("contain", "Lien d'achat").and("contain", "http");
    cy.storedBook("cy-lien-invalide").should("be.null");
  });

  it("bloque une image trop lourde côté navigateur, sans rien envoyer", () => {
    cy.visit("/admin/livres/nouveau");
    remplirFormulaire("Cy Image Lourde");

    // 11 Mo : au-dessus des 10 Mo autorisés. Le contrôle doit se faire AVANT
    // l'envoi — au-delà de bodySizeLimit, Next rejette la requête au transport
    // et la server action n'a aucun moyen de renvoyer un message.
    cy.get("[data-cy=book-form-cover]").selectFile({
      contents: Cypress.Buffer.alloc(11 * 1024 * 1024, 1),
      fileName: "trop-lourde.jpg",
      mimeType: "image/jpeg",
    });

    cy.get("[data-cy=book-form-error-cover]")
      .should("be.visible")
      .and("contain", "trop lourde")
      .and("contain", "10 Mo");
    // le champ est vidé : le fichier refusé ne peut pas partir malgré tout
    cy.get("[data-cy=book-form-cover]").should("have.value", "");
  });
});

export {};
