'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Log = Me.imports.impl.log.Log;

const Lang = imports.lang;
const Main = imports.ui.main;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Config = imports.misc.config;
const Util = imports.misc.util;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const PROXY_NONE = Me.imports.impl.proxySettings.NONE;
const PROXY_MANUAL = Me.imports.impl.proxySettings.MANUAL;
const PROXY_AUTO = Me.imports.impl.proxySettings.AUTO;

const Gettext = imports.gettext.domain('proxyprofiles');
const _ = Gettext.gettext;

var ProxyMenu = class {
    constructor(config) {
        Log.log('Building ProxyMenu.');
        this.config = config;
        this.settings = config.settings;

        this.refreshIcons();

        this.createContainer();
    }

    refreshIcons() {
        Log.debug('Icon no proxy : ' + this.config.getIconNoProxy());
        this.iconNone = Gio.icon_new_for_string(this.config.getIconNoProxy());
        Log.debug('Icon proxy manual : ' + this.config.getIconProxyManual());
        this.iconManual = Gio.icon_new_for_string(this.config.getIconProxyManual());
        Log.debug('Icon proxy auto : ' + this.config.getIconProxyAuto());
        this.iconAuto = Gio.icon_new_for_string(this.config.getIconProxyAuto());
    }

    createContainer() {
        this.container = new PanelMenu.Button(St.Align.START, 'ProxyProfiles');
        this.icon = new St.Icon({gicon: this.iconNone, style_class: 'system-status-icon'});
        this.icon = new St.Icon({gicon: Gio.icon_new_for_string(Me.path + '/icons/proxy.png'), style_class: 'system-status-icon'});
        //this.icon = new St.Icon({icon_name: 'preferences-system-network-proxy-symbolic', style_class: 'system-status-icon'});

        let hbox = new St.BoxLayout({style_class: 'panel-status-menu-box' });
        hbox.add_child(this.icon);

        this.container.add_actor(hbox);
        this.container.add_style_class_name('panel-status-button');

        Main.panel.addToStatusArea('extensions', this.container);

        this.menu = this.container.menu;
        
        this.container.connect('button-press-event', Lang.bind(this, () => this.refreshMenu(true)));

        this.createMenu();

        this.settings.onChangedMode(this.refreshMenu.bind(this));
        this.config.onChangedConfig(this.refreshConfig.bind(this));
    }

    createMenu() {
        this.menu.removeAll();

        if (this.config.getShowStatus()) {
            this.commandCurrent = new PopupMenu.PopupMenuItem('');
            this.commandCurrent.setSensitive(false);
            this.menu.addMenuItem(this.commandCurrent);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        this.commandNoProxy = new PopupMenu.PopupMenuItem(_('Deactivate Proxy'));
        this.commandNoProxy.connect('activate', () => this.noProxy());
        this.menu.addMenuItem(this.commandNoProxy);

        this.commandProxyManual = new PopupMenu.PopupMenuItem(_('Activate Manual Proxy'));
        this.commandProxyManual.connect('activate', () => this.proxyMan());
        this.menu.addMenuItem(this.commandProxyManual);

        this.commandProxyAuto = new PopupMenu.PopupMenuItem(_('Activate Automatic Proxy'));
        this.commandProxyAuto.connect('activate', () => this.proxyAuto());
        this.menu.addMenuItem(this.commandProxyAuto);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const profiles = this.config.getProfiles();

        if (profiles && profiles.length) {
                this.commandProfiles = new PopupMenu.PopupSubMenuMenuItem(_('Proxy Profiles'), true);

                for (let profile of profiles) {
                    const profileMenuItem = new PopupMenu.PopupMenuItem(profile.name);
                    profileMenuItem.connect('activate', () => this.config.applyProfile(profile.name));
                    this.commandProfiles.menu.addMenuItem(profileMenuItem);
                }

                this.menu.addMenuItem(this.commandProfiles);

                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        const commandSettings = new PopupMenu.PopupMenuItem(_("Settings"));
        commandSettings.connect("activate", () => {
            if (ExtensionUtils.openPrefs) {
                Log.debug('Opening preferences.');
                ExtensionUtils.openPrefs();
            } else if (parseFloat(Config.PACKAGE_VERSION.substring(0,4)) > 3.32) {
                Log.debug('Opening preferences with shell command.');
                Util.trySpawnCommandLine(`gnome-extensions prefs ${Me.metadata.uuid}`);
            } else {
                Log.debug('Opening preferences with deprecated shell command.');
                Util.trySpawnCommandLine(`gnome-shell-extension-prefs ${Me.metadata.uuid}`);
            }
            return 0;
        });
        this.menu.addMenuItem(commandSettings);

        if (this.config.getShowOpenSettingsFile()) {
            const commandSettingsFile = new PopupMenu.PopupMenuItem(_("Open Settings File"));
            commandSettingsFile.connect("activate", () => {
                Log.debug('Opening settings file.');
                Util.trySpawnCommandLine(`gedit ${this.config.getConfigFile().get_path()}`);
            });
            this.menu.addMenuItem(commandSettingsFile);
        }

        this.refreshMenu();
    }

    refreshConfig() {
        Log.debug('Refreshing config.');
        this.refreshIcons();
        this.createMenu();
    }

    refreshMenu(skipIfNotOpened) {
        if (skipIfNotOpened && ! this.menu.isOpen) return;
        Log.debug('Refreshing proxy profile menu.');

        const current = this.config.getSystemConfigInfo(this.config.getShowStatus());
        let modeLib = '';
        this.commandNoProxy.setSensitive(! current.mode.isNone());
        this.commandProxyManual.setSensitive(! current.mode.isManual());
        this.commandProxyAuto.setSensitive(! current.mode.isAuto());
        if (current.mode.isNone()) {
            modeLib = _('Proxy: ') + _('Deactivated');
            this.icon.gicon = this.iconNone;
        }
        if (current.mode.isManual()) {
            if (current.profile) modeLib = _('Profile: ') + current.profile.name;
            else modeLib = _('Proxy: ') + _('Manual');
            this.icon.gicon = this.iconManual;
        }
        if (current.mode.isAuto()) {
            if (current.profile) modeLib = _('Profile: ') + current.profile.name;
            else modeLib = _('Proxy: ') + _('Automatic');
            this.icon.gicon = this.iconAuto;
        }
        
        if (this.config.getShowStatus()) this.commandCurrent.label.text = modeLib;
    }

    noProxy() {
        this.settings.setMode(PROXY_NONE);
    }

    proxyMan() {
        this.settings.setMode(PROXY_MANUAL);
    }

    proxyAuto() {
        this.settings.setMode(PROXY_AUTO);
    }

    destroy() {
        Log.log('Destroying ProxyMenu.');
        this.container.destroy();
    }
}
