<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/img/logo-dark.svg">
    <img alt="Floorwalk" src="docs/img/logo-light.svg" width="440">
  </picture>
</h1>

**Walk the floor and watch your AI agents work.** Every Claude Code session you run becomes a character in a 3D
office, and it goes to the furniture that matches what it is actually doing: the desk when it edits, the bookshelf
when it reads, the server rack when it pushes, and it raises a flag when it needs your permission.

[Português](README.pt-BR.md)

![Demo: starting from an empty room, a desk is dropped on the floor and dragged to a new spot; a character gets new hair, clothes and accessories; then Claude Code sessions walk in through the door, one runs git push and walks to the server rack, and a click on a character opens its card with the time per activity and the history.](docs/img/demo.gif)

<sub>[Watch as MP4](docs/img/demo.mp4) · full version, 76 seconds</sub>

> Status: early open-source release. Works on Windows, macOS and Linux with Node 22.9+.
> The interface follows your browser language (English or Portuguese); switch it in the menu (☰ → Idioma / Language).

## Quick start

You need [Node.js](https://nodejs.org) 22.9 or newer and [Claude Code](https://claude.com/claude-code).

**1. Start the server** (it shows the room in your browser):

```bash
git clone https://github.com/efesodavila/Floorwalk.git
cd Floorwalk
npm install
npm start
```

Open http://127.0.0.1:8787. The office opens with a ready-made dev room; you can change it later.

**2. Connect Claude Code** with the plugin, in another terminal (it adds the hooks for you, nothing to edit by hand):

```bash
claude plugin marketplace add efesodavila/Floorwalk
claude plugin install floorwalk@floorwalk
```

Then start a **new** Claude Code session in any project (sessions that were already open are not tracked). It walks in
through the door. No API key, no account.

<details>
<summary>Prefer not to use the plugin? Install the hooks by hand</summary>

```bash
npm run hooks:install     # adds the hooks to ~/.claude/settings.json (saves a copy first)
npm run hooks:status      # shows whether they are on
npm run hooks:uninstall   # removes only Floorwalk's entries
```

The hooks point to this folder. If you move or delete it, run `npm run hooks:uninstall` first, or
`npm run hooks:install` again after moving. Use the plugin or the manual hooks, not both (the installer refuses when the
plugin is on, so events don't arrive twice).
</details>

| Claude Code is… | in the office |
|-----------------|---------------|
| editing or writing files | works at a computer |
| reading, searching, browsing the web | goes to the bookshelf or armchair |
| running tests or lint | reviewing |
| `git push`, deploy, publish | goes to the server rack |
| planning or delegating to subagents | goes to the board (or the meeting table) |
| asking for permission | blocked, with an alert |
| waiting for your answer | waiting |
| done with its turn | celebrates |
| session closed | leaves the room |

Click a character to open its card: what it is doing right now, where, time spent per activity, and a timestamped
history of its actions.

## Is it working?

The badge in the bottom-left corner of the page tells you:

- **Waiting for the first Claude Code session**: all set. Start a new session.
- **Claude Code is not connected yet**: install the plugin (or the manual hooks).
- **The hooks point to a folder that no longer exists**: you moved the folder. Run `npm run hooks:install` again.
- **Not connected to the server**: the server stopped. Run `npm start`.
- **N sessions open · Last event 5s ago**: events are arriving.

Other things that can go wrong:

- **`Port 8787 is already in use`**: Floorwalk (or another program) is already running there. Open the page, or pick
  another port: `PORT=8790 npm start` (or put `PORT=8790` in a `.env` file, see `.env.example`).
- **`Floorwalk needs Node 22.9 or newer`**: install the current LTS from [nodejs.org](https://nodejs.org).
- **The session never shows up**: it has to be a session started after the plugin or hooks were installed, and `node`
  must be on the PATH that Claude Code sees (the hook runs `node`).

## Safety and privacy

Everything stays on your machine. The hook sends each event only to `127.0.0.1`, with a secret the server creates
(the "token", in `~/.floorwalk/hook.json`, readable only by you; delete the file and the server makes a new one).

**What the hook sends:** the session id, the event name, the project folder, the tool name and, from the tool input,
the file path, search pattern or query, URL, command and its description, plus Claude Code's notification messages.
**What it never sends:** your prompts, file contents and tool output.

The local server then removes anything that looks like a token, key or password from commands before showing them, and
shortens long ones. The history lives in the server's memory: it survives a page reload and is gone when the server
stops. Your room layout is saved in your browser; sessions are never saved into it.

The hook never gets in Claude Code's way: it prints nothing, always exits successfully, and returns at once when the
server is not running (it waits at most 1.5 seconds for a server that is slow to answer).

The server only answers requests addressed to your own machine (`localhost` or an IP), which blocks other websites from
posing as it (DNS rebinding). To reach it through a name (a reverse proxy, Tailscale), list it in `FLOORWALK_ALLOWED_HOSTS`.

The manual installer (`npm run hooks:install`) edits `~/.claude/settings.json`, which also holds your permissions, so it
is careful: if the file is unreadable or has a shape it does not know, it stops and changes nothing; before the first
write it saves a copy (`settings.json.floorwalk.backup`) and never overwrites it; and it only touches its own entries.

## What makes it different

- **Actions go to the right place.** The character does not just type or read; each kind of work has its own spot in
  the room, so you can tell at a glance who is shipping, who is stuck and who is researching.
- **Nothing to configure.** No API key, no account, no cloud: the server runs on your machine and only listens to it.
- **Build your own office.** Start from the ready-made room or from scratch: furniture, walls, glass rooms, people and
  roles, all in 3D.

## Build your own office

Menu (☰) → **Edit the room and people**. Pick furniture from the catalog, drop it on the floor, and adjust the people if you
want fixed characters besides your sessions. Menu → **Restore the default room** brings the ready-made room back.

| Pick the furniture | Place it in the room | Adjust a character |
|---|---|---|
| ![Catalog of work furniture: desk, island with 4 stations, meeting table, reception desk](docs/img/editor-catalog.png) | ![Placing a sofa: the new sofa floats over a free spot of the floor, outlined in green](docs/img/editor-placing.png) | ![Editing a character: name, role, skin, gender, hair and clothes](docs/img/editor-people.png) |

The lighting follows the time of day (or pick day, afternoon or night in the menu):

![The same office at night](docs/img/claude-code-room.jpg)

## Controls

Left-drag rotates the room in 90° steps, right-drag (or Shift + drag) pans, the wheel zooms toward the cursor; arrows/WASD
also pan. Click a person to open their card. Menu (top right) → edit the room, or **How to use (tour)** for a short tour.

Without WebGL the page falls back to a 2D view. `npm run build:single` creates a single offline HTML file
(`dist/floorwalk.html`, about 10 MB with the 3D models; `--sem-modelos` makes it about 1 MB).

## How it works

```
Claude Code ──hooks──▶ server (server/) ──events──▶ page (web/, Three.js)
```

The server turns everything into events of the [Floorwalk protocol](docs/PROTOCOLO.md) over a WebSocket. Any agent
system can speak it: send `{ "agent": "Bia", "state": "trabalhando", "place": "computador" }` and the character walks
to a computer.

| folder | contents |
|--------|----------|
| `web/` | the page: `index.html`, `css/app.css`, `js/` (one file per topic), `js3d/` (3D scene, furniture, characters) |
| `server/` | HTTP + WebSocket server, Claude Code bridge, protocol |
| `plugin/` | the Claude Code plugin: hook script and `hooks.json` |
| `scripts/` | manual hook installer, single-file build, checks |
| `test/` | `npm test` |
| `docs/` | protocol and development notes (Portuguese) |

## Known limits

- The protocol's state names are in Portuguese (English aliases such as `working` and `done` are accepted).
- Claude Code is the only coding agent supported today. Codex and Gemini CLI are next.
- Subagents do not get their own character yet; the main session goes to the meeting table when it delegates.
- One office per server.
- **3D character models** in `web/modelos/` were generated with [Meshy](https://www.meshy.ai) on a paid plan, which grants
  commercial-use rights, and are distributed with the project under the same MIT license. If you prefer not to use them,
  delete the folder and the code-built low-poly characters take over.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Development notes, decisions and the backlog live in
[`docs/CONTINUACAO.md`](docs/CONTINUACAO.md) (Portuguese).

## License

[MIT](LICENSE)
