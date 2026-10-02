# Lobby TV – Firebase Setup

The Lobby TV videos are stored in Firebase so every TV, on any device, can load them.
Videos are uploaded from the Admin Settings page ("Lobby TV Video") and played by `/display`.

## Firebase Storage rules

Set these in the Firebase console (they are not part of this repo):

```
match /tv-videos/{allPaths=**} {
  allow read: if true;
  allow create, update: if request.auth != null
    && request.resource.size < 500 * 1024 * 1024
    && request.resource.contentType.matches('video/(mp4|webm)');
  allow delete: if request.auth != null;
}
```

Files are stored at `tv-videos/<kioskId>/<videoId>`.

## Firestore document shape

`kiosks/<kioskId>/settings/tvVideo`:

```
{
  videos: [{ id, name, size, url, uploaded_at }],
  mode: 'single' | 'playlist',
  activeId,
  loop,
  muted,
  updated_at
}
```

## Note

Firestore rules currently allow public read/write and should be tightened later.
