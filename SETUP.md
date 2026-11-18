# Production Planner — Firebase setup

This sets up the online database for the Production Planner, as a new Firebase
project separate from IND Instruct. It takes about 15 minutes on the free (Spark)
plan, with no billing details needed.

## How access works

There are no email logins. Screens unlock with a PIN:

- **Management PIN** (at least 8 characters): full access to the roster, build
  batches, plans, staff and settings.
- **Bench PIN** (at least 6 characters): one shared PIN for every bench and cage
  screen. A bench screen sees only released plans, and can move people and record
  changes on them.
- **Anyone else:** no access.

A screen asks for the PIN once and then stays unlocked. Changing a PIN on the
setup page makes every screen using the old one ask for the new one.

**Why the length matters:** on the free plan, Firebase can't limit how many times
someone guesses a PIN, so make them hard to guess. A short phrase works well for
the management PIN.

## 1. Create the project

1. Go to console.firebase.google.com and click **Create a project**.
2. Name it `Production Planner`. Google Analytics isn't needed.
3. Click **Create project** and wait for it to finish.

## 2. Create the database

1. **Build → Firestore Database → Create database**.
2. Choose the **Standard** edition if asked, and keep the database ID as `(default)`.
3. **Location:** the one closest to the factory (for example, Melbourne). It can't
   be changed later.
4. Choose **Start in production mode** and click **Create**.

## 3. Add the access rules

1. In Firestore, open the **Rules** tab.
2. Delete what's there, paste in the whole of `firestore.rules`, and click **Publish**.

The red italic lines are comments; they're fine. A real problem shows as a red
mark beside a line number or a red banner after publishing.

## 4. Allow screens to sign in without an account

1. **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, click **Add new provider → Anonymous**.
3. Turn it on and click **Save**.

"Anonymous" just means a screen can connect without an email account. The PIN is
what decides what it can see.

## 5. Connect the app

1. Click the gear icon next to **Project Overview → Project settings**.
2. Under **Your apps**, click the web icon `</>`.
3. Nickname: `Production Planner`. Leave "Also set up Firebase Hosting" unticked
   for now, then click **Register app**.
4. You'll see a block of code starting `const firebaseConfig = {`. Copy each value
   into the matching line of `public/js/firebase-config.js`, or send the block to
   Claude.

These values are designed to sit in a web page, so they're safe to share. The
access rules from stage 3 are what protect the data.

## 6. Create the management PIN

This is the only PIN you type into the Firebase console. After this, the setup
page handles PINs.

1. **Firestore Database → Data → Start collection**.
2. Collection ID: `pins`, then **Next**.
3. **Document ID:** type your management PIN. It needs at least 8 characters, using
   only letters, numbers, spaces, dashes or underscores.
4. Add one field: name `role`, type **string**, value `management`.
5. Click **Save**.

## 7. Load the starter data and set the bench PIN

1. Open the setup page. Claude can open it in the preview pane, or you can go to
   `http://localhost:8765/setup.html` while the preview is running.
2. Enter the management PIN.
3. Click **Load starter data**. This adds the 13 staff from Worker Admin and the
   8 configuration colours.
4. Under **PINs**, set the **bench PIN** (at least 6 characters) and share it with
   the bench teams.

## Good to know

- **Free plan:** the Spark plan is plenty for one site: up to 50,000 reads and
  20,000 writes a day, and live updates are included.
- **Changing PINs:** do it on the setup page. Every screen using the old PIN will
  ask for the new one.
- **Locking a screen:** the setup page has **Lock this screen**. The bench screens
  will get the same button.
- **Publishing online:** when the app is ready, it goes on Firebase Hosting at a
  `.web.app` address like IND Instruct. `firebase.json` is already set up for that.

## Checking the access rules (developers)

`tests/firestore-rules.test.mjs` checks what each kind of screen (management,
bench, no PIN, old PIN) can and can't do. It runs on a local practice database
with made-up PINs, so the live data and real PINs are never touched.

Needs Java 21 and Node. Then, from the project folder:

```bash
npm install
npm run test:rules
```

Run it after any change to `firestore.rules`, then publish the rules
(step 3, or `firebase deploy --only firestore:rules --project production-planner-be3e6`).

## Practice mode (developers)

Try the whole app on this computer with test data, without touching the live
database or needing the real PINs:

```bash
npm run practice
```

Leave that running. In a second terminal, fill it with the starter staff,
colours and two made-up PINs (listed at the top of `scripts/seed-practice.mjs`):

```bash
npm run practice:seed
```

Then serve `public/` locally (e.g. `python3 -m http.server 8765 --directory public`)
and open `http://localhost:8765/?practice=1`. A yellow **PRACTICE DATABASE** bar
shows while it's on; `?practice=0` switches back. Practice mode only works on
`localhost`, never on the live website. The practice data is wiped when
`npm run practice` stops.
