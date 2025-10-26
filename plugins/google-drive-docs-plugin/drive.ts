import "dotenv/config";

import { JWT } from "google-auth-library";
import { google } from "googleapis";

const googleSearchAccountAuth = new JWT({
  email: process.env.GCLOUD_CLIENT_EMAIL,
  key: process.env.GCLOUD_PRIVATE_KEY,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});

export const drive = google.drive({
  version: "v3",
  auth: googleSearchAccountAuth,
});
