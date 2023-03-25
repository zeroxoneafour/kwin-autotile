# faq

## getting journalctl output
To file a bug report (not a feature request), if possible, you need a journalctl log. This log can be obtained by -

1. Enabling debug mode in the settings
2. Restarting KWin (usually done by logging out and back in)
3. Recreating the problematic action
4. Executing the command `journalctl --user --no-pager -e | grep "Autotile DBG"` in a terminal

In the not-so-distant future, these logs will be _required_ to submit a bug report. Any bug reports without them **will not be evaluated**.

## this problem is happening...

### ...windows are not tiling
* If your preset layout (Meta-T by default to set) is already full of windows, new ones will not be tiled and will usually appear above
* If the windows is in your blacklist or a pop-up window, by default it will not be tiled
* If the whitelist option is checked in settings, then only windows in your blacklist will be tiled

### ...I cannot move windows with my mouse back into tiles
Hold the shift key while moving them, like how KWin does it.

### ...keyboard shortcuts are not working
Check that you have them assigned in systemsettings. If you do, make sure no applications are overriding them. Make sure to restart KWin after configuring these.

### ...<issue with screens>
You need to provide as much information as possible when filling out a bug report, as I do not have multiple screens to test on.

## explanation of settings
All settings need a restart of KWin to apply!

### whitelist (check box)
This checkbox turns the blacklist into a whitelist, and blacklists all other windows. If your windows are not tiling, this is something to disable first.

### blacklist (line edit)
A list of windows to not tile (or if whitelist is checked, the only windows that will tile).

### tile popup windows (check box)
If enabled, certain supported popups will be tiled.

### border settings (dropdown)
Configures how borders around windows should be set up.

### invert insertion (check box)
Windows will be inserted (by default) to the right instead of to the left, keeping the first window in its original place.

### keep tiled below (check box)
Tiled windows will be kept below other windows.

### debug mode (check box)
This will print debug messages every time an action is performed.
