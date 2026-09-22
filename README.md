# CSApp - Streamer Hub

A local control center and interactive overlay suite for Twitch broadcasts. Includes a dynamic Subathon timer, animated Goals Queue, Top Supporters Podium, challenge roulette wheel, Google Sheets synchronization, and a browser-based visual overlay editor.

---

### Download & Installation

To download the ready-to-use Windows installer:

👉 **[Download the Latest Setup Installer](https://github.com/compileERezaCheng/CSApp/releases/latest)**

1. Download `CSApp_v2.4.13.exe` (or the latest version) from the **Assets** section of the latest release.
2. Run the installer to set up CSApp on your computer.
3. Start the application via the Desktop shortcut or `Iniciar-CSApp.bat`.
4. The dashboard will automatically open in your browser at `http://localhost:7331`.

---

## Recent Updates (v2.4.13)

- **Power-Cut Resilient Storage (Anti-Corrupção de Dados):**
  - **Deteção Rigorosa de Ficheiro Vazio/Corrompido:** Ficheiros com 0 bytes, bytes nulos (`\0`) ou estruturas `{}` vazias deixam de ser considerados válidos, forçando a recuperação automática a partir do backup.
  - **Recuperação Automática Multinível:** Restaura dados automaticamente de `data.json.bak` ou `data.json.bak2`, gerando cópia forense `data.corrupted.<timestamp>.json` e sincronizando de imediato o ficheiro principal.
  - **Garantia de Persistência com `fsync`:** Gravação síncrona com `fs.fsyncSync` antes de substituir ficheiros, forçando a descarga da cache de RAM do Windows diretamente para os setores físicos do disco.
  - **Proteção Concorrente e Backup Seguro:** Evita conflitos de I/O em gravações simultâneas e só atualiza os backups se o ficheiro atual contiver dados íntegros e não-vazios.

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
