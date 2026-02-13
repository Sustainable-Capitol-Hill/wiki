import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { DriveClient } from './drive-client';
import type { DriveFile } from './drive-client';
import { convertDocToMarkdown, convertMarkdownDoc } from './doc-converter';
import { getAuthClient } from './auth';
import {
  loadState,
  saveState,
  hasChanged,
  getDeletedFiles,
  updateFileState,
  removeFileState,
} from './state-manager';
import type { SyncState } from './state-manager';
import {
  sanitizePath,
  getContentPath,
  ensureDirectoryExists,
  deleteFile,
  deleteDirectory,
} from './path-utils';

dotenv.config();

interface SyncOptions {
  full?: boolean;
  dryRun?: boolean;
}

interface FileTree {
  [fileId: string]: {
    file: DriveFile;
    path: string[];  // Path parts from root to this file
  };
}

/**
 * Main sync function
 */
export async function sync(options: SyncOptions = {}) {
  const { full = false, dryRun = false } = options;

  console.log(chalk.bold.blue('\n🔄 Starting Google Drive sync...\n'));

  if (dryRun) {
    console.log(chalk.yellow('DRY RUN MODE - No files will be written\n'));
  }

  // Validate environment
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    console.error(chalk.red('❌ GOOGLE_DRIVE_FOLDER_ID not set in .env file'));
    process.exit(1);
  }

  // Initialize Drive client
  const spinner = ora('Authenticating with Google Drive...').start();
  const driveClient = new DriveClient();
  
  try {
    await driveClient.initialize();
    spinner.succeed('Authenticated successfully');
  } catch (error) {
    spinner.fail('Authentication failed');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }

  // Load sync state
  const state = full ? { lastSync: new Date(0).toISOString(), files: {} } : loadState();
  
  if (full) {
    console.log(chalk.yellow('⚠️  Full sync mode - ignoring state'));
  } else {
    console.log(chalk.gray(`Last sync: ${state.lastSync}`));
  }

  // Fetch Drive files
  spinner.start('Scanning Drive folder...');
  let driveFiles: DriveFile[];
  
  try {
    driveFiles = await driveClient.listFilesRecursive(folderId);
    spinner.succeed(`Found ${driveFiles.length} files in Drive`);
  } catch (error) {
    spinner.fail('Failed to scan Drive folder');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }

  // Build file tree with paths
  const fileTree = buildFileTree(driveFiles, folderId, driveClient);

  // Categorize changes
  const googleDocs = Object.values(fileTree).filter(item => 
    driveClient.isGoogleDoc(item.file)
  );

  const changes = categorizeChanges(googleDocs, state, driveClient);

  // Display summary
  console.log(chalk.bold('\nChanges detected:'));
  console.log(chalk.green(`  📄 New: ${changes.new.length} files`));
  console.log(chalk.blue(`  ✏️  Modified: ${changes.modified.length} files`));
  console.log(chalk.red(`  🗑️  Deleted: ${changes.deleted.length} files`));
  console.log(chalk.gray(`  ⏭️  Unchanged: ${changes.unchanged.length} files`));

  const totalChanges = changes.new.length + changes.modified.length + changes.deleted.length;

  if (totalChanges === 0) {
    console.log(chalk.green('\n✨ Everything is up to date!'));
    
    // Set GitHub Actions output if running in CI
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_changes=false\n');
    }
    
    return;
  }
  
  // Set GitHub Actions output if running in CI
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_changes=true\n');
  }

  // Clear docs directory if full sync
  if (full && !dryRun) {
    const docsDir = path.join(process.cwd(), 'src', 'content', 'docs');
    if (fs.existsSync(docsDir)) {
      console.log(chalk.yellow('\n🗑️  Clearing docs directory...'));
      deleteDirectory(docsDir);
      fs.mkdirSync(docsDir, { recursive: true });
    }
  }

  // Process changes
  console.log(chalk.bold('\n📝 Processing changes...\n'));

  // Build mapping of Drive file IDs to wiki paths
  const fileIdToPath = new Map<string, string>();
  for (const item of googleDocs) {
    const { file, path: pathParts } = item;
    const relativePath = pathParts.map(sanitizePath).join('/');
    let fileName = sanitizePath(file.name);
    
    // Special case: "Home" at root level should be saved as "index.md"
    if (pathParts.length === 0 && file.name.toLowerCase() === 'home') {
      fileName = 'index';
    }
    
    const filePath = relativePath ? `${relativePath}/${fileName}.md` : `${fileName}.md`;
    fileIdToPath.set(file.id, filePath);
  }

  let processedCount = 0;
  let imageCount = 0;
  const errors: Array<{ file: string; error: any }> = [];

  // Process new and modified files
  for (const item of [...changes.new, ...changes.modified]) {
    const { file, path: pathParts } = item;
    const isNew = changes.new.includes(item);
    const status = isNew ? chalk.green('new') : chalk.blue('modified');

    try {
      // Build relative path
      const relativePath = pathParts.map(sanitizePath).join('/');
      let fileName = sanitizePath(file.name);
      
      // Special case: "Home" at root level should be saved as "index.md" for Starlight homepage
      if (pathParts.length === 0 && file.name.toLowerCase() === 'home') {
        fileName = 'index';
      }
      
      const filePath = relativePath ? `${relativePath}/${fileName}.md` : `${fileName}.md`;

      console.log(`  ${status} ${filePath}`);

      if (!dryRun) {
        // Export both markdown (for content without comments) and HTML (for high-quality images)
        let markdown: string;
        let html: string | undefined;
        
        try {
          markdown = await driveClient.exportDocAsMarkdown(file.id);
        } catch (error: any) {
          // Check if the error message contains "too large" - googleapis may format errors differently
          const isTooLargeError = 
            error?.message?.includes('too large to be exported') ||
            error?.response?.data?.error?.errors?.[0]?.reason === 'exportSizeLimitExceeded';
          
          if (isTooLargeError && file.exportLinks?.['text/markdown']) {
            console.log(`    └─ File too large for standard export, trying exportLink...`);
            
            const authClient = await getAuthClient();
            const accessToken = await authClient.getAccessToken();
            
            // Download via exportLink using https
            markdown = await new Promise<string>((resolve, reject) => {
              https.get(file.exportLinks!['text/markdown'], {
                headers: {
                  'Authorization': `Bearer ${accessToken.token}`,
                },
              }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
                res.on('error', reject);
              }).on('error', reject);
            });
            
            console.log(`    └─ Successfully downloaded via exportLink`);
          } else if (isTooLargeError) {
            throw new Error('File too large to export and no exportLink available');
          } else {
            throw error;
          }
        }
        
        // Export HTML for high-quality images (only if document has images in markdown)
        if (markdown.includes('[image')) {
          try {
            html = await driveClient.exportDocAsHtml(file.id);
          } catch (error: any) {
            console.warn(`    └─ Could not fetch HTML for images, using markdown images`);
            // Continue without HTML - will use lower quality markdown images
          }
        }
        
        const author = file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress;
        
        // Create unique image directory for each document (folder/filename)
        const imageDir = relativePath ? `${relativePath}/${fileName}` : fileName;
        
        const result = await convertMarkdownDoc({
          fileId: file.id,
          fileName: file.name,
          markdown,
          html,
          imageDir,
          author,
          modifiedTime: file.modifiedTime,
          fileIdToPath,
        });

        // Write markdown file
        const fullPath = getContentPath(filePath);
        ensureDirectoryExists(fullPath);
        fs.writeFileSync(fullPath, result.markdown, 'utf8');

        // Update state
        updateFileState(state, file.id, {
          path: filePath,
          modifiedTime: new Date().toISOString(),
          driveModifiedTime: file.modifiedTime,
        });

        processedCount++;
        imageCount += result.imageCount;

        if (result.imageCount > 0) {
          console.log(chalk.gray(`    └─ Downloaded ${result.imageCount} images`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`    └─ Error: ${error}`));
      errors.push({ file: file.name, error });
    }
  }

  // Process deletions
  for (const fileId of changes.deleted) {
    const fileState = state.files[fileId];
    if (!fileState) continue;

    console.log(chalk.red(`  deleted ${fileState.path}`));

    if (!dryRun) {
      const fullPath = getContentPath(fileState.path);
      deleteFile(fullPath);
      removeFileState(state, fileId);
    }
  }

  // Save state
  if (!dryRun) {
    saveState(state);
    
    // Generate folder metadata for sidebar
    const folderMetadata = generateFolderMetadata(fileTree, folderId);
    saveFolderMetadata(folderMetadata);
  }

  // Final summary
  console.log(chalk.bold.green('\n✅ Sync complete!'));
  console.log(chalk.gray(`   Processed: ${processedCount} files`));
  console.log(chalk.gray(`   Images: ${imageCount} downloaded`));
  
  if (errors.length > 0) {
    console.log(chalk.yellow(`   Errors: ${errors.length} files failed`));
    console.log(chalk.gray('\n   Failed files:'));
    errors.forEach(({ file, error }) => {
      console.log(chalk.gray(`     - ${file}: ${error.message || error}`));
    });
  }

  if (!dryRun && processedCount > 0) {
    console.log(chalk.cyan('\n💡 Run \'npm run dev\' to preview changes\n'));
  }
}

/**
 * Builds a file tree with paths from the root folder
 */
function buildFileTree(
  files: DriveFile[],
  rootFolderId: string,
  driveClient: DriveClient
): FileTree {
  const tree: FileTree = {};
  const folderMap = new Map<string, DriveFile>();

  // First pass: index all folders
  for (const file of files) {
    if (driveClient.isFolder(file)) {
      folderMap.set(file.id, file);
    }
  }

  // Second pass: build paths for all files
  for (const file of files) {
    const pathParts = buildPathParts(file, rootFolderId, folderMap);
    tree[file.id] = {
      file,
      path: pathParts,
    };
  }

  return tree;
}

/**
 * Builds path parts from root to file
 */
function buildPathParts(
  file: DriveFile,
  rootFolderId: string,
  folderMap: Map<string, DriveFile>
): string[] {
  const parts: string[] = [];
  let currentFile = file;

  // Walk up the parent chain
  while (currentFile.parents && currentFile.parents[0] !== rootFolderId) {
    const parentId = currentFile.parents[0];
    const parentFolder = folderMap.get(parentId);
    
    if (!parentFolder) break;
    
    parts.unshift(parentFolder.name);
    currentFile = parentFolder;
  }

  return parts;
}

/**
 * Categorizes files into new, modified, deleted, and unchanged
 */
function categorizeChanges(
  items: Array<{ file: DriveFile; path: string[] }>,
  state: SyncState,
  driveClient: DriveClient
) {
  const newFiles: typeof items = [];
  const modified: typeof items = [];
  const unchanged: typeof items = [];

  for (const item of items) {
    if (hasChanged(state, item.file.id, item.file.modifiedTime)) {
      if (state.files[item.file.id]) {
        modified.push(item);
      } else {
        newFiles.push(item);
      }
    } else {
      unchanged.push(item);
    }
  }

  const currentFileIds = new Set(items.map(item => item.file.id));
  const deleted = getDeletedFiles(state, currentFileIds);

  return {
    new: newFiles,
    modified,
    deleted,
    unchanged,
  };
}

/**
 * Generates folder metadata mapping sanitized paths to original Drive names
 * Handles both top-level and nested folders
 */
function generateFolderMetadata(
  fileTree: FileTree,
  rootFolderId: string
): Record<string, { originalName: string; driveId: string; path: string[] }> {
  const metadata: Record<string, { originalName: string; driveId: string; path: string[] }> = {};
  const processedFolders = new Set<string>();

  // Collect all unique folder paths from the file tree
  const folderPaths = new Map<string, string[]>(); // sanitized path -> original path parts
  
  for (const item of Object.values(fileTree)) {
    // Process each level of the path to build folder metadata
    for (let i = 1; i <= item.path.length; i++) {
      const originalPath = item.path.slice(0, i);
      const sanitizedPath = originalPath.map(sanitizePath).join('/');
      
      if (!folderPaths.has(sanitizedPath)) {
        folderPaths.set(sanitizedPath, originalPath);
      }
    }
  }

  // Build metadata for each unique folder path
  for (const [sanitizedPath, originalPath] of folderPaths) {
    if (processedFolders.has(sanitizedPath)) continue;
    processedFolders.add(sanitizedPath);
    
    // The folder name is the last part of the path
    const originalFolderName = originalPath[originalPath.length - 1];
    
    // Find the folder's Drive ID
    const folderId = findFolderIdByPath(fileTree, originalPath);
    
    metadata[sanitizedPath] = {
      originalName: originalFolderName,
      driveId: folderId || '',
      path: originalPath,
    };
  }

  return metadata;
}

/**
 * Finds the Drive ID for a folder by its full path
 */
function findFolderIdByPath(fileTree: FileTree, originalPath: string[]): string | null {
  for (const [id, item] of Object.entries(fileTree)) {
    if (
      item.file.mimeType === 'application/vnd.google-apps.folder' &&
      arraysEqual(item.path.concat([item.file.name]), originalPath)
    ) {
      return id;
    }
  }
  return null;
}

/**
 * Helper to compare arrays for equality
 */
function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}

/**
 * Saves folder metadata to a JSON file
 */
function saveFolderMetadata(
  metadata: Record<string, { originalName: string; driveId: string; path: string[] }>
): void {
  const metadataPath = path.join(process.cwd(), 'folder-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
}

/**
 * CLI entry point
 */
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);
  const options: SyncOptions = {
    full: args.includes('--full'),
    dryRun: args.includes('--dry-run'),
  };

  sync(options).catch((error) => {
    console.error(chalk.red('\n❌ Sync failed:'), error);
    process.exit(1);
  });
}
