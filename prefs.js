'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Log = Me.imports.impl.log.Log;
const ProxyPreferences = Me.imports.impl.proxyPreferences.ProxyPreferences;
const Convenience = Me.imports.impl.convenience;

function init() {
    Log.setPrefix('[preferences] ');
    Log.log(`Initializing ${Me.metadata.name} Preferences`);
    Convenience.initTranslations();
}

function buildPrefsWidget() {
    const preferences = new ProxyPreferences();
    preferences.main.show();
    return preferences.main;
}