// Les confirmations sont des dialogues du site, plus des boîtes du navigateur.
//
// Ce qu'on gagne en style, on peut le perdre en comportement : `window.confirm`
// apportait gratuitement le piège du focus, la touche Échap et l'inertie de la
// page derrière. C'est `<dialog>` + `showModal()` qui les fournit ici, et ce
// fichier vérifie qu'on ne les a pas perdues en route — plus la règle qui
// compte vraiment : SORTIR d'un dialogue ne doit jamais valoir accepter.

const SEED_PUBLIE = "les-jardins-suspendus";

describe("Dialogues de confirmation (admin)", () => {
  beforeEach(() => {
    cy.login();
    cy.visit("/admin/livres/nouveau");
    cy.get("[data-cy=book-form-title-fr]").type("Cy Dialogue");
    cy.get("[data-cy=book-form-status]").click();
    cy.get("[data-cy=confirm-dialog-publish]").should("be.visible");
  });

  it("donne le focus à Annuler, pas à l'action", () => {
    // Ces questions sont toutes irréversibles : une frappe réflexe sur Entrée
    // doit y renoncer, jamais les déclencher.
    cy.focused().should("have.attr", "data-cy", "confirm-dialog-publish-cancel");
  });

  it("renonce quand le navigateur annule le dialogue (Échap)", () => {
    // On déclenche l'événement `cancel`, pas la touche : la fermeture par Échap
    // est un comportement natif du navigateur, que Cypress ne peut pas provoquer
    // avec un événement clavier synthétique. Ce qui NOUS appartient, et qu'il
    // faut donc vérifier, c'est que notre gestionnaire referme proprement — sans
    // ça l'état de l'appelant resterait « ouvert » et le dialogue ne
    // reviendrait plus jamais.
    cy.get("[data-cy=confirm-dialog-publish]").trigger("cancel", { cancelable: true });
    cy.get("[data-cy=confirm-dialog-publish]").should("not.be.visible");
    cy.get("[data-cy=book-form-status]").should("not.be.checked");
  });

  it("renonce sur un clic à côté du panneau", () => {
    // Le clic vise le fond, pas le panneau : `<dialog>` reçoit alors l'événement.
    cy.get("[data-cy=confirm-dialog-publish]").click("topLeft");
    cy.get("[data-cy=confirm-dialog-publish]").should("not.be.visible");
    cy.get("[data-cy=book-form-status]").should("not.be.checked");
  });

  it("couvre la page d'un fond et se centre dans la fenêtre", () => {
    cy.window().then((fenetre) => {
      const dialogue = fenetre.document.querySelector("[data-cy=confirm-dialog-publish]")!;
      const fond = fenetre.getComputedStyle(dialogue, "::backdrop");
      const boite = dialogue.getBoundingClientRect();

      // Le fond n'est pas cosmétique : c'est lui qui dit que le reste de la page
      // est hors service. Les captures Cypress ne rendent pas le top layer, d'où
      // cette vérification sur le style calculé plutôt que sur une image.
      expect(fond.backgroundColor, "le fond est peint").to.not.be.oneOf([
        "rgba(0, 0, 0, 0)",
        "transparent",
        "",
      ]);
      expect(Number.parseInt(fond.height, 10), "le fond couvre la hauteur").to.be.at.least(
        fenetre.innerHeight - 20
      );

      const ecartHorizontal = Math.abs(
        boite.left - (fenetre.innerWidth - boite.width - boite.left)
      );
      expect(ecartHorizontal, "le panneau est centré horizontalement").to.be.lessThan(24);
    });
  });

  it("reste lisible sur un écran de téléphone", () => {
    cy.viewport("iphone-x");
    cy.get("[data-cy=confirm-dialog-publish-panel]").should("be.visible");
    cy.get("[data-cy=confirm-dialog-publish-accept]").should("be.visible");
    cy.get("[data-cy=confirm-dialog-publish-cancel]").should("be.visible");
    cy.get("[data-cy=confirm-dialog-publish-panel]").then(($panneau) => {
      const boite = $panneau[0].getBoundingClientRect();
      expect(boite.width, "le panneau tient dans la largeur").to.be.at.most(375);
      expect(boite.left, "sans déborder à gauche").to.be.at.least(0);
    });
  });

  it("laisse la suppression au second clic, jamais au premier", () => {
    cy.get("[data-cy=confirm-dialog-publish-cancel]").click();
    cy.visit("/admin");
    cy.get(`[data-cy=admin-book-row-${SEED_PUBLIE}]`).click();

    // Le clic sur « Supprimer ce livre » ne fait qu'ouvrir la question : le livre
    // doit être toujours là tant qu'on n'a pas répondu.
    cy.get("[data-cy=admin-delete-book]").click();
    cy.get("[data-cy=confirm-dialog-delete]").should("be.visible");
    cy.get("[data-cy=confirm-dialog-delete-cancel]").click();

    cy.get("[data-cy=confirm-dialog-delete]").should("not.be.visible");
    cy.storedBook(SEED_PUBLIE).should((livre) => {
      expect(livre, "renoncer ne supprime rien").to.not.equal(null);
    });
  });
});

export {};
