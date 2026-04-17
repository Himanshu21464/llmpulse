import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Set at enable() so the inner class can find the shipped SVG.
let EXTENSION_PATH = null;

const REFRESH_SECONDS = 120;

// Keep these in sync with the llmpulse CLI. See `llmpulse --sources` for
// the citations behind every constant.
const BASELINE_WH_PER_TOKEN = {
    input: 0.00040,
    output: 0.00200,
    cacheCreate: 0.00040,
    cacheRead: 0.00004,
};
const MODEL_MULTIPLIER = { haiku: 0.3, sonnet: 1.0, opus: 2.0, other: 1.0 };
const G_CO2_PER_KWH = 473;           // Ember 2024 global lifecycle
const ML_WATER_PER_KWH = 1800;       // Mytton 2021 / de Vries 2023
const KG_CO2_PER_TREE_YEAR = 21.77;  // US Forest Service
const KG_CO2_PER_TREE_LIFETIME = 450;
const SCC_USD_PER_TONNE_CO2 = 255;   // EPA 2023 Final Rule, 2025 value

function classifyModel(name) {
    if (!name) return 'other';
    const n = name.toLowerCase();
    if (n.includes('haiku')) return 'haiku';
    if (n.includes('opus')) return 'opus';
    if (n.includes('sonnet')) return 'sonnet';
    return 'other';
}

const VERDICTS = [
    'The Amazon rainforest left a one-star review.',
    'A polar bear just sent you a passive-aggressive DM.',
    'Greta is drafting a strongly worded tweet.',
    'Your carbon footprint wants a 1:1.',
    'Somewhere, a glacier sighed.',
    'The planet is not mad, just disappointed.',
    'Gaia is keeping receipts.',
    'Every token is a tiny scream from the troposphere.',
    'A cooling tower wept gently into the night.',
    'The coral reefs saw what you did there.',
    'Three ice cubes melted for your last prompt.',
    'The carbon budget has trust issues because of you.',
    '"Touch grass" will be a historical idiom soon.',
    'The IPCC cited you in a footnote. Not kindly.',
];

const CcusageIndicator = GObject.registerClass(
class CcusageIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'LLMpulse');

        // GNOME panel font (Cantarell) has no emoji glyphs and St doesn't
        // reliably fall back, so ship a real SVG and render via St.Icon.
        this._box = new St.BoxLayout({style_class: 'panel-status-indicators-box'});

        const iconPath = GLib.build_filenamev([EXTENSION_PATH, 'icons', 'tree-symbolic.svg']);
        this._icon = new St.Icon({
            gicon: Gio.icon_new_for_string(iconPath),
            style_class: 'system-status-icon llmpulse-icon',
            icon_size: 14,
        });
        this._box.add_child(this._icon);

        this._label = new St.Label({
            text: '…',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'llmpulse-label',
        });
        this._box.add_child(this._label);

        this.add_child(this._box);

        // Dropdown items — climate damage report.
        this._treesItem = new PopupMenu.PopupMenuItem('🌲 Tree-years to offset: --');
        this._treesItem.sensitive = false;
        this.menu.addMenuItem(this._treesItem);

        this._treesCutItem = new PopupMenu.PopupMenuItem('🪓 Trees-cut-equivalent: --');
        this._treesCutItem.sensitive = false;
        this.menu.addMenuItem(this._treesCutItem);

        this._energyItem = new PopupMenu.PopupMenuItem('⚡ Energy burned: --');
        this._energyItem.sensitive = false;
        this.menu.addMenuItem(this._energyItem);

        this._co2Item = new PopupMenu.PopupMenuItem('☁ CO₂ belched: --');
        this._co2Item.sensitive = false;
        this.menu.addMenuItem(this._co2Item);

        this._waterItem = new PopupMenu.PopupMenuItem('💧 Water evaporated: --');
        this._waterItem.sensitive = false;
        this.menu.addMenuItem(this._waterItem);

        this._tokensItem = new PopupMenu.PopupMenuItem('🔥 Tokens vaporized: --');
        this._tokensItem.sensitive = false;
        this.menu.addMenuItem(this._tokensItem);

        this._sccItem = new PopupMenu.PopupMenuItem('💀 Social cost of carbon: --');
        this._sccItem.sensitive = false;
        this.menu.addMenuItem(this._sccItem);

        this._modelsItem = new PopupMenu.PopupMenuItem('🤖 Models used: --');
        this._modelsItem.sensitive = false;
        this.menu.addMenuItem(this._modelsItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._verdictItem = new PopupMenu.PopupMenuItem('💬 …');
        this._verdictItem.sensitive = false;
        this.menu.addMenuItem(this._verdictItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const refreshItem = new PopupMenu.PopupMenuItem('Refresh Now');
        refreshItem.connect('activate', () => this._refresh());
        this.menu.addMenuItem(refreshItem);

        this._refreshTimeout = null;
        this._refresh();
        this._startTimer();
    }

    _startTimer() {
        this._refreshTimeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, REFRESH_SECONDS, () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _refresh() {
        try {
            const today = new Date();
            const dateStr = today.getFullYear().toString() +
                (today.getMonth() + 1).toString().padStart(2, '0') +
                today.getDate().toString().padStart(2, '0');

            // GNOME subprocesses don't inherit the user's interactive PATH,
            // so ccusage installed via nvm/npm/yarn/Homebrew isn't on PATH.
            // Extend PATH to cover common install locations before exec.
            const cmd =
                'for d in "$HOME/.nvm/versions/node"/*/bin; do [ -d "$d" ] && PATH="$d:$PATH"; done; ' +
                'PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:$PATH"; ' +
                `exec ccusage daily --since ${dateStr} --json --offline 2>/dev/null`;

            const proc = Gio.Subprocess.new(
                ['bash', '-c', cmd],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );

            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    const [, stdout] = p.communicate_utf8_finish(res);
                    if (stdout && stdout.trim()) {
                        this._parseAndUpdate(stdout.trim());
                    } else {
                        this._label.set_text('N/A');
                    }
                } catch {
                    this._label.set_text('err');
                }
            });
        } catch {
            this._label.set_text('err');
        }
    }

    _parseAndUpdate(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            const day = data?.daily?.[0];
            let input = 0, output = 0, cacheCreate = 0, cacheRead = 0;
            let wh = 0;

            const breakdowns = day?.modelBreakdowns || [];
            if (breakdowns.length > 0) {
                for (const mb of breakdowns) {
                    const mKey = classifyModel(mb.modelName);
                    const mult = MODEL_MULTIPLIER[mKey] ?? 1.0;
                    const i = mb.inputTokens || 0;
                    const o = mb.outputTokens || 0;
                    const cc = mb.cacheCreationTokens || 0;
                    const cr = mb.cacheReadTokens || 0;
                    input += i; output += o; cacheCreate += cc; cacheRead += cr;
                    wh += (i * BASELINE_WH_PER_TOKEN.input
                         + o * BASELINE_WH_PER_TOKEN.output
                         + cc * BASELINE_WH_PER_TOKEN.cacheCreate
                         + cr * BASELINE_WH_PER_TOKEN.cacheRead) * mult;
                }
            } else {
                const t = data?.totals ?? {};
                input = t.inputTokens || 0;
                output = t.outputTokens || 0;
                cacheCreate = t.cacheCreationTokens || 0;
                cacheRead = t.cacheReadTokens || 0;
                wh = input * BASELINE_WH_PER_TOKEN.input
                   + output * BASELINE_WH_PER_TOKEN.output
                   + cacheCreate * BASELINE_WH_PER_TOKEN.cacheCreate
                   + cacheRead * BASELINE_WH_PER_TOKEN.cacheRead;
            }

            const totalTokens = input + output + cacheCreate + cacheRead;
            const kwh = wh / 1000;
            const gCO2 = kwh * G_CO2_PER_KWH;
            const mlWater = kwh * ML_WATER_PER_KWH;
            const treeYears = (gCO2 / 1000) / KG_CO2_PER_TREE_YEAR;
            const treesCut = (gCO2 / 1000) / KG_CO2_PER_TREE_LIFETIME;
            const sccUsd = (gCO2 / 1e6) * SCC_USD_PER_TONNE_CO2;

            this._label.set_text(this._fmtTrees(treeYears));

            this._treesItem.label.set_text(`🌲 Tree-years to offset: ${this._fmtTrees(treeYears)}`);
            this._treesCutItem.label.set_text(`🪓 Trees-cut-equivalent: ${this._fmtTrees(treesCut)}`);
            this._energyItem.label.set_text(`⚡ Energy burned: ${this._fmtEnergy(wh)}`);
            this._co2Item.label.set_text(`☁ CO₂ belched: ${this._fmtCO2(gCO2)}`);
            this._waterItem.label.set_text(`💧 Water evaporated: ${this._fmtWater(mlWater)}`);
            this._tokensItem.label.set_text(`🔥 Tokens vaporized: ${this._fmtTokens(totalTokens)}`);
            this._sccItem.label.set_text(`💀 Social cost of carbon: ${this._fmtUSD(sccUsd)}`);

            const models = day?.modelsUsed || [];
            const modelNames = models.map(m => m.replace('claude-', '').replace(/-\d{8}$/, '')).join(', ');
            this._modelsItem.label.set_text(`🤖 Models used: ${modelNames || '--'}`);

            const seed = Math.floor(wh * 10) + totalTokens;
            this._verdictItem.label.set_text(`💬 ${VERDICTS[seed % VERDICTS.length]}`);
        } catch {
            this._label.set_text('parse err');
        }
    }

    _fmtUSD(n) {
        if (n >= 1) return '$' + n.toFixed(2);
        if (n >= 0.01) return '$' + n.toFixed(4);
        if (n <= 0) return '$0';
        return '$' + n.toExponential(2);
    }

    _fmtTokens(n) {
        if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toString();
    }

    _fmtEnergy(wh) {
        if (wh >= 1000) return (wh / 1000).toFixed(2) + ' kWh';
        if (wh >= 1) return wh.toFixed(2) + ' Wh';
        return (wh * 1000).toFixed(1) + ' mWh';
    }

    _fmtCO2(g) {
        if (g >= 1000) return (g / 1000).toFixed(2) + ' kg';
        if (g >= 1) return g.toFixed(2) + ' g';
        return (g * 1000).toFixed(1) + ' mg';
    }

    _fmtWater(ml) {
        if (ml >= 1000) return (ml / 1000).toFixed(2) + ' L';
        return ml.toFixed(2) + ' ml';
    }

    _fmtTrees(n) {
        if (n >= 10) return n.toFixed(1);
        if (n >= 0.01) return n.toFixed(3);
        if (n <= 0) return '0';
        return n.toExponential(2);
    }

    destroy() {
        if (this._refreshTimeout) {
            GLib.source_remove(this._refreshTimeout);
            this._refreshTimeout = null;
        }
        super.destroy();
    }
});

export default class LLMpulseExtension extends Extension {
    enable() {
        EXTENSION_PATH = this.path;
        this._indicator = new CcusageIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        EXTENSION_PATH = null;
    }
}
