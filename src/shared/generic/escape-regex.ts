/**
 * Échappe les métacaractères regex d'une entrée utilisateur avant usage
 * dans un `$regex` Mongoose. Sans cela, une entrée comme `(a+)+b` permet
 * une attaque ReDoS (CPU à 100 %) sur les endpoints de recherche.
 */
export const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
