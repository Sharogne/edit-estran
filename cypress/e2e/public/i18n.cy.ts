// « Une clé ajoutée dans l'un DOIT exister dans l'autre » est une convention non
// négociable du projet (AGENTS.md) : jusqu'ici rien ne la vérifiait. Le premier
// test la couvre à la source, les suivants sur le rendu.

describe("Page introuvable", () => {
  // Une adresse erronée sur un site vitrine français rendait la page par
  // défaut de Next : « 404: This page could not be found. », en anglais, sans
  // style ni en-tête. Seules les fiches livres étaient correctement traitées.
  it("rend la 404 du site, traduite et habillée, sur une adresse inconnue", () => {
    for (const [chemin, titre] of [
      ["/fr/inexistant", "Page introuvable"],
      ["/en/inexistant", "Page not found"],
    ] as const) {
      cy.request({ url: chemin, failOnStatusCode: false }).its("status").should("eq", 404);
      cy.visit(chemin, { failOnStatusCode: false });
      cy.get("[data-cy=not-found-title]").should("have.text", titre);
      // L'habillage du site, absent de la page par défaut de Next.
      cy.get("[data-cy=header-title]").should("be.visible");
      cy.get("[data-cy=not-found-home]").should("be.visible");
    }
  });

  it("refuse une locale malformée sans lever côté serveur", () => {
    // Le segment [locale] accepte n'importe quoi. La page se rendait avant que
    // le notFound() du layout ne prenne effet et atteignait
    // Intl.DateTimeFormat avec une étiquette invalide : RangeError à chaque
    // requête. Le visiteur voyait bien un 404, mais chaque robot balayant
    // /wp-admin ou /.env inondait les logs de production.
    for (const chemin of ["/de", "/e", "/a-b-c", "/123456789"]) {
      cy.request({ url: chemin, failOnStatusCode: false }).its("status").should("eq", 404);
      cy.visit(chemin, { failOnStatusCode: false });
      cy.get("[data-cy=not-found-title]").should("have.text", "Page introuvable");
      cy.get("[data-cy=header-title]").should("be.visible");
    }
  });

  it("préfixe la langue sur un chemin public sans locale", () => {
    // Le middleware next-intl doit rediriger /projets vers /fr/projets. Quand
    // son matcher était neutralisé, ces adresses tombaient en 404 : le test
    // précédent prenait ce 404 pour la règle, alors que c'était le symptôme.
    cy.request({ url: "/projets", followRedirect: false }).should((reponse) => {
      expect(reponse.status).to.eq(307);
      expect(reponse.redirectedToUrl).to.contain("/fr/projets");
    });
    cy.visit("/projets");
    cy.location("pathname").should("eq", "/fr/projets");
    cy.get("[data-cy=projects-title]").should("be.visible");
  });

  it("garde la 404 traduite pour un livre inconnu ou non publié", () => {
    for (const chemin of ["/fr/projets/inconnu", "/fr/projets/manuscrit-inacheve"]) {
      cy.visit(chemin, { failOnStatusCode: false });
      cy.get("[data-cy=not-found-title]").should("have.text", "Page introuvable");
      cy.get("[data-cy=header-title]").should("be.visible");
    }
  });
});

describe("Internationalisation", () => {
  it("garde exactement les mêmes clés dans fr.json et en.json", () => {
    cy.task<{ fr: string[]; en: string[] }>("messageKeys").should((cles) => {
      expect(cles.fr, "clés présentes en FR mais pas en EN (et inversement)").to.deep.equal(
        cles.en
      );
    });
  });

  it("bascule de langue en restant sur la même fiche livre", () => {
    cy.visit("/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=locale-switcher-en]").click();
    cy.url().should("include", "/en/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-title]").should("contain", "The Hanging Gardens");

    cy.get("[data-cy=locale-switcher-fr]").click();
    cy.url().should("include", "/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-title]").should("contain", "Les Jardins suspendus");
  });

  it("traduit le libellé du retournement de couverture", () => {
    cy.visit("/en/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-cover-flip]").should("contain", "See the back cover").click();
    cy.get("[data-cy=project-cover-flip]").should("contain", "See the front cover");

    cy.visit("/fr/projets/les-jardins-suspendus");
    cy.get("[data-cy=project-cover-flip]").should("contain", "4e de couverture");
  });
});
