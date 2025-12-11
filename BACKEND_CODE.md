# Roam Calendar Auth Backend - Complete Code

This file contains all the code needed for the OAuth backend repository.

---

## Repository Structure

```
roam-calendar-auth-backend/
├── src/
│   └── index.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## package.json

```json
{
  "name": "roam-calendar-auth-backend",
  "version": "1.0.0",
  "description": "OAuth backend for Roam Calendar extension - handles Google token exchange and refresh",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "keywords": ["oauth", "google-calendar", "roam-research"],
  "license": "MIT"
}
```

---

## src/index.js

```javascript
/**
 * OAuth Backend for Roam Calendar Extension
 *
 * Endpoints:
 *   POST /oauth/token   - Exchange authorization code for tokens
 *   POST /oauth/refresh - Refresh an expired access token
 *   GET  /health        - Health check
 */

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables (set these in Northflank)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
  "https://roamresearch.com",
];

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*")) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Exchange authorization code for tokens
 * Called once after user authorizes in the OAuth popup
 */
app.post("/oauth/token", async (req, res) => {
  const { code, redirect_uri } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirect_uri || "postmessage", // 'postmessage' for popup flow
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Token exchange error:", data);
      return res
        .status(400)
        .json({ error: data.error, description: data.error_description });
    }

    // Return tokens to client
    // IMPORTANT: The client should securely store the refresh_token
    res.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
    });
  } catch (error) {
    console.error("Token exchange failed:", error);
    res.status(500).json({ error: "Token exchange failed" });
  }
});

/**
 * Refresh an expired access token
 * Called automatically when access_token expires (~1 hour)
 */
app.post("/oauth/refresh", async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: "Missing refresh token" });
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Token refresh error:", data);
      return res
        .status(400)
        .json({ error: data.error, description: data.error_description });
    }

    // Return new access token
    // Note: Google typically doesn't return a new refresh_token
    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
    });
  } catch (error) {
    console.error("Token refresh failed:", error);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`OAuth backend running on port ${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
```

---

## .env.example

```bash
# Google OAuth credentials
# Get these from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Comma-separated list of allowed origins for CORS
# Use https://roamresearch.com for production
ALLOWED_ORIGINS=https://roamresearch.com,http://localhost:3000

# Port (Northflank will set this automatically)
PORT=3000
```

---

## .gitignore

```
node_modules/
.env
.DS_Store
*.log
```

---

## README.md

````markdown
# Roam Calendar Auth Backend

Minimal OAuth backend for the Roam Calendar extension. Handles Google token exchange and refresh securely.

## Endpoints

| Method | Endpoint         | Description                   |
| ------ | ---------------- | ----------------------------- |
| POST   | `/oauth/token`   | Exchange auth code for tokens |
| POST   | `/oauth/refresh` | Refresh expired access token  |
| GET    | `/health`        | Health check                  |

## Setup

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select existing)
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized JavaScript origins: `https://roamresearch.com`
   - Authorized redirect URIs: `https://your-backend-url.com/oauth/callback` (or use `postmessage` for popup flow)
5. Copy the Client ID and Client Secret

### 2. Local Development

```bash
# Clone the repo
git clone <your-repo-url>
cd roam-calendar-auth-backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials
nano .env

# Run locally
npm run dev
```
````

### 3. Deploy to Northflank

1. Create a new service in Northflank
2. Connect your GitHub repository
3. Set environment variables in Northflank dashboard:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `ALLOWED_ORIGINS=https://roamresearch.com`
4. Deploy!

### 4. Update Google Cloud Console

After deployment, add your Northflank URL to:

- Authorized JavaScript origins: `https://your-northflank-url.com`
- Authorized redirect URIs: `https://your-northflank-url.com/oauth/callback`

## Environment Variables

| Variable               | Description                         | Example                          |
| ---------------------- | ----------------------------------- | -------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth client ID from Google Console | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret (keep secure!)  | `GOCSPX-xxx`                     |
| `ALLOWED_ORIGINS`      | Comma-separated CORS origins        | `https://roamresearch.com`       |
| `PORT`                 | Server port (auto-set by host)      | `3000`                           |

## API Usage

### Exchange Authorization Code for Tokens

```bash
POST /oauth/token
Content-Type: application/json

{
  "code": "4/0AanRRrt...",
  "redirect_uri": "postmessage"
}
```

Response:

```json
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//0g...",
  "expires_in": 3599,
  "token_type": "Bearer",
  "scope": "https://www.googleapis.com/auth/calendar"
}
```

### Refresh Access Token

```bash
POST /oauth/refresh
Content-Type: application/json

{
  "refresh_token": "1//0g..."
}
```

Response:

```json
{
  "access_token": "ya29.a0...",
  "expires_in": 3599,
  "token_type": "Bearer",
  "scope": "https://www.googleapis.com/auth/calendar"
}
```

## Security Notes

- Never commit `.env` file to version control
- Keep `GOOGLE_CLIENT_SECRET` secure
- Use HTTPS in production
- Limit `ALLOWED_ORIGINS` to trusted domains only
- Regularly rotate OAuth credentials

## License

MIT

````

---

## Setup Instructions

1. Create a new GitHub repository named `roam-calendar-auth-backend`
2. Copy each section above into the corresponding files
3. Initialize the repository:
   ```bash
   npm install
   cp .env.example .env
   # Edit .env with your Google credentials
   npm run dev  # Test locally
````

4. Deploy to Northflank
5. Update the `BACKEND_URL` in your Roam extension's `googleCalendarService.js`

---

## Your Current Google OAuth Credentials

Based on your extension code, you already have:

- **Client ID**: `743270704845-jvqg91e6bk03jbnu1qcdnrh9r3ohgact.apps.googleusercontent.com`

You'll need to:

1. Get the **Client Secret** from Google Cloud Console
2. Add your Northflank backend URL to authorized origins in Google Console
3. Update the OAuth flow in your extension to use the authorization code flow instead of token client
