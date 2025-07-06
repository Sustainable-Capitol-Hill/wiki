import * as fs from "fs";
import * as path from "path";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as http from "http"; // Import http module for local server
import { URL } from "url"; // Import URL for parsing redirect URL
import open from "open"; // Import 'open' to automatically open browser

// --- Configuration ---
const SCOPES: string[] = ["https://www.googleapis.com/auth/drive.readonly"];
const TOKEN_PATH: string = "token.json";
const CREDENTIALS_PATH: string = "credentials.json";
const LOCAL_SERVER_PORT: number = 8080; // Default port for the local server

async function authorize(): Promise<OAuth2Client | undefined> {
  let credentials: any;
  try {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  } catch (err: any) {
    console.error(`Error loading client secret file: ${CREDENTIALS_PATH}`);
    console.error(
      "Please ensure your credentials.json is in the same directory.",
    );
    console.error(
      "You can download it from Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs -> Your Desktop App -> Download JSON.",
    );
    return;
  }

  const { client_secret, client_id, redirect_uris } =
    credentials.installed || credentials.web;

  // Use the localhost redirect URI for the OAuth2Client
  // Ensure this exact URI is configured in your Google Cloud Console for the Desktop app
  const redirectUri = `http://localhost:${LOCAL_SERVER_PORT}`;
  const oAuth2Client = new OAuth2Client(client_id, client_secret, redirectUri);

  // Check if we have a token already
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      oAuth2Client.setCredentials(
        JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")),
      );
      console.log(
        "Token already exists. To re-authenticate, delete token.json and run this script again.",
      );
      return oAuth2Client;
    } catch (err: any) {
      console.warn(
        "Existing token.json is invalid or corrupted. Re-authenticating...",
      );
      fs.unlinkSync(TOKEN_PATH); // Delete corrupted token
    }
  }

  // Generate a new token using a local server redirect
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url && req.url.startsWith("/")) {
          // Only handle root path redirects
          const requestUrl = new URL(req.url, redirectUri);
          const code = requestUrl.searchParams.get("code");

          if (code) {
            res.end("Authentication successful! You can close this tab.");
            server.close(); // Close the server once the code is received

            const { tokens } = await oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
            console.log("Token stored to", TOKEN_PATH);
            resolve(oAuth2Client);
          } else {
            res.end("Authentication failed: No code received.");
            server.close();
            reject(new Error("No authorization code received."));
          }
        }
      } catch (err: any) {
        console.error("Error handling redirect:", err);
        res.end("Authentication error.");
        server.close();
        reject(err);
      }
    });

    server.listen(LOCAL_SERVER_PORT, () => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        redirect_uri: redirectUri, // Explicitly set redirect_uri for the auth URL
      });
      console.log(`Local server listening on ${redirectUri}`);
      console.log("Opening browser for authorization...");
      open(authUrl).catch((err) => {
        console.error(
          "Failed to open browser automatically. Please visit this URL manually:",
          authUrl,
        );
      });
    });

    server.on("error", (err: any) => {
      console.error("Local server error:", err);
      reject(err);
    });
  });
}

authorize().catch(console.error);
