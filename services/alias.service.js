import crypto from 'crypto';
import { config } from '../config/index.js';
import { AppError } from '../config/AppError.js';
import { ovhCreate, ovhUpdate, ovhDelete } from '../config/ovh.js';
import { read, write } from '../db/index.js';
import { logger } from '../config/logger.js';

// ---- Validation helpers ----

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // RFC 5322 simplifié — suffisant pour un usage interne
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validateFrom(from) {
  if (!from || typeof from !== 'string') return false;
  const trimmed = from.trim();
  if (trimmed.length < 1 || trimmed.length > 64) return false;
  return /^[a-z0-9._-]+$/i.test(trimmed);
}

function validateTags(tags) {
  if (!Array.isArray(tags)) return false;
  if (tags.length > 10) return false;
  return tags.every((t) => typeof t === 'string' && t.length >= 1 && t.length <= 30);
}

// ---- Validation aggregator ----

function validateCreateInput(data) {
  const errors = [];

  // From
  if (!validateFrom(data.from)) {
    errors.push('Le champ From est requis (1-64 caractères, lettres/chiffres/tirets/points/underscores, sans @)');
  }

  // To
  if (!validateEmail(data.to)) {
    errors.push('Le champ To doit être une adresse email valide');
  }

  // Domain
  if (!data.domain || !config.domains.includes(data.domain)) {
    errors.push(`Domaine invalide. Domaines configurés : ${config.domains.join(', ')}`);
  }

  // Tags (optionnel)
  if (data.tags && data.tags.length > 0 && !validateTags(data.tags)) {
    errors.push('Maximum 10 tags, chaque tag entre 1 et 30 caractères');
  }

  // Description (optionnel)
  if (data.description && typeof data.description === 'string' && data.description.length > 500) {
    errors.push('La description ne peut pas dépasser 500 caractères');
  }

  // Active (optionnel, défaut true)
  if (data.active !== undefined && typeof data.active !== 'boolean') {
    errors.push('Le champ active doit être un booléen');
  }

  // tempExpires (optionnel)
  if (data.tempExpires) {
    const ts = Date.parse(data.tempExpires);
    if (isNaN(ts) || ts <= Date.now()) {
      errors.push('La date d\'expiration doit être dans le futur');
    }
  }

  return errors;
}

// ---- Service ----

/**
 * Crée un alias : validation → blacklist → OVH → store local.
 *
 * @param {object} input
 * @param {string} input.domain
 * @param {string} input.from - Partie locale (sans @)
 * @param {string} input.to - Destination email
 * @param {string} [input.description]
 * @param {string[]} [input.tags]
 * @param {boolean} [input.active=true]
 * @param {string|null} [input.tempExpires] - ISO 8601
 * @returns {Promise<object>} L'alias créé
 * @throws {AppError} Erreur validation, blacklist, ou OVH
 */
export async function createAlias(input) {
  // 1. Validation
  const errors = validateCreateInput(input);
  if (errors.length > 0) {
    throw new AppError(errors.join('; '), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const domain = input.domain.trim();
  const from = input.from.trim();
  const to = input.to.trim();
  const description = (input.description || '').trim();
  const tags = Array.isArray(input.tags) ? input.tags.map((t) => t.trim()).filter(Boolean) : [];
  const active = input.active !== false;
  const tempExpires = input.tempExpires || null;

  // 2. Vérifier la blacklist
  const store = await read();
  const blacklisted = store.blacklist || [];
  const aliasAddress = `${from}@${domain}`.toLowerCase();
  if (blacklisted.some((b) => b.toLowerCase() === aliasAddress)) {
    throw new AppError(
      'Cet alias a déjà été utilisé et supprimé. Choisissez un autre nom.',
      { statusCode: 409, code: 'BLACKLISTED' },
    );
  }

  // 3. Vérifier qu'il n'existe pas déjà (doublon local)
  const existingAlias = store.aliases.find(
    (a) => a.from.toLowerCase() === from.toLowerCase() && a.domain === domain,
  );
  if (existingAlias) {
    throw new AppError(
      `L'alias "${from}@${domain}" existe déjà dans le store local`,
      { statusCode: 409, code: 'ALIAS_EXISTS' },
    );
  }

  // 4. Créer côté OVH
  const now = new Date().toISOString();
  let ovhId;

  try {
    const ovhResult = await ovhCreate(domain, from, to);
    ovhId = ovhResult.id;
  } catch (err) {
    logger.error(`OVH create failed for ${from}@${domain}: ${err.message}`, { module: 'alias' });
    throw new AppError(`Échec de la création sur OVH : ${err.message}`, {
      statusCode: err.statusCode || 502,
      code: 'OVH_CREATE_ERROR',
    });
  }

  // 5. Persister localement
  const newAlias = {
    id: crypto.randomUUID(),
    domain,
    from,
    to,
    tags,
    active,
    tempExpires,
    description,
    ovhId,
    createdAt: now,
    updatedAt: now,
  };

  store.aliases.push(newAlias);
  await write(store);

  logger.info(`Alias created: ${from}@${domain} → ${to} (ovhId: ${ovhId})`, { module: 'alias' });

  return newAlias;
}

/**
 * Met à jour un alias : validation → OVH sync (si nécessaire) → store local.
 * Ne modifie le from que si explicitement fourni (le UI le bloque en read-only).
 *
 * @param {string} id - UUID local
 * @param {object} updates - Champs à modifier
 * @param {string} [updates.to]
 * @param {string} [updates.from]
 * @param {string} [updates.description]
 * @param {string[]} [updates.tags]
 * @param {boolean} [updates.active]
 * @param {string|null} [updates.tempExpires]
 * @returns {Promise<object>} L'alias mis à jour
 * @throws {AppError}
 */
export async function updateAlias(id, updates) {
  // 1. Charger le store
  const store = await read();
  const alias = store.aliases.find((a) => a.id === id);
  if (!alias) {
    throw new AppError('Alias introuvable', { statusCode: 404, code: 'NOT_FOUND' });
  }

  // 2. Valider les champs modifiables
  const errors = [];

  if (updates.to !== undefined) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.to.trim())) {
      errors.push('Le champ To doit être une adresse email valide');
    }
  }

  if (updates.from !== undefined) {
    const fromTrimmed = updates.from.trim();
    if (!fromTrimmed || fromTrimmed.length > 64 || !/^[a-z0-9._-]+$/i.test(fromTrimmed)) {
      errors.push('Le champ From est requis (1-64 caractères, lettres/chiffres/tirets/points/underscores, sans @)');
    }
  }

  if (updates.description !== undefined && typeof updates.description === 'string' && updates.description.length > 500) {
    errors.push('La description ne peut pas dépasser 500 caractères');
  }

  if (updates.tags !== undefined) {
    if (!Array.isArray(updates.tags) || updates.tags.length > 10 || !updates.tags.every((t) => typeof t === 'string' && t.length >= 1 && t.length <= 30)) {
      errors.push('Maximum 10 tags, chaque tag entre 1 et 30 caractères');
    }
  }

  if (updates.active !== undefined && typeof updates.active !== 'boolean') {
    errors.push('Le champ active doit être un booléen');
  }

  if (updates.tempExpires !== undefined && updates.tempExpires !== null) {
    const ts = Date.parse(updates.tempExpires);
    if (isNaN(ts)) {
      errors.push('La date d\'expiration est invalide');
    }
  }

  if (errors.length > 0) {
    throw new AppError(errors.join('; '), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  // 3. Appliquer les modifications (anciennes valeurs par défaut)
  const newFrom = updates.from !== undefined ? updates.from.trim() : alias.from;
  const newTo = updates.to !== undefined ? updates.to.trim() : alias.to;
  const description = updates.description !== undefined ? updates.description : alias.description;
  const tags = updates.tags !== undefined ? updates.tags.map((t) => t.trim()).filter(Boolean) : alias.tags;
  const active = updates.active !== undefined ? updates.active : alias.active;
  const tempExpires = updates.tempExpires !== undefined ? updates.tempExpires : alias.tempExpires;

  const now = new Date().toISOString();

  // 4. Déterminer si un appel OVH est nécessaire
  //    OVH sync nécessaire si from, to, ou active (passage inactif→actif ou actif→inactif) change
  const fromChanged = newFrom !== alias.from;
  const toChanged = newTo !== alias.to;
  const reactivating = !alias.active && active;  // false → true : recréer OVH
  const deactivating = alias.active && !active;  // true → false : supprimer OVH

  try {
    if (deactivating) {
      // Désactiver : supprimer côté OVH uniquement
      await ovhDelete(alias.domain, alias.ovhId);
      alias.ovhId = null;
    } else if (fromChanged || toChanged || reactivating) {
      // From/To a changé OU réactivation : delete + recreate OVH
      if (alias.ovhId) {
        await ovhDelete(alias.domain, alias.ovhId);
      }
      const ovhResult = await ovhCreate(alias.domain, newFrom, newTo);
      alias.ovhId = ovhResult.id;
    }
    // else: ni from, ni to, ni reactivation → pas d'appel OVH
  } catch (err) {
    logger.error(`OVH update failed for ${alias.from}@${alias.domain}: ${err.message}`, { module: 'alias' });
    throw new AppError(`Échec de la mise à jour sur OVH : ${err.message}`, {
      statusCode: err.statusCode || 502,
      code: 'OVH_UPDATE_ERROR',
    });
  }

  // 5. Mettre à jour les champs locaux
  alias.from = newFrom;
  alias.to = newTo;
  alias.description = description;
  alias.tags = tags;
  alias.active = active;
  alias.tempExpires = tempExpires;
  alias.updatedAt = now;

  // 6. Persister
  await write(store);

  logger.info(`Alias updated: ${newFrom}@${alias.domain} → ${newTo} (active: ${active})`, { module: 'alias' });

  return alias;
}

/**
 * Supprime un alias : OVH delete → blacklist → retrait local.
 * Si forceLocal=true, supprime localement même si OVH échoue.
 *
 * @param {string} id - UUID local
 * @param {boolean} [forceLocal=false] - Forcer la suppression locale si OVH échoue
 * @returns {Promise<{ alias: object, forceLocal: boolean }>}
 * @throws {AppError} Si OVH échoue et forceLocal=false
 */
export async function deleteAlias(id, forceLocal = false) {
  // 1. Charger l'alias
  const store = await read();
  const alias = store.aliases.find((a) => a.id === id);
  if (!alias) {
    throw new AppError('Alias introuvable', { statusCode: 404, code: 'NOT_FOUND' });
  }

  // 2. Supprimer côté OVH (sauf force local)
  if (!forceLocal && alias.ovhId) {
    try {
      await ovhDelete(alias.domain, alias.ovhId);
    } catch (err) {
      logger.error(`OVH delete failed for ${alias.from}@${alias.domain}: ${err.message}`, { module: 'alias' });
      throw new AppError(
        `Échec de la suppression sur OVH : ${err.message}. Utilisez forceLocal=true pour forcer.`,
        { statusCode: err.statusCode || 502, code: 'OVH_DELETE_ERROR' },
      );
    }
  } else if (forceLocal) {
    logger.warn(`Force local delete for ${alias.from}@${alias.domain} (ovhId: ${alias.ovhId})`, { module: 'alias' });
  }

  // 3. Ajouter à la blacklist
  const aliasAddress = `${alias.from}@${alias.domain}`.toLowerCase();
  if (!Array.isArray(store.blacklist)) store.blacklist = [];
  if (!store.blacklist.some((b) => b.toLowerCase() === aliasAddress)) {
    store.blacklist.push(aliasAddress);
  }

  // 4. Retirer du store
  const idx = store.aliases.indexOf(alias);
  if (idx !== -1) store.aliases.splice(idx, 1);

  // 5. Persister
  await write(store);

  logger.info(`Alias deleted: ${alias.from}@${alias.domain} (forceLocal: ${forceLocal})`, { module: 'alias' });

  return { alias, forceLocal };
}
