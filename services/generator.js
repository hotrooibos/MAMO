import { readDictionary } from '../db/index.js';
import { AppError } from '../config/AppError.js';
import { logger } from '../config/logger.js';

/**
 * Génère un alias aléatoire à partir du dictionnaire trilingue.
 * Vérifie les collisions avec les alias existants et la blacklist.
 * Évite les répétitions immédiates (tracking des 3 dernières).
 *
 * @param {object} options
 * @param {string} options.lang - Langue : 'fr', 'en', 'es', 'mashup'
 * @param {string} options.domain - Domaine (pour la vérification de collision)
 * @param {string[]} options.existingAliases - Liste des from@domain existants
 * @param {string[]} options.blacklist - Liste des from@domain blacklistés
 * @param {string[]} [options.recent=[]] - 3 dernières générations pour éviter répétition
 * @returns {Promise<{ from: string, usedLang: string }>}
 * @throws {AppError} Si impossible de générer après 5 tentatives
 */
export async function generateAlias({ lang = 'mashup', domain, existingAliases = [], blacklist = [], recent = [] } = {}) {
  const dict = await readDictionary();
  const prefixes = Array.isArray(dict.prefixes) ? dict.prefixes : [];
  const suffixes = Array.isArray(dict.suffixes) ? dict.suffixes : [];

  if (prefixes.length === 0 || suffixes.length === 0) {
    throw new AppError('Le dictionnaire est vide', { statusCode: 500, code: 'DICTIONARY_EMPTY' });
  }

  const usedFroms = new Set([
    ...existingAliases.map((a) => (typeof a === 'string' ? a.toLowerCase() : '')),
    ...blacklist.map((b) => (typeof b === 'string' ? b.toLowerCase() : '')),
    ...recent.map((r) => r.toLowerCase()),
  ].filter(Boolean));

  const supportedLangs = ['fr', 'en', 'es'];
  const actualLang = lang === 'mashup'
    ? supportedLangs[Math.floor(Math.random() * supportedLangs.length)]
    : lang;

  for (let attempt = 0; attempt < 5; attempt++) {
    const prefix = pickWord(prefixes, actualLang);
    const suffix = pickWord(suffixes, actualLang);
    const from = `${prefix}-${suffix}`.toLowerCase();
    const aliasAddress = `${from}@${domain}`.toLowerCase();

    if (usedFroms.has(aliasAddress)) continue;

    // Vérifier aussi le from seul (sans domaine)
    if (usedFroms.has(from)) continue;

    logger.debug(`Generated alias: ${from} (${actualLang}, attempt ${attempt + 1})`, { module: 'generator' });
    return { from, usedLang: actualLang };
  }

  throw new AppError('Impossible de générer un alias unique après 5 tentatives', {
    statusCode: 409,
    code: 'GENERATION_FAILED',
  });
}

/**
 * Pioche un mot aléatoire dans la liste, pour la langue spécifiée.
 * Fallback : fr → en → first available.
 */
function pickWord(list, lang) {
  const item = list[Math.floor(Math.random() * list.length)];
  if (!item) return 'unknown';
  return item[lang] || item.fr || item.en || item.es || Object.values(item)[0] || 'unknown';
}
