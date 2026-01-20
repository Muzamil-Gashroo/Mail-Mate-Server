# Gmail Client Server

A production-grade, RESTful email management system leveraging Google's Gmail API and OAuth 2.0 authentication framework. This server provides comprehensive email ingestion, composition, delivery, and read-receipt tracking capabilities with persistent state management via MongoDB.

## Architecture Overview

This is a **Node.js/Express-based microservice** designed to abstract Gmail API complexity and provide a unified interface for email operations. The system follows a layered architecture pattern with clear separation of concerns: route handlers → controllers → models → database persistence.

**⚠️ Skeptical Note**: This implementation prioritizes development velocity and feature completeness over exhaustive error recovery patterns. Production deployments should implement:
- Comprehensive exponential backoff for Google API rate limits
- Circuit breaker patterns for external service dependencies
- Structured logging with correlation IDs for request tracing
- Token refresh queue mechanisms to prevent authentication cascade failures

## Core Technical Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | v14+ | Event-driven, non-blocking I/O execution |
| **HTTP Framework** | Express.js | v5.2.1 | RESTful routing & middleware pipeline |
| **Database** | MongoDB | Via Mongoose | Document-oriented persistence layer |
| **ODM** | Mongoose | v9.1.2 | Schema validation & relationship management |
| **Authentication** | OAuth 2.0 + JWT | Google Identity | Delegated auth with refresh token flow |
| **Email API** | Gmail API v1 | googleapis | Direct inbox/draft manipulation |
| **SMTP Alternative** | Nodemailer | v7.0.12 | SMTP fallback for external deliveries |
| **Task Scheduling** | node-cron | v4.2.1 | Async job scheduling (currently disabled in boot) |
| **Dev Tooling** | Nodemon | v3.1.11 | Auto-restart on source changes |

## System Requirements

- **Node.js**: ≥14.0.0 (tested on v16+, recommend v18+ for production)
- **MongoDB**: 4.4+ (Atlas or self-hosted with authentication)
- **Google Cloud Project**: With Gmail API enabled and OAuth 2.0 credentials provisioned
- **Internet Connectivity**: Bidirectional HTTPS for OAuth callback & API proxying
- **Memory**: Minimum 256MB (recommend 512MB+ for concurrent operations)

## Installation & Setup

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd gmail-client/server
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root with the following structure:

```env
# Google OAuth 2.0 Credentials
# Obtain from: https://console.cloud.google.com/apis/credentials
CLIENT_ID=your_oauth_client_id_from_google_console
CLIENT_SECRET=your_oauth_client_secret
REDIRECT_URI=http://localhost:5000/auth/google/callback

# Frontend Configuration
# Adjust based on client application location
FRONTEND_URL=http://localhost:3000

# Database Connection
# Local: mongodb://localhost:27017/gmail-client
# Cloud: mongodb+srv://username:password@cluster.mongodb.net/gmail-client
MONGODB_URI=mongodb://localhost:27017/gmail-client

# Server Configuration
PORT=5000
NODE_ENV=development

# Email Tracking (Optional - for public-facing tracking URLs)
# If using tunneling solution (ngrok/cloudflare tunnel)
NGROK_URL=https://your-tunnel-url.ngrok-free.app
```

### 3. Google Cloud Setup (OAuth Credentials)

**Step-by-step procurement of OAuth credentials:**

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: **"Gmail Client"**
3. Enable APIs:
   - Gmail API (`gmail.modify` scope required)
   - Google+ API (for user profile data)
4. Create OAuth 2.0 Client ID (type: Web application)
   - **Authorized JavaScript origins**: `http://localhost:5000`
   - **Authorized redirect URIs**: `http://localhost:5000/auth/google/callback`
5. Download credentials as JSON and extract:
   - Copy `client_id` → `CLIENT_ID`
   - Copy `client_secret` → `CLIENT_SECRET`

### 4. Start Development Server

```bash
npm start
```

Server bootstraps on `http://localhost:5000`. Nodemon watches source files for hot-reload.

## API Endpoint Reference

### Authentication Flow

#### `GET /auth/google`
Initiates OAuth 2.0 authorization code flow.
- **Scopes Requested**: 
  - `openid` - OpenID identity
  - `email` - User email address
  - `profile` - User profile information
  - `https://www.googleapis.com/auth/gmail.modify` - Full Gmail inbox/draft access
- **Access Type**: `offline` (requests refresh token)
- **Prompt**: `consent` (forces user consent screen)

```
GET http://localhost:5000/auth/google
→ Redirects to: https://accounts.google.com/o/oauth2/v2/auth?...
```

#### `GET /auth/google/callback`
OAuth callback handler. Exchanges authorization code for access/refresh tokens.

**Request Parameters**:
- `code` (query) - Authorization code from Google

**Response Flow**:
1. Exchanges code for `access_token` + `refresh_token` via Google token endpoint
2. Retrieves user profile via `/oauth2/v3/userinfo`
3. Upserts user document in MongoDB (creates if new, updates if existing)
4. Redirects to frontend with success status: `FRONTEND_URL?auth=success&email=user@example.com`

**Error Handling**:
- Missing code → HTTP 400
- Token exchange failure → HTTP 500 with error details
- Database persistence failure → Logged but still redirects to frontend

---

### Email Operations

#### `GET /api/emails/:userEmail`
Retrieves paginated list of emails from user's Gmail inbox.

**Path Parameters**:
- `userEmail` (string) - User's email address

**Query Parameters**:
- `maxResults` (integer, default=10) - Number of messages per page (max 100)
- `pageToken` (string, optional) - Pagination cursor for subsequent pages

**Response**:
```json
{
  "emails": [
    {
      "id": "gmail_message_id",
      "threadId": "thread_id",
      "labelIds": ["INBOX", "IMPORTANT"],
      "subject": "Email subject",
      "from": "sender@example.com",
      "to": "recipient@example.com",
      "date": "Mon, 20 Jan 2026 10:30:00 +0000",
      "body": "Parsed HTML/plain text body",
      "snippet": "First 50 chars of message..."
    }
  ],
  "nextPageToken": "token_for_next_page"
}
```

**Status Codes**:
- `200 OK` - Successful retrieval
- `401 Unauthorized` - User not authenticated or missing access token
- `500 Internal Server Error` - Gmail API failure

---

#### `POST /api/emails/:userEmail/send`
Sends an email through Gmail API with optional read receipt tracking.

**Path Parameters**:
- `userEmail` (string) - Sender's email address

**Request Body**:
```json
{
  "to": "recipient@example.com",
  "subject": "Email subject",
  "body": "<p>HTML email body with content...</p>",
  "trackRead": true
}
```

**Processing**:
1. Validates user authentication via access token
2. If `trackRead=true`:
   - Generates unique `trackingId` (UUID v4)
   - Embeds 1×1 pixel: `<img src="http://localhost:5000/api/track/trackingId" />`
   - Creates `SentEmail` document with tracking metadata
3. Constructs MIME message (RFC 2822 format)
4. Submits to Gmail API with base64 encoding
5. Returns tracking record

**Response**:
```json
{
  "success": true,
  "messageId": "gmail_message_id",
  "trackingId": "uuid-v4-tracking-id",
  "trackingUrl": "http://localhost:5000/api/track/uuid-v4-tracking-id",
  "sentAt": "2026-01-20T10:30:00.000Z"
}
```

**Status Codes**:
- `200 OK` - Email sent successfully
- `400 Bad Request` - Missing required fields (to, subject, body)
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Gmail API error

---

#### `GET /api/emails/:userEmail/sent`
Retrieves user's sent emails with tracking status.

**Response**:
```json
{
  "sentEmails": [
    {
      "_id": "db_document_id",
      "userEmail": "sender@example.com",
      "to": "recipient@example.com",
      "subject": "Original subject",
      "trackingId": "uuid-v4",
      "opened": true,
      "openedAt": "2026-01-20T11:45:30.000Z",
      "openCount": 3,
      "lastOpenedAt": "2026-01-20T14:20:00.000Z",
      "sentAt": "2026-01-20T10:30:00.000Z"
    }
  ]
}
```

---

### Email Tracking (Pixel-Based Analytics)

#### `GET /api/track/:trackingId`
Pixel tracking endpoint. Returns 1×1 transparent GIF and records open event.

**Path Parameters**:
- `trackingId` (string) - UUID generated during email send

**Behavior**:
1. Logs pixel request with:
   - Timestamp
   - User-Agent
   - Referer (email client indicator)
   - IP address (client-provided or proxied)
2. Updates `SentEmail.opened = true` and `SentEmail.openedAt = timestamp`
3. Increments `SentEmail.openCount`
4. Returns base64-encoded 1×1 GIF (0 bytes visible content)

**Response**:
- **Content-Type**: `image/gif`
- **Body**: 43-byte transparent GIF
- **Status**: Always `200 OK` (even if tracking update fails internally)

**Pseudo-Endpoints (Conceptual)**:
```
GET /api/track/:trackingId
  → Internal: findOneAndUpdate(SentEmail, {trackingId})
  → Sets: opened=true, openedAt=now, openCount++, lastOpenedAt=now
```

#### `POST /api/track/manual/:trackingId`
Manual tracking trigger (for systems that block pixel loading).

**Request Body** (optional):
```json
{
  "userAgent": "Mozilla/5.0...",
  "referer": "Gmail/1.0"
}
```

**Response**:
```json
{
  "success": true,
  "trackingId": "uuid-v4",
  "updatedAt": "2026-01-20T12:00:00.000Z"
}
```

---

#### `GET /api/debug/config`
Debug endpoint returning server configuration (disabled in production).

**Response**:
```json
{
  "port": 5000,
  "mongodbConnected": true,
  "googleOAuthConfigured": true,
  "environment": "development"
}
```

⚠️ **Security Note**: This endpoint leaks configuration state. Implement authentication guards before production deployment.

---

### Newsletter Management (Batch Operations)

#### `POST /api/newsletters`
Creates batch email campaign with subscriber targeting.

#### `GET /api/newsletters/:campaignId`
Retrieves campaign performance metrics and delivery status.

#### `PATCH /api/newsletters/:campaignId/status`
Updates campaign status (draft → scheduled → sent).

---

## Database Schema

### User Collection
```javascript
{
  email: String,               // Primary identifier
  googleId: String,            // Google sub claim
  sub: String,                 // Duplicate of googleId
  name: String,                // Full name from Google
  given_name: String,          // First name
  family_name: String,         // Last name
  picture: String,             // Avatar URL
  email_verified: Boolean,     // From Google
  accessToken: String,         // Bearer token (short-lived, ~1 hour)
  refreshToken: String,        // Refresh token (long-lived, ~6 months)
  createdAt: Date,             // Document creation
  updatedAt: Date              // Last auth update
}
```

### SentEmail Collection
```javascript
{
  userEmail: String,           // Sender
  to: String,                  // Recipient(s)
  subject: String,             // Email subject
  body: String,                // HTML email content
  trackingId: String,          // UUID v4
  gmailMessageId: String,      // Gmail API ID (for updates)
  opened: Boolean,             // Default: false
  openedAt: Date,              // First open timestamp
  openCount: Number,           // Number of opens
  lastOpenedAt: Date,          // Most recent open
  openedFrom: Array,           // [{ timestamp, userAgent, ip }]
  sentAt: Date,                // When email was sent
  createdAt: Date,             // DB document creation
  updatedAt: Date              // Last modified
}
```

### Subscription Collection
```javascript
{
  email: String,               // Subscriber email
  newsLetterName: String,      // Campaign name
  status: String,              // "active" | "unsubscribed"
  subscribedAt: Date,
  unsubscribedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Development Notes

### Async Scheduler (Currently Disabled)

The project includes an optional email scheduler via `node-cron`:
```javascript
// In src/server.js (line 11)
// require("./utils/emailScheduler");  // ← Commented out
```

To enable scheduled sends:
1. Uncomment the require statement
2. Configure `SCHEDULER_CRON_EXPRESSION` in `.env`
3. Ensure MongoDB `Subscription` collection is populated

### Request/Response Pipeline

```
Client Request
  ↓
Express Router (routes/*)
  ↓
Controller Handler (controllers/*)
  ↓
Model Operations (models/*)
  ↓
MongoDB Persistence
  ↓
Response (JSON)
```

### Middleware Stack (from server.js)

1. `express.json()` - Parse incoming JSON bodies
2. `cors()` - Enable cross-origin requests (⚠️ permissive config)
3. Database connection via `connectDB()`
4. Route registration (auth, emails, tracking, newsletters)

---

## Production Deployment Checklist

- [ ] Replace `CLIENT_SECRET` with encrypted credentials (use environment variables manager)
- [ ] Enable HTTPS for all endpoints (OAuth security requirement)
- [ ] Configure CORS whitelist (currently allows all origins)
- [ ] Implement request rate limiting middleware
- [ ] Add JWT middleware for API authentication
- [ ] Enable MongoDB connection pooling
- [ ] Set `NODE_ENV=production` and remove debug endpoints
- [ ] Implement comprehensive error logging (Sentry/DataDog)
- [ ] Add request tracing headers (X-Request-ID)
- [ ] Implement token refresh queue to prevent cascade failures
- [ ] Set up email delivery retry logic with exponential backoff

---

## License

ISC
When running locally, tracking pixels will only work for emails opened in the same network. For external tracking (emails opened by recipients outside your local network), use ngrok:

1. Install ngrok: `npm install -g ngrok`
2. Start ngrok: `ngrok http 5000`
3. Copy the ngrok URL (e.g., `https://abc123.ngrok-free.app`)
4. Add to `.env`: `NGROK_URL=https://abc123.ngrok-free.app`
5. Restart the server

### How Tracking Works
- When sending an email with `trackRead: true`, a unique tracking ID is generated
- An invisible `<img>` tag is embedded in the email HTML pointing to `/api/track/:trackingId`
- When the email is opened, the image loads, triggering the tracking endpoint
- Only the first open is tracked (subsequent opens are ignored)

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   └── config.js          # Configuration and database connection
│   ├── controllers/
│   │   ├── authController.js  # Authentication logic
│   │   ├── emailController.js # Email operations
│   │   └── trackingController.js # Tracking logic
│   ├── models/
│   │   ├── user.js           # User model
│   │   └── sentEmail.js      # Sent email tracking model
│   ├── routes/
│   │   ├── auth.js           # Auth routes
│   │   ├── emails.js         # Email routes
│   │   └── tracking.js       # Tracking routes
│   ├── utils/
│   │   └── emailParser.js    # Email content parsing utilities
│   └── server.js             # Main server file
├── public/                   # Static frontend files
├── .env                      # Environment variables (gitignored)
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
├── LICENSE                  # MIT License
└── README.md               # This file
```

## Development

### Running in Development
```bash
npm run dev  # If you add a dev script with nodemon
# or
npm start
```

### Database
The application uses MongoDB. Make sure MongoDB is running locally or update `MONGODB_URI` for cloud instances.

### Frontend
The frontend is served statically from the `public/` directory. Update files there for UI changes.

## Security Notes

- Never commit `.env` files to version control
- Keep OAuth credentials secure
- The tracking system uses invisible pixels - ensure compliance with privacy laws
- Rate limiting is not implemented - consider adding for production use

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.