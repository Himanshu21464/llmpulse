# LLMpulse

Measure the climate impact of your Claude Code habit — in your terminal and in your GNOME top bar.

![GNOME 45-48](https://img.shields.io/badge/GNOME-45--48-blue)

LLMpulse ships two tools:

1. **`llmpulse` CLI** — a sourced, opinionated climate report that reads your `ccusage` data and converts tokens into energy, CO₂, water, tree-equivalents, and the EPA social cost of carbon. Supports per-model breakdown (Haiku / Sonnet / Opus), regional grid carbon intensity, historical trends, and offset pricing.
2. **GNOME Shell extension** — a tiny top-bar indicator that shows a tree icon + the tree-year count for today, with a dropdown breakdown that mirrors the CLI.

## Why these numbers?

Per-token energy for closed frontier models isn't published, so every constant used here is a middle-of-the-range estimate drawn from peer-reviewed work and industry disclosures. Run `llmpulse --sources` for the full citation list. Highlights:

| constant | value | source |
| --- | --- | --- |
| Energy / input token | 0.4 mWh | Simon P. Couch Claude Code analysis (2026) |
| Energy / output token | 2.0 mWh | same (output ~5× input) |
| Energy / cache-read token | 0.04 mWh | Anthropic pricing ratio as proxy |
| Model multiplier (Opus : Sonnet : Haiku) | 2.0 : 1.0 : 0.3 | pricing-derived compute ratio |
| Global grid carbon | 473 g CO₂/kWh | Ember Global Electricity Review 2025 |
| US / EU / India grid carbon | 384 / 213 / 708 | Ember 2024 country data |
| Water per kWh | 1.8 L | Mytton 2021, de Vries 2023 (Joule) |
| Tree CO₂ absorption | 21.77 kg/yr | US Forest Service |
| Social cost of carbon | $255 / tonne | EPA Final Rule, Nov 2023 |

You can override any constant via `~/.config/llmpulse/config.json` — see the `--help` output.

## Prerequisites

```bash
npm install -g ccusage
```

## Install the CLI

```bash
git clone https://github.com/Himanshu21464/llmpulse.git
cd llmpulse
install -m 755 llmpulse ~/.local/bin/llmpulse
```

Then:

```bash
llmpulse                    # today
llmpulse --all              # lifetime
llmpulse --since 20260101   # from date
llmpulse --models           # per-model (Haiku/Sonnet/Opus) breakdown
llmpulse --trends           # per-day bars, sparkline, WoW delta, biggest day
llmpulse --compare          # rich real-world equivalents panel
llmpulse --offset           # voluntary-market offset prices
llmpulse --region in        # use India grid carbon (708 g/kWh); also us|eu|cn|fr|no|uk|jp|au|ca|de|br|ru
llmpulse --sources          # print every citation
llmpulse --json             # machine-readable
llmpulse --config PATH      # load custom constants
```

Example:

```
        &            llmpulse — climate crime report
       &-&           period: today    grid: global (473 gCO₂/kWh)
      &&.&&
     &.&&&.&
    &&. &&.&&
        ||
       /||\

── the damage ──────────────────────────────────────────────
🔥 Tokens vaporized        6.48M
   input 14.9K   output 131.6K   cache-write 301.1K   cache-read 6.03M

⚡ Energy burned           1.26 kWh
☁  CO₂ belched            596.80 g
💧 Water evaporated        2.27 L
🌲 Tree-years to offset    0.027
🪓 Trees-cut-equivalent    1.33e-3
💀 Social cost of carbon   $0.1522
💸 Your wallet paid        $0.8746

── thats equivalent to ─────────────────────────────────────
    0.994  8-min hot shower
     4.97  km driven in an average car
    0.199  beef burger (100 g patty)
     6.63  km flown (economy)

── per-model breakdown ─────────────────────────────────────
model          tokens       energy         CO₂     trees   mult
────────────────────────────────────────────────────────────
opus            6.48M     1.26 kWh    596.80 g     0.027      2x

💬 The datacenter HVAC applied for hazard pay.
```

## Install the GNOME extension

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/ccusage@claude
cp -r extension.js metadata.json stylesheet.css icons \
   ~/.local/share/gnome-shell/extensions/ccusage@claude/
```

On X11, press `Alt+F2` → `r`. On **Wayland you must log out and back in** — disable/enable does not reload extension JS.

```bash
gnome-extensions enable ccusage@claude
```

The top bar shows a green tree icon and the tree-year count for today (e.g. `🌲 0.027`). Click for the full breakdown (energy / CO₂ / water / tokens / models / SCC / verdict).

## Config file

`~/.config/llmpulse/config.json` (or `~/.llmpulserc`) — any of these keys override the defaults:

```json
{
  "energyPerToken": { "input": 0.0004, "output": 0.002, "cacheCreate": 0.0004, "cacheRead": 0.00004 },
  "modelMultiplier": { "haiku": 0.3, "sonnet": 1.0, "opus": 2.0 },
  "gridIntensity":   { "global": 473, "us": 384, "eu": 213, "in": 708 }
}
```

## How accurate is this?

Honest answer: **order-of-magnitude**. The biggest uncertainties are (1) per-token energy for frontier models — undisclosed, varies 10× across published studies — and (2) your actual grid intensity, which varies by datacenter, time of day, and region. `--sources` documents every number. If Anthropic ever publishes real per-token energy figures, drop them into `~/.config/llmpulse/config.json` and the whole pipeline updates.

## License

MIT
