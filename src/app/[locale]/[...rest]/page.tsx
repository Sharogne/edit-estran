import { notFound } from "next/navigation";

/**
 * Attrape-tout du site public : toute adresse qui ne correspond à aucune route
 * du segment de langue (/fr/inexistant, /projets/quelque-chose…) atterrit ici.
 *
 * Sa seule raison d'être est de faire remonter le 404 DEPUIS une page, pour que
 * la frontière [locale]/not-found.tsx s'applique et rende la 404 du site,
 * traduite et habillée. Sans cette route, ces adresses ne matchaient rien et
 * Next servait sa propre page — en anglais, sans style.
 *
 * Un not-found.tsx à la racine aurait paru plus direct, mais il prend le pas
 * sur celui de [locale] : les fiches livres introuvables perdaient alors leur
 * 404 traduite, et la page s'imbriquait dans le layout public (deux <html>).
 */
export default function CatchAllNotFound() {
  notFound();
}
