# envcrypted 🔐

> Secure your `.env` files with AES-256 encryption. Share safely with your team via local vault or GitHub. Zero account. Zero server. Just works.

[![npm version](https://img.shields.io/npm/v/envcrypted.svg)](https://www.npmjs.com/package/envcrypted)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## The Problem

Every developer has faced this:

```
"Hey, can you send me the .env file?"
"Sure, sending on WhatsApp..."
```

Your secrets travel over chat apps, emails, Slack messages. They get leaked, forgotten, or go out of sync between team members. **envcrypted fixes this.**

---

## How It Works

```
.env  →  AES-256-GCM encryption  →  .env.vault
                                        ↓
                              store locally or push to GitHub
                                        ↓
                              team pulls and decrypts with master key
```

- **AES-256-GCM** with PBKDF2 key derivation (100,000 iterations)
- **No cloud. No account. No server.**
- Works with any Git repo or just locally
- Detects weak/exposed values with the built-in auditor

---

## Install

```bash
npm install -g envcrypted
```

---

## Commands

### `envcrypted init`
Initialize envcrypted in your project. Generates a master key and sets your storage preference (local or GitHub).

```bash
envcrypted init
```

### `envcrypted push`
Encrypts your `.env` file and saves it as `.env.vault`. If you chose GitHub storage, it commits and pushes automatically.

```bash
envcrypted push
envcrypted push --message "feat: update API keys"
```

### `envcrypted pull`
Pulls the vault (from GitHub if applicable) and decrypts it back to `.env`.

```bash
envcrypted pull
```

### `envcrypted audit`
Scans your `.env` for critical issues and warnings — weak passwords, placeholder keys, exposed DB URIs, HTTP URLs, debug flags, and more.

```bash
envcrypted audit
```

**Example output:**
```
── Audit Report ──────────────────────────────────

✖  2 Critical Issue(s) Found:

   Line 3: Weak password (too short)
   → DB_PASSWORD=1234

   Line 7: MongoDB URI with credentials exposed
   → DATABASE_URL=mongodb+srv://admin:pass@cluster...

⚠  1 Warning(s):

   Line 5: Localhost value — not safe for production
   → API_URL=http://localhost:3000

✔  4 variable(s) look safe.

── Summary ───────────────────────────────────────
   Critical : 2
   Warnings : 1
   Safe     : 4
```

---

## Workflow

**Team Lead (Project Setup):**
```bash
envcrypted init         # generate master key, choose storage
envcrypted push         # encrypt .env → .env.vault
# share master key with team securely (password manager, etc.)
```

**New Team Member:**
```bash
envcrypted init         # initialize with same storage type
envcrypted pull         # enter master key → .env restored
```

**Rotating Keys:**
```bash
# Change master key, re-push
envcrypted push         # enter new master key
# Share new key with team
```

---

## Security

| Feature | Detail |
|--------|--------|
| Algorithm | AES-256-GCM (authenticated encryption) |
| Key derivation | PBKDF2 with SHA-512, 100,000 iterations |
| Salt | 64 bytes random per encryption |
| IV | 16 bytes random per encryption |
| Auth tag | 16 bytes (tamper detection) |
| Master key | Never stored anywhere. Only you hold it. |

The encrypted `.env.vault` is safe to commit to public or private repos. Without the master key, it is unreadable.

---

## Add to .gitignore

```bash
# Always ignore raw .env
.env

# Commit the encrypted vault
# .env.vault  ← this is safe to commit
```

---

## Built By

**Mohammad Shoeb Faizan** — Full-Stack Developer & Automation Engineer  
[GitHub](https://github.com/Mohammad-Shoeb-Faizan) | [LinkedIn](https://linkedin.com/in/mohammad-shoeb-faizan) | [NPM](https://npmjs.com/~mohammad-shoeb-faizan)

---

## License

MIT — Free forever. Use it, share it, build on it.
