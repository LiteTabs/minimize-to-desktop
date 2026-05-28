'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';

const { Clutter, Meta, St } = imports.gi;

let minimizedWindows = new Map();

const THUMB_WIDTH = 240;
const SPACING_X = 290;
const SPACING_Y = 260;
const MAX_ROWS = 4;

function enable() {
    console.log('[MinToDesk] Minimize to Desktop Thumbnail v5 — запущено');

    global.display.connectObject('window-created', (_, window) => {
        if (window.get_window_type() !== Meta.WindowType.NORMAL) return;

        window.connect('notify::minimized', () => {
            if (window.minimized && !minimizedWindows.has(window)) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    createThumbnail(window);
                    return GLib.SOURCE_REMOVE;
                });
            }
        });
    }, this);
}

function createThumbnail(window) {
    const actor = window.get_compositor_private();
    if (!actor) return;

    const ratio = actor.height / actor.width;
    const height = Math.round(THUMB_WIDTH * ratio);

    const clone = new Clutter.Clone({ source: actor, reactive: true });
    clone.set_size(THUMB_WIDTH, height);

    // Вертикальная сетка как на рабочем столе
    const index = minimizedWindows.size;
    const col = Math.floor(index / MAX_ROWS);
    const row = index % MAX_ROWS;

    const x = 120 + col * SPACING_X;
    const y = 120 + row * SPACING_Y;

    clone.set_position(x, y);

    const container = Main.layoutManager._backgroundGroup || Main.layoutManager.uiGroup;
    container.add_child(clone);

    // Подпись окна
    const label = new St.Label({
        text: window.get_title()?.substring(0, 45) || "Окно",
        style: 'background-color: rgba(0,0,0,0.85); color: white; padding: 6px 12px; border-radius: 6px; font-size: 13px;',
    });
    label.set_position(x, y + height + 12);
    container.add_child(label);

    clone.connect('button-press-event', (_, event) => {
        if (event.get_button() === 1) {
            window.unminimize();
            window.activate(global.get_current_time());
            destroyThumbnail(window);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    });

    minimizedWindows.set(window, { clone, label });
    console.log(`[MinToDesk] Миниатюра создана: ${window.get_title()}`);
    
    window.minimize();
}

function destroyThumbnail(window) {
    const data = minimizedWindows.get(window);
    if (!data) return;

    if (data.clone) data.clone.destroy();
    if (data.label) data.label.destroy();
    minimizedWindows.delete(window);
}

function disable() {
    for (let [win] of [...minimizedWindows.keys()]) {
        if (win && !win.is_destroyed()) win.unminimize();
    }
    minimizedWindows.clear();
}

export default class MinimizeToDesktop {
    enable() { enable(); }
    disable() { disable(); }
}
