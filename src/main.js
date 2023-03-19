let debug;
let useWhitelist;
let blacklist;
let tileDialogs;
let borders;
let blacklistCache;

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
    blacklistCache = new Set();
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
    if (client.fullscreen || !client.moveable || !client.resizeable) {
        return false;
    }
    // check for the client type
    if (!(client.normalWindow || ((client.dialog || client.popupWindow || client.transient) && tileDialogs))) {
        return false;
    }
    let c = client.resourceClass.toString();
    // check if client is in blacklist cache (to save time)
    if (blacklistCache.has(c)) {
        return useWhitelist;
    }
    // check if client is black/whitelisted
    for (i of blacklist) {
        if (c.includes(i) || i.includes(c)) {
            blacklistCache.add(c);
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
    if (!client.wasTiled) {
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

let desktopChange = function(client, desktop) {
    printDebug("Desktop changed on " + client.resourceClass + " from desktop " + desktop, false);
    client.oldDesktop = desktop;
    if (client.wasTiled) {
        untileClient(client);
        tileClient(client);
    }
}

let geometryChange = function(client, _oldgeometry) {
    // if removed from tile
    if (client.wasTiled && client.tile == null) {
        printDebug(client.resourceClass + " was moved out of a tile");
        untileClient(client);
        client.wasTiled = false;
        return;
    }
    // if added to tile
    if (client.tile != null && !client.wasTiled) {
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
function tileClient(client) {
    // have to put this here so that there won't be a race condition between geometryChange and any function that also calls this
    client.wasTiled = true;
    let rootTile = workspace.tilingForScreen(client.screen).rootTile;
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
        if (client.hasBeenTiled == undefined) {
            client.frameGeometryChanged.connect(geometryChange);
            client.desktopPresenceChanged.connect(desktopChange);
            client.hasBeenTiled = true;
        }
    } else {
        client.wasTiled = false;
    }
}

let addClient = function(client) {
    if (doTileClient(client)) {
        printDebug("Tiling client " + client.resourceClass, false);
        tileClient(client);
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

// client minimized and maximized
let clientMinimized = function(client) {
    if (client.wasTiled) {
        printDebug("Client " + client.resourceClass + " minimized", false);
        untileClient(client);
        client.wasTiled = true;
    }
};
let clientUnminimized = function(client) {
    if (client.wasTiled) {
        printDebug("Client " + client.resourceClass + " unminimized", false);
        tileClient(client);
    }
};

// special stuff to untile fullscreen clients
let clientFullScreen = function(client, fullscreen, _user) {
    if (fullscreen) {
        client.keepBelow = false;
        client.keepAbove = true;
    } else {
        client.keepAbove = false;
        if (client.wasTiled) {
            client.keepBelow = true;
        }
    }
}

workspace.clientAdded.connect(addClient);
workspace.clientRemoved.connect(removeClient);
workspace.clientActivated.connect(clientActivated);
workspace.clientMinimized.connect(clientMinimized);
workspace.clientUnminimized.connect(clientUnminimized);
workspace.clientFullScreenSet.connect(clientFullScreen);
