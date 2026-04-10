// github.js
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const { pushLocalVault, pullLocalVault, VAULT_FILENAME } = require('./vault');

/**
 * Pushes encrypted vault to GitHub repo
 * Assumes the current directory is already a git repo
 */
async function pushToGitHub(masterKey, commitMessage = 'chore: update encrypted env vault', cwd = process.cwd()) {
  // First create the local vault
  pushLocalVault(masterKey, cwd);

  const git = simpleGit(cwd);

  // Check if it's a git repo
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error('Current directory is not a Git repository. Run "git init" first.');
  }

  // Stage the vault file
  await git.add(VAULT_FILENAME);

  // Commit
  await git.commit(commitMessage);

  // Push to remote
  const remotes = await git.getRemotes(true);
  if (!remotes.length) {
    throw new Error('No Git remote found. Add a remote with "git remote add origin <url>".');
  }

  await git.push();
  return remotes[0].refs.push;
}

/**
 * Pulls encrypted vault from GitHub and decrypts
 */
async function pullFromGitHub(masterKey, cwd = process.cwd()) {
  const git = simpleGit(cwd);

  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error('Current directory is not a Git repository.');
  }

  // Pull latest
  await git.pull();

  // Now decrypt the vault
  pullLocalVault(masterKey, cwd);
}

module.exports = { pushToGitHub, pullFromGitHub };
