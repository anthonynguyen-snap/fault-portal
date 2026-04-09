# Fault Portal — Customer Care Fault Tracking System

A modern, production-ready internal tool for logging faulty products, uploading evidence, tracking claims, and generating manufacturer reports.

Built with **Next.js 14**, **Tailwind CSS**, **Google Sheets** (database) and **Google Drive** (file storage).

---

## What This Portal Does

| Feature | Description |
|---|---|
| **Submit Fault** | Log a faulty product with automatic manufacturer/cost fill, evidence upload |
| **Case Management** | Search, filter, sort, and view all fault cases in a clean table |
| **Claims Tracking** | Group cases by manufacturer + month, track claim status and recovery |
| **Reports** | Internal (with costs) and external (cost-hidden) manufacturer reports |
| **Admin** | Manage products, manufacturers, and fault types |
| **Dashboard** | Live stats, charts, and trends |

---

## Technology Stack

```
Next.js 14        — React framework for web apps
Tailwind CSS      — Styling (no design skills needed to customise)
Google Sheets     — Your database (view & edit directly in Google Sheets)
Google Drive      — Evidence file storage (organised folders)
Vercel            — Free hosting, auto-deploys from GitHub
```

---

## Google Sheets Setup

### Step 1: Create your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Name it something like **"Fault Portal Data"**
3. Create these **exact tab names** (click the + at the bottom to add tabs):

#### Tab: `Cases`
Row 1 headers (copy exactly):
```
ID | Date | OrderNumber | CustomerName | Product | ManufacturerName | ManufacturerNumber | FaultType | FaultNotes | EvidenceLink | UnitCostUSD | ClaimStatus | SubmittedBy | CreatedAt
```

#### Tab: `Products`
Row 1 headers:
```
ID | Name | ManufacturerName | UnitCostUSD | ManufacturerNumbers
```

#### Tab: `Manufacturers`
Row 1 headers:
```
ID | Name | ContactEmail | Phone | Notes
```

#### Tab: `FaultTypes`
Row 1 headers:
```
ID | Name | Description
```

#### Tab: `Claims`
Row 1 headers:
```
ID | Manufacturer | Month | Year | FaultCount | CostAtRisk | AmountRecovered | Status | Notes | CaseIDs
```

4. Copy the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/**THIS_PART**/edit`

---

## Google Cloud Setup (One-time)

### Step 2: Create a Google Cloud project and service account

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **"New Project"** → name it `fault-portal` → Create
3. In the left menu, go to **APIs & Services → Library**
4. Search and **Enable** these two APIs:
   - **Google Sheets API**
   - **Google Drive API**
5. Go to **APIs & Services → Credentials**
6. Click **"Create Credentials" → "Service Account"**
7. Fill in name: `fault-portal-service` → Create
8. Click on the service account → **Keys tab → Add Key → Create new key → JSON**
9. A `.json` file will download — **keep this safe, never share it**

### Step 3: Share your Sheet and Drive folder with the service account

1. Open your Google Sheet
2. Click **Share** (top right)
3. Paste the `client_email` from your JSON file (looks like `something@project.iam.gserviceaccount.com`)
4. Set permission to **Editor** → Share

5. Go to [drive.google.com](https://drive.google.com)
6. Create a folder called **"Fault Portal Evidence"**
7. Right-click the folder → **Share** → paste the same `client_email` → **Editor** → Share
8. Open the folder and copy the folder ID from the URL:
   `https://drive.google.com/drive/folders/**THIS_PART**`

---

## Local Development Setup

### Step 4: Set up your environment variables

1. In the project folder, copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and fill in your values from the JSON key file:

```env
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your-client-id

GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id

PORTAL_PASSWORD=choose-a-strong-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Important:** For `GOOGLE_PRIVATE_KEY`, copy the entire private key value from the JSON file exactly. On Vercel, make sure to wrap it in double quotes.

### Step 5: Install and run locally

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying to Vercel

### Step 6: Push to GitHub

1. Go to [github.com](https://github.com) and create a **new repository** (name it `fault-portal`, set to Private)
2. On your computer, open a terminal in the project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fault-portal.git
git push -u origin main
```

### Step 7: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (use your GitHub account)
2. Click **"New Project"**
3. Import your `fault-portal` GitHub repository
4. Click **"Environment Variables"** and add all the same variables from your `.env.local` file
5. Click **Deploy**

Your portal will be live in about 2 minutes at a URL like `https://fault-portal-xxx.vercel.app`

> **Tip:** Every time you push changes to GitHub, Vercel automatically redeploys. No manual steps needed.

---

## Populating Your Initial Data

Once deployed, go to **Admin → Products** and add your products. For each product, enter:
- Product name
- Manufacturer name
- Unit cost in USD
- Manufacturer numbers (optional preset list, comma-separated)

Then add manufacturers and fault types in the other admin tabs.

The Google Sheet will be updated automatically as you use the app, but you can also edit it directly in Google Sheets at any time.

---

## Project Structure (for reference)

```
fault-portal/
├── app/                    ← All pages and API routes
│   ├── page.tsx            ← Dashboard
│   ├── cases/              ← Case list, new form, case detail
│   ├── claims/             ← Claims tracking
│   ├── reports/            ← Report generation
│   ├── admin/              ← Admin settings
│   └── api/                ← Backend API routes
├── components/
│   └── layout/             ← Sidebar, shared layout
├── lib/
│   ├── google-sheets.ts    ← All database operations
│   ├── google-drive.ts     ← File upload logic
│   └── utils.ts            ← Helpers & formatting
├── types/
│   └── index.ts            ← TypeScript type definitions
└── .env.local.example      ← Copy this to .env.local
```

---

## Google Drive Folder Structure

Evidence files are automatically organised like this:
```
📁 Fault Portal Evidence/
  📁 CASE-1712345678901/
    📄 photo.jpg
    📄 receipt.pdf
  📁 CASE-1712345679999/
    📄 video.mp4
```

---

## Common Issues & Fixes

**"Failed to fetch cases" error on dashboard**
- Check that your `GOOGLE_SPREADSHEET_ID` is correct
- Make sure the service account email has Editor access to the Sheet
- Verify the tab names match exactly (case-sensitive)

**"Failed to upload file" error**
- Check `GOOGLE_DRIVE_FOLDER_ID` is correct
- Make sure the service account has Editor access to the Drive folder

**Private key errors on Vercel**
- When adding `GOOGLE_PRIVATE_KEY` to Vercel, paste the entire value including the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines
- Wrap the entire value in double quotes in Vercel's environment variable editor

**App looks broken locally**
- Run `npm install` first
- Make sure `.env.local` exists and has all required variables

---

## Customising the App

**Changing the colour scheme:** Edit `tailwind.config.js` and change the `brand` colours.

**Adding a new page:** Create a folder under `app/` with a `page.tsx` file. Add the link to `components/layout/Sidebar.tsx`.

**Changing data fields:** Update the column structure in `lib/google-sheets.ts` and the matching TypeScript types in `types/index.ts`.

---

## Need Help?

If you get stuck, the key files to look at are:
1. `.env.local` — make sure all values are correct
2. `lib/google-sheets.ts` — controls all data reading/writing
3. The browser console (F12) — shows error messages

For Vercel issues, check the **Vercel Dashboard → Your Project → Deployments → View Logs**.
