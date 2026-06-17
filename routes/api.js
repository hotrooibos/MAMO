import { Router } from 'express';
import { config } from '../config/index.js';
import { createAlias, updateAlias, deleteAlias } from '../services/alias.service.js';
import { syncManual, getSyncStatus } from '../services/sync.service.js';
import { generateAlias } from '../services/generator.js';
import { read } from '../db/index.js';
import { AppError } from '../config/AppError.js';
import { logger } from '../config/logger.js';

const router = Router();

/**
 * Middleware de vérification de la clé API.
 * Toutes les routes sous /api nécessitent le header X-Api-Key.
 */
function requireApiKey(req, _res, next) {
  const apiKey = req.get('X-Api-Key');
  if (!apiKey || apiKey !== config.apiKey) {
    return next(new AppError('Unauthorized', { statusCode: 401, code: 'UNAUTHORIZED' }));
  }
  next();
}

router.use(requireApiKey);

/**
 * POST /api/alias — Créer un alias.
 * Body JSON : { domain, from, to, description?, tags?, active? }
 */
router.post('/alias', async (req, res, next) => {
  try {
    const { domain, from, to, description, tags, active, tempExpires } = req.body;

    const alias = await createAlias({
      domain,
      from,
      to,
      description,
      tags,
      active,
      tempExpires,
    });

    logger.info(`API: Alias created ${from}@${domain} → ${to}`, { module: 'api' });

    res.status(201).json({ success: true, data: alias });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/alias/:id — Modifier un alias.
 * Body JSON : { to?, description?, tags?, active?, tempExpires?, from? }
 */
router.put('/alias/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const alias = await updateAlias(id, updates);

    logger.info(`API: Alias updated ${alias.from}@${alias.domain}`, { module: 'api' });

    res.json({ success: true, data: alias });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/alias/:id — Supprimer un alias.
 * Query ?force=true pour forcer la suppression locale si OVH échoue.
 */
router.delete('/alias/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const forceLocal = req.query.force === 'true';

    const result = await deleteAlias(id, forceLocal);

    logger.info(`API: Alias deleted ${result.alias.from}@${result.alias.domain} (forceLocal: ${forceLocal})`, { module: 'api' });

    res.json({ success: true, data: { id: result.alias.id } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alias/quick — Quick alias via API.
 * Génère un from aléatoire et crée l'alias.
 * Body: { domain, to }
 */
router.post('/alias/quick', async (req, res, next) => {
  try {
    const { domain, to } = req.body;
    if (!domain || !to) {
      return res.status(400).json({ success: false, error: 'Domain et To requis', code: 'VALIDATION_ERROR' });
    }

    const store = await read();
    const existingAliases = Array.isArray(store.aliases) ? store.aliases : [];
    const blacklist = Array.isArray(store.blacklist) ? store.blacklist : [];

    const { from } = await generateAlias({
      lang: 'mashup',
      domain,
      existingAliases,
      blacklist,
    });

    const alias = await createAlias({ domain, from, to, active: true });
    logger.info(`API: Quick alias created ${from}@${domain} → ${to}`, { module: 'api' });
    res.status(201).json({ success: true, data: alias });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alias/sync — Déclencher une sync manuelle via API.
 * Retourne le rapport de discrepancy.
 */
router.post('/alias/sync', async (req, res, next) => {
  try {
    const discrepancy = await syncManual();
    logger.info('API: Manual sync completed', { module: 'api' });
    res.json({ success: true, data: discrepancy });
  } catch (err) {
    next(err);
  }
});

export default router;
