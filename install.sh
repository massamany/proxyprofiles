#!/bin/sh

echo "Installing extension..."
gnome-extensions pack --extra-source=proxyprofiles.glade --extra-source=impl --extra-source=locale --extra-source=icons -f
gnome-extensions install proxyprofiles@massamany.github.com.shell-extension.zip -f
gnome-extensions enable proxyprofiles@massamany.github.com

echo "Restarting GNOME Shell..."
dbus-send --session --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:"global.reexec_self();"

# To see execution logs
#journalctl /usr/bin/gnome-shell -f
#journalctl /usr/bin/gjs -f
