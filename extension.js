import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const REFRESH_SECONDS = 120;
const CACHE_FILE = '/tmp/ccusage-gnome-cache.json';

const CcusageIndicator = GObject.registerClass(
class CcusageIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Claude Code Usage');

        this._box = new St.BoxLayout({style_class: 'panel-status-indicators-box'});

        this._icon = new St.Icon({
            style_class: 'system-status-icon ccusage-icon',
            icon_size: 16,
        });
        this._icon.set_gicon(Gio.icon_new_for_string('dialog-information-symbolic'));
        this._box.add_child(this._icon);

        this._label = new St.Label({
            text: 'Claude: ...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'ccusage-label',
        });
        this._box.add_child(this._label);

        this.add_child(this._box);

        // Dropdown menu items
        this._totalItem = new PopupMenu.PopupMenuItem('Total Tokens: --');
        this._totalItem.sensitive = false;
        this.menu.addMenuItem(this._totalItem);

        this._inputItem = new PopupMenu.PopupMenuItem('Input: --');
        this._inputItem.sensitive = false;
        this.menu.addMenuItem(this._inputItem);

        this._outputItem = new PopupMenu.PopupMenuItem('Output: --');
        this._outputItem.sensitive = false;
        this.menu.addMenuItem(this._outputItem);

        this._cacheCreateItem = new PopupMenu.PopupMenuItem('Cache Write: --');
        this._cacheCreateItem.sensitive = false;
        this.menu.addMenuItem(this._cacheCreateItem);

        this._cacheReadItem = new PopupMenu.PopupMenuItem('Cache Read: --');
        this._cacheReadItem.sensitive = false;
        this.menu.addMenuItem(this._cacheReadItem);

        this._modelsItem = new PopupMenu.PopupMenuItem('Models: --');
        this._modelsItem.sensitive = false;
        this.menu.addMenuItem(this._modelsItem);

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

            // GNOME subprocesses don't inherit the user's interactive PATH, so
            // ccusage installed via nvm/npm isn't on PATH. Extend PATH to cover
            // common install locations (nvm, /usr/local/bin, ~/.local/bin,
            // Homebrew, pnpm/yarn global bins) before exec'ing ccusage.
            const cmd =
                'for d in "$HOME/.nvm/versions/node"/*/bin; do [ -d "$d" ] && PATH="$d:$PATH"; done; ' +
                'PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:$PATH"; ' +
                `exec ccusage daily --since ${dateStr} --json --offline 2>/dev/null`;

            const proc = Gio.Subprocess.new(
                ['bash', '-c', cmd],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );

            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    const [, stdout] = proc.communicate_utf8_finish(res);
                    if (stdout && stdout.trim()) {
                        this._parseAndUpdate(stdout.trim());
                    } else {
                        this._label.set_text('Claude: N/A');
                    }
                } catch (e) {
                    this._label.set_text('Claude: err');
                }
            });
        } catch (e) {
            this._label.set_text('Claude: err');
        }
    }

    _parseAndUpdate(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);

            if (!data || !data.totals) {
                this._label.set_text('Claude: 0');
                this._totalItem.label.set_text('Total: 0');
                this._inputItem.label.set_text('Input: 0');
                this._outputItem.label.set_text('Output: 0');
                this._cacheCreateItem.label.set_text('Cache Write: 0');
                this._cacheReadItem.label.set_text('Cache Read: 0');
                this._modelsItem.label.set_text('Models: --');
                return;
            }

            const t = data.totals;

            const input = t.inputTokens || 0;
            const output = t.outputTokens || 0;
            const cacheCreate = t.cacheCreationTokens || 0;
            const cacheRead = t.cacheReadTokens || 0;
            const usageTokens = input + output + cacheCreate;

            this._label.set_text(`Claude: ${this._fmtTokens(usageTokens)}`);

            this._totalItem.label.set_text(`Total: ${this._fmtTokens(usageTokens)}`);
            this._inputItem.label.set_text(`Input: ${this._fmtTokens(input)}`);
            this._outputItem.label.set_text(`Output: ${this._fmtTokens(output)}`);
            this._cacheCreateItem.label.set_text(`Cache Write: ${this._fmtTokens(cacheCreate)}`);
            this._cacheReadItem.label.set_text(`Cache Read: ${this._fmtTokens(cacheRead)}`);

            const models = data.daily?.[0]?.modelsUsed || [];
            const modelNames = models.map(m => m.replace('claude-', '').replace(/-\d{8}$/, '')).join(', ');
            this._modelsItem.label.set_text(`Models: ${modelNames || '--'}`);
        } catch (e) {
            this._label.set_text('Claude: parse err');
        }
    }

    _fmtTokens(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toString();
    }

    destroy() {
        if (this._refreshTimeout) {
            GLib.source_remove(this._refreshTimeout);
            this._refreshTimeout = null;
        }
        super.destroy();
    }
});

export default class CcusageExtension extends Extension {
    enable() {
        this._indicator = new CcusageIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
