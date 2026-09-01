// Les couvertures sont stockées en data URI, illisibles pour un crawler : la
// route /og/<slug> les redécode. Ce fichier vérifie cette chaîne de bout en
// bout, ainsi que les deux surfaces qui exposent le catalogue aux robots.
//
// La suite tourne avec SITE_ENV=production (.env.test) : c'est le comportement
// dont une régression coûte cher. Le cas staging — robots.txt fermé — est
// vérifié par scripts/deploy-staging.sh, qui refuse de laisser en ligne un site
// de test indexable.

describe("SEO & partages sociaux", () => {
  it("interdit le back office aux robots", () => {
    cy.request("/robots.txt").then((reponse) => {
      expect(reponse.status).to.eq(200);
      expect(reponse.body).to.contain("Disallow: /admin");
      expect(reponse.body).to.contain("/sitemap.xml");
    });
  });

  it("n'interdit pas tout le site en production", () => {
    cy.request("/robots.txt").then((reponse) => {
      // Piège : "Disallow: /admin" CONTIENT "Disallow: /". Une simple recherche
      // de sous-chaîne laisserait donc passer le garde-fou de staging jusqu'en
      // production sans qu'aucun test ne bronche — d'où la comparaison ligne à
      // ligne.
      const lignes = String(reponse.body)
        .split(String.fromCharCode(10))
        .map((ligne) => ligne.trim());
      expect(lignes, "aucune interdiction globale en production").to.not.include("Disallow: /");
    });
  });

  it("n'affiche pas le bandeau d'environnement de test en production", () => {
    cy.login();
    cy.visit("/admin");
    cy.get("[data-cy=admin-env-banner]").should("not.exist");
  });

  it("ne liste que les livres publiés dans le sitemap", () => {
    cy.request("/sitemap.xml").then((reponse) => {
      expect(reponse.status).to.eq(200);
      expect(reponse.body).to.contain("/fr/projets/les-jardins-suspendus");
      expect(reponse.body).to.contain("/en/projets/les-jardins-suspendus");
      expect(reponse.body).to.contain("/fr/projets/cartographie-du-silence");
      // le brouillon ne doit jamais fuiter
      expect(reponse.body).to.not.contain("manuscrit-inacheve");
    });
  });

  it("sert la couverture décodée aux crawlers", () => {
    cy.request("/og/les-jardins-suspendus").then((reponse) => {
      expect(reponse.status).to.eq(200);
      expect(reponse.headers["content-type"]).to.contain("image/webp");
      expect(Number(reponse.headers["content-length"])).to.be.greaterThan(1000);
    });
  });

  it("référence cette image dans les métadonnées de la fiche", () => {
    cy.request("/fr/projets/les-jardins-suspendus")
      .its("body")
      .should("contain", 'property="og:image"')
      .and("contain", "/og/les-jardins-suspendus");
  });

  it("ne divulgue ni brouillon ni slug inconnu", () => {
    for (const slug of ["manuscrit-inacheve", "n-existe-pas"]) {
      cy.request({ url: `/og/${slug}`, failOnStatusCode: false })
        .its("status")
        .should("eq", 404);
    }
  });
});

export {};
