import dotenv from 'dotenv';
import { getAuthClient } from './auth';
import { google } from 'googleapis';

dotenv.config();

async function checkAccount() {
  console.log('Checking authenticated Google account...\n');
  
  const auth = await getAuthClient();
  const drive = google.drive({ version: 'v3', auth: auth as any });
  
  // Get info about the authenticated user
  const about = await drive.about.get({
    fields: 'user',
  });
  
  console.log('Authenticated as:');
  console.log('  Email:', about.data.user?.emailAddress);
  console.log('  Name:', about.data.user?.displayName);
  console.log();
  
  console.log('Make sure this folder is owned by or shared with this account:');
  console.log('  https://drive.google.com/drive/folders/' + process.env.GOOGLE_DRIVE_FOLDER_ID);
}

checkAccount().catch(console.error);
