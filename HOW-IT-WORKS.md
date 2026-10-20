# How it works (and what to do if something breaks)

## The parts, in plain words

| Part | Think of it as… | Free account | What it does |
|---|---|---|---|
| **GitHub**, repo `jaymota/atom-onboarding` | A filing cabinet for the website's code, plus the shop window | github.com (user **jaymota**) | Stores the code and shows the website at onboarding.atomconsulting.in (GitHub Pages) |
| **Supabase**, project `atom-onboarding` | A locked notebook in the cloud | supabase.com (sign in with GitHub) | Remembers clients, quotes and MOUs; stores the PDFs; runs the small "server functions" (PIN check, form, emails) |
| **Resend** | A post office | resend.com | Sends all emails from quotes@atomconsulting.in |
| **GoDaddy** | The address book of the internet | your existing account | Points onboarding.atomconsulting.in at GitHub, and proves to Resend that we may send email for atomconsulting.in |
| **BoldSign** | A signing desk | boldsign.com (free: 25 documents a month) | Collects signatures on the MOU, with an audit trail |

**Cost: ₹0.** All of these are free plans. Nothing asks for a card.

### Where the secrets are kept
- The code on GitHub is **public**, so it contains **no** client data, prices, passwords or keys.
- Your fees and prices live only in the **Settings** table in Supabase, which only you can open.
- Keys are kept in safe places:
  - **Resend email key, admin login key:** Supabase → Project Settings → Edge Functions → **Secrets**.
  - **Database address and public key (for the website build):** GitHub → repo → Settings → Secrets and variables → **Actions**.
- Your **PIN is never stored**. Only a scrambled "fingerprint" of it (a bcrypt hash) is kept, so even we couldn't read it.

### Free-plan limits (checked October 2026)
- **Supabase:** 500 MB database, 1 GB files, and it **falls asleep after 7 days of no use**.
- **Resend:** 3,000 emails a month, up to 100 a day.
- **GitHub Pages:** 100 GB of visits a month. That's far more than we need.

---

## The lock on the admin area (PIN)

- Only one account exists: **jay@atomconsulting.in**. Sign-ups are switched **off**, so nobody can create another account.
- The PIN is checked **on the server**, never in the website code.
- **5 wrong PINs** lock the login for 15 minutes. If wrong PINs keep coming, it locks for longer each time: 30 minutes, 1 hour, and so on, up to 24 hours. Wrong tries are counted per internet address **and** overall, so switching computers doesn't help an attacker. You get an **email alert** with the time, IP and device.
- **New device check:** the first time the PIN is used in a new browser, a 6-digit code goes to jay@atomconsulting.in. A stolen PIN alone is not enough.
- Sessions last at most **7 days**, and lock after **30 minutes** of no activity.
- **Database protection:** every table has "Row Level Security". The public website can't read any table. Clients can only see the one quote that their long random link points to. We tested this: a direct request to the database without logging in gets "permission denied".

### If you're locked out
- **Too many wrong PINs:** wait for the time shown, then try again. You'll have an alert email explaining.
- **Forgot the PIN:** click **Forgot PIN?** on the login screen. A code is emailed to jay@atomconsulting.in.
- **Lost access to jay@atomconsulting.in:** first get the mailbox back through Google Workspace admin. Codes only ever go to that address, which is what keeps the platform safe. If that's impossible, a developer (or Claude Code, with your Supabase login) can reset the PIN record in Supabase.

---

## Things that can go wrong

### "The site says paused", or the dashboard shows nothing and won't load
Supabase falls asleep after a week of no use. A GitHub robot pokes it **every 3 days** to stop that ("Keep Supabase awake" in GitHub → Actions). If it paused anyway:
1. Log in to **supabase.com** (Continue with GitHub).
2. Open the **atom-onboarding** project.
3. Click **Restore project** / **Resume** and wait 2 minutes.

### Emails aren't arriving
1. Admin → Settings → **Email & signing** → **Send a test email**.
2. If it shows an error, log in to **resend.com** → **Domains**. `atomconsulting.in` should be **Verified**. If not, click **Verify DNS records**.
3. Check you haven't passed **100 emails in a day**.
4. Look in your spam folder once and mark it "Not spam".

### The website doesn't load at all
1. GitHub → **jaymota/atom-onboarding** → **Actions**: the last "Deploy website" run should have a green tick.
2. GitHub → repo **Settings → Pages**: the custom domain should say `onboarding.atomconsulting.in`.
3. In GoDaddy DNS, the `CNAME` record `onboarding` → `jaymota.github.io` must still exist.

### A PDF looks wrong
Download it again. If something's still off, open Claude Code in the project folder and describe what you see.

---

## About online signatures (legal strength, in plain words)

- BoldSign's signatures (signing by email, with an audit trail of names, emails, times, IPs and a tamper-proof certificate) are **electronic signatures**. They're widely used for commercial agreements in India, and the IT Act 2000 recognises electronic records and contracts.
- They are **not** the same as **Aadhaar eSign** or a **Digital Signature Certificate (DSC)**. Those carry stronger legal presumptions, and they always cost money.
- **Please ask your lawyer or CA:**
  1. whether e-signatures are enough for your MOUs
  2. about **stamp duty** on agreements in Maharashtra, which may apply however the MOU is signed
- **Free fallback:** if you ever outgrow BoldSign's 25 documents a month, **OpenSign** (opensignlabs.com) has a free plan with unlimited signing on its own website. You'd upload the PDF the same way. Change the button link in Settings → Email & signing.
- The signing step is a separate stage, so a paid Aadhaar eSign provider can be plugged in later if needed.

---

## Where the code lives (for a developer)

| What | Where |
|---|---|
| Website (React + Vite + Tailwind) | `src/` |
| Quote/MOU engine, used by both the website and the server | `supabase/functions/_shared/engine/` |
| Intake form questions | `supabase/functions/_shared/engine/intake.ts` (edit there to add or change questions) |
| Server functions | `supabase/functions/admin-auth` (PIN), `public` (form, quote page), `admin-actions` (sending email) |
| Database tables and security rules | `supabase/migrations/` |
| Tests (Indian formatting, the El Chico, Gut-health and Wafer test cases) | `tests/`; run them with `npx vitest run` |
