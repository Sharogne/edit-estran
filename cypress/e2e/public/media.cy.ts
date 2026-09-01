// Les couvertures vivent toujours dans content.json, encodées en data URI, mais
// elles ne sont plus SERVIES inline dans le HTML : elles passent par /media.
//
// Ce que ce fichier protège, dans l'ordre d'importance :
//   1. plus une seule data URI d'image dans le HTML — c'est ce qui pesait ~1,6 Mo
//      sur un catalogue de 50 livres, sans cache ni chargement différé possibles ;
//   2. le format 2:3 est décidé à l'encodage, donc l'image SERVIE l'a déjà — le
//      CSS ne rogne plus rien à l'insu de l'éditeur ;
//   3. l'URL porte une version, ce qui autorise un cache immuable : une adresse
//      périmée doit donc échouer, sinon un visiteur garderait l'ancienne image.

const PUBLIE = "les-jardins-suspendus";

/** Rapport largeur / hauteur réellement décodé par le navigateur. */
function ratio($img: JQuery<HTMLElement>): number {
  const img = $img[0] as HTMLImageElement;
  return img.naturalWidth / img.naturalHeight;
}

describe("Livraison des images (/media)", () => {
  it("ne laisse aucune image inline dans le HTML des pages publiques", () => {
    for (const url of ["/fr", "/fr/projets", `/fr/projets/${PUBLIE}`]) {
      cy.request(url).then((reponse) => {
        expect(reponse.body, `${url} ne doit embarquer aucune image`).to.not.contain("data:image/");
      });
    }
  });

  it("sert la couverture d'une fiche en WebP, au format 2:3, en cache immuable", () => {
    cy.visit(`/fr/projets/${PUBLIE}`);

    cy.get("[data-cy=project-cover]")
      .should("be.visible")
      .and(($img) => {
        expect($img.attr("src"), "la source est une URL /media").to.match(
          /^\/media\/[^/]+\/cover-[0-9a-z]+\.webp$/
        );
        expect(ratio($img), "l'image servie est déjà au format 2:3").to.be.closeTo(2 / 3, 0.01);
      });

    cy.get("[data-cy=project-cover]")
      .invoke("attr", "src")
      .then((src) => {
        cy.request(String(src)).then((reponse) => {
          expect(reponse.headers["content-type"]).to.eq("image/webp");
          expect(reponse.headers["cache-control"]).to.contain("immutable");
        });
      });
  });

  it("refuse une adresse dont la version ne correspond plus", () => {
    cy.visit(`/fr/projets/${PUBLIE}`);
    cy.get("[data-cy=project-cover]")
      .invoke("attr", "src")
      .then((src) => {
        // Une version périmée DOIT échouer : servir l'image malgré tout, avec un
        // cache d'un an, figerait une couverture remplacée chez le visiteur.
        const perimee = String(src).replace(/-[0-9a-z]+\.webp$/, "-zzzzzz.webp");
        expect(perimee, "l'URL a bien été modifiée").to.not.eq(String(src));
        cy.request({ url: perimee, failOnStatusCode: false }).its("status").should("eq", 404);

        const inconnue = String(src).replace("/cover-", "/inexistante-");
        cy.request({ url: inconnue, failOnStatusCode: false }).its("status").should("eq", 404);
      });
  });

  it("sert aux cartes de liste une variante nette mais plus légère que la fiche", () => {
    cy.visit("/fr/projets");
    cy.get(`[data-cy=book-card-${PUBLIE}] img`)
      .should("be.visible")
      .and(($img) => {
        expect($img.attr("src"), "variante carte").to.match(
          /^\/media\/[^/]+\/card-[0-9a-z]+\.webp$/
        );
        expect(ratio($img), "carte au format 2:3").to.be.closeTo(2 / 3, 0.01);
        // 600 px de large : assez pour rester net sur un écran à haute densité,
        // là où la vignette de 320 px se voyait floue à côté de la fiche.
        expect(($img[0] as HTMLImageElement).naturalWidth, "largeur de la carte").to.eq(600);
      });
  });

  it("laisse le navigateur différer le chargement des cartes", () => {
    // Impossible tant que la source était une data URI : next/image forçait
    // `isLazy = false` sur toute source `data:`.
    cy.visit("/fr/projets");
    cy.get("[data-cy=projects-grid] img").each(($img) => {
      expect($img.attr("loading"), "chargement différé").to.eq("lazy");
    });
  });
});

export {};
