import fs from 'fs/promises';
import path from 'path';
import { logger } from '../config/logger.js';

const DATA_DIR = path.resolve('data', '.locks');
const LOCK_TIMEOUT = 5000; // ms
const LOCK_RETRY_DELAY = 100; // ms
const STALE_LOCK_AGE = 10000; // ms — considérer un lock comme stale après 10s

async function ensureLockDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

/**
 * Acquiert un lock fichier exclusif pour une ressource.
 * Utilise open + O_EXCL pour atomicité.
 *
 * @param {string} resourceName - Nom de la ressource à verrouiller (e.g., 'aliases')
 * @returns {Promise<() => Promise<void>>} Fonction de release
 * @throws {AppError} Si le lock ne peut être acquis dans le timeout
 */
export async function acquireLock(resourceName) {
  await ensureLockDir();
  const lockFile = path.join(DATA_DIR, `${resourceName}.lock`);
  const deadline = Date.now() + LOCK_TIMEOUT;

  while (Date.now() < deadline) {
    try {
      // Vérifier si un lock stale existe
      try {
        const stat = await fs.stat(lockFile);
        if (Date.now() - stat.mtimeMs > STALE_LOCK_AGE) {
          logger.warn(`Removing stale lock for "${resourceName}"`, { module: 'lock' });
          await fs.unlink(lockFile);
        }
      } catch {
        // fichier n'existe pas → ok
      }

      // Tentative d'acquisition exclusive
      const fd = await fs.open(lockFile, 'wx');
      await fd.write(`${process.pid}\n`);
      await fd.close();

      logger.debug(`Lock acquired for "${resourceName}"`, { module: 'lock' });

      return async () => {
        try {
          await fs.unlink(lockFile);
          logger.debug(`Lock released for "${resourceName}"`, { module: 'lock' });
        } catch (err) {
          logger.warn(`Failed to release lock for "${resourceName}": ${err.message}`, { module: 'lock' });
        }
      };
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock détenu par quelqu'un d'autre — attendre et réessayer
        await new Promise((r) => setTimeout(r, LOCK_RETRY_DELAY));
        continue;
      }
      // Erreur inattendue
      throw err;
    }
  }

  throw Object.assign(new Error(`Lock timeout for resource "${resourceName}" after ${LOCK_TIMEOUT}ms`), {
    code: 'LOCK_TIMEOUT',
    statusCode: 409,
  });
}
