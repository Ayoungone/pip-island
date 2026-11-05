# Pip's Learning Island: installable app

This folder is a complete, self-contained web app. Once it's on a web address,
any phone, tablet or computer can install it to the home screen. It then opens
full screen, with no browser bars, and works offline.

## 1. Put it online (one time, free)

Pick one:

**GitHub Pages**
1. On github.com, create a new public repository, for example `pip-island`.
2. Choose "uploading an existing file" and upload everything in this folder
   (keep the `voice`, `fonts` and `icons` folders).
3. Go to Settings → Pages → "Deploy from a branch" → `main` / `(root)` → Save.
4. After a minute your app is at `https://YOUR-USERNAME.github.io/pip-island/`.

**Netlify**
1. Sign in at app.netlify.com, open "Add new site" → "Deploy manually".
2. Drag this whole folder onto the page. You get a web address right away.

## 2. Install it on the tablet or phone

- **iPad / iPhone (Safari):** open the address → Share button → "Add to Home Screen".
- **Android (Chrome):** open the address → ⋮ menu → "Install app" (or "Add to Home screen").
- **Computer (Chrome or Edge):** open the address → install icon in the address bar.

Open it once while online so it can save everything for offline use (about 17 MB).

## 3. Bring over his progress

The installed app saves progress on that device. To move existing progress:
1. In the Claude version: Grown-ups → Settings → **Copy progress code**.
2. In the installed app: Grown-ups → Settings → **Load progress code** → paste → Load it.

The same buttons move progress between any two devices.

## Updating later

Upload the new files over the old ones. Change `VERSION` at the top of `sw.js`
so installed copies pick up the new voice files.

## Tip: lock him into the app

- iPad/iPhone: Settings → Accessibility → Guided Access. Triple-click the side
  button inside the app to lock it there.
- Android: Settings → Security → App pinning.

## Automatic sync (Firebase)

`firebase-config.js` holds the Firebase web settings. Once it's filled in, each
device can turn on sync under Grown-ups → "Sync across devices". The first
device starts sync and gets a family code (PIP-XXXX-XXXX-XXXX-XXXX), and other
devices join with that code. Progress from every device is merged, not
overwritten.

Firestore security rules used:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{code} {
      allow get: if code.matches('PIP-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}');
      allow create, update: if code.matches('PIP-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}')
        && request.resource.data.keys().hasOnly(['json', 'updated', 'device'])
        && request.resource.data.json is string
        && request.resource.data.json.size() < 900000;
      allow list, delete: if false;
    }
  }
}
```
