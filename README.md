<p align="center">
  <img width="800" height="200" alt="Hero Banner" src="https://github.com/user-attachments/assets/91265965-b16d-419a-839c-32eb553c9c7d" />
</p>

# Clip Studio Paint Discord Rich Presence 
<img src="CSPlogoAnimatedSORA.gif" width="64" height="64" alt="csp" align="right" />

Show what you're working on in **Clip Studio Paint** on your Discord profile with a live elapsed timer. Automatically detects when CSP is running and sets your Discord status.
<br>
<br>
<br>
<p align="center">
  <img width="800" height="85" alt="FEATURES" src="https://github.com/user-attachments/assets/8875ee68-962a-41cb-8ed1-35c5bf558ae2" />
</p>

- **Automatic detection**: polls every 3 seconds; connects RPC when CSP is open, disconnects when closed
- **Customizable status**: edit your activity details and status text from the GUI
- **Elapsed timer**: shows how long you've been drawing
- **System tray**: runs quietly in the background; left-click to open the window
- **Launch at startup**: toggle-able
- **Built with Tauri v2**: lightweight native app (Rust backend + React frontend)

<p align="center">
  <img width="402" height="522" alt="CSPRPC GUI screenshot" src="https://github.com/user-attachments/assets/15075ea3-81e8-418c-82df-09138b8ca761" />
</p>
<p align="center">
  <img width="800" height="85" alt="Getting Started" src="https://github.com/user-attachments/assets/b633c724-9a3e-4154-babe-2ced9b7b397b" />
</p>

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Rust](https://rustup.rs/)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (MSVC build tools, etc.)

### Install & Run

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

The installer will be in `src-tauri/target/release/bundle/`.

<p align="center">
  <img width="800" height="85" alt="Tech Stack" src="https://github.com/user-attachments/assets/4f7c0d60-ec0b-4e19-b35a-032d7a94e49d" />
</p>


- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite
- **Backend:** Rust, Tauri v2, `discord-rich-presence`, `sysinfo`, `winreg`
- **Discord RPC:** [discord-rich-presence](https://crates.io/crates/discord-rich-presence) crate


<p align="center">
  <img width="800" height="85" alt="Sponsor" src="https://github.com/user-attachments/assets/557ae3ec-5ec8-40f7-9b8f-d37002a28e1b" />
</p>

### Ko-Fi
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/O8F720UY7E) 
### Trakteer (Indonesia)
<a href="https://trakteer.id/scriptical/tip?quantity=10" target="_blank"><img src="https://edge-cdn.trakteer.id/images/embed/trbtn-red-1.png?v=14-05-2025" width="100" height="30" alt="Trakteer"></a> 
