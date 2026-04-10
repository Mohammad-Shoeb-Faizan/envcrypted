<!-- README.md -->
# envcrypted 🔐

> A dev-friendly CLI workflow for encrypting, auditing, and sharing your environment secrets. AES-256-GCM. Zero account. Zero server. Just works.

[![npm version](https://img.shields.io/npm/v/envcrypted)](https://www.npmjs.com/package/envcrypted)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## The Problem

Every developer has faced this:

```
"Hey, can you send me the .env file?"
"Sure, sending it over..."
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
- Auto-protects `.gitignore` on init
- Git pre-commit hook to block accidental `.env` commits
- Share master key safely via self-destructing one-time links

You can also run your app securely without exposing `.env`:

```bash
envcrypted run node app.js

---

## Install

Install inside your project — works on **Windows, macOS, and Linux** without any PATH issues:

```bash
npm install envcrypted
```

Then run commands using `npx`:

```bash
npx envcrypted init
npx envcrypted audit
npx envcrypted push
npx envcrypted pull
```

### Or add to your `package.json` scripts for convenience:

```json
"scripts": {
  "env:init":     "envcrypted init",
  "env:audit":    "envcrypted audit",
  "env:push":     "envcrypted push",
  "env:pull":     "envcrypted pull",
  "env:generate": "envcrypted generate",
  "env:status":   "envcrypted status",
  "env:doctor":   "envcrypted doctor"
}
```

---

## Commands

### `envcrypted init`
Initialize envcrypted in your project. Generates a master key, sets your storage preference (local or GitHub), and auto-updates `.gitignore` to protect your `.env`.

```bash
npx envcrypted init
```

### `envcrypted push`
Encrypts your `.env` file and saves it as `.env.vault`. If you chose GitHub storage, it commits and pushes automatically.

```bash
npx envcrypted push
npx envcrypted push --message "feat: update API keys"
```

### `envcrypted pull`
Pulls the vault (from GitHub if applicable) and decrypts it back to `.env`.

```bash
npx envcrypted pull
```

### `envcrypted run`
Run your app with decrypted environment variables — without exposing .env on disk.

```bash
npx envcrypted run node app.js
npx envcrypted run npm start
```
• Decrypts .env.vault in memory
• Injects variables into your app
• Never writes .env to disk

### `envcrypted audit`
Scans your `.env` for critical issues and warnings — weak passwords, placeholder keys, exposed DB URIs, HTTP URLs, debug flags, and more.

```bash
npx envcrypted audit
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

### `envcrypted generate`
Generates a `.env.example` file from your `.env` — strips all values, keeps all keys. Safe to commit publicly.

```bash
npx envcrypted generate
```

**Example output:**
```
DB_PASSWORD=<your-value-here>
API_KEY=<your-value-here>
JWT_SECRET=<your-value-here>
DATABASE_URL=<your-value-here>
```

### `envcrypted status`
Shows a quick snapshot of your project's encryption state — `.env`, vault, `.gitignore`, git hook, and `.env.example`.

```bash
npx envcrypted status
```

**Example output:**
```
── envcrypted Status ─────────────────────────────

✔  Initialized
     Storage  : local
     Version  : 1.1.0
     Created  : 18/03/2026

✔  .env found (6 variables, 0.3kb)
✔  .env.vault found (last updated: 18/03/2026)
✔  .env.example found
✔  .env is in .gitignore
✔  Git pre-commit hook installed
```

### `envcrypted hook install`
Installs a git pre-commit hook that warns if `.env` is unencrypted and **blocks** any commit where `.env` is accidentally staged.

```bash
npx envcrypted hook install
npx envcrypted hook uninstall
```

### `envcrypted doctor`
Runs 8 health checks on your setup and tells you exactly what's wrong and how to fix it.

```bash
npx envcrypted doctor
```

**Example output:**
```
── envcrypted Doctor ─────────────────────────────

✔  Node.js version: v20.0.0
✔  .env file found
✔  envcrypted initialized
✔  .env.vault exists
✔  .env is protected in .gitignore
✔  Git repository detected
⚠  Pre-commit hook not installed (optional)
⚠  .env.example missing (optional)

✔  Everything looks great! Your setup is healthy.
```

---

## Sharing the Master Key

After encrypting your vault, you need to share the master key with your team. **Don't send it over chat apps or email.** Use a self-destructing one-time link instead.

The envcrypted docs include a built-in **Share Key** page powered by [OneTimeSecret](https://onetimesecret.com) — open source, no account needed:

1. Paste your master key
2. Get a unique one-time link
3. Send it over any channel — the link reveals nothing about the content
4. Your teammate opens it once → key shown → link self-destructs permanently

🔗 **[Share your master key safely →](https://onetimesecret.com)**

---

## Workflow

**Team Lead (Project Setup):**
```bash
npm install envcrypted
npx envcrypted init         # generate master key, choose storage
npx envcrypted audit        # scan .env for issues first
npx envcrypted generate     # create .env.example for team
npx envcrypted hook install # block accidental .env commits
npx envcrypted push         # encrypt .env → .env.vault
# share master key using: https://onetimesecret.com
```

**New Team Member:**
```bash
npm install envcrypted      # install in project
npx envcrypted init         # initialize with same storage type
npx envcrypted pull         # enter master key → .env restored
```

**Check Your Setup:**
```bash
npx envcrypted status       # quick health snapshot
npx envcrypted doctor       # full diagnosis with fixes
```

**Rotating Keys:**
```bash
npx envcrypted push         # enter new master key
# share new key via one-time link
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
| Key sharing | One-time self-destructing links via OneTimeSecret |

The encrypted `.env.vault` is safe to commit to public or private repos. Without the master key, it is unreadable.

---

## Add to .gitignore

`envcrypted init` does this automatically. But if you need to do it manually:

```bash
# Always ignore raw .env
.env
.env.*

# These are safe to commit
# .env.vault
# .env.example
```

---

## Built By

**Mohammad Shoeb Faizan** — Full-Stack Developer & Automation Engineer  
[GitHub](https://github.com/Mohammad-Shoeb-Faizan) | [LinkedIn](https://linkedin.com/in/mohammad-shoeb-faizan) | [NPM](https://npmjs.com/~shoebcodes)

---

## License

MIT — Free forever. Use it, share it, build on it.





---

## Roadmap

These are planned improvements based on real developer feedback. Nothing is promised — but everything here is being actively thought about.

### 🔜 Coming Next

**`envcrypted setup`**  
A single command that runs the full team lead flow interactively — `init` + `audit` + `generate` + `hook install` + `push` — in one guided session. Zero friction onboarding.

**`envcrypted push --share`**  
Encrypts your `.env` and immediately opens OneTimeSecret with your secret key ready to share. One command. Vault encrypted. Key shared. Done.

**Auto-detect `.env`**  
Remove the need to run `init` before other commands. If a `.env` exists in the current directory, envcrypted should just work.

**Stronger `audit` patterns**  
Real regex detection for common secret formats — AWS access keys, Stripe live keys, GitHub tokens, Twilio, SendGrid, Firebase, and more. Not just weak password checks.

---

### 💡 Considering

**`envcrypted rotate`**  
Re-encrypt the vault with a new secret key in one command. Automatically notifies team members that a new key is in use.

**`envcrypted diff`**  
Compare two vaults or two `.env` files and show what changed — without revealing actual values. Useful for auditing key rotations.

**`envcrypted history`**  
Local changelog of when the vault was last pushed, pulled, or audited. No cloud. No server. Just a local log file.

**`envcrypted verify`**  
Let a teammate verify their `.env` matches the current vault — without sharing the actual values. Hash-based comparison.

**Multiple vault support**  
Support for `.env.staging`, `.env.production` — each with its own vault and secret key.

**VS Code extension**  
Warnings directly in the editor when a `.env` value looks weak or exposed. No terminal needed.

---

### 🚫 Out of Scope (by design)

These will never be added — they go against the zero-account, zero-server philosophy that makes envcrypted trustworthy:

- Cloud storage of secret keys
- Web dashboard or SaaS version
- Telemetry or usage tracking
- Paid tiers or paywalled features

---

Have an idea? Open a discussion on [GitHub](https://github.com/Mohammad-Shoeb-Faizan/envcrypted/discussions). The best features come from real problems.

---

Have an idea? Reach out on [LinkedIn](https://linkedin.com/in/mohammad-shoeb-faizan) or [open an issue](https://github.com/Mohammad-Shoeb-Faizan/envcrypted/issues/new) on GitHub.