#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const { generateMasterKey } = require('./crypto');
const { pushLocalVault, pullLocalVault, auditEnvFile, saveConfig, loadConfig } = require('./vault');
const { pushToGitHub, pullFromGitHub } = require('./github');

const pkg = require('./package.json');

// ─── Banner ───────────────────────────────────────────────────────────────────
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

// ─── Init ─────────────────────────────────────────────────────────────────────
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

    const { storageType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'storageType',
        message: 'Where do you want to store your encrypted vault?',
        choices: [
          { name: 'Local only (store .env.vault in this folder)', value: 'local' },
          { name: 'GitHub (commit and push .env.vault to your repo)', value: 'github' }
        ]
      }
    ]);

    const { generateKey } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'generateKey',
        message: 'Generate a secure master key automatically?',
        default: true
      }
    ]);

    let masterKey;

    if (generateKey) {
      masterKey = generateMasterKey();
      console.log(chalk.green('\n  ✔  Master key generated!\n'));
      console.log(chalk.bgRed.white.bold('  ⚠  SAVE THIS KEY SOMEWHERE SAFE. You cannot recover your .env without it.  '));
      console.log(chalk.yellow(`\n  Master Key: ${chalk.white.bold(masterKey)}\n`));
    } else {
      const { customKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'customKey',
          message: 'Enter your master key:',
          mask: '*',
          validate: (val) => val.length >= 16 ? true : 'Master key must be at least 16 characters.'
        }
      ]);
      masterKey = customKey;
    }

    const config = {
      version: pkg.version,
      storageType,
      createdAt: new Date().toISOString()
    };

    saveConfig(config);

    console.log(chalk.green(`\n  ✔  Initialized! Storage: ${chalk.white.bold(storageType)}`));
    console.log(chalk.gray('     Config saved to .envcrypted.json\n'));
    console.log(chalk.cyan('  Next steps:'));
    console.log(chalk.white('     1. Add .env to your .gitignore (never commit raw .env)'));
    console.log(chalk.white('     2. Run: envcrypted push'));
    console.log(chalk.white('     3. Share the master key securely with your team\n'));
  });

// ─── Push ─────────────────────────────────────────────────────────────────────
program
  .command('push')
  .description('Encrypt your .env and save/push the vault')
  .option('-m, --message <msg>', 'Git commit message', 'chore: update encrypted env vault')
  .action(async (options) => {
    const config = loadConfig();
    if (!config) {
      console.log(chalk.red('\n  ✖  Not initialized. Run "envcrypted init" first.\n'));
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

    const spinner = ora('Encrypting .env...').start();

    try {
      if (config.storageType === 'github') {
        spinner.text = 'Encrypting and pushing to GitHub...';
        await pushToGitHub(masterKey, options.message);
        spinner.succeed(chalk.green('Encrypted vault pushed to GitHub successfully!'));
      } else {
        pushLocalVault(masterKey);
        spinner.succeed(chalk.green('Encrypted vault saved locally as .env.vault'));
      }

      console.log(chalk.gray('\n  Tip: Commit .env.vault to version control and share master key securely.\n'));
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Pull ─────────────────────────────────────────────────────────────────────
program
  .command('pull')
  .description('Decrypt the vault and restore your .env file')
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      console.log(chalk.red('\n  ✖  Not initialized. Run "envcrypted init" first.\n'));
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

    const spinner = ora('Decrypting vault...').start();

    try {
      if (config.storageType === 'github') {
        spinner.text = 'Pulling from GitHub and decrypting...';
        await pullFromGitHub(masterKey);
        spinner.succeed(chalk.green('.env restored from GitHub vault successfully!'));
      } else {
        pullLocalVault(masterKey);
        spinner.succeed(chalk.green('.env restored from local vault successfully!'));
      }

      console.log(chalk.gray('\n  Your .env file has been restored. Keep your master key safe.\n'));
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      if (err.message.includes('Unsupported state')) {
        console.log(chalk.yellow('  ⚠  Wrong master key. Decryption failed.\n'));
      }
      process.exit(1);
    }
  });

// ─── Audit ────────────────────────────────────────────────────────────────────
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

      if (issues.length === 0 && warnings.length === 0) {
        console.log(chalk.green('  ✔  All clear! No issues found in your .env file.\n'));
      }

      if (issues.length > 0) {
        console.log(chalk.red.bold(`  ✖  ${issues.length} Critical Issue(s) Found:\n`));
        issues.forEach(({ line, content, label }) => {
          console.log(chalk.red(`     Line ${line}: ${label}`));
          console.log(chalk.gray(`     → ${content}\n`));
        });
      }

      if (warnings.length > 0) {
        console.log(chalk.yellow.bold(`  ⚠  ${warnings.length} Warning(s):\n`));
        warnings.forEach(({ line, content, label }) => {
          console.log(chalk.yellow(`     Line ${line}: ${label}`));
          console.log(chalk.gray(`     → ${content}\n`));
        });
      }

      if (safe.length > 0) {
        console.log(chalk.green(`  ✔  ${safe.length} variable(s) look safe.\n`));
      }

      console.log(chalk.cyan('  ── Summary ───────────────────────────────────────'));
      console.log(chalk.red(`     Critical : ${issues.length}`));
      console.log(chalk.yellow(`     Warnings : ${warnings.length}`));
      console.log(chalk.green(`     Safe     : ${safe.length}`));
      console.log(chalk.gray('\n  Run "envcrypted push" to encrypt and store your .env securely.\n'));

    } catch (err) {
      spinner.fail(chalk.red(`Audit failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Run ──────────────────────────────────────────────────────────────────────
program
  .name('envcrypted')
  .version(pkg.version)
  .description('Secure .env encryption CLI — AES-256, zero account, zero server.')
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  printBanner();
  program.outputHelp();
}