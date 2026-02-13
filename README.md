# Starlight Starter Kit: Basics

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

A wiki powered by Astro Starlight that automatically syncs with Google Drive.

## ✨ Features

- Automatic sync from Google Drive folder
- Converts Google Docs to Markdown
- Preserves folder structure in sidebar
- Downloads and optimizes images
- Incremental sync (only updates changed files)
- Simple manual sync workflow (no hosting required)
- Google Analytics integration (optional)
- "Edit in Google Docs" link on every page
- Automatic redirects from old Drive file IDs

## 🚀 Project Structure

This is an Astro + Starlight wiki that syncs with Google Drive.

Inside of your Astro + Starlight project, you'll see the following folders and files:

```
.
├── public/
│   └── images/          # Auto-synced images from Google Drive
├── src/
│   ├── assets/
│   ├── content/
│   │   └── docs/        # Auto-synced markdown from Google Drive
│   └── content.config.ts
├── sync/                # Google Drive sync scripts
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

Starlight looks for `.md` or `.mdx` files in the `src/content/docs/` directory. Each file is exposed as a route based on its file name.

Images can be added to `src/assets/` and embedded in Markdown with a relative link.

Static assets, like favicons, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`            | Installs dependencies                            |
| `pnpm dev`                | Starts local dev server at `localhost:4321`      |
| `pnpm build`              | Build your production site to `./dist/`          |
| `pnpm preview`            | Preview your build locally, before deploying     |
| `pnpm astro ...`          | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help`    | Get help using the Astro CLI                     |
| `pnpm auth`               | Authenticate with Google Drive (first time)      |
| `pnpm sync`               | Sync changed files from Google Drive             |
| `pnpm sync:full`          | Full sync, re-download all files                 |
| `pnpm sync:dry`           | Preview what would be synced                     |

## 📚 Google Drive Sync Setup

This wiki automatically syncs content from a Google Drive folder. To set it up:

1. Follow the detailed setup guide in [SYNC_SETUP.md](./SYNC_SETUP.md)
2. Create a `.env` file with your Google OAuth credentials
3. Run `pnpm auth` to authenticate
4. Run `pnpm sync:full` to perform your first sync
5. Run `pnpm dev` to view your wiki

Your Google Drive folder structure will be preserved in the wiki sidebar.

## 👀 Want to learn more?

Check out [Starlight’s docs](https://starlight.astro.build/), read [the Astro documentation](https://docs.astro.build), or jump into the [Astro Discord server](https://astro.build/chat).
