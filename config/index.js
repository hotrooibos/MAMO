import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`[FATAL] Required environment variable "${name}" is missing`);
    process.exit(1);
  }
  return value.trim();
}

const port = parseInt(process.env.PORT, 10) || 3000;

// Normaliser DRY_RUN (insensible à la casse)
const dryRunRaw = (process.env.DRY_RUN || '').toLowerCase();
const dryRun = dryRunRaw === 'true' || dryRunRaw === '1';

const rawDomains = requireEnv('OVH_DOMAINS');
const domains = rawDomains.split(',').map((d) => d.trim()).filter(Boolean);

if (domains.length === 0) {
  console.warn(`[WARN] OVH_DOMAINS="${rawDomains}" produced an empty domain list — no sync will run`);
}

const defaultToRaw = process.env.DEFAULT_TO || '';
const defaultTo = defaultToRaw.trim() || null;

export const config = {
  port,
  ovhAppKey: requireEnv('OVH_APPLICATION_KEY'),
  ovhAppSecret: requireEnv('OVH_APPLICATION_SECRET'),
  ovhConsumerKey: requireEnv('OVH_CONSUMER_KEY'),
  domains,
  apiKey: requireEnv('API_KEY'),
  nodeEnv: process.env.NODE_ENV || 'development',
  dryRun,
  defaultTo,
};
