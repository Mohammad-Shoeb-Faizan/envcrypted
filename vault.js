// vault.js
const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('./crypto');

const VAULT_FILENAME = '.env.vault';
const CONFIG_FILENAME = '.envcrypted.json';

/**
 * Saves config to project root
 */
function saveConfig(config, cwd = process.cwd()) {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Loads config from project root
 */
function loadConfig(cwd = process.cwd()) {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) return null;
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * Reads the .env file
 */
function readEnvFile(cwd = process.cwd()) {
  const envPath = path.join(cwd, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found in current directory.');
  }
  return fs.readFileSync(envPath, 'utf8');
}

/**
 * Writes decrypted content back to .env
 */
function writeEnvFile(content, cwd = process.cwd()) {
  const envPath = path.join(cwd, '.env');
  fs.writeFileSync(envPath, content, 'utf8');
}

/**
 * Encrypts the .env file and writes the vault locally
 */
function pushLocalVault(masterKey, cwd = process.cwd()) {
  const envContent = readEnvFile(cwd);
  const encrypted = encrypt(envContent, masterKey);
  const vaultPath = path.join(cwd, VAULT_FILENAME);
  fs.writeFileSync(vaultPath, encrypted, 'utf8');
  return vaultPath;
}

/**
 * Decrypts vault file and restores .env locally
 */
function pullLocalVault(masterKey, cwd = process.cwd()) {
  const vaultPath = path.join(cwd, VAULT_FILENAME);
  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault file not found: ${VAULT_FILENAME}. Run "envcrypted push" first.`);
  }
  const encrypted = fs.readFileSync(vaultPath, 'utf8');
  const decrypted = decrypt(encrypted, masterKey);
  writeEnvFile(decrypted, cwd);
}

/**
 * Audits .env for weak or risky keys
 */
function auditEnvFile(cwd = process.cwd()) {
  const envContent = readEnvFile(cwd);
  const lines = envContent.split('\n');
  const issues = [];
  const warnings = [];
  const safe = [];

  const dangerPatterns = [
    { pattern: /password\s*=\s*\w{1,6}$/i, label: 'Weak password (too short)' },
    { pattern: /secret\s*=\s*(secret|test|demo|1234|password|abc)/i, label: 'Common/weak secret value' },
    { pattern: /key\s*=\s*(test|demo|sample|example|your[-_]?key)/i, label: 'Placeholder key detected' },
    { pattern: /=\s*true|=\s*false/i, label: 'Boolean flag — ensure not sensitive' },
    { pattern: /mongodb\+srv:\/\/[^:]+:[^@]+@/i, label: 'MongoDB URI with credentials exposed' },
    { pattern: /postgres:\/\/[^:]+:[^@]+@/i, label: 'Postgres URI with credentials exposed' },
    { pattern: /mysql:\/\/[^:]+:[^@]+@/i, label: 'MySQL URI with credentials exposed' },
  ];

  const warnPatterns = [
    { pattern: /localhost|127\.0\.0\.1/i, label: 'Localhost value — not safe for production' },
    { pattern: /http:\/\//i, label: 'HTTP (not HTTPS) URL detected' },
    { pattern: /debug\s*=\s*true/i, label: 'Debug mode enabled' },
  ];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    let flagged = false;

    for (const { pattern, label } of dangerPatterns) {
      if (pattern.test(trimmed)) {
        issues.push({ line: i + 1, content: trimmed, label });
        flagged = true;
        break;
      }
    }

    if (!flagged) {
      for (const { pattern, label } of warnPatterns) {
        if (pattern.test(trimmed)) {
          warnings.push({ line: i + 1, content: trimmed, label });
          flagged = true;
          break;
        }
      }
    }

    if (!flagged) {
      safe.push({ line: i + 1, content: trimmed });
    }
  });

  return { issues, warnings, safe };
}

module.exports = {
  pushLocalVault,
  pullLocalVault,
  auditEnvFile,
  saveConfig,
  loadConfig,
  VAULT_FILENAME,
  CONFIG_FILENAME
};
