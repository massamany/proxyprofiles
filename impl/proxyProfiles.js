'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const ProxySettings = Me.imports.impl.proxySettings.ProxySettings;
const ProxyConfig = Me.imports.impl.proxyConfig.ProxyConfig;
const ProxyMenu = Me.imports.impl.proxyMenu.ProxyMenu;
const Log = Me.imports.impl.log.Log;


var ProxyProfiles = class {
    constructor() {
        Log.log('Building ProxyProfiles.');

        this.settings = new ProxySettings();
        Log.debug('Proxy mode is ' + this.settings.getMode().label);
        this.settings.onChangedMode(() => {
            Log.debug('Proxy mode changed to ' + this.settings.getMode().label);
        });

        this.config = new ProxyConfig(this.settings, true);
        this.menu = new ProxyMenu(this.config);
    }

    destroy() {
        Log.log('Destroying ProxyProfiles.');
        this.settings.destroy();
        this.config.destroy();
        this.menu.destroy();
    }
}
