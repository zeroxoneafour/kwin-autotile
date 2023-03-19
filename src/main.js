let debug;
let useWhitelist;
let blacklist;
let tileDialogs;
let borders;

function printDebug(str, isError) {
    if (isError) {
        print("Autotile ERR: " + str);
    } else if (debug) {
        print("Autotile DBG: " + str);
    }
}

let updateConfig = function() {
    debug = readConfig("Debug", false);
    useWhitelist = readConfig("UseWhitelist", false);
    blacklist = readConfig("Blacklist", "krunner,yakuake").split(',').map(x => x.trim());
    tileDialogs = readConfig("TileDialogs", false);
    borders = readConfig("Borders", 1);
    printDebug("Config Updated", false)
    printDebug("useWhitelist == " + useWhitelist, false);
    printDebug("blacklist == " + blacklist, false);
    printDebug("tileDialogs == " + tileDialogs, false);
    printDebug("borders == " + borders, false);
}

updateConfig();
options.configChanged.connect(updateConfig);

// whether to ignore a client or not
function doTileClient(client) {
    // if the client is not movable, dont bother
    if (client.transient || !client.moveable || !client.resizeable) {
        return false;
    }
    // check for the client type
    if (!(client.normalWindow || ((client.dialog || client.popupWindow) && tileDialogs))) {
        return false;
    }
    // check if client is black/whitelisted
    for (i of blacklist) {
        if (client.resourceClass.toString().includes(i) || i.includes(client.resourceClass.toString())) {
            return useWhitelist;
        }
    }
    return !useWhitelist;
}

// gets windows on desktop because tiles share windows across several desktops
function windowsOnDesktop(tile, desktop) {
    let ret = [];
    for (w of tile.windows) {
        if (w.desktop == desktop || w.desktop == -1) {
            ret.push(w);
        }
    }
    return ret;
}

// forcibly sets tile, for use almost exclusively with putClientInTile
function setTile(client, tile) {
    client.tile = null;
    client.tile = tile;
    client.oldTile = tile;
    client.wasTiled = true;
    client.keepBelow = true;
    client.oldDesktop = client.desktop;
    if (borders == 1 || borders == 2) {
        client.noBorder = true;
    }
}

// sets tile and moves things around a bit if needed
function putClientInTile(client, tile) {
    // case for non-root tiles
    if (tile.parent != undefined) {
        let parent = tile.parent;
        let sibling;
        if (tile == parent.tiles[0]) {
            sibling = parent.tiles[1];
        } else {
            sibling = parent.tiles[0];
        }
        for (w of windowsOnDesktop(parent, client.desktop)) {
            setTile(w, sibling);
        }
    }
    setTile(client, tile);
}

// untile a client (ill refactor this later)
function untileClient(client) {
    if (client.wasTiled == false) {
        return;
    }
    // if root tile then make sure the loop doesnt fail
    if (client.oldTile.parent != undefined) {
        let parent = client.oldTile.parent;
        let sibling;
        // get the parent and merge its child tile's window back into the parent to fill empty space
        if (client.oldTile == parent.tiles[0]) {
            sibling = parent.tiles[1];
        } else {
            sibling = parent.tiles[0];
        }
        // only use windows on our virtual desktop
        let windows = windowsOnDesktop(sibling, client.oldDesktop);
        if (windows.length != 0) {
            for (w of windows) {
                setTile(w, parent);
            }
        } else {
            // get the shallowest no split window and bring it up to fill the gap
            let stack = [sibling];
            mainloop: while (stack.length > 0) {
                let stackNext = [];
                // indent over 9000
                for (t of stack) {
                    // try to find binary-split window
                    if (t.tiles.length == 2) {
                        let t0 = t.tiles[0];
                        let t0_windows = windowsOnDesktop(t0, client.oldDesktop);
                        let t1 = t.tiles[1];
                        let t1_windows = windowsOnDesktop(t1, client.oldDesktop);
                        if (t0_windows.length != 0 && t1_windows.length != 0) {
                            // move windows from one tile to fill in gap
                            for (w of t0_windows) {
                                setTile(w, client.oldTile);
                            }
                            // move windows in other tile to fill in gap created from moving original windows
                            for (w of t1_windows) {
                                setTile(w, t);
                            }
                            break mainloop;
                        }
                    }
                    stackNext = stackNext.concat(t.tiles);
                }
                stack = stackNext;
            }
        }
    }
    client.oldDesktop = client.desktop;
    client.wasTiled = false;
    client.tile = null;
    client.keepBelow = false;
    if (borders == 1 || borders == 2) {
        client.noBorder = false;
    }
}

let desktopChange = function(client, _desktop) {
    printDebug("Desktop changed on " + client.resourceClass, false);
    untileClient(client);
    tileClient(client, workspace.tilingForScreen(client.screen).rootTile);
}

let geometryChange = function(client, _oldgeometry) {
    // if removed from tile
    if (client.wasTiled == true && client.tile == null) {
        printDebug(client.resourceClass + " was moved out of a tile");
        untileClient(client);
        return;
    }
    // if added to tile
    if (client.tile != null && client.wasTiled == false) {
        printDebug(client.resourceClass + " was moved back into a tile");
        // move old windows in tile to other clients old tile
        for (w of windowsOnDesktop(client.tile, client.desktop)) {
            if (w != client) {
                putClientInTile(w, client.oldTile);
            }
        }
        putClientInTile(client, w.tile);
    }
}

// add a client to the root tile, splitting tiles if needed
function tileClient(client, rootTile) {
    if (client.hasBeenTiled == undefined) {
        client.frameGeometryChanged.connect(geometryChange);
        client.desktopPresenceChanged.connect(desktopChange);
        client.hasBeenTiled = true;
    }
    let targetTile = null;
    let stack = [rootTile];
    // we need to check if any tiles at all have windows so if they dont we can place the client on the root window
    let hasWindows = false;
    // breadth-first search for open tiles, starting at the root tile and working progressively smaller
    // works kind of i guess? dont try with more than ~5-6 tiles
    mainloop: while (stack.length != 0) {
        let stackNext = [];
        for (t of stack) {
            // have to separate windows by virtual desktop because tiling affects on screen basis
            let t_windows = windowsOnDesktop(t, client.desktop);
            // see has_windows comment
            if (!(hasWindows) && t_windows.length != 0) {
                hasWindows = true;
            }
            // check if there are no windows or child tiles
            if (t_windows.length == 0 && t.tiles.length == 0) {
                targetTile = t;
                break mainloop;
            }
            // check if there is only one window and the tile is binary-splittable
            if (t_windows.length != 0 && t.tiles.length == 2) {
                targetTile = t.tiles[0];
                break mainloop;
            }
            stackNext = stackNext.concat(t.tiles);
        }
        stack = stackNext;
    }
    // if there are no windows on the page, set tile to the root tile
    if (!hasWindows) {
        targetTile = rootTile;
    }
    if (targetTile != null) {
        putClientInTile(client, targetTile);
    }
}

let addClient = function(client) {
    if (doTileClient(client)) {
        printDebug("Tiling client " + client.resourceClass, false);
        tileClient(client, workspace.tilingForScreen(client.screen).rootTile);
    }
    if (borders == 0) {
        client.noBorder = true;
    }
}

let removeClient = function(client) {
    if (client.tile != null) {
        printDebug("Removing client " + client.resourceClass, false);
        untileClient(client, client.desktop);
    }
}

// keybind for untiling/retiling windows
let retileWindow = function() {
    let client = workspace.activeClient;
    if (client.tile != null) {
        printDebug("Untiling client " + client.resourceClass, false);
        untileClient(client);
    } else {
        client.wasTiled = true; // have to put this here to make sure geometryChange is not called before retiling
        printDebug("Retiling client " + client.resourceClass, false);
        tileClient(client, workspace.tilingForScreen(client.screen).rootTile);
    }
}

// border stuff (github issue #1)
let clientActivated = function(client) {
    // for setting borders for the last active client to off when new one is activated
    if (workspace.lastActiveClient != null && workspace.lastActiveClient != undefined) {
        if (borders == 2) {
            workspace.lastActiveClient.noBorder = true;
        }
    }
    workspace.lastActiveClient = client;
    if (borders == 2 && client.tile != null) {
        client.noBorder = false;
    }
}

// maybe someday we will be able to freely tile clients, idk
workspace.clientAdded.connect(addClient);
workspace.clientRemoved.connect(removeClient);
workspace.clientActivated.connect(clientActivated);
registerShortcut("RetileWindow", "Autotile: Untile/Retile Window", "Meta+Shift+Space", retileWindow);
