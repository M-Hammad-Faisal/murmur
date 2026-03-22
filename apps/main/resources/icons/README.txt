Place your app icons here:

- tray.png     (16x16 or 32x32 — shown in system tray)
- icon.ico     (Windows — 256x256 recommended)
- icon.icns    (macOS — use iconutil to generate from icon.png)
- icon.png     (Linux + fallback — 512x512 recommended)

For a quick start, you can use any PNG and rename it.
Free tools to generate all formats:
  - https://www.electron.build/icons
  - https://cloudconvert.com/png-to-icns
  - https://convertico.com (PNG to ICO)

electron-builder will automatically pick up icons from this folder
based on the paths set in apps/main/package.json under "build.mac.icon"
and "build.win.icon".
