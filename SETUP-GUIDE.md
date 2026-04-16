# 🔧 Fault Portal — Setup Guide (No Coding Required)

This guide walks you through getting your Fault Portal live in about **30–45 minutes**.
You only need a web browser — no coding, no command line.

---

## What You'll Need Before Starting

- ✅ A **Google account** (the one that owns your Google Sheet and Drive)
- ✅ Your **Google Sheet** already created (or create a blank one now)
- ✅ A **"Fault Evidence" folder** in Google Drive (create one now if needed)
- ✅ A free **GitHub** account → https://github.com
- ✅ A free **Vercel** account → https://vercel.com (sign up with GitHub)

---

## Step 1 — Set Up Google Cloud (15 mins)

### 1a. Create a Google Cloud Project
1. Go to → https://console.cloud.google.com
2. Click **"Select a project"** at the top → **"New Project"**
3. Name it `fault-portal` → click **Create**

### 1b. Enable the APIs
1. In the left menu, go to **APIs & Services → Library**
2. Search for **"Google Sheets API"** → click it → click **Enable**
3. Go back to Library, search **"Google Drive API"** → click it → click **Enable**

### 1c. Create a Service Account
1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → Service Account**
3. Name it `fault-portal-service` → click **Create and Continue** → click **Done**
4. Click on your new service account in the list
5. Go to the **Keys** tab → **Add Key → Create new key → JSON**
6. A JSON file will download — **keep this safe, you'll need it shortly**

### 1d. Create OAuth Credentials (for Google Sign-in)
1. Still in **Credentials**, click **+ Create Credentials → OAuth client ID**
2. If prompted, click **Configure Consent Screen** first:
   - Choose **Internal** (if your Google account is a Workspace/business account) or **External**
   - Fill in App name: `Fault Portal` → Save
3. Back in Create OAuth client ID:
   - Application type: **Web application**
   - Name: `fault-portal`
   - Under **Authorised redirect URIs**, add:
     `https://YOUR-VERCEL-URL.vercel.app/api/auth/callback/google`
     *(You'll get this URL in Step 3 — come back and add it then)*
4. Click **Create** — copy the **Client ID** and **Client Secret**

---

## Step 2 — Share Access with the Service Account

### 2a. Share your Google Sheet
1. Open your Google Sheet
2. Click **Share** (top right)
3. Paste the service account email (it looks like `fault-portal-service@fault-portal.iam.gserviceaccount.com`)
   — you can find it in the JSON file you downloaded, in the `"client_email"` field
4. Set role to **Editor** → click **Send**
5. Copy your **Sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**THIS-PART**/`edit`

### 2b. Share your Drive folder
1. Open Google Drive → find your **"Fault Evidence"** folder (create it if needed)
2. Right-click → **Share**
3. Paste the service account email → set to **Editor** → Share
4. Copy the **Folder ID** from the URL when you open the folder:
   `https://drive.google.com/drive/folders/`**THIS-PART**

---

## Step 3 — Upload to GitHub and Deploy to Vercel

### 3a. Create a GitHub repository
1. Go to https://github.com → click **+ New repository**
2. Name it `fault-portal` → set to **Private** → click **Create repository**
3. On the next page, click **"uploading an existing file"**
4. Unzip the `fault-portal.zip` file on your computer
5. Drag **all the files and folders** from inside the unzipped folder into the GitHub uploader
6. Click **Commit changes**

### 3b. Deploy on Vercel
1. Go to https://vercel.com → **Add New → Project**
2. Click **Import** next to your `fault-portal` GitHub repository
3. Leave all settings as default → click **Deploy**
4. Wait ~2 minutes for the first build (it will fail — that's OK, you need to add your settings first)
5. **Copy your Vercel URL** (e.g. `https://fault-portal-abc123.vercel.app`)

---

## Step 4 — Add Your Settings to Vercel

1. In Vercel, go to your project → **Settings → Environment Variables**
2. Add each of the following one by one:

| Variable Name | What to paste |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The **entire contents** of your downloaded JSON file — paste it all as one line |
| `GOOGLE_SHEET_ID` | Your Sheet ID from Step 2a |
| `GOOGLE_SHEET_TAB` | `Fault Log` |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Your Drive folder ID from Step 2b |
| `GOOGLE_CLIENT_ID` | From Step 1d |
| `GOOGLE_CLIENT_SECRET` | From Step 1d |
| `NEXTAUTH_SECRET` | Go to https://generate-secret.vercel.app/32 and paste the result |
| `NEXTAUTH_URL` | Your Vercel URL, e.g. `https://fault-portal-abc123.vercel.app` |
| `ALLOWED_EMAILS` | Comma-separated list of staff emails, e.g. `jane@company.com,john@company.com` |

3. After adding all variables, go to **Deployments → Redeploy** (click the three dots on the latest deployment)

---

## Step 5 — Finish Google OAuth Setup

1. Go back to Google Cloud Console → **APIs & Services → Credentials**
2. Click on your OAuth client
3. Under **Authorised redirect URIs**, add your actual Vercel URL:
   `https://YOUR-ACTUAL-URL.vercel.app/api/auth/callback/google`
4. Click **Save**

---

## Step 6 — Set Up Your Google Sheet

1. Open your Google Sheet
2. Rename the first tab to: **`Fault Log`** (must match exactly)
3. The portal will automatically create the header row on first use

---

## ✅ You're Done!

Visit your Vercel URL → sign in with Google → start logging faults.

**Your portal features:**
- 🔐 Google sign-in (only approved emails can access)
- 📝 Fault entry form with all fields
- 📁 Auto-upload evidence to Google Drive monthly folders
- 📊 Dashboard with search and filters
- 🔄 Status updates (Open → In Progress → Resolved)
- 📄 Every fault automatically saved to your Google Sheet

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Sign in failed" | Check `ALLOWED_EMAILS` includes your email, and the OAuth redirect URI matches your Vercel URL exactly |
| "Failed to save fault" | Check `GOOGLE_SHEET_ID` and that the sheet is shared with the service account |
| "Upload failed" | Check `GOOGLE_DRIVE_ROOT_FOLDER_ID` and that the folder is shared with the service account |
| Build failing in Vercel | Check all environment variables are set correctly — no extra spaces |
| Sheet tab not found | Make sure the tab is named exactly `Fault Log` (capital F, capital L) |

---

*Need help? Share your error message and we can troubleshoot together.*
