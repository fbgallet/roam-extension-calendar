# Privacy Policy for Full Calendar Extension for Roam Research

**Last Updated: December 27, 2025**

## Introduction

This Privacy Policy describes how the Full Calendar Extension for Roam Research ("Extension", "we", "our") handles your information when you use our browser extension that integrates Google Calendar and Google Tasks with Roam Research.

## Information We Collect

### 1. Authentication Tokens

When you connect your Google account to the Extension:

- **What we collect**: OAuth 2.0 access tokens and refresh tokens
- **Where it's stored**:
  - Access tokens are stored locally in your browser using Roam's extension storage API
  - Refresh tokens are stored on our secure backend server to enable persistent authentication
- **What it contains**: These tokens do NOT contain any personal information such as your name, email, or calendar data. They are encrypted keys that allow the Extension to access your Google Calendar and Tasks on your behalf.

### 2. Calendar and Task Data

- **Local Storage Only**: All your calendar events, tasks, and related data are stored exclusively in your local browser storage
- **No Server Storage**: We do NOT store, transmit, or have access to your calendar events, task content, or any other personal data on our servers
- **Synchronization**: Data syncing occurs directly between your browser and Google's servers

### 3. Configuration Data

- **What we collect**: Your Extension settings including:
  - Which calendars you choose to sync
  - Custom calendar display names and tags
  - Sync preferences (intervals, directions, formatting options)
  - Task list configurations
- **Where it's stored**: Locally in your browser only

## How We Use Your Information

### Authentication Tokens

- **Purpose**: To maintain persistent authentication with Google services without requiring you to re-authorize frequently
- **Server Processing**: Our backend server exchanges authorization codes for tokens and refreshes expired tokens
- **Token Refresh**: The Extension automatically refreshes your access token approximately every hour to maintain uninterrupted access
- **No Token Inspection**: Our server processes tokens securely without inspecting, logging, or storing any of the data they grant access to

### Your Data

- All synchronization between Roam Research and Google Calendar/Tasks happens directly in your browser
- We do not collect, analyze, or process your calendar events or task content
- We do not track your usage patterns or behavior

## Data Sharing and Third Parties

### Google Services

This Extension uses Google Calendar API and Google Tasks API to:

- Read your calendar events and task lists
- Create, update, and delete events and tasks based on your actions
- Your use of Google services is governed by [Google's Privacy Policy](https://policies.google.com/privacy)

### No Third-Party Sharing

- We do NOT sell, trade, or transfer your information to third parties
- We do NOT use analytics or tracking services
- We do NOT share authentication tokens with any third party

### Backend Service

- **Purpose**: Token exchange and refresh only
- **Hosting**: Northflank cloud platform
- **Security**: HTTPS-encrypted communication, CORS-restricted to Roam Research domain
- **Data Retention**: Tokens are stored only for the duration of your active session

## Data Retention and Deletion

### Local Data

- All calendar and task data remains in your browser and is controlled by you
- Uninstalling the Extension will remove all locally stored data
- You can manually clear Extension data at any time through Roam Research

### Server-Side Tokens

- **Refresh Tokens**: Stored on our server for persistent authentication
- **Deletion**: When you disconnect your Google account through the Extension:
  - Your refresh token is revoked through Google's API
  - The token is removed from our server
  - All local data is cleared from your browser

### Automatic Cleanup

- We implement automatic cleanup of expired or revoked tokens
- Inactive tokens (not used for 90 days) are automatically purged

## Security Measures

We implement industry-standard security practices:

1. **Encryption**: All communication with our backend uses HTTPS/TLS encryption
2. **Token Security**: OAuth tokens are stored securely and never exposed in logs or analytics
3. **Access Control**: Backend API is restricted to authorized domains only (roamresearch.com)
4. **Minimal Data**: We collect and store only the minimum data necessary for functionality
5. **No Plaintext Storage**: Sensitive data is never stored in plaintext

## Your Rights and Choices

You have the right to:

1. **Access**: Review what data is stored locally in your browser through Roam's extension settings
2. **Disconnect**: Revoke the Extension's access to your Google account at any time
3. **Delete**: Remove all Extension data by disconnecting and uninstalling
4. **Control**: Configure which calendars and task lists to sync
5. **Revoke**: Revoke access directly through [Google Account Permissions](https://myaccount.google.com/permissions)

## Google API Services User Data Policy Compliance

This Extension's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

Specifically:

- We only request the minimum scopes necessary (Calendar and Tasks)
- We do not transfer user data to third parties
- We do not use user data for serving advertisements
- We do not allow humans to read user data unless:
  - Required for security purposes (e.g., investigating abuse)
  - With explicit user consent
  - Necessary for compliance with applicable law

## Children's Privacy

This Extension is not intended for use by children under 13. We do not knowingly collect information from children under 13.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Changes will be reflected by updating the "Last Updated" date at the top of this document. Continued use of the Extension after changes constitutes acceptance of the updated policy.

## Open Source

This Extension is open source. You can review our code to verify our privacy practices at:
[GitHub Repository URL]

## Contact Information

If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:

**Email**: fbgallet@gmail.com
**GitHub Issues**: https://github.com/fbgallet/roam-extension-calendar/issues

## Technical Details for Transparency

For users interested in technical details:

- **Authentication Flow**: OAuth 2.0 authorization code flow with PKCE
- **Scopes Requested**:
  - `https://www.googleapis.com/auth/calendar` - Calendar read/write access
  - `https://www.googleapis.com/auth/tasks` - Tasks read/write access
- **Backend Endpoints**:
  - `/oauth/token` - Exchange authorization code for tokens
  - `/oauth/refresh` - Refresh expired access tokens
  - `/health` - Service health check
- **Data Storage Locations**:
  - Browser: Roam extension storage API, localStorage (event cache)
  - Server: Only OAuth refresh tokens (encrypted, minimal retention)

## Consent

By installing and using the Full Calendar Extension for Roam Research, you consent to the collection and use of information as described in this Privacy Policy.
