import ovh from 'ovh';
import { config } from './index.js';
import { logger } from './logger.js';

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1s
const REQUEST_TIMEOUT = 15000; // 15s — évite les appels pendants
let lastRetryAfter = null; // Dernière valeur Retry-After reçue d'OVH

let client = null;

function getClient() {
  if (!client) {
    client = ovh({
      endpoint: 'ovh-eu',
      appKey: config.ovhAppKey,
      appSecret: config.ovhAppSecret,
      consumerKey: config.ovhConsumerKey,
      timeout: REQUEST_TIMEOUT,
    });
  }
  return client;
}

/**
 * Effectue une requête OVH avec gestion du rate limiting (429).
 * En mode dry-run, ne fait aucun appel réel.
 */
async function request(method, path, params = {}) {
  if (config.dryRun) {
    logger.info(`[DRY-RUN] ${method} ${path}`, { module: 'ovh' });
    return method === 'GET' ? [] : {};
  }

  const ovhClient = getClient();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await ovhClient.requestPromised(method, path, params);
      return result;
    } catch (err) {
      // L'API OVH rejette avec { error: statusCode, message: responseMessage }
      const statusCode = err.error ?? err.statusCode;
      const errMsg = typeof err.message === 'string' ? err.message : 'Erreur inconnue';

      if (statusCode === 429 && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * BASE_DELAY + Math.random() * 1000;
        logger.warn(
          `Rate limited (429) on ${method} ${path}, retry ${attempt - 1}/${MAX_RETRIES - 1} in ${Math.round(delay)}ms`,
          { module: 'ovh' },
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Capturer Retry-After si présent dans la réponse OVH
      const retryAfter = err.retryAfter ?? err.headers?.['retry-after'] ?? null;
      if (retryAfter) {
        lastRetryAfter = retryAfter;
      }

      const error = new Error(`OVH API error: ${errMsg}`);
      error.statusCode = statusCode ?? 502;
      error.code = statusCode === 429 ? 'OVH_RATE_LIMITED' : 'OVH_API_ERROR';
      if (lastRetryAfter) {
        error.retryAfter = lastRetryAfter;
      }
      throw error;
    }
  }
}

/**
 * Liste les IDs des redirections (alias) d'un domaine.
 * Retourne un tableau vide si la réponse n'est pas un tableau.
 * @param {string} domain
 * @returns {Promise<number[]>}
 */
export async function ovhListing(domain) {
  const result = await request('GET', `/email/domain/${domain}/redirection`);
  return Array.isArray(result) ? result : [];
}

/**
 * Récupère les détails d'un alias OVH.
 * Valide la présence des champs from/to.
 * @param {string} domain
 * @param {number} id
 * @returns {Promise<{ id: number, from: string, to: string }>}
 */
export async function ovhGet(domain, id) {
  const result = await request('GET', `/email/domain/${domain}/redirection/${id}`);
  if (!result || typeof result.from !== 'string' || typeof result.to !== 'string') {
    logger.warn(`OVH API returned unexpected shape for ${domain}/redirection/${id}`, {
      module: 'ovh',
    });
    return { id, from: '', to: '' };
  }
  return result;
}

/**
 * Crée un alias OVH (redirection email).
 * En dry-run, retourne un faux ID incrémental.
 * @param {string} domain
 * @param {string} from - Partie locale (sans @)
 * @param {string} to - Destination complète
 * @returns {Promise<{ id: number, from: string, to: string }>}
 */
// Délai d'attente max pour la complétion d'une tâche OVH
const TASK_POLL_MAX = 30; // 30 × 1s = 30s
const TASK_POLL_INTERVAL = 1000; // 1s

/**
 * Crée un alias OVH (redirection email).
 * L'API OVH est asynchrone : le POST retourne une tâche, pas la redirection.
 * On attend la fin de la tâche puis on récupère le vrai ID de redirection.
 */
export async function ovhCreate(domain, from, to) {
  const fullFrom = `${from}@${domain}`;
  if (config.dryRun) {
    logger.info(`[DRY-RUN] POST /email/domain/${domain}/redirection { from: "${fullFrom}", to: "${to}" }`, { module: 'ovh' });
    return { id: Date.now(), from, to };
  }

  // 1. Lancer la création asynchrone → récupérer la tâche
  const task = await request('POST', `/email/domain/${domain}/redirection`, { from: fullFrom, to, localCopy: false });
  if (!task || !task.id) {
    throw Object.assign(new Error(`OVH create task returned unexpected shape`), {
      statusCode: 502, code: 'OVH_API_ERROR',
    });
  }

  const taskId = task.id;
  logger.info(`OVH create task ${taskId} launched for ${fullFrom}`, { module: 'ovh' });

  // 2. Attendre la complétion de la tâche
  let completed = false;
  for (let i = 0; i < TASK_POLL_MAX; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL));
    try {
      // eslint-disable-next-line no-await-in-loop
      const status = await request('GET', `/email/domain/${domain}/task/redirection/${taskId}`);
      if (!status) continue;
      const action = (status.action || '').toLowerCase();
      if (action === 'done' || action === 'completed') {
        completed = true;
        break;
      }
      if (action === 'error' || action === 'cancelled') {
        throw Object.assign(new Error(`OVH task ${taskId} failed (${action})`), {
          statusCode: 502, code: 'OVH_TASK_FAILED',
        });
      }
      // 'todo' / 'doing' → continue
    } catch (err) {
      // 404 au début : la tâche n'est pas encore visible → réessayer
      if (err.statusCode === 404 && i < 5) continue;
      throw err;
    }
  }

  if (!completed) {
    throw Object.assign(new Error(`OVH task ${taskId} did not complete within ${TASK_POLL_MAX}s`), {
      statusCode: 504, code: 'OVH_TASK_TIMEOUT',
    });
  }

  // 3. Récupérer la redirection créée via le filtre from
  const ids = await request('GET', `/email/domain/${domain}/redirection`, { from: fullFrom });
  if (!ids || ids.length === 0) {
    // Fallback : lister toutes les redirections et chercher par from
    const allIds = await request('GET', `/email/domain/${domain}/redirection`);
    throw Object.assign(
      new Error(`Redirection ${fullFrom} not found after task completion (${allIds.length} total on OVH)`),
      { statusCode: 502, code: 'OVH_REDIRECTION_NOT_FOUND' },
    );
  }

  // 4. Récupérer les détails du premier résultat
  const result = await request('GET', `/email/domain/${domain}/redirection/${ids[0]}`);
  if (!result || result.id == null) {
    throw Object.assign(new Error(`OVH get redirection detail failed after task`), {
      statusCode: 502, code: 'OVH_API_ERROR',
    });
  }

  if (typeof result.id === 'string') result.id = Number(result.id);
  logger.info(`OVH redirection created: ${fullFrom} → ${to} (ovhId: ${result.id})`, { module: 'ovh' });
  return result;
}

/**
 * Supprime un alias OVH.
 * En dry-run, ne fait rien.
 * @param {string} domain
 * @param {number} id - OVH ID
 * @returns {Promise<void>}
 */
export async function ovhDelete(domain, id) {
  if (config.dryRun) {
    logger.info(`[DRY-RUN] DELETE /email/domain/${domain}/redirection/${id}`, { module: 'ovh' });
    return;
  }

  await request('DELETE', `/email/domain/${domain}/redirection/${id}`);
}

/**
 * Met à jour un alias OVH (delete + recreate — pas de PUT disponible).
 * En mode dry-run, simule la mise à jour.
 * @param {string} domain
 * @param {number} currentOvhId - ID OVH actuel (pour DELETE)
 * @param {string} from - Nouveau from
 * @param {string} to - Nouveau to
 * @returns {Promise<{ id: number, from: string, to: string }>}
 */
export async function ovhUpdate(domain, currentOvhId, from, to) {
  if (config.dryRun) {
    logger.info(`[DRY-RUN] UPDATE /email/domain/${domain}/redirection (delete ${currentOvhId} + create ${from} → ${to})`, { module: 'ovh' });
    return { id: Date.now(), from, to };
  }

  // Delete current
  await ovhDelete(domain, currentOvhId);
  // Recreate with new values
  const result = await ovhCreate(domain, from, to);
  return result;
}
