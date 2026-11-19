# MANIVIZHA

Invitation and RSVP site with a password-protected response dashboard.

## Deploy on Vercel

1. Create a Neon Postgres project and copy its connection string.
2. Import this repository into Vercel. Vercel serves `index.html` and the functions in `api/`.
3. In the Vercel project settings, add these environment variables for Production (and Preview/Development if needed):
   - `DATABASE_URL`: Neon connection string.
   - `ADMIN_PASSWORD`: a strong password for the dashboard.
   - `ADMIN_SESSION_SECRET`: a random secret of at least 32 bytes. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. Deploy. The database table and index are created automatically when the first response or dashboard request reaches the API.
5. Open `/admin.html` on the deployed site and sign in with `ADMIN_PASSWORD`.

Install dependencies with `npm install`. For local Vercel development, put the environment values in an untracked `.env.local` file and run `npx vercel dev`.

## Responses and duplicates

RSVPs are stored in Neon; the Vercel filesystem is not used for persistence. The dashboard shows total submissions, unique guests, duplicate submissions, and attending guests. Phone numbers are normalized for duplicate detection. By default, only the newest response for each normalized phone number is listed; enable **Include duplicate submissions** to see every submission and which ones are duplicates. All records remain stored.
