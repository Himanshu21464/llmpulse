# Claude Code Usage - GNOME Extension

A GNOME Shell extension that shows your daily Claude Code token usage in the top bar.

![GNOME 45-48](https://img.shields.io/badge/GNOME-45--48-blue)

## Features

- **Top bar indicator** showing total daily token usage (input + output + cache write)
- **Dropdown breakdown** with:
  - Total tokens
  - Input tokens
  - Output tokens
  - Cache write tokens
  - Cache read tokens
  - Models used
- Auto-refreshes every 2 minutes
- Manual refresh via dropdown menu

## Prerequisites

Install [ccusage](https://github.com/ryoppippi/ccusage):

```bash
npm install -g ccusage
```

## Install from GNOME Extensions

Visit [Claude Code Usage on extensions.gnome.org](https://extensions.gnome.org/extension/ccusage@claude/) and toggle the switch.

## Manual Install

```bash
git clone https://github.com/AeoruEntity/ccusage-gnome.git
cd ccusage-gnome
mkdir -p ~/.local/share/gnome-shell/extensions/ccusage@claude
cp extension.js metadata.json stylesheet.css ~/.local/share/gnome-shell/extensions/ccusage@claude/
```

Then restart GNOME Shell (log out/in on Wayland, or `Alt+F2` → `r` on X11) and enable the extension:

```bash
gnome-extensions enable ccusage@claude
```

## How It Works

The extension runs `ccusage daily --since <today> --json --offline` every 2 minutes and parses the JSON output to display your token usage.

## License

MIT
