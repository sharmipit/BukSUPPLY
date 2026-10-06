# BukSUPPLY Frontend (React + Vite)

Welcome to the React version of the **BukSUPPLY** project! This repository contains the modern, component-based frontend interface for the BukSU Supply and Property Management System.

---

## Quick Start Guide

### 1. Prerequisites
Ensure you have Node.js installed on your local machine before proceeding.
- **Node.js**: `v18.0.0` or higher (recommended)
- **npm**: `v9.0.0` or higher

Check your installed versions by running:
```bash
node -v
npm -v


### 2. Repository Setup & Installation
Clone or open the project folder in your terminal, then navigate into the frontend directory:

# Navigate to the project directory (if not already inside)
git switch react-migration
cd frontend

# Install all dependencies
npm install


### 3. Running the Development Server
Start the local React development server:

npm run dev

Once running, open your browser and navigate to the local address provided in your terminal:

Default Local URL: http://localhost:5173

Default Port: 5173

(Note: If port 5173 is occupied, Vite will automatically select the next available port such as 5174).


---


Current System Status & Backend/API Notes

1. Google Single Sign-On (SSO) & Backend Integration
OAuth Credentials: The current Google Client ID is configured for client-side testing (119378619205-32j7sol7rdlks9jmda04geetnlng6ovu.apps.googleusercontent.com).

Backend Handlers: Both SignIn.jsx and SignUp.jsx contain inline comment blocks (// TODO FOR BACKEND DEVELOPER) outlining token verification (response.credential) for when backend API integration begins.

Domain Whitelisting: If you encounter a redirect_uri_mismatch or origin_mismatch error on your machine while testing Google Login, ensure http://localhost:5173 is listed under "Authorized JavaScript origins" in the Google Cloud Console.

2. Mock Authentication & Form Navigation
Sign-In, Sign-Up, Forgot Password, and Password Reset workflows currently use client-side state handling and mock UI modals.

Successful form actions simulate authentication responses without requiring a live database connection.


---


Key Directory Structure

frontend/
├── public/              # Static public assets
├── src/
│   ├── assets/
│   │   ├── css/         # CSS stylesheets (signin.css, signup.css, etc.)
│   │   └── img/         # Images, icons, and branding assets
│   ├── components/      # Reusable React components
│   ├── pages/
│   │   ├── SignIn.jsx   # Login page component
│   │   └── SignUp.jsx   # Registration page component
│   ├── App.jsx          # Root routing configuration
│   └── main.jsx         # Entry point script
├── index.html           # HTML template
├── package.json         # Project dependencies and scripts
└── vite.config.js       # Vite build configuration
