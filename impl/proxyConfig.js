'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Lang = imports.lang;

const NONE = Me.imports.impl.proxySettings.NONE;
const MANUAL = Me.imports.impl.proxySettings.MANUAL;
const AUTO = Me.imports.impl.proxySettings.AUTO;
const ProxyMode = Me.imports.impl.proxySettings.ProxyMode;

const Log = Me.imports.impl.log.Log;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

var ProxyConfig = class {
    constructor(settings, monitorConfFile) {
        Log.log('Building ProxyConfig.');
        const self = this;
        this.settings = settings;
        this.confFile = Gio.File.new_for_path('.proxyprofile.json');

        this.listeners = [];
        let listeners = this.listeners;
        
        this.read();

        if (monitorConfFile) {
            this.confFileMonitor = this.confFile.monitor(Gio.FileMonitorFlags.WATCH_MOVES, null);
            this.onChangedConfigListener = Lang.bind(this, (file, otherFile, eventType) => {
                Log.debug('Config changed.');
                this.read();
                listeners.forEach((listener) => {
                    listener();
                });
            
            });
            this.confFileMonitor.connect('changed', this.onChangedConfigListener);
        }
    }

    destroy() {
        Log.log('Destroying ProxyConfig.');
        if (this.confFileMonitor) this.confFileMonitor.disconnect(this.onChangedConfigListener);
    }

    read() {
        if (this.confFile.query_exists(null)) {
            Log.debug('Config file found.');
            const content = this.confFile.load_contents(null);
            this.conf = JSON.parse(ByteArray.toString(content[1]));
        } else {
            Log.debug('Creating new config file.');
            this.conf = {};
            this.write();
        }
        Log.setActivateDebug(this.getActivateDebugLogs());
    }

    write() {
        Log.debug('Writing config file.');
        const stream = this.confFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        stream.write(JSON.stringify(this.conf, null, 2), null);
        stream.close(null);
    }

    getConfigFile() {
        return this.confFile;
    }

    onChangedConfig(listener) {
        this.listeners.push(listener);
    }

    getSystemConfigInfo(withCurrentProfile) {
        Log.debug('Retrieving System Config Info.');
        const infos = {mode: this.settings.getMode()};

        if (withCurrentProfile) {
            const profiles = this.getProfiles();
            if (profiles.length && ! infos.mode.isNone()) {
                Log.debug('Searching profile corresponding to mode ' + infos.mode.label);
                let currentProfile;
                for (let profile of profiles) {
                    if (profile.mode === infos.mode.label) {
                        if (!currentProfile) currentProfile = this.generateProfile(profile.name, infos.mode);
                        else currentProfile.name = profile.name;
                        if (this.profilesEqual(profile, currentProfile)) {
                            Log.debug('Found corresponding profile: ' + profile.name);
                            infos.profile = profile;
                            break;
                        }
                    }
                }
            }
        }

        return infos;
    }

    profilesEqual(p1, p2) {
        const keys1 = Object.getOwnPropertyNames(p1);
        const keys2 = Object.getOwnPropertyNames(p2);

        if (keys1.length !== keys2.length) return false;

        for (const key of keys1) {
            let val1 = p1[key] || null;
            let val2 = p2[key] || null;
            if (key === 'ignored') {
                val1 = val1.ignored ? val1.ignored.replace(/ /g, '') : val1.ignored;
                val2 = val2.ignored ? val2.ignored.replace(/ /g, '') : val2.ignored;
            }
            if (val1 != val2) {
                return false;
            } 
        }

        return true;
    }

    generateProfile(name, mode) {
        if (typeof mode === 'object') mode = mode.label;
        Log.debug('Generating new profile from system configuration in mode ' + mode);
        if (mode == MANUAL.label) {
            return {
                name: name,
                mode: mode,

                httpHost: this.settings.getHttpHost(),
                httpPort: this.settings.getHttpPort(),

                httpsHost: this.settings.getHttpsHost(),
                httpsPort: this.settings.getHttpsPort(),

                ftpHost: this.settings.getFtpHost(),
                ftpPort: this.settings.getFtpPort(),

                socksHost: this.settings.getSocksHost(),
                socksPort: this.settings.getSocksPort(),

                ignored: this.settings.getIgnoredHosts(),
            };
        }
        if (mode == AUTO.label) {
            return {
                name: name,
                mode: mode,

                autoConfigUrl: this.settings.getAutoconfigUrl()
            };
        }
    }

    applyProfile(name) {
        const profile = this.getProfile(name);
        Log.debug('Applying profile ' + name + ' of type ' + profile.mode + '.');

        if (profile.mode == MANUAL.label) {
            this.settings.setHttpHost(profile.httpHost);
            this.settings.setHttpPort(profile.httpPort);

            this.settings.setHttpsHost(profile.httpsHost);
            this.settings.setHttpsPort(profile.httpsPort);

            this.settings.setFtpHost(profile.ftpHost);
            this.settings.setFtpPort(profile.ftpPort);

            this.settings.setSocksHost(profile.socksHost);
            this.settings.setSocksPort(profile.socksPort);

            this.settings.setIgnoredHosts(profile.ignored);
        }
        if (profile.mode == AUTO.label) {
            this.settings.setAutoconfigUrl(profile.autoConfigUrl);
        }
        if (this.getAutoActivateModeOnApplyProfile()) {
            this.settings.setMode(ProxyMode.from(profile.mode));
        }
    }

    getProfiles() {
        if (this.conf.profiles) return this.conf.profiles;
        return [];
    }

    getProfile(name) {
        let profile = this.getProfiles().find(profile => profile.name === name);
        if (profile) return profile;
        return {};
    }

    deleteProfile(name) {
        this.conf.profiles = this.getProfiles().filter(profile => profile.name !== name);
        this.write();
    }

    saveProfile(profile) {
        const profiles = this.getProfiles();
        profiles[this.profileIndex(profile.name)] = profile;
        this.conf.profiles = profiles;
        this.write();
    }

    moveProfile(name, direction) {
        const profiles = this.getProfiles();
        const profileIndex = this.profileIndex(name);
        if (profileIndex >= 0 - direction && profileIndex <= profiles.length - 1 - direction) {
            [profiles[profileIndex], profiles[profileIndex + direction]] = [profiles[profileIndex + direction], profiles[profileIndex]];
            this.conf.profiles = profiles;
            this.write();
            return true;
        }
        return false;
    }

    profileIndex(name) {
        let i = 0;
        while (this.conf && i < this.conf.profiles.length && this.conf.profiles[i].name !== name) ++ i;
        return i;
    }

    getIconProxyAuto(emptyIfDefault) {
        return this.conf.iconProxyAuto || (emptyIfDefault ? undefined : Me.path + '/icons/proxy_auto.png');
    }

    setIconProxyAuto(iconProxyAuto) {
        this.conf.iconProxyAuto = iconProxyAuto;
        this.write();
    }

    getIconProxyManual(emptyIfDefault) {
        return this.conf.iconProxyManual || (emptyIfDefault ? undefined :  Me.path + '/icons/proxy_manual.png');
    }

    setIconProxyManual(iconProxyManual) {
        this.conf.iconProxyManual = iconProxyManual;
        this.write();
    }

    getIconNoProxy(emptyIfDefault) {
        return this.conf.iconNoProxy || (emptyIfDefault ? undefined :  Me.path + '/icons/no_proxy.png');
    }

    setIconNoProxy(iconNoProxy) {
        this.conf.iconNoProxy = iconNoProxy;
        this.write();
    }

    getShowStatus() {
        return this.conf.showStatus === false ? false : true;
    }

    setShowStatus(showStatus) {
        this.conf.showStatus = showStatus === false ? false : undefined;
        this.write();
    }

    getShowOpenSettingsFile() {
        return this.conf.showOpenSettingsFile === true ? true : false;
    }

    setShowOpenSettingsFile(showOpenSettingsFile) {
        this.conf.showOpenSettingsFile = showOpenSettingsFile === true ? true : undefined;
        this.write();
    }

    getAutoActivateModeOnApplyProfile() {
        return this.conf.autoActivateModeOnApplyProfile === false ? false : true;
    }

    setAutoActivateModeOnApplyProfile(autoActivateModeOnApplyProfile) {
        this.conf.autoActivateModeOnApplyProfile = autoActivateModeOnApplyProfile === false ? false : undefined;
        this.write();
    }

    getActivateDebugLogs() {
        return this.conf.activateDebugLogs === true ? true : false;
    }

    setActivateDebugLogs(activateDebugLogs) {
        this.conf.activateDebugLogs = activateDebugLogs === true ? true : undefined;
        Log.setActivateDebug(this.getActivateDebugLogs());
        this.write();
    }

    getShowOpenNetworkSettings() {
        return this.conf.showOpenNetworkSettings === true ? true : false;
    }

    setShowOpenNetworkSettings(showOpenNetworkSettings) {
        this.conf.showOpenNetworkSettings = showOpenNetworkSettings === true ? true : undefined;
        this.write();
    }

    getShowProfilesAsSubMenu() {
        return this.conf.showProfilesAsSubMenu === false ? false : true;
    }

    setShowProfilesAsSubMenu(showProfilesAsSubMenu) {
        this.conf.showProfilesAsSubMenu = showProfilesAsSubMenu === false ? false : undefined;
        this.write();
    }
}