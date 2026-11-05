# monkeymelodycodes
Global deposit for any interactive projects for Monkey Melody.
Each branch stores a different project.
!!!Branches are not to be merged to main!!!

---

## Studio booking: setup guide

This branch contains a web page for booking Monkey Melody's two studios (**Studio Utama** and **Studio VO**). Every booking is saved to a Google Sheet, and anything in the Sheet shows up on the page as "booked".

No programming is needed. Follow the steps in order. Total time: about 15 minutes.

### What you need

- A Google account (the one that will own the bookings Sheet).
- The files from this branch: `index.html` and `apps-script/Code.gs`.

### Step 1: Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a **Blank spreadsheet**.
2. Name it, for example, `MM Studio Bookings`.
3. Leave it empty. The booking tab and its columns are created automatically on the first booking.

### Step 2: Add the booking script to the Sheet

1. In the Sheet, open the menu **Extensions → Apps Script**. A new tab opens.
2. Delete everything in the editor (the `function myFunction() {}` text).
3. Open `apps-script/Code.gs` from this branch, copy **all** of its contents, and paste them into the editor.
4. Click the **Save** icon (floppy disk).

### Step 3: Publish the script

1. In the Apps Script tab, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Google asks for permission. Click **Authorize access**, choose your account, then **Advanced → Go to (project name) (unsafe) → Allow**. This warning is normal for scripts you write yourself.
6. Copy the **Web app URL**. It ends with `/exec`. Keep it for the next step.

**Check:** paste the URL into a new browser tab. You should see `{"ok":true,"reservations":[]}`.

### Step 4: Connect the page to the script

1. Open `index.html` in a plain text editor (Notepad on Windows, TextEdit on Mac in plain-text mode).
2. Find the line that starts with `const GOOGLE_SCRIPT_URL =`.
3. Replace the address between the quotes with your Web app URL from Step 3. Keep the quotes.
4. Save the file.

### Step 5: Put the page online

Pick one option:

- **Netlify Drop (easiest):** go to [app.netlify.com/drop](https://app.netlify.com/drop), drag a folder containing `index.html` onto the page, and share the link it gives you.
- **GitHub Pages:** in this repository, open **Settings → Pages**, choose this branch as the source, and save. The page link appears after a minute or two. (Private repositories need a paid GitHub plan for this.)

You can also just double-click `index.html` to open it in a browser on your own computer.

### Step 6: Test it

1. Open the page, pick a date, click one or more slots, fill in the form, and click **Book studio**.
2. Check the Sheet: a new tab called **Bookings** has one row per booked hour.
3. Reload the page: those slots show as booked (dark, crossed out).

### Day-to-day use

- **Cancel a booking:** delete its rows in the Sheet. The slot becomes free on the page within 30 seconds.
- **Block a time by hand** (e.g. maintenance): add a row in the **Bookings** tab with
  - **Studio:** `Studio Utama` or `Studio VO` (spelled exactly like this)
  - **Date:** `yyyy-mm-dd`, e.g. `2026-11-20`
  - **Slot:** an hour such as `09:00`, or several separated by commas: `09:00, 10:00`
- **The page updates by itself** every 30 seconds. Click **Refresh bookings** to update immediately.
- **Double bookings are blocked.** If two people book the same slot at the same moment, the second one gets a message and the page refreshes.

### If you change the script later

Use **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**.
Do **not** use "New deployment" again: that creates a new URL, and you would have to repeat Step 4.

### Troubleshooting

| Problem | Fix |
|---|---|
| Red message "Could not load reservations" | Check that the URL in `index.html` is correct and ends with `/exec`, and that "Who has access" is set to **Anyone**. |
| "Booking not saved" | Same checks as above. Also make sure you created a new version after editing the script. |
| A row added by hand doesn't show as booked | Check the studio name spelling and that the date is `yyyy-mm-dd`. |
| Page shows "Demo mode" | `GOOGLE_SCRIPT_URL` in `index.html` is empty or not a Google Script address. Redo Step 4. |
