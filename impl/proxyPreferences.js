'use strict';

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const NONE = Me.imports.impl.proxySettings.NONE;
const MANUAL = Me.imports.impl.proxySettings.MANUAL;
const AUTO = Me.imports.impl.proxySettings.AUTO;
const ProxySettings = Me.imports.impl.proxySettings.ProxySettings;
const ProxyConfig = Me.imports.impl.proxyConfig.ProxyConfig;
const Log = Me.imports.impl.log.Log;

const Gettext = imports.gettext.domain('proxyprofiles');
const _ = Gettext.gettext;

const GLADE_FILE = Me.dir.get_path() + '/proxyprofiles.glade';

var ProxyPreferences = class {
    constructor() {
        Log.log('Building ProxyMenu.');
        this.settings = new ProxySettings();
        this.config = new ProxyConfig(this.settings, true);
        this.builder = new Gtk.Builder();
        this.builder.set_translation_domain('proxyprofiles');
        this.builder.add_objects_from_file(GLADE_FILE, ['main']);
        this.loadWidgets(this, this.builder, [
            'main',
            'iconNoProxyFileChooser',
            'iconProxyManualFileChooser',
            'iconProxyAutoFileChooser',
            'showStatusSwitch',
            'showOpenSettingsFileSwitch',
            'showOpenNetworkSettingsSwitch',
            'showProfilesAsSubMenuSwitch',
            'autoActivateModeOnApplyProfileSwitch',
            'activateDebugLogsSwitch',
            'profileStack',
            'profilesListBox',
            'profilesAddToolButton',
            'profilesRemoveToolButton',
            'profilesMoveUpToolButton',
            'profilesMoveDownToolButton',
            'messageLabel'
        ]);

        this.config.onChangedConfig(this.refreshConfig.bind(this));
        this.newProfileRows = [];

        this.refreshConfig();

        // After config loaded, connect the events
        this.builder.connect_signals_full((builder, object, signal, handler) => {
            object.connect(signal, this[handler].bind(this));
        });

        // At the time buildPrefsWidget() is called, the window is not yet prepared
        // so if you want to access the headerbar you need to use a small trick
        GLib.timeout_add(0, 0, () => {
            const window = this.main.get_toplevel();
            const headerBar = window.get_titlebar();
            headerBar.title = _('Proxy Profiles Preferences');
        });
    }

    loadWidgets(target, builder, names) {
        for (let i in names) {
            target[names[i]] = builder.get_object(names[i]);
        }
    }

    refreshConfig() {
        Log.debug('Refreshing config');

        const self = this;
        this.config.getIconNoProxy(true) && this.iconNoProxyFileChooser.set_filename(this.config.getIconNoProxy(true));
        this.config.getIconProxyManual(true) && this.iconProxyManualFileChooser.set_filename(this.config.getIconProxyManual(true));
        this.config.getIconProxyAuto(true) && this.iconProxyAutoFileChooser.set_filename(this.config.getIconProxyAuto(true));

        this.messageLabel.set_text('');

        this.showStatusSwitch.active = this.config.getShowStatus();
        this.showOpenSettingsFileSwitch.active = this.config.getShowOpenSettingsFile();
        this.showOpenNetworkSettingsSwitch.active = this.config.getShowOpenNetworkSettings();
        this.showProfilesAsSubMenuSwitch.active = this.config.getShowProfilesAsSubMenu();
        this.autoActivateModeOnApplyProfileSwitch.active = this.config.getAutoActivateModeOnApplyProfile();
        this.activateDebugLogsSwitch.active = this.config.getActivateDebugLogs();

        // Saving current user editions
        const profiles = {};
        const newProfiles = []; 
        let selectedProfileRow = this.getSelectedProfileRow();
        if (this.profileRows) this.profileRows.forEach(profileRow => profiles[profileRow.profile.name] = profileRow.toProfile(false));
        if (this.newProfileRows) this.newProfileRows.forEach(newProfileRow => newProfiles.push([newProfileRow.profile, newProfileRow.toProfile(false)]));

        // Reseting
        this.profileRows = [];
        this.newProfileRows = [];

        this.profileStack.foreach(child => {
            self.profileStack.remove(child);
            child.destroy();
        });
        this.profilesListBox.foreach(child => {
            self.profilesListBox.remove(child);
            child.destroy();
        });

        this.config.getProfiles().forEach(profile => {
            const row = this.createProfileRow(profile, false);
            if (profiles[profile.name]) row.fromProfile(profiles[profile.name], false);
        });
        newProfiles.forEach(profile => {
            const row = this.createProfileRow(profile[0], true);
            row.fromProfile(profile[1], false);
        });

        if (selectedProfileRow) {
            Log.debug('Try to reselect profile ' + selectedProfileRow.profile.name);
            selectedProfileRow = this.searchProfileRowByName(selectedProfileRow.profile.name);
        }

        this.recomputeNamesDuplicates();

        if (selectedProfileRow) {
            this.profilesListBox.select_row(selectedProfileRow.profileListBoxRow);
        }
        else if (this.profileRows.length) this.profilesListBox.select_row(this.profileRows[0].profileListBoxRow);
        else if (this.newProfileRows.length) this.profilesListBox.select_row(this.newProfileRows[0].profileListBoxRow);
        else this.onProfilesListBoxRowSelected();
    }

    searchProfileRowByName(name) {
        const s = function(rows) {
            for (let i = 0 ; i < rows.length ; ++ i) {
                if (name === rows[i].profile.name) {
                    return rows[i];
                }
            }
        }.bind(this);
        return s(this.profileRows) || s(this.newProfileRows);
    }

    onIconNoProxySet(fileChooser) {
        Log.debug('Defining icon for no proxy: ' + fileChooser.get_filename());
        this.config.setIconNoProxy(fileChooser.get_filename());
    }

    onIconNoProxyReset() {
        Log.debug('Reseting icon for no proxy.');
        this.unselectIcon(this.iconNoProxyFileChooser, this.config.setIconNoProxy);
    }

    onIconProxyManualSet(fileChooser) {
        Log.debug('Defining icon for proxy manual: ' + fileChooser.get_filename());
        this.config.setIconProxyManual(fileChooser.get_filename());
    }

    onIconProxyManualReset() {
        Log.debug('Reseting icon for proxy manual.');
        this.unselectIcon(this.iconProxyManualFileChooser, this.config.setIconProxyManual);
    }

    onIconProxyAutoSet(fileChooser) {
        Log.debug('Defining icon for proxy auto: ' + fileChooser.get_filename());
        this.config.setIconProxyAuto(fileChooser.get_filename());
    }

    onIconProxyAutoReset() {
        Log.log('Reseting icon for proxy auto.');
        this.unselectIcon(this.iconProxyAutoFileChooser, this.config.setIconProxyAuto);
    }

    unselectIcon(chooser, configCall) {
        configCall.bind(this.config)(undefined);
        chooser.get_filename() && chooser.unselect_filename(chooser.get_filename());
    }

    onShowStatusSwitchToggled() {
        Log.debug('Switch Show Status.');
        this.config.setShowStatus(this.showStatusSwitch.active);
    }

    onShowOpenSettingsFileSwitchToggled() {
        Log.debug('Switch Show Settings File.');
        this.config.setShowOpenSettingsFile(this.showOpenSettingsFileSwitch.active);
    }

    onShowOpenNetworkSettingsSwitchToggled() {
        Log.debug('Switch Show Network Settings.');
        this.config.setShowOpenNetworkSettings(this.showOpenNetworkSettingsSwitch.active);
    }

    onShowProfilesAsSubMenuSwitchToggled() {
        Log.debug('Switch Show Profiles As Sub Menu.');
        this.config.setShowProfilesAsSubMenu(this.showProfilesAsSubMenuSwitch.active);
    }

    onAutoActivateModeOnApplyProfileSwitchToggled() {
        Log.debug('Switch Auto Activate Mode On Apply Profile.');
        this.config.setAutoActivateModeOnApplyProfile(this.autoActivateModeOnApplyProfileSwitch.active);
    }

    onActivateDebugLogsSwitchToggled() {
        Log.debug('Switch Activate Debug Logs.');
        this.config.setActivateDebugLogs(this.activateDebugLogsSwitch.active);
    }

    onAboutButtonClicked() {
        Log.debug('Loading About dialog.');
        let aboutBuilder = new Gtk.Builder();
        aboutBuilder.set_translation_domain('proxyprofiles');
        aboutBuilder.add_objects_from_file(GLADE_FILE, ['aboutDialog']);
        let dialog = aboutBuilder.get_object('aboutDialog');
        let parentWindow = this.main.get_toplevel();
        dialog.set_transient_for(parentWindow);
        dialog.run();
        dialog.hide();
    }

    onProfilesAddToolButtonClicked() {
        Log.debug('Adding profile.');
        let i = 1;
        const name = _('New Profile');
        while (this.searchProfileRowByName(name + ' ' + i)) ++i;
        const row = this.createProfileRow({name: name + ' ' + i}, true);
        this.profilesListBox.select_row(row.profileListBoxRow);
    }

    onProfilesRemoveToolButtonClicked() {
        Log.debug('Removing profile.');
        let profileRow = this.getSelectedProfileRow();
        if (!!profileRow) {
            if (profileRow.isNew) {
                this.newProfileRows.splice(this.newProfileRows.indexOf(profileRow), 1);
                this.refreshConfig();
            }
            else this.config.deleteProfile(profileRow.profile.name);
        }
    }

    onProfilesMoveUpToolButtonClicked() {
        Log.debug('Moving up profile.');
        let profileRow = this.getSelectedProfileRow();
        if (!!profileRow && !profileRow.isNew) {
            this.config.moveProfile(profileRow.profile.name, -1);
        }
    }

    onProfilesMoveDownToolButtonClicked() {
        Log.debug('Moving down profile.');
        let profileRow = this.getSelectedProfileRow();
        if (!!profileRow && !profileRow.isNew) {
            this.config.moveProfile(profileRow.profile.name, 1);
        }
    }

    onProfilesListBoxRowSelected() {
        Log.debug('Selecting profile.');
        let row = this.getSelectedProfileRow();
        if (!!row) {
            this.profileStack.set_visible_child_name(row.uuid);
            this.messageLabel.set_text(row.messageLabelText);
        }

        if (! row || row.isNew) {
            this.profilesMoveUpToolButton.set_sensitive(false);
            this.profilesMoveDownToolButton.set_sensitive(false);
        }
        else if (row.uuid === this.profileRows[0].uuid) {
            this.profilesMoveUpToolButton.set_sensitive(false);
            this.profilesMoveDownToolButton.set_sensitive(this.profileRows.length > 1);
        }
        else if (row.uuid === this.profileRows[this.profileRows.length - 1].uuid) {
            this.profilesMoveUpToolButton.set_sensitive(true);
            this.profilesMoveDownToolButton.set_sensitive(false);
        }
        else {
            this.profilesMoveUpToolButton.set_sensitive(true);
            this.profilesMoveDownToolButton.set_sensitive(true);
        }
    }

    getSelectedProfileRow() {
        let selectedRow = this.profilesListBox.get_selected_rows()[0];

        if (this.profileRows) {
            for (let profileRow of this.profileRows) {
                if (selectedRow == profileRow.profileListBoxRow) {
                    return profileRow;
                }
            }
        }

        if (this.newProfileRows) {
            for (let profileRow of this.newProfileRows) {
                if (selectedRow == profileRow.profileListBoxRow) {
                    return profileRow;
                }
            }
        }
        return null;
    }

    createProfileRow(profile, isNew) {
        Log.debug('Creating row for ' + (isNew ? 'new ' : '') + 'profile : ' + profile.name);
        const self = this;
        let profileListBoxRowItemBuilder = new Gtk.Builder();
        let profileSettingsGridBuilder = new Gtk.Builder();
        profileListBoxRowItemBuilder.set_translation_domain('proxyprofiles');
        profileSettingsGridBuilder.set_translation_domain('proxyprofiles');

        profileListBoxRowItemBuilder.add_objects_from_file(GLADE_FILE, ['profileListBoxRow']);
        profileSettingsGridBuilder.add_objects_from_file(GLADE_FILE,
            ['PortAdjustmentHttp', 'PortAdjustmentHttps', 'PortAdjustmentFtp', 'PortAdjustmentSocks', 'profileSettingsGrid']);

        let row = {
            uuid: this.generateUUID(),
            isNew,
            isUniqueName: true,

            onProfileModeToggled(radio) {
                if (radio.active) {
                    this.recomputeComponentsSensitive(radio.name);
                }
            },

            recomputeComponentsSensitive(mode) {
                Log.debug('Computing sensibility for mode: ' + mode);
                this.profileHttpLabel.set_sensitive(mode === MANUAL.label);
                this.profileAuthenticationLabel.set_sensitive(mode === MANUAL.label);
                this.profileHttpsLabel.set_sensitive(mode === MANUAL.label);
                this.profileFtpLabel.set_sensitive(mode === MANUAL.label);
                this.profileSocksLabel.set_sensitive(mode === MANUAL.label);
                this.profileIgnoredHostsLabel.set_sensitive(mode === MANUAL.label);
                this.profileHttpHostEntry.set_sensitive(mode === MANUAL.label);
                this.profileHttpsHostEntry.set_sensitive(mode === MANUAL.label);
                this.profileFtpHostEntry.set_sensitive(mode === MANUAL.label);
                this.profileSocksHostEntry.set_sensitive(mode === MANUAL.label);
                this.profileHttpPortEntry.set_sensitive(mode === MANUAL.label);
                this.profileHttpsPortEntry.set_sensitive(mode === MANUAL.label);
                this.profileFtpPortEntry.set_sensitive(mode === MANUAL.label);
                this.profileSocksPortEntry.set_sensitive(mode === MANUAL.label);
                this.profileIgnoredHostsEntry.set_sensitive(mode === MANUAL.label);

                this.profileAutomaticConfigURLLabel.set_sensitive(mode === AUTO.label);
                this.profileAutomaticConfigURLEntry.set_sensitive(mode === AUTO.label);

                this.profileFromCurrentButton.set_sensitive(mode === MANUAL.label || mode === AUTO.label);
                this.profileCancelButton.set_sensitive(mode === MANUAL.label || mode === AUTO.label);
                this.recomputeSaveButtonSensitive(mode);

                if (mode === MANUAL.label) {
                    this.recomputePortSensitive('Http');
                    this.recomputePortSensitive('Https');
                    this.recomputePortSensitive('Ftp');
                    this.recomputePortSensitive('Socks');
                }

                this.recomputeAuthenticationSensitive(mode);
            },

            recomputeSaveButtonSensitive(mode) {
                const authentOk = mode !== MANUAL.label
                    || !this.profileAuthenticationActivateSwitch.active
                    || (this.profileAuthenticationUserEntry.get_text() && this.profileAuthenticationPasswordEntry.get_text());
                const modeOk = (mode === MANUAL.label || mode === AUTO.label);

                this.profileSaveButton.set_sensitive(this.isUniqueName && modeOk && authentOk);

                this.messageLabelText = '';
                if (! modeOk) this.messageLabelText = _('Please choose proxy mode.');
                else if (! this.isUniqueName) this.messageLabelText = _('Profile name must be unique.');
                else if (! authentOk) this.messageLabelText = _('Authentication is not filled correctly.');
                self.messageLabel.set_text(this.messageLabelText);
            },

            recomputePortSensitive(proxyType) {
                Log.debug('Recomputing port sensitive for ' + proxyType);
                const hostEntry = this['profile' + proxyType + 'HostEntry'];
                const portEntry = this['profile' + proxyType + 'PortEntry'];
                if (hostEntry.get_text()) {
                    portEntry.set_sensitive(true);
                    if (! portEntry.get_text()) portEntry.set_text('1');
                } else {
                    portEntry.set_sensitive(false);
                    portEntry.set_text('');
                }
            },

            recomputeAuthenticationSensitive(mode) {
                Log.debug('Recomputing authentication sensitive for ' + mode);
                this.profileAuthenticationActivateSwitch.set_sensitive(mode === MANUAL.label);
                this.profileAuthenticationUserEntry.set_sensitive(
                    mode === MANUAL.label && this.profileAuthenticationActivateSwitch.active);
                this.profileAuthenticationPasswordEntry.set_sensitive(
                    mode === MANUAL.label && this.profileAuthenticationActivateSwitch.active);
            },

            setProfile(profile) {
                this.profile = profile;
                this.fromProfile(profile, true);
            },

            fromProfile(profile, updateProfilesListbox) {
                Log.debug('Loading profile: ' + profile.name);
                if (updateProfilesListbox) this.profileRowNameLabel.set_text(profile.name || _('None'));

                this.profileNameEntry.set_text(profile.name || '');

                if (profile.mode === MANUAL.label) {
                    if (updateProfilesListbox) this.profileRowDetailLabel.set_text('(' + _('Manual') + ')');

                    this.profileModeManualRadio.active = true;
                    this.profileModeAutoRadio.active = false;
                    this.profileModeNoneRadio.active = false;

                    this.profileHttpHostEntry.set_text(profile.httpHost || '');
                    this.profileHttpsHostEntry.set_text(profile.httpsHost || '');
                    this.profileFtpHostEntry.set_text(profile.ftpHost || '');
                    this.profileSocksHostEntry.set_text(profile.socksHost || '');
                    this.profileHttpPortEntry.set_text('' + (profile.httpPort || ''));
                    this.profileHttpsPortEntry.set_text('' + (profile.httpsPort || ''));
                    this.profileFtpPortEntry.set_text('' + (profile.ftpPort || ''));
                    this.profileSocksPortEntry.set_text('' + (profile.socksPort || ''));
                    this.profileIgnoredHostsEntry.set_text(profile.ignored || '');

                    this.profileAuthenticationActivateSwitch.active = profile.httpUseAuthentication || false;
                    this.profileAuthenticationUserEntry.set_text(profile.httpAuthenticationUser || '');
                    this.profileAuthenticationPasswordEntry.set_text(profile.httpAuthenticationPassword || '');

                    this.profileAutomaticConfigURLEntry.set_text('');
                } else if (profile.mode === AUTO.label) {
                    if (updateProfilesListbox) this.profileRowDetailLabel.set_text('(' + _('Automatic') + ')');

                    this.profileModeAutoRadio.active = true;
                    this.profileModeManualRadio.active = false;
                    this.profileModeNoneRadio.active = false;

                    this.profileHttpHostEntry.set_text('');
                    this.profileHttpsHostEntry.set_text('');
                    this.profileFtpHostEntry.set_text('');
                    this.profileSocksHostEntry.set_text('');
                    this.profileHttpPortEntry.set_text('');
                    this.profileHttpsPortEntry.set_text('');
                    this.profileFtpPortEntry.set_text('');
                    this.profileSocksPortEntry.set_text('');
                    this.profileIgnoredHostsEntry.set_text('');

                    this.profileAuthenticationActivateSwitch.active = false;
                    this.profileAuthenticationUserEntry.set_text('');
                    this.profileAuthenticationPasswordEntry.set_text('');

                    this.profileAutomaticConfigURLEntry.set_text(profile.autoConfigUrl || '');
                } else {
                    this.profileModeNoneRadio.active = true;
                    this.profileModeAutoRadio.active = false;
                    this.profileModeManualRadio.active = false;
                }

                this.recomputeComponentsSensitive(profile.mode);
            },

            toProfile(updateInternalProfile) {
                const profile = updateInternalProfile ? this.profile : {};
                profile.name = this.profileNameEntry.get_text();
                if (this.profileModeManualRadio.active) {
                    profile.mode = MANUAL.label;

                    profile.httpHost = this.profileHttpHostEntry.get_text();
                    profile.httpsHost = this.profileHttpsHostEntry.get_text();
                    profile.ftpHost =  this.profileFtpHostEntry.get_text();
                    profile.socksHost = this.profileSocksHostEntry.get_text();
                    profile.httpPort = this.profileHttpPortEntry.get_text();
                    profile.httpsPort = this.profileHttpsPortEntry.get_text();
                    profile.ftpPort = this.profileFtpPortEntry.get_text();
                    profile.socksPort = this.profileSocksPortEntry.get_text();
                    profile.ignored = this.profileIgnoredHostsEntry.get_text();

                    profile.httpUseAuthentication = this.profileAuthenticationActivateSwitch.active;
                    profile.httpAuthenticationUser = this.profileAuthenticationUserEntry.get_text();
                    profile.httpAuthenticationPassword = this.profileAuthenticationPasswordEntry.get_text();

                    delete profile.autoConfigUrl;
                }
                if (this.profileModeAutoRadio.active) {
                    profile.mode = AUTO.label;

                    delete profile.httpHost;
                    delete profile.httpsHost;
                    delete profile.ftpHost;
                    delete profile.socksHost;
                    delete profile.httpPort;
                    delete profile.httpsPort;
                    delete profile.ftpPort;
                    delete profile.socksPort;
                    delete profile.ignored;

                    delete profile.httpUseAuthentication;
                    delete profile.httpAuthenticationUser;
                    delete profile.httpAuthenticationPassword;

                    profile.autoConfigUrl = this.profileAutomaticConfigURLEntry.get_text();
                }

                return profile;
            },

            onProfileFromCurrentButtonClicked() {
                Log.debug('Retrieving current configuration to profile ' + this.profile.name);
                const savedName = this.profileNameEntry.get_text();
                let mode = NONE.label;
                if (this.profileModeManualRadio.active) mode = MANUAL.label;
                if (this.profileModeAutoRadio.active) mode = AUTO.label;
                
                this.fromProfile(self.config.generateProfile(this.profile.name, mode), false);
                this.profileNameEntry.set_text(savedName);
            },

            onProfileCancelButtonClicked() {
                Log.debug('Cancel profile modifications ' + this.profile.name);
                this.fromProfile(this.profile, false);
            },

            onProfileSaveButtonClicked() {
                Log.debug('Save profile modifications ' + this.profile.name);
                this.toProfile(true);
                if (this.isNew) {
                    self.newProfileRows.splice(self.newProfileRows.indexOf(this), 1);
                    self.profileRows.push(this);
                }
                self.config.saveProfile(this.profile);
            },

            onHostChanged(hostEntry) {
                this.recomputePortSensitive(hostEntry.name);
            },

            onProfileNameEntryChanged() {
                self.recomputeNamesDuplicates();
            },

            onAuthenticationActivateSwitchToggled() {
                Log.debug('Switched authentication mode for ' + this.profile.name);
                this.recomputeAuthenticationSensitive(MANUAL.label);
                this.recomputeSaveButtonSensitive(MANUAL.label);
            },

            onProfileAuthenticationUserEntryChanged() {
                this.recomputeSaveButtonSensitive(MANUAL.label);
            },

            onProfileAuthenticationPasswordEntryChanged() {
                this.recomputeSaveButtonSensitive(MANUAL.label);
            },

            getSelectedMode() {
                if (this.profileModeManualRadio.active) return this.profileModeManualRadio.name;
                if (this.profileModeAutoRadio.active) return this.profileModeAutoRadio.name;
                if (this.profileModeNoneRadio.active) return this.profileModeNoneRadio.name;
            }
        };

        this.loadWidgets(row, profileListBoxRowItemBuilder, [
            'profileListBoxRow',
            'profileRowNameLabel',
            'profileRowDetailLabel'
        ]);

        this.loadWidgets(row, profileSettingsGridBuilder, [
            'profileSettingsGrid',
            'profileNameEntry',
            'profileModeManualRadio',
            'profileModeAutoRadio',
            'profileModeNoneRadio',
            'profileHttpLabel',
            'profileAuthenticationLabel',
            'profileHttpsLabel',
            'profileFtpLabel',
            'profileSocksLabel',
            'profileIgnoredHostsLabel',
            'profileAutomaticConfigURLLabel',
            'profileHttpHostEntry',
            'profileHttpsHostEntry',
            'profileFtpHostEntry',
            'profileSocksHostEntry',
            'profileHttpPortEntry',
            'profileHttpsPortEntry',
            'profileFtpPortEntry',
            'profileSocksPortEntry',
            'profileIgnoredHostsEntry',
            'profileAutomaticConfigURLEntry',
            'profileAuthenticationActivateSwitch',
            'profileAuthenticationUserEntry',
            'profileAuthenticationPasswordEntry',
            'profileFromCurrentButton',
            'profileCancelButton',
            'profileSaveButton'
        ]);

        row.setProfile(profile);
        if (isNew) this.newProfileRows.push(row);
        else this.profileRows.push(row);
        this.profilesListBox.add(row.profileListBoxRow);
        this.profileStack.add_named(row.profileSettingsGrid, row.uuid);

        // After config loaded, connect the events
        profileSettingsGridBuilder.connect_signals_full((builder, object, signal, handler) => {
            object.connect(signal, row[handler].bind(row));
        });

        return row;
    }

    recomputeNamesDuplicates() {
        Log.debug('Recomputing duplicated rows.')
        const rowNames = {};

        const upd = function(rows) {
            for (let row of rows) {
                const name = row.profileNameEntry.get_text();
                if (rowNames[name]) {
                    row.isUniqueName = ! row.isNew && rowNames[name].isNew;
                    rowNames[name].isUniqueName = ! rowNames[name].isNew && row.isNew;
                } else {
                    row.isUniqueName = true;
                    rowNames[name] = row;
                }
            }
        }.bind(this);

        upd(this.profileRows);
        upd(this.newProfileRows);

        this.profileRows.forEach(row => row.recomputeSaveButtonSensitive(row.getSelectedMode()));
        this.newProfileRows.forEach(row => row.recomputeSaveButtonSensitive(row.getSelectedMode()));
    }

    // 32bit random number without 0
    generateUUID() {
        return Math.floor(1 + Math.random() * 0xFFFFFFFE).toString();
    }
}