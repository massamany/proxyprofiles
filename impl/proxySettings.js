'use strict';

var ProxyMode = class {
    constructor(label) {
        this.label = label;
    }

    isNone() {
        return this.label === NONE_LABEL;
    }

    isManual() {
        return this.label === MANUAL_LABEL;
    }

    isAuto() {
        return this.label === AUTO_LABEL;
    }

    static from(str) {
        if (str === NONE_LABEL) return NONE;
        if (str === MANUAL_LABEL) return MANUAL;
        if (str === AUTO_LABEL) return AUTO;
        throw Error('Illegal mode ' + str);
    }
}

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Log = Me.imports.impl.log.Log;

const NONE_LABEL = 'none';
const MANUAL_LABEL = 'manual';
const AUTO_LABEL = 'auto';
var NONE = new ProxyMode(NONE_LABEL);
var MANUAL = new ProxyMode(MANUAL_LABEL);
var AUTO = new ProxyMode(AUTO_LABEL);


var ProxySettings = class {
    constructor() {
        Log.log('Building ProxySettings.');
        this.proxySetting = new Gio.Settings({ schema: 'org.gnome.system.proxy' });
        this.proxySettingHttp = new Gio.Settings({ schema: 'org.gnome.system.proxy.http' });
        this.proxySettingHttps = new Gio.Settings({ schema: 'org.gnome.system.proxy.https' });
        this.proxySettingFtp = new Gio.Settings({ schema: 'org.gnome.system.proxy.ftp' });
        this.proxySettingSocks = new Gio.Settings({ schema: 'org.gnome.system.proxy.socks' });
        this.listeners = [];

        let listeners = this.listeners;
        this.onChangedModeListener = Lang.bind(this, () => {
            listeners.forEach((listener) => {
                listener();
            });
        });

        this.proxySetting.connect('changed::mode', this.onChangedModeListener);
    }

    destroy() {
        Log.log('Destroying ProxySettings.');
        this.proxySetting.disconnect(this.onChangedModeListener);
    }

    onChangedMode(listener) {
        this.listeners.push(listener);
    }

    setMode(mode) {
        this.proxySetting.set_string('mode', mode.label)
    }

    getMode() {
        return ProxyMode.from(this.proxySetting.get_string('mode'));
    }
    
    getHttpHost() {
        return this.proxySettingHttp.get_string('host');
    }
    
    setHttpHost(value) {
        this._setStr(this.proxySettingHttp, 'host', value);
    }

    getHttpPort() {
        return this.proxySettingHttp.get_int('port');
    }

    setHttpPort(value) {
        this._setInt(this.proxySettingHttp, 'port', value);
    }

    getHttpUseAuthentication() {
        return this.proxySettingHttp.get_boolean('use-authentication');
    }

    setHttpUseAuthentication(value) {
        this._setBoolean(this.proxySettingHttp, 'use-authentication', value);
    }

    getHttpAuthenticationUser() {
        return this.proxySettingHttp.get_string('authentication-user');
    }

    setHttpAuthenticationUser(value) {
        this._setStr(this.proxySettingHttp, 'authentication-user', value);
    }

    getHttpAuthenticationPassword() {
        return this.proxySettingHttp.get_string('authentication-password');
    }

    setHttpAuthenticationPassword(value) {
        this._setStr(this.proxySettingHttp, 'authentication-password', value);
    }

    getHttpsHost() {
        return this.proxySettingHttps.get_string('host');
    }

    setHttpsHost(value) {
        this._setStr(this.proxySettingHttps, 'host', value);
    }

    getHttpsPort() {
        return this.proxySettingHttps.get_int('port');
    }

    setHttpsPort(value) {
        this._setInt(this.proxySettingHttps, 'port', value);
    }

    getFtpHost() {
        return this.proxySettingFtp.get_string('host');
    }

    setFtpHost(value) {
        this._setStr(this.proxySettingFtp, 'host', value);
    }

    getFtpPort() {
        return this.proxySettingFtp.get_int('port');
    }

    setFtpPort(value) {
        this._setInt(this.proxySettingFtp, 'port', value);
    }

    getSocksHost() {
        return this.proxySettingSocks.get_string('host');
    }

    setSocksHost(value) {
        this._setStr(this.proxySettingSocks, 'host', value);
    }

    getSocksPort() {
        return this.proxySettingSocks.get_int('port');
    }

    setSocksPort(value) {
        this._setInt(this.proxySettingSocks, 'port', value);
    }
    
    getAutoconfigUrl() {
        return this.proxySetting.get_string('autoconfig-url');
    }
    
    setAutoconfigUrl(value) {
        this._setStr(this.proxySetting, 'autoconfig-url', value);
    }
        
    getIgnoredHosts() {
        const tmp = this.proxySetting.get_strv('ignore-hosts').join(', ');
        const defVal = this.proxySetting.get_default_value('ignore-hosts').get_strv().join(', ');
        if (tmp && tmp !== defVal) return tmp;
        else return '';
    }
        
    setIgnoredHosts(value) {
        let tmp = value ? value.replace(/ /g, '') : value;
        if (tmp) {
            const defVal = this.proxySetting.get_default_value('ignore-hosts').get_strv().join(','); //No space here for join !
            if (tmp != defVal) {
               tmp = tmp.split(',')
                this.proxySetting.set_strv('ignore-hosts', tmp);
            }
            else this.proxySetting.reset('ignore-hosts');
        }
        else this.proxySetting.reset('ignore-hosts');
    }
        
    _setStr(settings, k, v) {
        if (v && v != settings.get_default_value(k).get_string())
            settings.set_string(k, v);
        else
            settings.reset(k);
    }
    
    _setInt(settings, k, v) {
        if (v && v != settings.get_default_value(k).get_int32())
            settings.set_int(k, v);
        else
            settings.reset(k);
    }
    
    _setBoolean(settings, k, v) {
        if ((v === true || v === false) && v != settings.get_default_value(k).get_boolean())
            settings.set_boolean(k, v);
        else
            settings.reset(k);
    }
}
