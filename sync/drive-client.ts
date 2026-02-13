import { google, drive_v3 } from 'googleapis';
import { getAuthClient } from './auth';
import * as fs from 'fs';

const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  parents?: string[];
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  exportLinks?: { [mimeType: string]: string };
}

export class DriveClient {
  private drive: drive_v3.Drive | null = null;

  /**
   * Initializes the Drive client with authentication
   */
  async initialize() {
    const auth = await getAuthClient();
    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Lists all files and folders recursively from a given folder
   */
  async listFilesRecursive(folderId: string): Promise<DriveFile[]> {
    if (!this.drive) {
      throw new Error('Drive client not initialized. Call initialize() first.');
    }

    const allFiles: DriveFile[] = [];
    const foldersToProcess: string[] = [folderId];

    console.log(`[DEBUG] Starting recursive scan from folder: ${folderId}`);

    while (foldersToProcess.length > 0) {
      const currentFolderId = foldersToProcess.shift()!;
      
      console.log(`[DEBUG] Scanning folder: ${currentFolderId}`);
      
      let pageToken: string | undefined;
      
      do {
        try {
          const response = await this.drive.files.list({
            q: `'${currentFolderId}' in parents and trashed=false`,
            fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, parents, owners, exportLinks)',
            pageSize: 1000,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });

          const files = response.data.files || [];
          console.log(`[DEBUG] Found ${files.length} files in folder ${currentFolderId}`);
          
          for (const file of files) {
            console.log(`[DEBUG] - ${file.name} (${file.mimeType})`);
            
            const driveFile: DriveFile = {
              id: file.id!,
              name: file.name!,
              mimeType: file.mimeType!,
              modifiedTime: file.modifiedTime!,
              parents: file.parents ?? undefined,
              owners: file.owners as any,
              exportLinks: file.exportLinks as any,
            };

            allFiles.push(driveFile);

            // If it's a folder, add to queue for processing
            if (file.mimeType === FOLDER_MIME_TYPE) {
              foldersToProcess.push(file.id!);
            }
          }

          pageToken = response.data.nextPageToken ?? undefined;
        } catch (error: any) {
          console.error(`[ERROR] Failed to list files in folder ${currentFolderId}:`, error.message);
          if (error.response) {
            console.error(`[ERROR] Response status: ${error.response.status}`);
            console.error(`[ERROR] Response data:`, error.response.data);
          }
          throw error;
        }
      } while (pageToken);
    }

    console.log(`[DEBUG] Total files found: ${allFiles.length}`);
    return allFiles;
  }

  /**
   * Exports a Google Doc as HTML
   */
  async exportDocAsHtml(fileId: string): Promise<string> {
    if (!this.drive) {
      throw new Error('Drive client not initialized. Call initialize() first.');
    }

    const response = await this.drive.files.export(
      {
        fileId,
        mimeType: 'text/html',
      },
      { responseType: 'text' }
    );

    return response.data as string;
  }

  /**
   * Downloads a file (e.g., image) from Drive
   */
  async downloadFile(fileId: string, destPath: string): Promise<void> {
    if (!this.drive) {
      throw new Error('Drive client not initialized. Call initialize() first.');
    }

    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      const dest = fs.createWriteStream(destPath);
      
      response.data
        .on('error', reject)
        .pipe(dest)
        .on('error', reject)
        .on('finish', resolve);
    });
  }

  /**
   * Gets metadata for a specific file
   */
  async getFileMetadata(fileId: string): Promise<DriveFile> {
    if (!this.drive) {
      throw new Error('Drive client not initialized. Call initialize() first.');
    }

    const response = await this.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, modifiedTime, parents, owners, exportLinks',
      supportsAllDrives: true,
    });

    const file = response.data;
    
    return {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      modifiedTime: file.modifiedTime!,
      parents: file.parents ?? undefined,
      owners: file.owners as any,
      exportLinks: file.exportLinks as any,
    };
  }

  /**
   * Checks if a file is a Google Doc
   */
  isGoogleDoc(file: DriveFile): boolean {
    return file.mimeType === GOOGLE_DOC_MIME_TYPE;
  }

  /**
   * Checks if a file is a folder
   */
  isFolder(file: DriveFile): boolean {
    return file.mimeType === FOLDER_MIME_TYPE;
  }
}
