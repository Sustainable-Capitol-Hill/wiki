# Google Drive Sync Setup Guide

This guide will walk you through setting up Google Drive OAuth credentials and syncing your Drive folder to this Astro wiki.

## Prerequisites

- A Google account
- Access to Google Cloud Console
- A Google Drive folder with Google Docs

## Step 1: Set Up Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
   - Click the project dropdown in the top navigation
   - Click "New Project"
   - Enter a name (e.g., "Wiki Sync")
   - Click "Create"

## Step 2: Enable Google Drive API

1. In the Google Cloud Console, make sure your project is selected
2. Go to "APIs & Services" → "Library"
3. Search for "Google Drive API"
4. Click on it and click "Enable"

## Step 3: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth Client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type (unless you have a Google Workspace)
   - Fill in app name: "Wiki Sync" (or your preferred name)
   - Add your email as the developer contact
   - Click "Save and Continue"
   - Skip scopes (we'll set them in code)
   - Add your email as a test user
   - Click "Save and Continue"
4. Now create the OAuth Client ID:
   - Application type: **Desktop app**
   - Name: "Wiki Sync Desktop" (or your preferred name)
   - Click "Create"
5. You'll see a dialog with your Client ID and Client Secret
   - **Don't close this yet!** Copy these values

## Step 4: Configure Environment Variables

1. In the project root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
   GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here
   ```

3. Get your Drive folder ID:
   - Open Google Drive in your browser
   - Navigate to the folder you want to sync
   - The URL will look like: `https://drive.google.com/drive/folders/FOLDER_ID`
   - Copy the `FOLDER_ID` part and paste it into `.env`

## Step 5: Authenticate

Run the authentication script to log in and save your credentials:

```bash
npm run auth
```

This will:
1. Open your browser to Google's OAuth consent page
2. Ask you to sign in and authorize the app
3. Save your access token to `.gdrive-token.json`

**Note:** The token file is gitignored and should never be committed.

## Step 6: Run Your First Sync

Now you're ready to sync! Try a dry run first to see what will happen:

```bash
npm run sync:dry
```

If everything looks good, run a full sync:

```bash
npm run sync:full
```

This will:
- Download all Google Docs from your Drive folder
- Convert them to Markdown
- Save them to `src/content/docs/`
- Download images to `public/images/`
- Preserve your folder structure

## Daily Usage

After the initial setup, use these commands:

### Incremental Sync (Recommended)
Only syncs files that have changed since the last sync:
```bash
npm run sync
```

### Full Sync
Re-syncs everything, ignoring the sync state:
```bash
npm run sync:full
```

### Preview Changes
See what would be synced without actually writing files:
```bash
npm run sync:dry
```

### View Your Wiki
Start the development server:
```bash
npm run dev
```

Visit `http://localhost:4321` to see your wiki.

## Folder Structure

Your Google Drive folder structure will be mirrored in the wiki:

```
Google Drive:
  Wiki Folder (your root)
  ├── Getting Started/
  │   └── Introduction.gdoc
  └── Guides/
      └── Setup.gdoc

Becomes:
  src/content/docs/
  ├── getting-started/
  │   └── introduction.md
  └── guides/
      └── setup.md
```

## Troubleshooting

### "Missing Google OAuth credentials"
Make sure your `.env` file exists and has all required variables filled in.

### "Authentication failed"
- Check that your Client ID and Client Secret are correct
- Make sure the redirect URI is exactly `http://localhost:3000/oauth2callback`
- Try deleting `.gdrive-token.json` and running `npm run auth` again

### "Token expired"
The sync script will automatically refresh expired tokens. If this fails, delete `.gdrive-token.json` and run `npm run auth` again.

### "Permission denied" errors
Make sure:
- You've added your email as a test user in the OAuth consent screen
- You have access to the Google Drive folder
- The folder ID in `.env` is correct

### Images not showing up
- Images are saved to `public/images/` with the same folder structure as docs
- Image URLs in markdown use absolute paths: `/images/folder/image.png`
- Make sure the sync completed without errors

## Advanced Configuration

### Excluding Files
Currently, the sync downloads all Google Docs in the folder. To exclude certain files, you can:
1. Move them to a different folder outside the sync root
2. Or modify `sync/sync.ts` to add filtering logic

### Custom Frontmatter
Edit `sync/doc-converter.ts` to customize the frontmatter fields added to each page.

### Scheduling Syncs
You can set up a cron job or scheduled task to run `npm run sync` periodically:

```bash
# Example: Sync every hour
0 * * * * cd /path/to/wiki-astro && npm run sync
```

## Security Notes

- Never commit `.env` or `.gdrive-token.json` to version control
- Keep your Client Secret secure
- Only share your OAuth credentials with trusted team members
- Consider using a service account if this will run on a server

## Getting Help

If you encounter issues:
1. Check the error messages carefully
2. Verify all credentials are correct
3. Try deleting `.gdrive-token.json` and re-authenticating
4. Check Google Cloud Console for any API quota limits

---

Happy wiki building! 📚
