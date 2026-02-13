# Google Drive Wiki Sync - Implementation Summary

## Overview

A complete Google Drive sync system for Astro Starlight that:
- Syncs Google Docs from a Drive folder to your wiki
- Converts docs to Markdown with frontmatter
- Downloads and manages images locally
- Preserves folder structure in sidebar
- Tracks changes incrementally

## Files Created

### Configuration Files
- `.env.example` - Template for environment variables
- `.gitignore` - Updated with sync-related files

### Sync Scripts (`sync/`)
- `auth.ts` - OAuth2 authentication with Google Drive
- `drive-client.ts` - Google Drive API wrapper
- `doc-converter.ts` - Google Docs HTML → Markdown conversion
- `path-utils.ts` - Path sanitization and file system utilities
- `state-manager.ts` - Sync state tracking (JSON-based)
- `sync.ts` - Main sync orchestration script

### Documentation
- `SYNC_SETUP.md` - Comprehensive setup guide
- `README.md` - Updated with sync commands

### Updated Files
- `package.json` - Added sync scripts and dependencies
- `astro.config.mjs` - Configured sidebar autogeneration

## Architecture

### Sync Flow
1. **Authentication**: OAuth2 flow with token caching
2. **Discovery**: Recursively list all files in Drive folder
3. **Change Detection**: Compare with `sync-state.json`
4. **Processing**: 
   - Export Google Docs as HTML
   - Convert to Markdown
   - Download images
   - Write to `src/content/docs/`
5. **State Update**: Save new sync state

### File Mapping
```
Google Drive                    Local File System
─────────────                   ─────────────────
Root Folder (ID: abc123)        src/content/docs/
├── Folder A/                   ├── folder-a/
│   └── Doc 1                   │   └── doc-1.md
└── Doc 2                       └── doc-2.md

Images:                         public/images/
                                ├── folder-a/
                                │   └── doc-1/
                                │       └── image-0.png
```

### Path Sanitization
- Lowercase all paths
- Replace spaces with hyphens
- Remove special characters
- Collapse multiple hyphens

### Frontmatter Schema
```yaml
---
title: "Document Title"
description: "First paragraph excerpt..."
author: "Author Name"
lastModified: 2026-02-08T12:00:00Z
driveFileId: "abc123xyz"
---
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm auth` | Authenticate with Google (first time) |
| `pnpm sync` | Incremental sync (changed files only) |
| `pnpm sync:full` | Full sync (re-download everything) |
| `pnpm sync:dry` | Preview changes without writing |

## State Management

### `sync-state.json` Structure
```json
{
  "lastSync": "2026-02-08T12:00:00Z",
  "files": {
    "drive-file-id-1": {
      "path": "folder/document.md",
      "modifiedTime": "2026-02-08T11:00:00Z",
      "driveModifiedTime": "2026-02-08T11:00:00Z"
    }
  }
}
```

### Change Detection
- **New**: File ID not in state
- **Modified**: `driveModifiedTime` > `state.driveModifiedTime`
- **Deleted**: File ID in state but not in Drive
- **Unchanged**: Same `driveModifiedTime`

## Image Handling

1. Parse HTML for `<img>` tags
2. Detect image format:
   - Data URLs (base64) → decode and save
   - External URLs → download via fetch
3. Save to `public/images/{doc-path}/image-{n}.{ext}`
4. Rewrite markdown to use `/images/...` URLs
5. Astro serves `public/` at root, so images work

## Error Handling

### Authentication Errors
- Token refresh on expiry
- Clear error messages for missing credentials
- Graceful fallback to re-authentication

### API Errors
- Continue processing on single file failure
- Log errors but don't abort sync
- Summary of failed files at end

### Conversion Errors
- Skip file and log warning
- Keep old version if conversion fails
- Preserve broken image links with warning

## Security

### Credentials
- `.env` - Not committed (in .gitignore)
- `.gdrive-token.json` - Not committed (in .gitignore)
- OAuth scopes: read-only Drive access

### Token Management
- Automatic refresh on expiry
- Cached locally for convenience
- Can be regenerated via `pnpm auth`

## Performance

### Incremental Sync
- Only processes changed files
- Timestamp-based change detection
- No unnecessary API calls

### Rate Limiting
- Relies on error handling (no explicit throttling)
- Google Drive API has generous quotas
- Can add delays if needed

## Limitations

### Current Implementation
- Only syncs Google Docs (not Sheets, Slides, etc.)
- No real-time updates (manual sync)
- Images embedded in docs only
- Simple markdown conversion (may not preserve complex formatting)

### Future Enhancements
- Support for Google Sheets → tables
- Webhook support for automatic syncs
- Custom frontmatter fields
- File filtering/exclusion patterns
- Conflict resolution for concurrent edits

## Deployment

### Static Hosting (Current)
1. Run `pnpm sync` locally
2. Commit synced files to git
3. Deploy to Netlify/Vercel/etc.
4. Wiki is fully static

### Dynamic Option (Future)
1. Deploy sync service to Railway/Render
2. Add webhook endpoint
3. Auto-sync on Drive changes
4. Trigger rebuilds or use SSR

## Troubleshooting

### Common Issues

**"Missing Google OAuth credentials"**
- Create `.env` from `.env.example`
- Fill in all required values

**"Authentication failed"**
- Check Client ID and Secret
- Verify redirect URI is exact
- Delete `.gdrive-token.json` and retry

**"No files synced"**
- Check folder ID is correct
- Verify folder contains Google Docs
- Ensure Drive permissions are correct

**"Images not showing"**
- Check `public/images/` directory
- Verify image paths in markdown
- Look for download errors in sync output

## Dependencies

### Runtime
- `googleapis` - Google Drive API client
- `node-html-markdown` - HTML to Markdown conversion
- `jsdom` - HTML parsing for image extraction
- `dotenv` - Environment variable management
- `chalk` - Terminal colors
- `ora` - Loading spinners

### Dev
- `tsx` - TypeScript execution
- `@types/node` - Node.js types
- `@types/jsdom` - JSDOM types

## Next Steps

To use this system:

1. Follow `SYNC_SETUP.md` to configure Google OAuth
2. Run `pnpm auth` to authenticate
3. Run `pnpm sync:full` for initial sync
4. Run `pnpm dev` to view wiki
5. Use `pnpm sync` for updates

Happy wiki building! 📚
