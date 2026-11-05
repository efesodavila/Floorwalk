# Security policy

## Reporting a problem

Please **do not open a public issue** for a security problem. Report it privately instead:

**[Report a vulnerability](https://github.com/efesodavila/Floorwalk/security/advisories/new)** (GitHub private
vulnerability reporting). Only the maintainer sees it until a fix is out.

Include what you found, how to reproduce it, and what someone could do with it. English or Portuguese is fine.
You will get an answer within a few days. Once it is fixed, the advisory is published with credit to you, unless you
prefer to stay anonymous.

## Supported versions

Only the latest release and the `main` branch get security fixes.

## What Floorwalk protects

Floorwalk runs on your own machine and touches files that matter, so these are the guarantees worth testing:

- **Your Claude Code settings.** `npm run hooks:install` edits `~/.claude/settings.json`. It must never lose or
  change entries that are not its own, and it keeps a backup of the original.
- **The local server.** It listens on `127.0.0.1` by default and only answers requests addressed to your own machine
  (blocks DNS rebinding). The WebSocket only accepts the page served by the server itself.
- **The hook.** Events reach the server only with the secret in `~/.floorwalk/hook.json`. The hook never prints
  anything, never blocks Claude Code, and does not send your prompts or file contents.
- **What appears on screen.** Commands are shown truncated, with anything that looks like a password, token or key
  removed.

The full list of rules, and how each one is tested, is in [`docs/REGRAS.md`](docs/REGRAS.md) (Portuguese).

## Out of scope

- Running the server with `HOST` set to a network address (it warns you; anyone on that network can then see your
  sessions).
- Problems that need someone who already controls your user account or your machine.
