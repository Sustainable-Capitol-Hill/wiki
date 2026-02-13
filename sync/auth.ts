import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { URL } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN_PATH = path.join(process.cwd(), '.gdrive-token.json');

interface TokenData {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Creates and returns an authorized OAuth2 client
 */
export async function getAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Google OAuth credentials. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env file.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  // Check if we have a saved token
  if (fs.existsSync(TOKEN_PATH)) {
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) as TokenData;
    oauth2Client.setCredentials(tokenData);

    // Check if token is expired
    if (tokenData.expiry_date && tokenData.expiry_date < Date.now()) {
      console.log('Token expired, refreshing...');
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
        console.log('Token refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // Token refresh failed, need to re-authenticate
        await authenticateUser(oauth2Client);
      }
    }

    return oauth2Client;
  }

  // No saved token, need to authenticate
  await authenticateUser(oauth2Client);
  return oauth2Client;
}

/**
 * Performs OAuth flow to get new credentials
 */
async function authenticateUser(oauth2Client: any) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  console.log('\n🔐 Authorization required!');
  console.log('\nPlease visit this URL to authorize the application:');
  console.log('\n' + authUrl + '\n');

  const code = await getAuthCodeFromCallback();

  console.log('\n✓ Authorization code received, exchanging for token...');

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Save token to disk
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('✓ Credentials saved to', TOKEN_PATH);
}

/**
 * Starts a local server to receive the OAuth callback
 */
function getAuthCodeFromCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url && req.url.indexOf('/oauth2callback') > -1) {
          const qs = new URL(req.url, 'http://localhost:3000').searchParams;
          const code = qs.get('code');
          
          if (code) {
            res.end('Authentication successful! You can close this window and return to the terminal.');
            server.close();
            resolve(code);
          } else {
            res.end('Authentication failed: No code received');
            server.close();
            reject(new Error('No authorization code received'));
          }
        }
      } catch (e) {
        reject(e);
      }
    }).listen(3000, () => {
      console.log('Waiting for authorization...');
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Standalone script to test authentication
 */
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  (async () => {
    try {
      console.log('Testing Google Drive authentication...\n');
      await getAuthClient();
      console.log('\n✅ Authentication successful!');
    } catch (error) {
      console.error('\n❌ Authentication failed:', error);
      process.exit(1);
    }
  })();
}
