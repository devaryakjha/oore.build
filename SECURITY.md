# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Oore seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

Send an email to [dev.jha.arya@gmail.com](mailto:dev.jha.arya@gmail.com) with:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact of the vulnerability
- Any suggested fixes (optional)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
- **Initial Assessment**: Within 7 days, we will provide an initial assessment of the report.
- **Resolution Timeline**: We aim to resolve critical vulnerabilities within 30 days.
- **Disclosure**: We will coordinate with you on the timing of public disclosure.

### Scope

The following are in scope for security reports:

- The `oored` server daemon
- The `oore` CLI client
- The web dashboard
- Authentication and authorization mechanisms
- Credential storage and encryption
- Webhook signature verification

### Out of Scope

- Issues in dependencies (please report these to the respective projects)
- Social engineering attacks
- Physical attacks
- Denial of service attacks

## Security Best Practices for Users

When self-hosting Oore:

1. **Keep secrets secure**: Never commit `.env.local` or expose `OORE_ADMIN_TOKEN`
2. **Use HTTPS**: Always run behind a reverse proxy with TLS in production
3. **Rotate credentials**: Periodically rotate your admin token and encryption keys
4. **Limit network access**: Restrict access to the Oore server to trusted networks
5. **Keep updated**: Regularly update to the latest version for security patches
