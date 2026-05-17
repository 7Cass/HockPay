# Security Policy

## Supported Versions

This repository is a portfolio/demo project. Security fixes target the `main`
branch unless a maintained release branch is explicitly published.

## Reporting a Vulnerability

Do not open public issues for vulnerabilities, exposed credentials, or private
customer data.

If this repository is published under your GitHub account, enable private
vulnerability reporting in GitHub Security settings and use that channel. Until
then, contact the maintainer privately with:

- affected commit or branch;
- impact and reproduction steps;
- any relevant logs with secrets redacted.

## Secret Handling

Do not commit real `.env` files, API keys, webhook secrets, private keys,
database passwords, or customer documents. Rotate any credential that may have
been committed or used outside local development before making the repository
public.
