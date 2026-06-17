import { Router } from 'express';
import { config } from '../config/index.js';
import { read } from '../db/index.js';
import { createAlias, updateAlias, deleteAlias } from '../services/alias.service.js';
import { syncManual, computeDiscrepancy, getSyncStatus } from '../services/sync.service.js';
import { generateAlias } from '../services/generator.js';
import { readDictionary } from '../db/index.js';
import { logger } from '../config/logger.js';

const router = Router();

/**
 * GET / — Page d'accueil avec la liste des alias.
 * Injecte les données initiales (alias + domaines) dans le template.
 */
router.get('/', async (req, res, next) => {
  try {
    const store = await read();
    const aliases = Array.isArray(store.aliases) ? store.aliases : [];
    const dictionary = await readDictionary();

    logger.info(`Rendering index with ${aliases.length} aliases`, { module: 'routes' });

    res.render('index', {
      aliases,
      domains: config.domains,
      dictionary,
      defaultTo: config.defaultTo,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/aliases/ui — Créer un alias depuis l'interface UI.
 * Non protégé par API key (localhost-only).
 * Body JSON : { domain, from, to, description?, tags?, active?, tempExpires? }
 */
router.post('/api/aliases/ui', async (req, res, next) => {
  try {
    const { domain, from, to, description, tags, active, tempExpires } = req.body;

    const alias = await createAlias({ domain, from, to, description, tags, active, tempExpires });

    logger.info(`UI: Alias created ${from}@${domain} → ${to}`, { module: 'routes' });

    res.status(201).json({ success: true, data: alias });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/aliases/ui/:id — Modifier un alias depuis l'interface UI.
 * Body JSON : { to?, description?, tags?, active?, tempExpires?, from? }
 */
router.put('/api/aliases/ui/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const alias = await updateAlias(id, updates);

    logger.info(`UI: Alias updated ${alias.from}@${alias.domain}`, { module: 'routes' });

    res.json({ success: true, data: alias });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/aliases/ui/sync — Déclencher une sync manuelle depuis l'UI.
 * Retourne le rapport de discrepancy.
 */
router.post('/api/aliases/ui/sync', async (req, res, next) => {
  try {
    const discrepancy = await syncManual();
    logger.info('UI: Manual sync completed', { module: 'routes' });
    res.json({ success: true, data: discrepancy });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/aliases/ui/quick — Quick alias.
 * Génère un from aléatoire et crée l'alias.
 * Body: { domain, to }
 */
router.post('/api/aliases/ui/quick', async (req, res, next) => {
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
    logger.info(`UI: Quick alias created ${from}@${domain} → ${to}`, { module: 'routes' });
    res.status(201).json({ success: true, data: alias });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/aliases/ui/sync-status — Statut de la sync en cours.
 */
router.get('/api/aliases/ui/sync-status', (req, res) => {
  const status = getSyncStatus();
  res.json({ success: true, data: status });
});

/**
 * DELETE /api/aliases/ui/:id — Supprimer un alias depuis l'interface UI.
 * Query ?force=true pour forcer la suppression locale si OVH échoue.
 */
router.delete('/api/aliases/ui/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const forceLocal = req.query.force === 'true';

    const result = await deleteAlias(id, forceLocal);

    logger.info(`UI: Alias deleted ${result.alias.from}@${result.alias.domain} (forceLocal: ${forceLocal})`, { module: 'routes' });

    res.json({ success: true, data: { id: result.alias.id } });
  } catch (err) {
    next(err);
  }
});

export default router;
