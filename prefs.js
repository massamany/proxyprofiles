'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const EXTENSIONDIR = Me.dir.get_path();
const Log = Me.imports.impl.log.Log;
const ProxyPreferences = Me.imports.impl.proxyPreferences.ProxyPreferences;
const Convenience = Me.imports.impl.convenience;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;

function init() {
    Log.setPrefix('[preferences] ');
    Log.log('Initializing Preferences');
    Convenience.initTranslations();
}

function buildPrefsWidget() {
    if (Gtk.get_major_version() === 4) {
        let dummy = new Gtk.Label();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 0, () => {
            let window = dummy.get_root();
            window.close();

            Log.log('Opening Preferences sub process');
            let [res, out, err, status] = GLib.spawn_sync(
                null,
                [`${EXTENSIONDIR}/impl/prefs40/main.js`],
                null,
                null,
                null,
            );

            Log.debug(`Preferences sub process results :
    - res : ${res}
    - out : ${out}
    - err : ${err}
    - status : ${status}`);

            return GLib.SOURCE_REMOVE;
        });
        return dummy;
    } else {
        const preferences = new ProxyPreferences();
        preferences.main.show();
        return preferences.main;
    }
}