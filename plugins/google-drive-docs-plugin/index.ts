import * as path from "path";
import * as fs from "fs-extra"; // Using fs-extra for recursive mkdir and better file ops
import { google, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import { DocusaurusContext } from "@docusaurus/types"; // Import DocusaurusContext type
import type { CLIRegistry } from "@docusaurus/types"; // Import CLIRegistry type for extendCli

// --- Configuration Constants ---
const SCOPES: string[] = ["https://www.googleapis.com/auth/drive.readonly"];
const TOKEN_PATH: string = "token.json"; // Relative to Docusaurus project root
const CREDENTIALS_PATH: string = "credentials.json"; // Relative to Docusaurus project root

interface MimeExportInfo {
  mimeType: string;
  extension: string;
}

const MIME_TYPES_EXPORT: { [key: string]: MimeExportInfo } = {
  "application/vnd.google-apps.document": {
    mimeType: "text/markdown",
    extension: ".md",
  },
};

interface PluginOptions {
  // These options now serve as defaults that can be overridden by CLI args
  sharedDriveId?: string;
  nestedFolderId?: string;
  outputDir?: string;
}

/**
 * Authenticates with Google Drive API and returns the Drive service and OAuth2 client.
 * Assumes token.json is already generated.
 * @param siteDir The root directory of the Docusaurus site.
 * @returns An object containing the Drive service and the authenticated OAuth2 client.
 */
async function authenticate(
  siteDir: string,
): Promise<{ drive: drive_v3.Drive; authClient: OAuth2Client }> {
  let credentials: any;
  try {
    credentials = JSON.parse(
      fs.readFileSync(path.join(siteDir, CREDENTIALS_PATH), "utf8"),
    );
  } catch (err: any) {
    throw new Error(
      `Error loading client secret file: ${path.join(siteDir, CREDENTIALS_PATH)}. Please ensure it exists. Error: ${err.message}`,
    );
  }

  const { client_secret, client_id, redirect_uris } =
    credentials.installed || credentials.web;
  const oAuth2Client = new OAuth2Client(
    client_id,
    client_secret,
    redirect_uris[0],
  );

  try {
    const token = JSON.parse(
      fs.readFileSync(path.join(siteDir, TOKEN_PATH), "utf8"),
    );
    oAuth2Client.setCredentials(token);
  } catch (err: any) {
    throw new Error(
      `Error loading token from ${path.join(siteDir, TOKEN_PATH)}. Please run the 'auth_setup.ts' script first to generate it. Error: ${err.message}`,
    );
  }

  const drive = google.drive({ version: "v3", auth: oAuth2Client });
  return { drive, authClient: oAuth2Client };
}

/**
 * Downloads a file from Google Drive, exporting Google Workspace files as Markdown
 * using their exportLinks and the axios library.
 * @param drive The Google Drive API service client.
 * @param fileId The ID of the file to download.
 * @param fileName The name of the file.
 * @param fileMimeType The MIME type of the file.
 * @param outputPath The local directory path where the file should be saved.
 * @param exportLinks A map of MIME types to export URLs provided by the Drive API.
 * @param authClient The authenticated OAuth2 client.
 */
async function downloadFile(
  drive: drive_v3.Drive,
  fileId: string,
  fileName: string,
  fileMimeType: string,
  outputPath: string,
  exportLinks: { [key: string]: string },
  authClient: OAuth2Client,
): Promise<void> {
  try {
    if (fileMimeType in MIME_TYPES_EXPORT) {
      const exportInfo = MIME_TYPES_EXPORT[fileMimeType];
      const targetMimeType = exportInfo.mimeType;
      const fileExtension = exportInfo.extension;

      // Check if the desired export link exists for the file
      if (!exportLinks || !(targetMimeType in exportLinks)) {
        console.warn(
          `  Warning: No export link found for '${fileName}' to '${targetMimeType}'. Skipping.`,
        );
        return;
      }

      const exportUrl = exportLinks[targetMimeType];
      console.log(
        `  Exporting Google Workspace file '${fileName}' as ${fileExtension} using exportLink...`,
      );

      // Use axios to download the file from the export URL
      const response = await axios({
        method: "GET",
        url: exportUrl,
        headers: {
          Authorization: `Bearer ${authClient.credentials.access_token}`,
        },
        responseType: "stream", // Important for handling large files efficiently
      });

      const outputFilePath = path.join(outputPath, fileName + fileExtension);
      const writer = fs.createWriteStream(outputFilePath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          console.log(
            `  Successfully downloaded/exported '${fileName}${fileExtension}'.`,
          );
          resolve();
        });
        writer.on("error", (err: Error) => {
          console.error(`Error writing file '${outputFilePath}':`, err);
          reject(err);
        });
      });
    } else {
      // This block should ideally not be reached due to prior filtering in replicateDrive
      console.log(
        `  Skipping non-Google Doc file: '${fileName}' (MIME type: ${fileMimeType})`,
      );
    }
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(
        `An HTTP error occurred while downloading/exporting '${fileName}': ${error.response ? error.response.status : "N/A"} - ${error.message}`,
      );
      if (error.response && error.response.data) {
        // Attempt to read error message from stream if available
        let errorData = "";
        error.response.data.on(
          "data",
          (chunk: Buffer) => (errorData += chunk.toString()),
        );
        error.response.data.on("end", () =>
          console.error("  Error response body:", errorData),
        );
      }
    } else {
      console.error(
        `An unexpected error occurred during download/export of '${fileName}': ${error.message}`,
      );
    }
  }
}

/**
 * Recursively replicates the directory structure and downloads files
 * from a Google Drive Shared Drive.
 * @param drive The Google Drive API service client.
 * @param parentId The ID of the current parent folder in Drive.
 * @param currentPath The current local path corresponding to the Drive folder.
 * @param sharedDriveIdForQuery The root Shared Drive ID (used for the driveId query parameter).
 * @param authClient The authenticated OAuth2 client.
 */
async function replicateDrive(
  drive: drive_v3.Drive,
  parentId: string,
  currentPath: string,
  sharedDriveIdForQuery: string,
  authClient: OAuth2Client,
): Promise<void> {
  let pageToken: string | null = null;
  do {
    try {
      const response = await drive.files.list({
        q: `'${parentId}' in parents and trashed = false`,
        corpora: "drive",
        driveId: sharedDriveIdForQuery,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        fields: "nextPageToken, files(id, name, mimeType, exportLinks)",
        pageToken: pageToken,
      });

      const items = response.data.files || [];
      if (items.length === 0) {
        console.log(`No files or folders found in '${currentPath}'.`);
        break; // Exit loop if no items
      }

      for (const item of items) {
        const itemName = item.name || "Untitled"; // Provide a fallback name
        const itemId = item.id;
        const itemMimeType = item.mimeType;

        if (itemMimeType === "application/vnd.google-apps.folder") {
          console.log(
            `Creating directory: ${path.join(currentPath, itemName)}`,
          );
          const newDirPath = path.join(currentPath, itemName);
          await fs.ensureDir(newDirPath); // Ensures directory exists recursively
          await replicateDrive(
            drive,
            itemId!,
            newDirPath,
            sharedDriveIdForQuery,
            authClient,
          ); // itemId is guaranteed here
        } else {
          // It's a file, check if it's a Google Doc
          if (itemMimeType === "application/vnd.google-apps.document") {
            await downloadFile(
              drive,
              itemId!,
              itemName,
              itemMimeType,
              currentPath,
              item.exportLinks || {},
              authClient,
            ); // itemId is guaranteed here
          } else {
            console.log(
              `  Skipping non-Google Doc file: '${itemName}' (MIME type: ${itemMimeType})`,
            );
          }
        }
      }
      pageToken = response.data.nextPageToken || null;
    } catch (error: any) {
      console.error(
        `An error occurred while listing files in '${currentPath}': ${error.message}`,
      );
      // Depending on the error, you might want to break or continue
      break;
    }
  } while (pageToken);
}

/**
 * Docusaurus Plugin Entry Point
 * @param context The Docusaurus context object.
 * @param options Plugin options defined in docusaurus.config.js.
 */
module.exports = function (context: DocusaurusContext, options: PluginOptions) {
  return {
    name: "docusaurus-plugin-google-drive-docs",

    /**
     * Extends the Docusaurus CLI to add a custom command for syncing Google Drive Docs.
     * @param cli The Docusaurus CLI registry.
     */
    extendCli(cli: CLIRegistry) {
      cli
        .command("drive:sync") // Define the new command
        .description("Sync Google Drive Docs to Docusaurus docs directory.")
        .option("--shared-drive-id <id>", "The ID of the Google Shared Drive.")
        .option(
          "--nested-folder-id <id>",
          "Optional: The ID of a specific folder within the Shared Drive to replicate.",
        )
        .option(
          "--output-dir <path>",
          "Optional: The output directory relative to project root (default: docs).",
        )
        .action(
          async (cliOptions: {
            sharedDriveId?: string;
            nestedFolderId?: string;
            outputDir?: string;
          }) => {
            const { siteDir } = context;

            // Determine sharedDriveId: CLI arg takes precedence, then plugin option
            const sharedDriveId =
              cliOptions.sharedDriveId || options.sharedDriveId;
            if (!sharedDriveId) {
              console.error(
                "Error: --shared-drive-id must be provided either via CLI or in docusaurus.config.js plugin options.",
              );
              process.exit(1);
            }

            // Determine nestedFolderId: CLI arg takes precedence, then plugin option
            const nestedFolderId =
              cliOptions.nestedFolderId || options.nestedFolderId;

            // Determine outputDir: CLI arg takes precedence, then plugin option, then default 'docs'
            const outputDir =
              cliOptions.outputDir || options.outputDir || "docs";

            const absoluteOutputDir = path.join(siteDir, outputDir);

            // Clear the output directory before syncing
            console.log(`Clearing output directory: ${absoluteOutputDir}`);
            await fs.emptyDir(absoluteOutputDir); // This will delete all contents but not the directory itself
            await fs.ensureDir(absoluteOutputDir); // Re-create if it was deleted or ensure it exists

            console.log("Starting Google Drive Docs Replication via CLI...");

            try {
              const { drive, authClient } = await authenticate(siteDir);
              console.log("Authentication successful.");

              const startParentId = nestedFolderId || sharedDriveId;

              console.log(
                `Replicating from ID: ${startParentId} to '${absoluteOutputDir}'`,
              );

              // Start replication from the determined parent ID.
              // The sharedDriveId is passed for the 'driveId' parameter in API calls.
              await replicateDrive(
                drive,
                startParentId,
                absoluteOutputDir,
                sharedDriveId,
                authClient,
              );

              console.log("\nGoogle Docs replication complete!");
            } catch (error: any) {
              console.error(
                "Error during Google Drive Docs replication:",
                error.message,
              );
              // Exit with a non-zero code to indicate failure
              process.exit(1);
            }
          },
        );
    },
    // You can add other lifecycle methods if needed, e.g., contentLoaded, postBuild
  };
};
