# MANIVIZHA

Invitation and RSVP site with a password-protected response dashboard.

## Deploy on Vercel

1. Create a Neon Postgres project and copy its connection string.
2. Import this repository into Vercel. Vercel serves `index.html` and the functions in `api/`.
3. In the Vercel project settings, add these environment variables for Production (and Preview/Development if needed):
   - `DATABASE_URL`: Neon connection string.
   - `ADMIN_PASSWORD`: a strong password for the dashboard.
   - `ADMIN_SESSION_SECRET`: a random secret of at least 32 bytes. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. Add the Google Sheets webhook variables described below in Vercel.
5. Deploy. The database table and index are created automatically when the first response or dashboard request reaches the API.
6. Open `/admin` on the deployed site and sign in with `ADMIN_PASSWORD`.

The invitation page includes Open Graph and Twitter metadata for link previews. The preview artwork is `og-image.png`; social apps may cache a previous preview, so use their link-preview debugger or share a changed URL when refreshing it.

Install dependencies with `npm install`. For local Vercel development, put the environment values in an untracked `.env.local` file and run `npx vercel dev`.

## Responses and duplicates

RSVPs are stored in Neon; the Vercel filesystem is not used for persistence. The dashboard shows total submissions, unique guests, duplicate submissions, and attending guests. Phone numbers are normalized for duplicate detection. By default, only the newest response for each normalized phone number is listed; enable **Include duplicate submissions** to see every submission and which ones are duplicates. All records remain stored.

## Mirror responses to Google Sheets

The Google Sheet is updated through a Google Apps Script web app. The script creates a `Responses` tab with these columns: Response ID, Submitted At (UTC), Name, Phone, Normalized Phone, and Celebration Reply. Response IDs make retries idempotent.

1. Open the spreadsheet and choose **Extensions → Apps Script**.
2. Replace the editor contents with [`google-apps-script/Code.gs`](./google-apps-script/Code.gs), save, and run `setup()` once. Authorize the script when prompted; this creates the header row without overwriting existing tabs.
3. In Apps Script **Project Settings → Script properties**, add `GOOGLE_SHEETS_WEBHOOK_SECRET`. Generate a unique value with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and use the same value in Apps Script and Vercel.
4. Choose **Deploy → New deployment → Web app**, set **Execute as** to yourself and access to **Anyone**, then deploy and authorize. Copy the deployed web app URL ending in `/exec` (not the spreadsheet URL or Apps Script editor URL). Opening that URL in a browser should show a JSON health message.
5. In Vercel, add `GOOGLE_SHEETS_WEBHOOK_URL` (the `/exec` URL) and `GOOGLE_SHEETS_WEBHOOK_SECRET` (the generated value) for Production, then redeploy.
6. Sign in to `/admin` and choose **Sync sheet** to copy existing Neon responses. New RSVPs are mirrored automatically. If Google Sheets is temporarily unavailable, the response remains saved in Neon and the dashboard's **Sync sheet** action can safely retry without adding duplicate rows.

The webhook secret is kept server-side and must not be added to frontend code or committed to the repository. If the Google account blocks Apps Script deployments available to “Anyone”, use an approved Google Workspace deployment policy instead.
