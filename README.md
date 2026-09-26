# CSApp - Streamer Hub

A local control center and interactive overlay suite for Twitch broadcasts. Includes a dynamic Subathon timer, animated Goals Queue, Top Supporters Podium, challenge roulette wheel, Google Sheets synchronization, and a browser-based visual overlay editor.

---

### Download & Installation

To download the ready-to-use Windows installer:

👉 **[Download the Latest Setup Installer](https://github.com/compileERezaCheng/CSApp/releases/latest)**

1. Download `CSApp_v2.4.13.exe` (or the latest version) from the **Assets** section of the latest release.
2. Run the installer to set up CSApp on your computer.
3. Start the application via the Desktop shortcut. The CSApp icon stays in the Windows notification area.
4. The dashboard will automatically open in your browser at `http://localhost:7331`.

Right-click the CSApp icon to open the dashboard, pause or start the timer, or close the app cleanly.

---

## Recent Updates (v2.4.13)

- **Power-Cut Resilient Storage (Anti-Corrupção de Dados):**
  - **Deteção Rigorosa de Ficheiro Vazio/Corrompido:** Ficheiros com 0 bytes, bytes nulos (`\0`) ou estruturas `{}` vazias deixam de ser considerados válidos, forçando a recuperação automática a partir do backup.
  - **Recuperação Automática Multinível:** Restaura dados automaticamente de `data.json.bak` ou `data.json.bak2`, gerando cópia forense `data.corrupted.<timestamp>.json` e sincronizando de imediato o ficheiro principal.
  - **Garantia de Persistência com `fsync`:** Gravação síncrona com `fs.fsyncSync` antes de substituir ficheiros, forçando a descarga da cache de RAM do Windows diretamente para os setores físicos do disco.
  - **Proteção Concorrente e Backup Seguro:** Evita conflitos de I/O em gravações simultâneas e só atualiza os backups se o ficheiro atual contiver dados íntegros e não-vazios.

---

## Features

### Support the project

If CSApp helps your stream, you can [support the project on Ko-fi](https://ko-fi.com/itsryuuchen). Contributions are optional.

### Subathon Timer
- Automatic time addition from Twitch and StreamElements events:
  - Regular Subs and Gift Subs (with configurable time per Tier 1, 2, and 3).
  - Sub bomb debounce (bundles multiple gifts into a single notification).
  - Bits / Cheers.
  - Tips and Ko-fi donations.
  - Follows and Raids (with configurable base time and viewer multiplier).
- Manual emergency controls: pause, resume, add, subtract, or reset time.
- Optional maximum timer length in hours (0 disables the cap). Lowering the cap clamps the current time immediately; later additions cannot exceed it.
- Per-event local MP3, OGG or WAV sounds (up to 1 MB each), with preview and volume controls on the Timer dashboard. Add the timer overlay as an OBS Browser Source for playback.

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
- Timer pulse or bounce on added time, plus a confetti effect when time reaches zero. System reduced-motion preference disables these effects.
- **Export JSON / Import JSON** saves one widget's design using version 1 of the format. Export embeds local images and fonts so the file can be shared; it cancels if a resource is missing, external, over 10 MB, or the full JSON exceeds 20 MB. Import validates the widget and shows a summary before replacing and saving the design.

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

URL parameters override the saved design **only for that Browser Source**. They never change the saved design. Unknown or invalid values are ignored. Supported parameters:

| Widget | Parameters |
| :--- | :--- |
| Timer | `fontSize` (8–200 px), `color`, `bg`, `glow` |
| Goals | `fontSize` (8–200 px), `color`, `bg` |
| Podium | `fontSize` (8–200 px), `color` |
| Roulette | `fontSize` (8–200 px), `arrowColor`, `outlineColor` |

Colors accept `#RRGGBB` (URL-encode `#` as `%23`) or `white`, `black`, `red`, `green`, `blue`. Timer and Goals also accept `bg=transparent`; Timer accepts `glow=false`.

Examples: `http://localhost:7331/overlay/timer?fontSize=40&bg=transparent&color=white&glow=false` and `http://localhost:7331/overlay/roulette?fontSize=36&arrowColor=%23ffcc00`.

### Community plugins

Use **Plugins da comunidade** in the local Dashboard to install a ZIP, enable it, configure it, and copy its OBS URL. A ZIP contains exactly one folder named after the plugin ID, with `plugin.json`, `overlay.html`, and `config.html`. The included `plugins/time-badge/` is a working example. The manifest format is:

```json
{"id":"time-badge","name":"Time Badge","version":"1.0.0","overlay":"overlay.html","config":"config.html","events":["timeUpdate","timeAdded"]}
```

The overlay and configuration pages run in sandboxed iframes without same-origin access. Their content security policy blocks network connections and external scripts. No plugin server code is loaded. Pages receive `postMessage` values from the parent: `{type:"csapp:config",config}` and `{type:"csapp:event",event,data}`. Supported events are `timeUpdate` (seconds), `timeAdded` (`{id,type,seconds}`), `timerEnded` (event ID), and `logEvent` (text). A configuration page saves a small object of string, number or boolean values with `parent.postMessage({type:"csapp:saveConfig",config},"*")`. Configuration is sent to the public overlay, so do not put secrets in it. The ZIP installer rejects unexpected files, invalid manifests, and archives above 5 MB expanded.

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
