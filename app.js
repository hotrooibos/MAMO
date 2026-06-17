import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import { logger } from './config/logger.js';
import { AppError } from './config/AppError.js';
import { config } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- View engine ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// --- Middlewares ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

// --- Request logger ---
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, { module: 'http' });
  next();
});

// --- Template locals ---
app.use((req, res, next) => {
  res.locals.domains = config.domains;
  next();
});

// --- Routes ---
import indexRouter from './routes/index.js';
import apiRouter from './routes/api.js';
app.use('/', indexRouter);
app.use('/api', apiRouter);

// --- 404 — rendre une page HTML pour les routes UI ---
app.use((req, res) => {
  // Les chemins commençant par /api reçoivent du JSON
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
  } else {
    res.status(404).type('html').send(`<!DOCTYPE html>
<html class="theme-light" lang="fr">
<head><meta charset="utf-8"><title>404 — MAM</title>
<link rel="stylesheet" href="/css/style.css">
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:var(--surface-base);color:var(--text-primary)}.c{text-align:center}h1{font-size:3rem;margin:0;color:var(--text-muted)}p{margin:0.5rem 0 1.5rem}a{color:var(--blue)}</style></head>
<body><div class="c"><h1>404</h1><p>Page introuvable</p><a href="/">← Retour à l'accueil</a></div></body></html>`);
  }
});

// --- Global error handler ---
app.use((err, req, res, _next) => {
  const isAppError = err instanceof AppError;
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';

  // En production, ne pas exposer les détails internes
  const message = (config.nodeEnv === 'production' && !isAppError)
    ? 'Internal server error'
    : err.message;

  logger.error(`${code}: ${err.message}`, { module: 'app', stack: err.stack });

  // Header Retry-After pour rate limiting
  if (err.retryAfter) {
    res.set('Retry-After', String(err.retryAfter));
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code,
  });
});

export default app;
