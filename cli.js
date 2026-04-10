#!/usr/bin/env node
// cli.js


'use strict';

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const { generateMasterKey } = require('./crypto');
const { pushLocalVault, pullLocalVault, auditEnvFile, saveConfig, loadConfig, VAULT_FILENAME } = require('./vault');
const { pushToGitHub, pullFromGitHub } = require('./github');

const pkg = require('./package.json');

function printBanner() {
  console.log(chalk.cyan.bold(`
  ███████╗███╗   ██╗██╗   ██╗ ██████╗██████╗ ██╗   ██╗██████╗ ████████╗███████╗██████╗ 
  ██╔════╝████╗  ██║██║   ██║██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝██╔════╝██╔══██╗
  █████╗  ██╔██╗ ██║██║   ██║██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║   █████╗  ██║  ██║
  ██╔══╝  ██║╚██╗██║╚██╗ ██╔╝██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║   ██╔══╝  ██║  ██║
  ███████╗██║ ╚████║ ╚████╔╝ ╚██████╗██║  ██║   ██║   ██║        ██║   ███████╗██████╔╝
  ╚══════╝╚═╝  ╚═══╝  ╚═══╝   ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝   ╚══════╝╚═════╝ 
  `));
  console.log(chalk.gray(`  v${pkg.version} — Secure .env encryption. Zero account. Zero server. Just works.\n`));
}

// INIT
program
  .command('init')
  .description('Initialize envcrypted in your project and generate a master key')
  .action(async () => {
    printBanner();
    const existing = loadConfig();
    if (existing) {
      console.log(chalk.yellow('  ⚠  envcrypted is already initialized in this project.'));
      console.log(chalk.gray('     Delete .envcrypted.json to reinitialize.\n'));
      process.exit(0);
    }
    console.log(chalk.white.bold('  Setting up envcrypted...\n'));
    const { storageType } = await inquirer.prompt([{ type: 'list', name: 'storageType', message: 'Where do you want to store your encrypted vault?', choices: [{ name: 'Local only (store .env.vault in this folder)', value: 'local' }, { name: 'GitHub (commit and push .env.vault to your repo)', value: 'github' }] }]);
    const { generateKey } = await inquirer.prompt([{ type: 'confirm', name: 'generateKey', message: 'Generate a secure master key automatically?', default: true }]);
    let masterKey;
    if (generateKey) {
      masterKey = generateMasterKey();
      console.log(chalk.green('\n  ✔  Master key generated!\n'));
      console.log(chalk.bgRed.white.bold('  ⚠  SAVE THIS KEY SOMEWHERE SAFE. You cannot recover your .env without it.  '));
      console.log(chalk.yellow(`\n  Master Key: ${chalk.white.bold(masterKey)}\n`));
    } else {
      const { customKey } = await inquirer.prompt([{ type: 'password', name: 'customKey', message: 'Enter your master key:', mask: '*', validate: (val) => val.length >= 16 ? true : 'Master key must be at least 16 characters.' }]);
      masterKey = customKey;
    }
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const gitignoreEntries = ['.env', '.env.*', '!.env.vault', '!.env.example'];
    if (fs.existsSync(gitignorePath)) {
      let content = fs.readFileSync(gitignorePath, 'utf8');
      let added = [];
      gitignoreEntries.forEach(entry => { if (!content.includes(entry)) { content += `\n${entry}`; added.push(entry); } });
      if (added.length > 0) { fs.writeFileSync(gitignorePath, content); console.log(chalk.green(`  ✔  Added to .gitignore: ${added.join(', ')}`)); }
    } else {
      fs.writeFileSync(gitignorePath, gitignoreEntries.join('\n') + '\n');
      console.log(chalk.green('  ✔  Created .gitignore with safe defaults'));
    }
    const config = { version: pkg.version, storageType, createdAt: new Date().toISOString() };
    saveConfig(config);
    console.log(chalk.green(`\n  ✔  Initialized! Storage: ${chalk.white.bold(storageType)}`));
    console.log(chalk.gray('     Config saved to .envcrypted.json\n'));
    console.log(chalk.cyan('  Next steps:'));
    console.log(chalk.white('     1. Run: npx envcrypted audit'));
    console.log(chalk.white('     2. Run: npx envcrypted push'));
    console.log(chalk.white('     3. Share the master key securely with your team\n'));
  });

// PUSH
program
  .command('push')
  .description('Encrypt your .env and save/push the vault')
  .option('-m, --message <msg>', 'Git commit message', 'chore: update encrypted env vault')
  .action(async (options) => {
    const config = loadConfig();
    if (!config) { console.log(chalk.red('\n  ✖  Not initialized. Run "npx envcrypted init" first.\n')); process.exit(1); }
    const { masterKey } = await inquirer.prompt([{ type: 'password', name: 'masterKey', message: 'Enter your master key:', mask: '*', validate: (val) => val.length >= 8 ? true : 'Master key too short.' }]);
    const spinner = ora('Encrypting .env...').start();
    try {
      if (config.storageType === 'github') { spinner.text = 'Encrypting and pushing to GitHub...'; await pushToGitHub(masterKey, options.message); spinner.succeed(chalk.green('Encrypted vault pushed to GitHub successfully!')); }
      else { pushLocalVault(masterKey); spinner.succeed(chalk.green('Encrypted vault saved locally as .env.vault')); }
      console.log(chalk.gray('\n  Tip: Commit .env.vault to version control and share master key securely.\n'));
    } catch (err) { spinner.fail(chalk.red(`Failed: ${err.message}`)); process.exit(1); }
  });

// PULL
program
  .command('pull')
  .description('Decrypt the vault and restore your .env file')
  .action(async () => {
    const config = loadConfig();
    if (!config) { console.log(chalk.red('\n  ✖  Not initialized. Run "npx envcrypted init" first.\n')); process.exit(1); }
    const { masterKey } = await inquirer.prompt([{ type: 'password', name: 'masterKey', message: 'Enter your master key:', mask: '*', validate: (val) => val.length >= 8 ? true : 'Master key too short.' }]);
    const spinner = ora('Decrypting vault...').start();
    try {
      if (config.storageType === 'github') { spinner.text = 'Pulling from GitHub and decrypting...'; await pullFromGitHub(masterKey); spinner.succeed(chalk.green('.env restored from GitHub vault successfully!')); }
      else { pullLocalVault(masterKey); spinner.succeed(chalk.green('.env restored from local vault successfully!')); }
      console.log(chalk.gray('\n  Your .env file has been restored. Keep your master key safe.\n'));
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      if (err.message.includes('Unsupported state')) console.log(chalk.yellow('  ⚠  Wrong master key. Decryption failed.\n'));
      process.exit(1);
    }
  });

// AUDIT
program
  .command('audit')
  .description('Scan your .env for weak, exposed, or risky values')
  .action(() => {
    printBanner();
    const spinner = ora('Scanning .env for issues...').start();
    try {
      const { issues, warnings, safe } = auditEnvFile();
      spinner.stop();
      console.log(chalk.white.bold('\n  ── Audit Report ──────────────────────────────────\n'));
      if (issues.length === 0 && warnings.length === 0) console.log(chalk.green('  ✔  All clear! No issues found in your .env file.\n'));
      if (issues.length > 0) { console.log(chalk.red.bold(`  ✖  ${issues.length} Critical Issue(s) Found:\n`)); issues.forEach(({ line, content, label }) => { console.log(chalk.red(`     Line ${line}: ${label}`)); console.log(chalk.gray(`     → ${content}\n`)); }); }
      if (warnings.length > 0) { console.log(chalk.yellow.bold(`  ⚠  ${warnings.length} Warning(s):\n`)); warnings.forEach(({ line, content, label }) => { console.log(chalk.yellow(`     Line ${line}: ${label}`)); console.log(chalk.gray(`     → ${content}\n`)); }); }
      if (safe.length > 0) console.log(chalk.green(`  ✔  ${safe.length} variable(s) look safe.\n`));
      console.log(chalk.cyan('  ── Summary ───────────────────────────────────────'));
      console.log(chalk.red(`     Critical : ${issues.length}`));
      console.log(chalk.yellow(`     Warnings : ${warnings.length}`));
      console.log(chalk.green(`     Safe     : ${safe.length}`));
      console.log(chalk.gray('\n  Run "npx envcrypted push" to encrypt and store your .env securely.\n'));
    } catch (err) { spinner.fail(chalk.red(`Audit failed: ${err.message}`)); process.exit(1); }
  });

// GENERATE
program
  .command('generate')
  .description('Generate a .env.example file from your .env (removes values, keeps keys)')
  .action(() => {
    const cwd = process.cwd();
    const envPath = path.join(cwd, '.env');
    const examplePath = path.join(cwd, '.env.example');
    if (!fs.existsSync(envPath)) { console.log(chalk.red('\n  ✖  No .env file found in current directory.\n')); process.exit(1); }
    const spinner = ora('Generating .env.example...').start();
    try {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      const exampleLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) return line;
        return `${line.slice(0, eqIndex)}=`;
      });
      fs.writeFileSync(examplePath, exampleLines.join('\n'), 'utf8');
      spinner.succeed(chalk.green('.env.example generated successfully!'));
      console.log(chalk.gray('\n  Keys preserved, values removed.'));
      console.log(chalk.gray('  Safe to commit .env.example to version control.\n'));
      console.log(chalk.cyan('  ── Generated Keys ────────────────────────────────'));
      exampleLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const key = trimmed.split('=')[0];
        console.log(chalk.white(`     ${key}=`) + chalk.gray('<your-value-here>'));
      });
      console.log('');
    } catch (err) { spinner.fail(chalk.red(`Failed: ${err.message}`)); process.exit(1); }
  });

// STATUS
program
  .command('status')
  .description('Show the current vault and encryption status of your project')
  .action(() => {
    const cwd = process.cwd();
    const config = loadConfig(cwd);
    console.log(chalk.white.bold('\n  ── envcrypted Status ─────────────────────────────\n'));
    if (config) {
      console.log(chalk.green('  ✔  Initialized'));
      console.log(chalk.gray(`     Storage  : ${config.storageType}`));
      console.log(chalk.gray(`     Version  : ${config.version}`));
      console.log(chalk.gray(`     Created  : ${new Date(config.createdAt).toLocaleString()}`));
    } else {
      console.log(chalk.red('  ✖  Not initialized — run "npx envcrypted init"'));
    }
    console.log('');
    const envExists = fs.existsSync(path.join(cwd, '.env'));
    if (envExists) {
      const stats = fs.statSync(path.join(cwd, '.env'));
      const lines = fs.readFileSync(path.join(cwd, '.env'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
      console.log(chalk.green(`  ✔  .env found (${lines.length} variables, ${(stats.size / 1024).toFixed(1)}kb)`));
    } else { console.log(chalk.yellow('  ⚠  .env not found')); }
    const vaultExists = fs.existsSync(path.join(cwd, VAULT_FILENAME));
    if (vaultExists) {
      const stats = fs.statSync(path.join(cwd, VAULT_FILENAME));
      console.log(chalk.green(`  ✔  .env.vault found (last updated: ${new Date(stats.mtime).toLocaleString()})`));
    } else { console.log(chalk.yellow('  ⚠  .env.vault not found — run "npx envcrypted push"')); }
    const exampleExists = fs.existsSync(path.join(cwd, '.env.example'));
    console.log(exampleExists ? chalk.green('  ✔  .env.example found') : chalk.gray('  -  .env.example not found — run "npx envcrypted generate"'));
    const gitignorePath = path.join(cwd, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      console.log(content.includes('.env') ? chalk.green('  ✔  .env is in .gitignore') : chalk.red('  ✖  .env is NOT in .gitignore — danger!'));
    } else { console.log(chalk.red('  ✖  No .gitignore found')); }
    const hookPath = path.join(cwd, '.git', 'hooks', 'pre-commit');
    const hookInstalled = fs.existsSync(hookPath) && fs.readFileSync(hookPath, 'utf8').includes('envcrypted');
    console.log(hookInstalled ? chalk.green('  ✔  Git pre-commit hook installed') : chalk.gray('  -  Git hook not installed — run "npx envcrypted hook install"'));
    console.log('');
  });

// HOOK
program
  .command('hook')
  .description('Manage git pre-commit hook for auto-encryption')
  .argument('<action>', 'install or uninstall')
  .action(async (action) => {
    const cwd = process.cwd();
    const hooksDir = path.join(cwd, '.git', 'hooks');
    const hookPath = path.join(hooksDir, 'pre-commit');
    if (!fs.existsSync(path.join(cwd, '.git'))) { console.log(chalk.red('\n  ✖  Not a git repository. Run "git init" first.\n')); process.exit(1); }
    if (action === 'install') {
      if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
      const hookScript = `#!/bin/sh\n# envcrypted pre-commit hook\nif [ -f ".env" ]; then\n  echo ""\n  echo "  🔐 envcrypted: .env detected before commit"\n  if git diff --cached --name-only | grep -q "^\\.env$"; then\n    echo "  ✖  ERROR: .env is staged for commit! Remove it:"\n    echo "     git reset HEAD .env"\n    echo ""\n    exit 1\n  fi\nfi\nexit 0\n`;
      if (fs.existsSync(hookPath)) {
        const existing = fs.readFileSync(hookPath, 'utf8');
        if (existing.includes('envcrypted')) { console.log(chalk.yellow('\n  ⚠  envcrypted hook already installed.\n')); process.exit(0); }
        fs.appendFileSync(hookPath, '\n' + hookScript);
      } else { fs.writeFileSync(hookPath, hookScript); }
      fs.chmodSync(hookPath, '755');
      console.log(chalk.green('\n  ✔  Git pre-commit hook installed!\n'));
      console.log(chalk.gray('  Now every commit will:'));
      console.log(chalk.white('     • Warn if .env exists but not encrypted'));
      console.log(chalk.white('     • Block commit if .env is accidentally staged\n'));
    } else if (action === 'uninstall') {
      if (!fs.existsSync(hookPath)) { console.log(chalk.yellow('\n  ⚠  No pre-commit hook found.\n')); process.exit(0); }
      const content = fs.readFileSync(hookPath, 'utf8');
      if (!content.includes('envcrypted')) { console.log(chalk.yellow('\n  ⚠  envcrypted hook not found in pre-commit.\n')); process.exit(0); }
      const cleaned = content.replace(/\n?# envcrypted pre-commit hook[\s\S]*?exit 0\n?/, '').trim();
      cleaned ? fs.writeFileSync(hookPath, cleaned + '\n') : fs.unlinkSync(hookPath);
      console.log(chalk.green('\n  ✔  Git pre-commit hook removed.\n'));
    } else { console.log(chalk.red(`\n  ✖  Unknown action: ${action}. Use "install" or "uninstall".\n`)); process.exit(1); }
  });

// DOCTOR
program
  .command('doctor')
  .description('Diagnose your envcrypted setup and fix common issues')
  .action(() => {
    const cwd = process.cwd();
    let allGood = true;
    console.log(chalk.white.bold('\n  ── envcrypted Doctor ─────────────────────────────\n'));
    console.log(chalk.gray('  Checking your setup...\n'));
    const checks = [];
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
    nodeVersion >= 16 ? checks.push({ ok: true, msg: `Node.js version: ${process.version}` }) : (checks.push({ ok: false, msg: `Node.js ${process.version} — requires v16+` }), allGood = false);
    const envExists = fs.existsSync(path.join(cwd, '.env'));
    envExists ? checks.push({ ok: true, msg: '.env file found' }) : (checks.push({ ok: false, msg: '.env not found — create one first' }), allGood = false);
    const config = loadConfig(cwd);
    config ? checks.push({ ok: true, msg: 'envcrypted initialized (.envcrypted.json found)' }) : (checks.push({ ok: false, msg: 'Not initialized — run "npx envcrypted init"' }), allGood = false);
    const vaultExists = fs.existsSync(path.join(cwd, VAULT_FILENAME));
    vaultExists ? checks.push({ ok: true, msg: '.env.vault exists' }) : (checks.push({ ok: false, msg: '.env.vault not found — run "npx envcrypted push"' }), allGood = false);
    const gitignorePath = path.join(cwd, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      content.includes('.env') ? checks.push({ ok: true, msg: '.env is protected in .gitignore' }) : (checks.push({ ok: false, msg: '.env not in .gitignore — danger!' }), allGood = false);
    } else { checks.push({ ok: false, msg: 'No .gitignore found' }); allGood = false; }
    const isGitRepo = fs.existsSync(path.join(cwd, '.git'));
    checks.push(isGitRepo ? { ok: true, msg: 'Git repository detected' } : { ok: null, msg: 'Not a git repo — GitHub storage won\'t work' });
    const hookPath = path.join(cwd, '.git', 'hooks', 'pre-commit');
    const hookInstalled = fs.existsSync(hookPath) && fs.readFileSync(hookPath, 'utf8').includes('envcrypted');
    checks.push(hookInstalled ? { ok: true, msg: 'Git pre-commit hook installed' } : { ok: null, msg: 'Pre-commit hook not installed (optional) — run "npx envcrypted hook install"' });
    const exampleExists = fs.existsSync(path.join(cwd, '.env.example'));
    checks.push(exampleExists ? { ok: true, msg: '.env.example found' } : { ok: null, msg: '.env.example missing (optional) — run "npx envcrypted generate"' });
    checks.forEach(({ ok, msg }) => {
      if (ok === true) console.log(chalk.green(`  ✔  ${msg}`));
      else if (ok === false) console.log(chalk.red(`  ✖  ${msg}`));
      else console.log(chalk.yellow(`  ⚠  ${msg}`));
    });
    console.log('');
    allGood ? console.log(chalk.green.bold('  ✔  Everything looks great! Your setup is healthy.\n')) : console.log(chalk.red.bold('  ✖  Some issues found. Fix them above and run "npx envcrypted doctor" again.\n'));
  });

// DOCTOR (your last existing command above)

// 👇 PASTE HERE (new run command)

// RUN COMMAND
const { exec } = require('child_process');
const { decrypt } = require('./crypto');

program
  .command('run')
  .description('Run your app with decrypted environment variables (in-memory, no .env exposure)')
  .argument('<cmd...>', 'Command to run')
  .action(async (cmd) => {
    const config = loadConfig();

    if (!config) {
      console.log(chalk.red('\n  ✖  Not initialized. Run "npx envcrypted init" first.\n'));
      process.exit(1);
    }

    const { masterKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'masterKey',
        message: 'Enter your master key:',
        mask: '*',
        validate: (val) => val.length >= 8 ? true : 'Master key too short.'
      }
    ]);

    const spinner = ora('Decrypting vault in memory...').start();

    try {
      const vaultPath = path.join(process.cwd(), VAULT_FILENAME);

      if (!fs.existsSync(vaultPath)) {
        throw new Error('.env.vault not found. Run "envcrypted push" first.');
      }

      const encrypted = fs.readFileSync(vaultPath, 'utf8');
      const decrypted = decrypt(encrypted, masterKey);

      const envVars = {};

      decrypted.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const index = trimmed.indexOf('=');
        if (index === -1) return;

        const key = trimmed.slice(0, index);
        const value = trimmed.slice(index + 1);

        envVars[key] = value;
      });

      spinner.succeed(chalk.green('Environment loaded securely. Running command...\n'));

      const command = cmd.join(' ');

      const child = exec(command, {
        env: { ...process.env, ...envVars },
        shell: true
      });

      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);

      child.on('exit', (code) => {
        process.exit(code);
      });

    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));

      if (err.message.includes('Unsupported state')) {
        console.log(chalk.yellow('  ⚠  Wrong master key. Decryption failed.\n'));
      }

      process.exit(1);
    }
  });



// RUN
program
  .name('envcrypted')
  .version(pkg.version)
  .description('Secure .env encryption CLI — AES-256, zero account, zero server.')
  .parse(process.argv);

if (!process.argv.slice(2).length) { printBanner(); program.outputHelp(); }