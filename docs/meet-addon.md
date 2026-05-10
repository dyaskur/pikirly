# Google Meet Add-on Integration

This document explains how to register and test the Pikirly Meet add-on.

## Registration in Google Cloud Console

1.  **Enable APIs:**
    *   Enable the **Google Workspace Marketplace SDK**.
    *   Enable the **Google Workspace Add-ons API**.

2.  **Configure OAuth Consent Screen:**
    *   Add scope: `https://www.googleapis.com/auth/meetings.space.readonly`.

3.  **Google Workspace Marketplace SDK:**
    *   Go to **App Configuration**.
    *   Find **App integration** and check **Google Workspace add-on**.
    *   Provide the following manifest (update URLs to match your deployment):

```json
{
  "addOns": {
    "common": {
      "name": "Pikirly",
      "logoUrl": "https://absolute-spin.yaskur.com/assets/logo_128x128.gif"
    },
    "meet": {
      "web": {
        "sidePanelUrl": "https://your-domain.com/?mode=meet&surface=side",
        "supportsScreenSharing": true,
        "addOnOrigins": [
          "https://your-domain.com",
          "http://localhost:5173"
        ],
        "logoUrl": "https://absolute-spin.yaskur.com/assets/logo_128x128.gif"
      }
    }
  }
}
```

## Local Development & Testing

1.  **Tunneling:** Google Meet requires HTTPS. Use `ngrok` or similar:
    ```bash
    ngrok http 5173
    ```
2.  **Update Manifest:** Use the ngrok URL in your Marketplace SDK configuration.
3.  **Test Install:** 
    *   Go to "App Listing" in Marketplace SDK.
    *   Click "Test Install" or "Publish to Private" (if in a Workspace).
4.  **Join a Meet:**
    *   Open a Google Meet call.
    *   Click the **Activities** icon (bottom right).
    *   Select **Pikirly**.
    *   **Host:** Select "Main stage" to pick a quiz.
    *   **Participants:** Will see the side panel auto-load the game.

## Technical Details

### Identity Reconciliation
Participants are identified by their Google Meet participant ID. On first join, Pikirly maps this ID to an internal `playerId`. If the participant refreshes or reconnects, they are automatically restored to the same player session without needing a PIN or nickname.

### Auth
Hosts must be signed in to Pikirly via Google OAuth. If they launch the add-on without being authed, they will see a "Sign in" button that opens a popup.

### URL Parameters
- `mode=meet`: Triggers the Meet SDK initialization.
- `surface=side`: For the side panel (players).
- `surface=stage`: For the main stage (host leaderboard).
