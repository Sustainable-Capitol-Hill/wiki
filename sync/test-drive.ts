import dotenv from 'dotenv';
import { DriveClient } from './drive-client';
import { getAuthClient } from './auth';

dotenv.config();

async function testDriveAccess() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  
  if (!folderId) {
    console.error('❌ GOOGLE_DRIVE_FOLDER_ID not set in .env');
    process.exit(1);
  }

  console.log('Testing Drive access...\n');
  console.log(`Folder ID: ${folderId}\n`);

  // Check token scopes
  console.log('Checking OAuth token...');
  const auth = await getAuthClient();
  const credentials = auth.credentials;
  console.log('✓ Token scope:', credentials.scope);
  console.log();

  const client = new DriveClient();
  await client.initialize();

  try {
    // Test 1: Get folder metadata
    console.log('Test 1: Getting folder metadata...');
    const folderMeta = await client.getFileMetadata(folderId);
    console.log('✓ Folder found:', folderMeta.name);
    console.log('  Type:', folderMeta.mimeType);
    console.log('  ID:', folderMeta.id);
    console.log('  Modified:', folderMeta.modifiedTime);
    console.log();

    // Test 2: List files in folder
    console.log('Test 2: Listing files...');
    const files = await client.listFilesRecursive(folderId);
    console.log(`✓ Found ${files.length} total files`);
    console.log();

    if (files.length > 0) {
      console.log('First 10 files:');
      files.slice(0, 10).forEach(file => {
        console.log(`  - ${file.name} (${file.mimeType})`);
      });
    } else {
      console.log('⚠️  Folder appears to be empty or inaccessible');
      console.log('\nPossible reasons:');
      console.log('  1. Folder is actually empty');
      console.log('  2. Files are in subfolders (should still be found)');
      console.log('  3. Permission issue with OAuth token');
      console.log('\nTry:');
      console.log('  - Check the folder in Google Drive web interface');
      console.log('  - Make sure the folder ID is correct');
      console.log('  - Verify files exist in that folder');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    console.log('\n💡 Troubleshooting:');
    console.log('  1. Verify the folder ID is correct (from the Drive URL)');
    console.log('  2. Make sure the folder is owned by or shared with the Google account you authenticated with');
    console.log('  3. Try deleting .gdrive-token.json and running "pnpm auth" again');
    console.log('  4. Check if you can access the folder in your browser while logged into the same Google account');
    process.exit(1);
  }
}

testDriveAccess();
