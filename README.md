# CSApp - Streamer Hub

A local control center and interactive overlay suite for Twitch broadcasts. Includes a dynamic Subathon timer, animated Goals Queue, Top Supporters Podium, challenge roulette wheel, Google Sheets synchronization, and a browser-based visual overlay editor.

---

### Download & Installation

To download the ready-to-use Windows installer:

👉 **[Download the Latest Setup Installer](https://github.com/compileERezaCheng/CSApp/releases/latest)**

1. Download `CSApp_v2.4.12.exe` (or the latest version) from the **Assets** section of the latest release.
2. Run the installer to set up CSApp on your computer.
3. Start the application via the Desktop shortcut or `Iniciar-CSApp.bat`.
4. The dashboard will automatically open in your browser at `http://localhost:7331`.

---

## Recent Updates (v2.4.12)

- **Goals Queue Ordering Fix:** Resetting the counter to 0 now restores the first goal to the top of the queue instead of appending it below subsequent goals.
- **Animation Safety:** Goals that are re-activated before exit animations complete now cancel removal timers immediately, preventing accidental removal or strike-through styles.
- **Dedicated Port (7331):** The default port was moved from 3000 to 7331 (with `process.env.PORT` support) to avoid port clashes with common web development environments.
- **Dynamic OBS Link Detection:** Dashboard inputs now adapt automatically to the current runtime host and port.
- **OBS Script Cache Refresh:** Overlay scripts now include updated version parameters (`?v=4`) to ensure OBS loads the latest code.

---

## Features

### Subathon Timer
- Automatic time addition from Twitch and StreamElements events:
  - Regular Subs and Gift Subs (with configurable time per Tier 1, 2, and 3).
  - Sub bomb debounce (bundles multiple gifts into a single notification).
  - Bits / Cheers.
  - Tips and Ko-fi donations.
  - Follows and Raids (with configurable base time and viewer multiplier).
- Manual emergency controls: pause, resume, add, subtract, or reset time.

### Animated Goals Queue
- Track subathon progress by total subs or monetary value.
- Smooth transitions for OBS: completed goals hold for a configurable delay, fade out, and smoothly slide up upcoming goals.
- Real-time management: add, edit, reorder via drag-and-drop, and remove goals without restarting.

### Supporters Podium Widget
- Auto-cycling display (every 10 seconds) between:
  - Top Subs
  - Top Bits
  - Top Donos / Tips
- Horizontal and vertical layout modes.
- Case-insensitive supporter matching to prevent duplicate profiles.

### Interactive Custom Roulette
- HTML5 Canvas wheel with realistic spin physics and deceleration.
- Multiple independent profiles (e.g., Challenges, Punishments, Sub Goals).
- Configurable option weights and probabilities.
- Winner announcement pop-up with option to temporarily deactivate winning items.

### In-Browser Visual Overlay Editor
- Visual layout designer with live preview canvas (1920x1080).
- Drag-and-drop element positioning, interactive resizing, and layer management.
- Custom fonts (`.ttf`, `.otf`), text styling, colors, glow effects, and borders.
- Non-destructive image cropping tool for overlay assets and goal queue backgrounds.

### Google Sheets Synchronization
- Automatic real-time logging into dedicated columns (`Subs T1..T3`, `Gift Subs T1..T3`, `Bits`, `Ko-Fi`, `Tips`, `Follow`, `Raids`).
- Automatic daily grouping with exact event timestamps (`DD-MM-YYYY HH:mm`).
- One-click **Sync Sheets** button on the Podium dashboard to load and aggregate historical totals.

### Moderator Panel & Dual Tunnel Architecture
- **Cloudflare Tunnel:** Secure password-protected remote moderator dashboard (`/mod.html`), allowing trusted mods to control the timer and goals without network exposure.
- **Ko-fi Tunnel:** Dedicated localtunnel endpoint for webhook event processing.

---

## OBS Studio Setup

Add a **Browser Source** in OBS Studio with a resolution of **1920x1080** for each widget:

| Overlay Widget | OBS Browser Source URL |
| :--- | :--- |
| **Timer** | `http://localhost:7331/overlay/timer` |
| **Goals Queue** | `http://localhost:7331/overlay/goals` |
| **Podium** | `http://localhost:7331/overlay/podium` |
| **Roulette** | `http://localhost:7331/overlay/roulette` |

---

## Running from Source (Development)

### Prerequisites
- Windows 10/11 (64-bit)
- Node.js 18 or higher

```bash
# 1. Install dependencies
npm install

# 2. Set up initial configuration
copy data.example.json data.json

# 3. Start the server
node server.js
```

---

## Tech Stack

- **Runtime & Server:** Node.js, Express
- **Real-Time Communication:** Socket.IO
- **Tunnels:** Cloudflare Tunnel (`cloudflared`), localtunnel
- **Frontend:** Vanilla JavaScript, HTML5 Canvas, Modern CSS
- **Interaction Engine:** Interact.js
- **Packaging & Installer:** Vercel pkg, Inno Setup 7

---

## License

This project is available for personal and community use. For commercial distribution or customized integrations, please contact the author.
