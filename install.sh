#!/bin/sh

EXT_UUID='proxyprofiles@massamany.github.com'

gnome-extensions pack --extra-source=proxyprofiles.glade --extra-source=impl --extra-source=locale --extra-source=icons -f
gnome-extensions disable ${EXT_UUID}
gnome-extensions uninstall ${EXT_UUID}
#gnome-extensions install "${EXT_UUID}.shell-extension.zip" -f
gnome-extensions install proxyprofiles@massamany.github.com.shell-extension.zip -f
#gnome-extensions reset ${EXT_UUID}
#gnome-extensions enable ${EXT_UUID}

# ll ~/.local/share/gnome-shell/extensions/ | grep proxy
#gnome-extensions list | grep proxy

#gnome-extensions show ${EXT_UUID}

#journalctl /usr/bin/gnome-shell -f

#journalctl /usr/bin/gjs -f

echo "Restarting GNOME Shell..."
dbus-send --session --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:"global.reexec_self();"
