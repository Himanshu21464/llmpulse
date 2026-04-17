# LLMpulse

Measure the climate impact of your Claude Code habit, in your terminal and in your GNOME top bar.

![GNOME 45-48](https://img.shields.io/badge/GNOME-45--48-blue)

LLMpulse is two things:

1. **`llmpulse` CLI** — a sarcastic, terminal-facing climate report that reads your `ccusage` data and translates tokens into energy, CO₂, water, and tree-equivalents.
2. **GNOME Shell extension** — a tiny top-bar indicator that shows the tree-count (🌲) for today's usage, with a dropdown breaking down energy, CO₂, water, and a rotating sarcastic verdict.

> All numbers are rough estimates assembled from published LLM-inference ranges. They exist to shame you approximately, not precisely.

## Prerequisites

Install [ccusage](https://github.com/ryoppippi/ccusage):

```bash
npm install -g ccusage
```

## Install the CLI

```bash
install -m 755 llmpulse ~/.local/bin/llmpulse
```

Make sure `~/.local/bin` is on your `PATH`, then:

```bash
llmpulse              # today's climate crimes
llmpulse --all        # every sin recorded by ccusage
llmpulse --since 20260101
llmpulse --json       # machine-readable
llmpulse --help
```

Example:

```
🌍  llmpulse — your climate crime report (today)  🌍

You vaporized 3.17M tokens.
  input: 3.4K   output: 71.9K   cache write: 189.2K   cache read: 2.90M

⚡  Energy burned:       555.0 Wh
☁   CO₂ belched:         263.6 g
💧  Water evaporated:    999.0 ml
🌲  Tree-years to offset: 0.012
🪓  Trees-cut-equivalent: 5.86e-4
💸  Your wallet paid:    $0.8746

That's the equivalent of driving 2.20 km in an average car, or boiling 15.9 cups of water.

A datacenter cooling tower wept gently into the night.
```

## Install the GNOME extension

```bash
git clone https://github.com/Himanshu21464/llmpulse.git
cd llmpulse
mkdir -p ~/.local/share/gnome-shell/extensions/ccusage@claude
cp extension.js metadata.json stylesheet.css ~/.local/share/gnome-shell/extensions/ccusage@claude/
```

On X11, press `Alt+F2` → `r`. On Wayland, log out and back in. Then:

```bash
gnome-extensions enable ccusage@claude
```

The top bar will show something like `🌲 0.012` (tree-years of absorption consumed today). Click it for the full breakdown.

## How It Works

Every 120 seconds the extension runs `ccusage daily --since <today> --json --offline`, sums tokens across inputs / outputs / cache-write / cache-read (cache-read discounted at 10%), and converts:

- `tokens × 0.001 Wh/token` → energy
- `energy × 475 g CO₂/kWh` → carbon (global grid average)
- `energy × 1.8 L/kWh` → water (datacenter cooling)
- `CO₂ / 21.77 kg/tree-year` → tree-years to offset
- `CO₂ / 450 kg/tree-lifetime` → trees cut equivalent

The CLI uses the same constants and the same ccusage command — just with prettier ANSI and more existential dread.

## License

MIT
