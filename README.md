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

### Frontend (`cd frontend`)
- `npm run dev`: Launches the Vite development server with Hot Module Replacement (HMR).
- `npm run build`: Compiles production-ready static assets to `dist/`.
- `npm run lint`: Runs Oxlint for fast code analysis.
- `npm run preview`: Previews the production build locally.

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
