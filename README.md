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

This wiki automatically syncs content from a Google Drive folder.

### Local Development Setup

1. **Create OAuth Credentials** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create OAuth 2.0 Client ID (type: "Desktop app")
   - Download the credentials

2. **Create `.env` file** (copy from `.env.example`):
   ```bash
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
   GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here
   ```

3. **Authenticate and Sync**:
   ```bash
   pnpm auth          # Authenticate (first time only)
   pnpm sync:full     # Full sync
   pnpm dev           # Start dev server
   ```

Your Google Drive folder structure will be preserved in the wiki sidebar.

## 🚀 Automated Deployment (GitHub Actions + GitHub Pages)

Deploy your wiki with automatic syncing from Google Drive every 6 hours.

### One-Time Setup

#### Step 1: Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create new)
3. Navigate to: **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**:
   - Name: `wiki-sync` (or your choice)
   - Description: "Automated Google Drive sync for wiki"
   - Click **Create and Continue**
5. Skip role assignment (click **Continue**, then **Done**)
6. Click on the created service account
7. Go to **Keys** tab → **Add Key** → **Create New Key**
8. Choose **JSON** format → **Create**
9. **Save the downloaded JSON file securely**

#### Step 2: Share Drive Folder with Service Account

1. Open the JSON file you downloaded
2. Find the `client_email` field (looks like `wiki-sync@project-id.iam.gserviceaccount.com`)
3. Go to your Google Drive folder
4. Right-click → **Share**
5. Paste the service account email
6. Grant **Viewer** permissions
7. Click **Send** (you can ignore the notification warning)

#### Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add each of these:

| Secret Name | Value | Where to Find |
|-------------|-------|---------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Entire contents of JSON file from Step 1 | Open the downloaded file, copy everything (from `{` to `}`) |
| `GOOGLE_DRIVE_FOLDER_ID` | Your Drive folder ID | From folder URL: `drive.google.com/drive/folders/{THIS_PART}` |
| `PUBLIC_GOOGLE_ANALYTICS_ID` | Your GA measurement ID *(optional)* | From Google Analytics, format: `G-XXXXXXXXXX` |

#### Step 4: Enable GitHub Pages

1. In your repo, go to: **Settings** → **Pages**
2. Under **Source**, select: **GitHub Actions**
3. Save

### 🎉 You're Done!

Your wiki will now:
- ✅ Sync from Google Drive every 6 hours
- ✅ Auto-deploy to: `https://{your-username}.github.io/{repo-name}/`
- ✅ Update automatically when you push code changes
- ✅ Can be manually triggered anytime via Actions tab

### Manual Deployment Trigger

To deploy immediately (without waiting for scheduled sync):

1. Go to **Actions** tab in your GitHub repo
2. Click **Sync and Deploy Wiki** workflow
3. Click **Run workflow** → **Run workflow**

The workflow will sync from Google Drive and deploy the updated site.

### Important Notes

⚠️ **Scheduled Workflow Limitation**: GitHub automatically disables scheduled workflows after 60 days of repository inactivity (no commits/pushes). You'll receive an email warning before this happens.

**To re-enable:**
- Option 1: Go to **Actions** tab → Click the disabled workflow → **Enable workflow**
- Option 2: Push any commit to the repository (even a small README update)

The manual trigger (workflow_dispatch) always works, regardless of the schedule status.

### Troubleshooting Deployment

**Workflow fails with "Authentication failed":**
- Verify `GOOGLE_SERVICE_ACCOUNT_JSON` secret is set correctly (entire JSON, no extra quotes)
- Check that Drive folder is shared with the service account email
- Ensure the service account has the correct permissions

**Pages site not updating:**
- Check the **Actions** tab for workflow runs - look for errors
- Verify GitHub Pages is enabled: **Settings** → **Pages** → Source: "GitHub Actions"
- Workflow must complete successfully (green checkmark)

**Build fails during sync:**
- Check that `GOOGLE_DRIVE_FOLDER_ID` secret matches your folder
- Verify the service account has read access to all files in the folder
- Check Actions logs for specific error messages

**Local development OAuth fails:**
- Run `pnpm auth` to re-authenticate
- Delete `.gdrive-token.json` and re-run `pnpm auth`
- Verify `.env` has correct OAuth credentials (not service account JSON)

### Custom Domain (Optional)

To use a custom domain with GitHub Pages:

1. Add a `CNAME` file to the `public/` directory with your domain
2. Configure DNS with your domain provider (add CNAME record pointing to `{username}.github.io`)
3. In GitHub: **Settings** → **Pages** → **Custom domain** → Enter your domain
4. Enable **Enforce HTTPS**

See [GitHub's custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) for details.

## 👀 Want to learn more?

Check out [Starlight’s docs](https://starlight.astro.build/), read [the Astro documentation](https://docs.astro.build), or jump into the [Astro Discord server](https://astro.build/chat).
