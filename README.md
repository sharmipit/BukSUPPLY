# BukSUPPLY

> **Supply Office Inventory & Requisition Management System**  
> *Bukidnon State University (BukSU)*

BukSUPPLY is an end-to-end web platform designed to streamline supply office operations: managing inventory, handling item requests and approvals, generating official issuance slips and inventory reports, auditing activities, and integrating with external services (Google Drive, Google Forms, Google OAuth, reCAPTCHA, and email notifications).

---

## Table of Contents
- [Project Architecture](#project-architecture)
- [Key Features & Role Permissions](#key-features--role-permissions)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Step-by-Step Setup Guide](#step-by-step-setup-guide)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [Environment Variables Reference](#environment-variables-reference)
- [Available Scripts](#available-scripts)
- [Database Backup & Disaster Recovery](#database-backup--disaster-recovery)
- [API Endpoints Reference](#api-endpoints-reference)
- [Security & Best Practices](#security--best-practices)

---

## Project Architecture

BukSUPPLY is structured as a two-tier full-stack application:

```
BukSUPPLY/
├── backend/                # Express.js REST API & MongoDB Atlas Service
│   ├── config/             # DB connection & third-party client configs
│   ├── middleware/         # Auth verification, RBAC, error handlers
│   ├── models/             # Mongoose schemas (User, Item, Requisition, etc.)
│   ├── routes/             # API route endpoints
│   ├── services/           # Business logic, document export & integrations
│   └── server.js           # Server entry point
│
├── frontend/               # React 19 + Vite Single-Page Application
│   ├── src/
│   │   ├── api/            # Axios API client functions
│   │   ├── components/     # Reusable UI components & layouts
│   │   ├── context/        # React context providers (Auth, Theme, etc.)
│   │   ├── pages/          # User, Moderator, and Admin portal views
│   │   └── utils/          # Helpers and utility functions
│   ├── index.html          # HTML entry
│   └── vite.config.js      # Vite configuration
│
└── README.md               # Unified project documentation
```

---

## Key Features & Role Permissions

| Role | Access & Capabilities |
| :--- | :--- |
| **Admin** | Full system control: user account management, role assignment (`admin`, `moderator`, `user`), account activation/suspension, system settings configuration (Google Drive, Forms, reCAPTCHA, SMTP), inventory master data, and comprehensive audit logs. |
| **Moderator** | Supply operations: stock adjustments, review and approval/rejection of item requests, tracking fulfillment, and generating official issuance slips. |
| **User (Requester)** | Catalog browsing, submitting item requests, tracking requisition approval status, receiving notifications, and providing feedback. |

### Core Modules
- **Authentication & RBAC**: JWT tokens with HTTP-only cookies, password hashing (bcryptjs), email verification, and role-based route guards.
- **Inventory Tracking**: Stock level monitoring, category tagging, low-stock warnings, and real-time adjustments.
- **Requisition Workflow**: Multi-step lifecycle: Submission $\rightarrow$ Review $\rightarrow$ Approval/Rejection $\rightarrow$ Issuance $\rightarrow$ Fulfillment.
- **Automated Document Export**: PDF generation (Puppeteer / jsPDF) and Excel exports (ExcelJS) for issuance slips and inventory reports.
- **External Integrations**:
  - **Google OAuth**: One-click authentication for university Google accounts.
  - **Google Drive API**: Automatic archival of generated reports and slips.
  - **Google Forms API**: Live connection check and feedback sync.
  - **Google reCAPTCHA**: Automated bot prevention on authentication routes.
  - **Nodemailer (SMTP)**: Automated verification emails and password reset links.

---

## Tech Stack

### Frontend
- **Framework**: React 19 with Vite
- **Routing**: React Router DOM (v7)
- **Icons & Styling**: Bootstrap Icons, Modular CSS
- **Document Export**: jsPDF, jsPDF-AutoTable, ExcelJS
- **Authentication**: `@react-oauth/google`, `react-google-recaptcha`
- **Linter & Tools**: Oxlint, Prettier

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (v4.19+)
- **Database**: MongoDB Atlas via Mongoose (v8.5+)
- **Authentication**: `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `google-auth-library`
- **Integrations**: `googleapis`, `nodemailer`, `axios`
- **PDF & File Handling**: `exceljs`, `puppeteer`, `jspdf`

---

## Prerequisites

Ensure you have the following installed locally:
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) (v9.0.0 or higher)
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (or local MongoDB database)
- A Google Cloud Platform (GCP) project (optional, for Google Drive, Forms, or OAuth integrations)

---

## Step-by-Step Setup Guide

### 1. Clone Repository
```bash
git clone https://github.com/your-org/BukSUPPLY.git
cd BukSUPPLY
```

---

### 2. Backend Setup

1. **Navigate to the backend directory and install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the `backend/` directory:
   ```bash
   touch .env
   ```
   Add the required configuration (see [Environment Variables Reference](#environment-variables-reference)):
   ```env
   PORT=5001
   CLIENT_URL=http://localhost:5173
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/buksupply_dev?retryWrites=true&w=majority
   JWT_SECRET=your_generated_jwt_secret_key
   JWT_EXPIRES_IN=1d
   ```

   *Generate a secure `JWT_SECRET` using Node.js:*
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Verify database connectivity:**
   ```bash
   npm run db:test
   ```

4. **Start the backend development server:**
   ```bash
   npm run dev
   ```
   *The API will be live at `http://localhost:5001`.*

---

### 3. Frontend Setup

1. **Open a new terminal, navigate to the frontend directory, and install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   *The web application will open at `http://localhost:5173`.*

---

## Environment Variables Reference

Configure these in `backend/.env`:

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | Optional | `5001` | Port on which the Express server listens. |
| `NODE_ENV` | Optional | `development` | Runtime mode (`development` or `production`). |
| `MONGODB_URI` | **Yes** | — | MongoDB Atlas SRV connection string with credentials. |
| `JWT_SECRET` | **Yes** | — | Secret key used to sign and verify JSON Web Tokens. |
| `JWT_EXPIRES_IN` | Optional | `1d` | Expiration window for authentication tokens (e.g., `1d`, `7d`). |
| `RESET_TOKEN_EXPIRES_MINUTES` | Optional | `15` | Expiration window (in minutes) for password reset links. |
| `CLIENT_URL` | Optional | `http://localhost:5173` | Allowed frontend origin(s) for CORS, separated by commas. |
| `EMAIL_HOST` | Optional | `smtp.gmail.com` | SMTP host for outbound transactional emails. |
| `EMAIL_PORT` | Optional | `587` | SMTP port (e.g., `587` for TLS, `465` for SSL). |
| `EMAIL_USER` | Optional | — | Email address for automated notifications. |
| `EMAIL_PASS` | Optional | — | SMTP password or Google App Password. |
| `EMAIL_FROM` | Optional | — | Sender display header (e.g., `"BukSUPPLY <no-reply@buksupply.com>"`). |
| `GOOGLE_CLIENT_ID` | Optional | — | Google OAuth 2.0 Web Client ID. |
| `GOOGLE_CLIENT_SECRET` | Optional | — | Google OAuth 2.0 Web Client Secret. |

---

## Available Scripts

### Backend (`cd backend`)
- `npm run dev`: Starts the server with `nodemon` for active development and auto-reload.
- `npm start`: Starts the server in standard Node.js production mode.
- `npm run db:test`: Runs a standalone check to test the database connection.
- `npm run db:backup`: Generates a compressed mongodump archive in `backups/` and prunes archives older than 14 days.
- `npm run db:restore -- <file>`: Safely restores a backup archive with interactive confirmation and dry-run support.

### Frontend (`cd frontend`)
- `npm run dev`: Launches the Vite development server with Hot Module Replacement (HMR).
- `npm run build`: Compiles production-ready static assets to `dist/`.
- `npm run lint`: Runs Oxlint for fast code analysis.
- `npm run preview`: Previews the production build locally.

---

## Database Backup & Disaster Recovery

BukSUPPLY uses an automated, zero-cost backup system leveraging `mongodump` and `mongorestore` with Google Drive cloud storage. Because this repository is **public**, backup archives are never published as GitHub Actions artifacts; they are streamed directly into your private Google Drive folder via a Google Cloud Service Account.

> For the institutional response protocol, National Privacy Commission (NPC) 72-hour compliance policy, role designations, and historical restore test logs, see the formal project documentation **[BukSUPPLY_Incident_Response_and_Backup_Plan.docx](BukSUPPLY_Incident_Response_and_Backup_Plan.docx)**.

### 1. Prerequisites & Required Tools
Install MongoDB Database Tools locally if you plan to run manual backups or restores:
- **macOS (Homebrew)**: `brew tap mongodb/brew && brew install mongodb-database-tools`
- **Ubuntu/Debian**: `sudo apt-get install -y mongodb-database-tools`
- **Windows**: Download from the [MongoDB Download Center](https://www.mongodb.com/try/download/database-tools) and add to `PATH`.

### 2. Atlas Dedicated Read-Only Backup User (Recommended)
To adhere to the principle of least privilege, do not use your primary application database user for backups. Create a dedicated read-only database user:
1. Log into [MongoDB Atlas](https://cloud.mongodb.com).
2. Under **Security**, click **Database Access** > **Add New Database User**.
3. Set **Authentication Method** to **Password**.
4. Choose a username (e.g., `backup_user`) and a secure password.
5. Under **Database User Privileges**, select **Built-in Role** > **Read any database** (or **Only read specific database** and select `buksupply_dev`).
6. Click **Add User**.
7. Construct your backup connection string:
   ```text
   mongodb+srv://backup_user:<PASSWORD>@your-cluster.mongodb.net/buksupply_dev?retryWrites=true&w=majority
   ```

### 3. Atlas Network Access (IP Allowlist for GitHub Actions)
GitHub-hosted runners have dynamic IP addresses. For the GitHub Actions workflow to reach your Atlas cluster:
1. Go to **Network Access** under **Security** in MongoDB Atlas.
2. Click **Add IP Address**.
3. Select **Allow Access from Anywhere** (`0.0.0.0/0`) or configure an entry with a comment like `GitHub Actions Backup Runner`.
4. Ensure your cluster uses strong database user passwords and the read-only user configured above.

### 4. Google Drive Service Account Setup
Backups are uploaded to Google Drive via a Google Cloud Service Account:
1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project (or select your existing BukSUPPLY project).
2. Enable the **Google Drive API** under **APIs & Services** > **Library**.
3. Go to **IAM & Admin** > **Service Accounts** > **Create Service Account** (e.g. `buksupply-backup-bot`).
4. Click into the service account > **Keys** tab > **Add Key** > **Create new key** > **JSON**. Download the JSON key file.
5. In your Google Drive, create a folder named `BukSUPPLY-Backups`.
6. Open the folder sharing settings and share it with the service account email (e.g. `buksupply-backup-bot@<project-id>.iam.gserviceaccount.com`) with the **Editor** role.
7. Copy the folder ID from the Google Drive URL (the string after `folders/` in `https://drive.google.com/drive/folders/<FOLDER_ID>`).

### 5. GitHub Secrets Configuration (Public Repo Safe)
In your GitHub repository, navigate to **Settings** > **Secrets and variables** > **Actions** and add the following repository secrets:
| Secret Name | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (use the dedicated read-only backup user). |
| `GDRIVE_SERVICE_ACCOUNT_KEY` | The entire content of the downloaded service account JSON key (or its base64 string). |
| `GDRIVE_FOLDER_ID` | The Google Drive folder ID shared with the service account. |

### 6. Local & Manual Operations

#### Run Manual Backup
```bash
# Back up to backups/backup-YYYY-MM-DD-HHMM.gz
cd backend
npm run db:backup

# Back up and immediately upload to Google Drive:
node scripts/backup.js --upload-drive
```

#### Run Safe Restore
```bash
cd backend
# 1. Perform a dry-run first (simulates restore without modifying data)
node scripts/restore.js ../backups/backup-YYYY-MM-DD-HHMM.gz --dry-run

# 2. Restore into a test database to verify integrity
node scripts/restore.js ../backups/backup-YYYY-MM-DD-HHMM.gz --db buksupply_test

# 3. Restore to target database with interactive confirmation
npm run db:restore -- ../backups/backup-YYYY-MM-DD-HHMM.gz
```

### 7. GitHub Actions Scheduled Automation & 60-Day Inactivity Rule
- The workflow `.github/workflows/mongodb-backup.yml` runs automatically every day at `18:00 UTC` (`02:00 AM PHT`) and supports manual triggering via **Actions > MongoDB Atlas Automated Backup > Run workflow**.
- **Important GitHub Limitation**: In **public** repositories, GitHub automatically disables scheduled workflows if no commit or repository activity occurs within **60 days**. The workflow includes a check that alerts when the repository approaches 45 days without commits. If the workflow is disabled by GitHub, navigate to the **Actions** tab in GitHub and click **Enable workflow** to resume backups.

---

## API Endpoints Reference

### Public & Health
- `GET /api/health` — Service health status.
- `GET /api/public-config` — Non-sensitive public configurations (Google Client ID, reCAPTCHA site key).

### Authentication (`/api/auth`)
- `POST /api/auth/signup` — User registration.
- `POST /api/auth/signin` — User login & token generation.
- `POST /api/auth/google` — Google OAuth login.
- `POST /api/auth/forgot-password` — Password reset request.
- `POST /api/auth/reset-password` — Password reset execution.
- `POST /api/auth/signout` — Clear session cookies.

### User & Profile (`/api/user`)
- `GET /api/user/profile` — Fetch user profile.
- `PUT /api/user/profile` — Update user details.
- `PUT /api/user/password` — Change password.

### Admin Operations (`/api/admin/users`, `/api/admin/settings`)
- `GET /api/admin/users` — List registered users.
- `PATCH /api/admin/users/:id/role` — Update user role (`admin`, `moderator`, `user`).
- `PATCH /api/admin/users/:id/status` — Activate or suspend accounts.
- `GET /api/admin/settings` — Read system settings and integration health.
- `POST /api/admin/settings` — Update and validate settings (Google Drive, Forms, reCAPTCHA, SMTP).
- `POST /api/admin/settings/reset` — Reset settings to system defaults.

### Inventory (`/api/inventory`)
- `GET /api/inventory` — List inventory items with stock levels.
- `POST /api/inventory` — Add a new item.
- `PUT /api/inventory/:id` — Update item details and stock.
- `DELETE /api/inventory/:id` — Delete an inventory item.

### Requisitions (`/api/requisitions`)
- `GET /api/requisitions` — Retrieve requisition list.
- `POST /api/requisitions` — Submit an item request.
- `PATCH /api/requisitions/:id/status` — Approve, reject, or fulfill a request.
- `GET /api/requisitions/:id/issuance-slip` — Generate an official issuance slip.

### Reports, Notifications & Logs
- `GET /api/reports/inventory` — Export inventory report (PDF/Excel).
- `GET /api/reports/requisitions` — Export requisition summaries.
- `GET /api/notifications` — Fetch user notifications.
- `PATCH /api/notifications/:id/read` — Mark notification as read.
- `GET /api/activity` — System audit logs.
- `POST /api/feedback` — Submit user feedback synced with Google Forms.

---

## Security & Best Practices

1. **Protect Secrets**: Never commit `.env` files or service account JSON keys to GitHub.
2. **CORS Isolation**: Access is restricted strictly to origins configured in `CLIENT_URL`.
3. **HTTP-only Cookies**: Authentication tokens are passed in secure HTTP-only cookies to defend against XSS vulnerabilities.
4. **Live Validation**: Settings changes (Google Drive, Forms, SMTP) are tested live before saving to avoid runtime service failure.
