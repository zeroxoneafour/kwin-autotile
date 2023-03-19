# autotile
Autotiling for KWin using heavy inspiration from [kwin-tiling-scripts](https://invent.kde.org/mart/kwin-tiling-scripts).

## features
* Works more or less fully in X11 and Wayland Plasma 5.27 and up
* Manage layouts via the integrated KWin GUI
* Send your windows to other virtual desktops while tiled
* Move your windows around, and automatically untile/retile them when moving (doesn't work unless tile you are moving into can be binary split)
* Keybinds to select and move your windows around
* If you close your eyes and imagine, then it can be as good as Bismuth

## limitations/bugs
* Requires binary-split tiles (if your tiles were put in a tree, they would be a binary tree). If you don't know what this means, you're probably fine but don't use layouts that split in 3
* More than 1 window in a single tile will cause untested and most likely undesireable behavior
* Completely untested with multiple screens (I don't have multiple screens)

## contributing
Please do! I have very little time to maintain this script as much as it needs to be. There are many bugs that render it more-or-less unuseable (cut down to less, but still there).

I will try to be active on the Github for this project, to point out issues and such.

## building
Run `make` and then `make install`.

## license
MIT licensed, do whatever with credit given
