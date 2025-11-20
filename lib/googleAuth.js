import { google } from "googleapis";

// Build a GoogleAuth using the same env-based credentials parsing
function buildAuth(scopes) {
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  let auth;

  if (raw) {
    let creds;
    try {
      creds = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (err) {
      try {
        const repaired = raw.replace(/\\n/g, "\n");
        creds = JSON.parse(repaired);
      } catch (err2) {
        throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT JSON: " + err2.message);
      }
    }

    if (creds.private_key && creds.private_key.includes("\\n")) {
      creds.private_key = creds.private_key.replace(/\\n/g, "\n");
    }

    auth = new google.auth.GoogleAuth({ credentials: creds, scopes });
  } else {
    auth = new google.auth.GoogleAuth({
      keyFile: "svt20-471109-615d0e03e469.json",
      scopes,
    });
  }

  return auth;
}

// Existing: Docs client
export async function getDocsClient() {
  const scopes = [
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
  ];
  const auth = buildAuth(scopes);
  return google.docs({ version: "v1", auth });
}

// New: Drive client (for listing docs in a folder)
export async function getDriveClient() {
  const scopes = ["https://www.googleapis.com/auth/drive.readonly"];
  const auth = buildAuth(scopes);
  return google.drive({ version: "v3", auth });
}
