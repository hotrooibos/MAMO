import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../config/logger.js';
import { acquireLock } from './lock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const ALIASES_FILE = path.join(DATA_DIR, 'aliases.json');
const DICTIONARY_FILE = path.join(DATA_DIR, 'dictionary.json');
const MAX_BACKUPS = 5;

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Logger les erreurs non-EEXIST (permissions, read-only FS, etc.)
    if (err.code !== 'EEXIST') {
      logger.error(`Cannot create data directory: ${err.message}`, { module: 'db' });
    }
  }
}

/**
 * Lit le fichier aliases.json. Retourne la structure par défaut si absent.
 * Tente une restauration depuis les backups si le fichier est corrompu.
 */
export async function read() {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(ALIASES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // S'assurer que la structure de base est correcte
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('aliases.json is not an object');
    }
    return {
      aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [],
      blacklist: Array.isArray(parsed.blacklist) ? parsed.blacklist : [],
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      const empty = { aliases: [], blacklist: [] };
      await write(empty);
      return empty;
    }
    logger.error(`Corrupted aliases.json: ${err.message}`, { module: 'db' });
    const restored = await restoreFromBackup();
    if (restored) return restored;
    logger.warn('No valid backup found, starting fresh', { module: 'db' });
    const empty = { aliases: [], blacklist: [] };
    await write(empty);
    return empty;
  }
}

/**
 * Écriture atomique avec rotation des backups.
 * 1. Sauvegarde l'état courant (backup AVANT écriture)
 * 2. Écrit dans .tmp
 * 3. Renomme .tmp → aliases.json (atomique sur le même filesystem)
 * Acquisition d'un lock pour éviter les races conditions.
 */
export async function write(data) {
  const release = await acquireLock('aliases');
  try {
    await ensureDataDir();
    const json = JSON.stringify(data, null, 2);
    const tmpFile = ALIASES_FILE + '.tmp';

    // Backup de l'état courant AVANT la nouvelle écriture
    await rotateBackups();

    // Écriture atomique
    await fs.writeFile(tmpFile, json, 'utf-8');
    await fs.rename(tmpFile, ALIASES_FILE);
  } catch (err) {
    // Nettoyer le .tmp si l'écriture a échoué
    try {
      await fs.unlink(ALIASES_FILE + '.tmp');
    } catch {
      // ignore if already removed
    }
    throw err;
  } finally {
    await release();
  }
}

async function rotateBackups() {
  // Décaler .bak.N → .bak.N+1
  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
    const oldPath = ALIASES_FILE + `.bak.${i}`;
    const newPath = ALIASES_FILE + `.bak.${i + 1}`;
    try {
      await fs.rename(oldPath, newPath);
    } catch (err) {
      // ENOENT = pas de backup à ce niveau (normal au début)
      if (err.code !== 'ENOENT') {
        logger.warn(`Backup rotation rename failed: ${err.message}`, { module: 'db' });
      }
    }
  }
  // Copier l'état courant vers .bak.1 (AVANT la nouvelle écriture)
  try {
    await fs.copyFile(ALIASES_FILE, ALIASES_FILE + '.bak.1');
    logger.debug('Backup .bak.1 created', { module: 'db' });
  } catch (err) {
    // ENOENT = pas encore de fichier courant (première écriture)
    if (err.code !== 'ENOENT') {
      logger.warn(`Backup copy failed: ${err.message}`, { module: 'db' });
    }
  }
}

async function restoreFromBackup() {
  for (let i = 1; i <= MAX_BACKUPS; i++) {
    const backupPath = ALIASES_FILE + `.bak.${i}`;
    try {
      const raw = await fs.readFile(backupPath, 'utf-8');
      const data = JSON.parse(raw);
      // Restauration atomique (tmp → rename)
      const tmpFile = ALIASES_FILE + '.restore.tmp';
      await fs.writeFile(tmpFile, raw, 'utf-8');
      await fs.rename(tmpFile, ALIASES_FILE);
      logger.info(`Restored aliases.json from backup .bak.${i}`, { module: 'db' });
      return {
        aliases: Array.isArray(data.aliases) ? data.aliases : [],
        blacklist: Array.isArray(data.blacklist) ? data.blacklist : [],
      };
    } catch {
      // try next backup
    }
  }
  return null;
}

/**
 * Lit le dictionnaire (prefixes/suffixes). Retourne la valeur par défaut si absent.
 */
export async function readDictionary() {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(DICTIONARY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`Error reading dictionary.json: ${err.message}`, { module: 'db' });
    }
    const empty = { prefixes: [], suffixes: [] };
    try {
      await fs.writeFile(DICTIONARY_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    } catch (writeErr) {
      logger.warn(`Cannot create default dictionary.json: ${writeErr.message}`, { module: 'db' });
    }
    return empty;
  }
}
