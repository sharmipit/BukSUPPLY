
# BukSUPPLY - Backend API

Backend application for the BukSUPPLY platform built with Node.js, Express, and MongoDB Atlas.

---

## Prerequisites
- **Node.js**: v18 or higher
- **npm**: v9 or higher

---

## Team Setup & Onboarding Guide

### 1. Clone the Repository
```bash
git clone <repository-url>
cd BukSUPPLY/backend

```

### 2. Install Dependencies

```bash
cd backend
npm install
npm install google-auth-library

```

### 3. Configure Environment Variables

Copy the template file to create your active `.env` file:

```bash
cp .env.example .env

```

Open `.env` in VS Code and update the following:

* Replace `<username>` and `<password>` with your database user credentials.
* Generate a secure key for `JWT_SECRET` by running this command in your terminal and copying the output into `.env`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

```



### 4. Verify Database Connection

```bash
cd backend
npm run db:test

```

### 5. Start the Development Server

```bash
cd backend
npm run dev

```

The backend server will run at `http://localhost:5001`.

---

## Environment Variables Reference

| Variable | Description |
| --- | --- |
| `PORT` | Local port number (default: `5001`) |
| `MONGODB_URI` | MongoDB Atlas SRV connection string |
| `JWT_SECRET` | Secret key for signing authentication tokens |
| `JWT_EXPIRES_IN` | Token expiration period (e.g., `1d`) |
| `CLIENT_URL` | Frontend URL for CORS and password resets |

---

## Security Rules

* **Never commit `.env`:** Keep passwords, database URIs, and secret keys strictly in your local `.env` file.
* **Sync before feature work:** Always run `git pull origin main` before creating new branches or adding features.

```

```