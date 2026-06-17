import crypto from 'crypto';
import { ovhListing, ovhGet } from '../config/ovh.js';
import { config } from '../config/index.js';
import { read, write } from '../db/index.js';
import { deleteAlias } from './alias.service.js';
import { logger } from '../config/logger.js';

/**
 * Sync startup — importe les alias OVH pour chaque domaine configuré.
 * S'exécute de manière asynchrone pour ne pas bloquer le rendu de la page.
 * Ignore les alias déjà présents dans le store local (se base sur ovhId).
 */
export async function syncStartup() {
  logger.info('Sync startup started', { module: 'sync' });

  for (const domain of config.domains) {
    try {
      const ids = await ovhListing(domain);
      logger.info(`Domain "${domain}": ${ids.length} alias(es) on OVH`, { module: 'sync' });

      if (ids.length === 0) continue;

      const store = await read();
      // Normaliser ovhId en Number pour comparaison robuste
      const knownOvhIds = new Set(store.aliases.map((a) => Number(a.ovhId)));
      const toImport = [];

      for (const ovhId of ids) {
        const numericId = Number(ovhId);
        if (knownOvhIds.has(numericId)) continue;

        const detail = await ovhGet(domain, numericId);
        const now = new Date().toISOString();

        toImport.push({
          id: crypto.randomUUID(),
          domain,
          from: String(detail.from || ''),
          to: String(detail.to || ''),
          tags: [],
          active: true,
          tempExpires: null,
          description: '',
          ovhId: numericId,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (toImport.length > 0) {
        store.aliases.push(...toImport);
        await write(store);
        logger.info(`Imported ${toImport.length} new alias(es) for domain "${domain}"`, { module: 'sync' });
      } else {
        logger.info(`No new aliases to import for domain "${domain}"`, { module: 'sync' });
      }
    } catch (err) {
      logger.error(`Sync failed for domain "${domain}": ${err.message}`, {
        module: 'sync',
        stack: err.stack,
      });
    }
  }

  // Nettoyer les alias temporaires expirés
  await cleanupExpiredTempAliases();

  logger.info('Sync startup complete', { module: 'sync' });
}

/**
 * Parcourt les alias temporaires expirés et les supprime automatiquement.
 * La suppression se fait en mode forceLocal (OVH déjà considéré comme expiré).
 * Silencieux — pas de notification pour éviter de polluer l'UI au démarrage.
 */
async function cleanupExpiredTempAliases() {
  const store = await read();
  const now = new Date();
  const expired = store.aliases.filter(
    (a) => a.tempExpires && new Date(a.tempExpires) <= now,
  );

  if (expired.length === 0) return;

  logger.info(`Cleaning up ${expired.length} expired temp alias(es)`, { module: 'sync' });

  for (const alias of expired) {
    try {
      // Force local: OVH a déjà dû supprimer l'alias, ou on ignore l'erreur OVH
      await deleteAlias(alias.id, true);
      logger.info(`Expired alias cleaned up: ${alias.from}@${alias.domain}`, { module: 'sync' });
    } catch (err) {
      logger.error(`Failed to clean up expired alias ${alias.from}@${alias.domain}: ${err.message}`, { module: 'sync' });
    }
  }

  logger.info(`Cleanup complete: ${expired.length} expired alias(es) removed`, { module: 'sync' });
}

// ---- Sync status ----
const syncStatus = {
  isSyncing: false,
  lastSyncAt: null,
  lastError: null,
};

export function getSyncStatus() {
  return { ...syncStatus };
}

function setSyncStatus(partial) {
  Object.assign(syncStatus, partial);
}

// ---- Discrepancy comparison ----

/**
 * Compare les alias locaux avec la liste OVH pour détecter les écarts.
 * @returns {Promise<{ localOnly: object[], ovhOnly: object[], synced: object[], timestamp: string }>}
 */
export async function computeDiscrepancy() {
  const store = await read();
  const localAliases = Array.isArray(store.aliases) ? store.aliases : [];

  // Collecter tous les IDs OVH de tous les domaines
  const ovhAliases = []; // { ovhId, domain, from, to }
  const ovhIdSet = new Set();

  for (const domain of config.domains) {
    try {
      const ids = await ovhListing(domain);
      for (const ovhId of ids) {
        const numericId = Number(ovhId);
        ovhIdSet.add(`${domain}:${numericId}`);
        try {
          const detail = await ovhGet(domain, numericId);
          ovhAliases.push({
            ovhId: numericId,
            domain,
            from: String(detail.from || ''),
            to: String(detail.to || ''),
          });
        } catch (err) {
          logger.warn(`Failed to get OVH detail for ${domain}/${numericId}: ${err.message}`, { module: 'sync' });
        }
      }
    } catch (err) {
      logger.error(`Failed to list OVH aliases for ${domain}: ${err.message}`, { module: 'sync' });
    }
  }

  // Classifier les alias locaux
  const localOnly = [];
  const synced = [];

  for (const alias of localAliases) {
    if (alias.ovhId && ovhIdSet.has(`${alias.domain}:${Number(alias.ovhId)}`)) {
      synced.push(alias);
    } else {
      localOnly.push(alias);
    }
  }

  // Filtrer les OVH-only (pas dans local)
  const ovhIdToLocal = new Map();
  for (const alias of localAliases) {
    if (alias.ovhId) {
      ovhIdToLocal.set(`${alias.domain}:${Number(alias.ovhId)}`, true);
    }
  }
  const ovhOnly = ovhAliases.filter(
    (o) => !ovhIdToLocal.has(`${o.domain}:${o.ovhId}`),
  );

  return {
    localOnly,
    ovhOnly,
    synced,
    timestamp: new Date().toISOString(),
  };
}

// ---- Periodic sync ----

/**
 * Sync périodique — interroge OVH silencieusement, importe les nouveaux alias
 * et nettoie les alias temporaires expirés.
 * Met à jour syncStatus. Ne bloque pas.
 */
export async function syncPeriodic() {
  if (syncStatus.isSyncing) {
    logger.debug('Sync already in progress, skipping', { module: 'sync' });
    return;
  }

  setSyncStatus({ isSyncing: true });
  logger.info('Periodic sync started', { module: 'sync' });

  try {
    // Même logique que syncStartup pour l'import
    for (const domain of config.domains) {
      try {
        const ids = await ovhListing(domain);
        if (ids.length === 0) continue;

        const store = await read();
        const knownOvhIds = new Set(store.aliases.map((a) => Number(a.ovhId)));
        const toImport = [];

        for (const ovhId of ids) {
          const numericId = Number(ovhId);
          if (knownOvhIds.has(numericId)) continue;

          const detail = await ovhGet(domain, numericId);
          const now = new Date().toISOString();

          toImport.push({
            id: crypto.randomUUID(),
            domain,
            from: String(detail.from || ''),
            to: String(detail.to || ''),
            tags: [],
            active: true,
            tempExpires: null,
            description: '',
            ovhId: numericId,
            createdAt: now,
            updatedAt: now,
          });
        }

        if (toImport.length > 0) {
          store.aliases.push(...toImport);
          await write(store);
          logger.info(`Periodic sync: imported ${toImport.length} new alias(es) for domain "${domain}"`, { module: 'sync' });
        }
      } catch (err) {
        logger.error(`Periodic sync failed for domain "${domain}": ${err.message}`, { module: 'sync' });
      }
    }

    // Nettoyer les alias temporaires expirés
    await cleanupExpiredTempAliases();

    setSyncStatus({ lastSyncAt: new Date().toISOString(), lastError: null });
    logger.info('Periodic sync complete', { module: 'sync' });
  } catch (err) {
    setSyncStatus({ lastError: err.message });
    logger.error(`Periodic sync error: ${err.message}`, { module: 'sync', stack: err.stack });
  } finally {
    setSyncStatus({ isSyncing: false });
  }
}

// ---- Manual sync ----

/**
 * Sync manuelle — exécute syncPeriodic() puis retourne le rapport de discrepancy.
 * @returns {Promise<object>} Le rapport de discrepancy
 */
export async function syncManual() {
  await syncPeriodic();
  return await computeDiscrepancy();
}
