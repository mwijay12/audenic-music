# Audenic — Cross-Platform Music & Video Studio

Audenic is a high-performance audio workstation and media player engineered for desktop and mobile. Built with TypeScript, React 19, Tauri v2, and a custom Web Audio DSP pipeline, Audenic delivers low-latency playback, Camelot harmonic key matching, real turntable pitch bending, parametric equalization, and cloud-synced media streaming.

---

## Architectural Highlights

- **Web Audio DSP Pipeline**: Direct signal routing via `AudioContext` with zero-latency 5-band parametric EQ, bass boost shelving filters, spatial convolver reverb, and dynamic loudness normalization.
- **Harmonic DJ & Automix Station**: 
  - Real-time tempo estimation using onset energy-flux analysis and harmonic histogram bin smoothing.
  - Musical key classification via Chromagram analysis and Krumhansl-Schmuckler correlation (Camelot wheel compatible).
  - Turntable pitch bending with selectable Key Lock (Master Tempo) and momentary ±6% beat-matching nudges.
  - DSP automix transition engine supporting resonant low-pass sweep, high-pass sweep, echo out, and beat-synced morphing.
- **Tauri v2 Desktop Shell**: Frameless desktop window with custom system titlebar, GPU-accelerated floating mini-player (PIP), global keyboard shortcuts, and Windows media notification integration (`MediaSession`).
- **Course & Video Player**: Integrated 1080p video player with PiP support, folder hierarchy navigation, and instant MP3 audio-only extraction mode.
- **Vertical Reel Player**: Smooth-snapping vertical video feed with GPU compositing (`will-change: scroll-position`) and deterministic scroll stops.
- **Global Radio Streamer**: Access to 30,000+ live international radio stations powered by Radio-Browser distributed mirrors.

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Audenic UI Workspace    │
                          │   (React 19 + TypeScript) │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│   Web Audio DSP     │      │   Virtual DJ Engine │      │   Tauri v2 Shell    │
│  - 5-Band Parametric│      │  - Flux BPM Onset   │      │  - Windows Native   │
│  - Bass Shelving    │      │  - Camelot Analysis │      │  - OS Notifications │
│  - Convolver Reverb │      │  - Pitch Bender     │      │  - Floating Mini PIP│
│  - Dynamic Limiter  │      │  - Dual-Deck Morph  │      │  - File Associations│
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
```

---

## Desktop Keyboard Shortcuts

| Shortcut | Function |
| :--- | :--- |
| `Space` | Play / Pause toggle |
| `Arrow Right` / `Arrow Left` | Seek forward / backward 5 seconds |
| `Arrow Up` / `Arrow Down` | Master volume adjust (±5%) |
| `M` | Mute / Unmute audio |
| `F` | Fullscreen toggle |
| `\` or `Ctrl + B` | Expand / Collapse navigation sidebar |
| `Esc` | Close active overlay / Exit simple mode |

---

## Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or newer
- **Rust toolchain** *(for desktop executable builds)*: `rustc` and `cargo` (installable via [rustup.rs](https://rustup.rs))
- **Platform Build Tools** *(Windows)*: Visual Studio C++ Build Tools with Windows 10/11 SDK

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/audenic-music.git
   cd audenic-music
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   *Populate `.env` with your API keys if you plan to use speech synthesis or cloud features.*

### Development

Start the Vite development server:
```bash
npm run dev
```

Start the native Tauri desktop development window:
```bash
npm run tauri:dev
```

---

## Building Executables

### Production Desktop Executable (Windows)

To build the native Windows installer and standalone binary on a Windows workstation:
```bash
npm run tauri:build
```

The build outputs will be generated in `src-tauri/target/release/`:
- **Setup Installer**: `src-tauri/target/release/bundle/nsis/Audenic_2.0.0_x64-setup.exe`  
  *(Recommended for end users — includes desktop shortcut, Start Menu integration, and file associations for MP3/FLAC/WAV/MP4).*
- **Portable Executable**: `src-tauri/target/release/audenic.exe`  
  *(Standalone portable binary that runs instantly without installation).*

### Production Desktop Executable (Linux)

To build the native Linux packages on an Ubuntu/Debian environment:
```bash
# 1. Install prerequisites
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev librsvg2-dev patchelf xdg-utils

# 2. Build binaries
npm run tauri:build
```

The build outputs will be generated in `src-tauri/target/release/bundle/`:
- **Universal AppImage**: `bundle/appimage/Audenic_2.0.0_amd64.AppImage`  
  *(Universal portable package compatible with Ubuntu, Debian, Fedora, Arch, Manjaro, etc. To run: `chmod +x Audenic_2.0.0_amd64.AppImage && ./Audenic_2.0.0_amd64.AppImage`)*
- **Debian / Ubuntu Package**: `bundle/deb/audenic_2.0.0_amd64.deb`  
  *(Installs system-wide: `sudo dpkg -i audenic_2.0.0_amd64.deb`)*

### Automated Multi-Platform Cloud Builds (GitHub Actions)

Audenic features an automated CI/CD pipeline configured at `.github/workflows/build.yml`. Every time code is pushed to `main` or a release tag `v*` is created:
1. GitHub runners spin up clean **Ubuntu 22.04** and **Windows** build environments.
2. Web assets are bundled and the native Rust shell compiles with maximum optimization.
3. Linux `.AppImage`, `.deb`, and Windows `.exe`, `.msi` are generated and uploaded directly to the GitHub Release and Actions artifacts.

### Web Production Bundle

To build the optimized client web bundle:
```bash
npm run build
```
The output will be placed in the `dist/` directory.

### Android Native Build (Capacitor)

```bash
npm run build
npx cap sync android
npx cap open android
```

---

## Security & Environment Variables

Audenic separates client source code from credentials. Never commit your `.env` file to version control. The repository includes a `.env.example` file detailing all supported configuration parameters:

- `VITE_GEMINI_KEYS` — Comma-separated API keys for natural language assistant and lyric processing
- `VITE_GROQ_KEYS` — Ultra-fast inference keys for offline-first fallback
- `VITE_ELEVENLABS_TTS_KEYS` — Voice synthesis keys for text-to-speech
- `VITE_R2_*` — Cloudflare R2 bucket credentials for direct audio asset distribution

---

## License

This project is licensed under the MIT License.
