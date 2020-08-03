'use strict';

let _debugActivated = false;
let _prefix = '';

var Log = class Log {
    static setActivateDebug(activated) {
        _debugActivated = activated;
    }
    static setPrefix(prefix) {
        _prefix = prefix;
    }

    static debug(msg) {
        if (_debugActivated) this.log('[debug] ' + msg);
    }

    static log(msg) {
        log('[ProxyProfiles] ' + _prefix + msg);
    }
}
