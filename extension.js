/*
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const ProxyProfiles = Me.imports.impl.proxyProfiles.ProxyProfiles;
const Log = Me.imports.impl.log.Log;
const Convenience = Me.imports.impl.convenience;

let instance;

function enable() {
    Log.setPrefix('[extension] ');
    Log.log(`Enabling ${Me.metadata.name} version ${Me.metadata.version}`);
    instance = new ProxyProfiles();
}

function disable() {
    Log.log(`Disabling ${Me.metadata.name} version ${Me.metadata.version}`);
    if (instance != null) instance.destroy();
    instance = null;
}

function init() {
    Log.log(`Initializing ${Me.metadata.name} version ${Me.metadata.version}`);
    Convenience.initTranslations();
}
