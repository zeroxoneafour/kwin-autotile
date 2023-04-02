// config options
let debug;
let useWhitelist;
let blacklist;
let tilePopups;
let borders;
let invertInsertion;
let insertMethod;
let keepTiledBelow;
let keepFullscreenAbove;

// caches of stuff to make operations faster
let blacklistCache;
let bottomTileCache = new Map();

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
    blacklist = readConfig("Blacklist", "krunner, yakuake, kded, polkit").split(',').map(x => x.trim());
    tilePopups = readConfig("TilePopups", false);
    borders = readConfig("Borders", 1);
    invertInsertion = readConfig("InvertInsertion", true);
    insertMethod = readConfig("InsertMethod", 0);
    keepTiledBelow = readConfig("KeepTiledBelow", true);
    keepFullscreenAbove = readConfig("KeepFullscreenAbove", true);
    blacklistCache = new Set();
    printDebug("Config Updated", false)
    printDebug("useWhitelist == " + useWhitelist, false);
    printDebug("blacklist == " + blacklist, false);
    printDebug("tilePopups == " + tilePopups, false);
    printDebug("borders == " + borders, false);
    printDebug("invertInsertion == " + invertInsertion, false);
    printDebug("insertMethod == " + insertMethod, false);
    printDebug("keepTiledBelow == " + keepTiledBelow, false);
    printDebug("keepFullscreenAbove == " + keepFullscreenAbove, false);
}

updateConfig();
options.configChanged.connect(updateConfig);

// whether to ignore a client or not
function doTileClient(client) {
    // if the client is not movable, dont bother
    if (client.fullscreen || !client.moveable || !client.resizeable) {
        return false;
    }
    // check if client is a popup window or transient (placeholder window)
    if ((client.popupWindow || client.transient) && !tilePopups) {
        return false;
    }
    // check if client is a dock or something
    if (client.specialWindow) {
        return false;
    }
    let c = client.resourceClass.toString();
    // check if client is in blacklist cache (to save time)
    if (blacklistCache.has(c)) {
        return useWhitelist;
    }
    // check if client is black/whitelisted
    for (const i of blacklist) {
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
    for (let w of tile.windows) {
        if (w.desktop == desktop || w.desktop == -1) {
            ret.push(w);
        }
    }
    return ret;
}

// forcibly sets tile, for use almost exclusively with putClientInTile
function setTile(client, tile) {
    client.tile = tile;
    client.oldTile = tile;
    client.wasTiled = true;
    client.oldDesktop = client.desktop;
    if (keepTiledBelow) {
        client.keepBelow = true;
    }
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
        for (let w of windowsOnDesktop(parent, client.desktop)) {
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
            for (let w of windows) {
                setTile(w, parent);
            }
        } else {
            // get the shallowest no split window and bring it up to fill the gap
            let stack = [sibling];
            mainloop: while (stack.length > 0) {
                let stackNext = [];
                // indent over 9000
                for (const t of stack) {
                    // try to find binary-split window
                    if (t.tiles.length == 2) {
                        let t0;
                        if (invertInsertion) {
                            t0 = t.tiles[1];
                        } else {
                            t0 = t.tiles[0];
                        }
                        let t1;
                        if (invertInsertion) {
                            t1 = t.tiles[0];
                        } else {
                            t1 = t.tiles[1];
                        }
                        let t0_windows = windowsOnDesktop(t0, client.oldDesktop);
                        let t1_windows = windowsOnDesktop(t1, client.oldDesktop);
                        if (t0_windows.length != 0 && t1_windows.length != 0) {
                            // move windows from one tile to fill in gap
                            for (let w of t0_windows) {
                                setTile(w, client.oldTile);
                            }
                            // move windows in other tile to fill in gap created from moving original windows
                            for (let w of t1_windows) {
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
    if (keepTiledBelow) {
        client.keepBelow = false;
    }
    if (borders == 1 || borders == 2) {
        client.noBorder = false;
    }
}

let desktopChange = function(client, _desktop) {
    printDebug("Desktop changed on " + client.resourceClass + " from desktop " + client.oldDesktop, false);
    if (client.wasTiled) {
        untileClient(client);
        tileClient(client);
    }
}

let screenChange = function() {
    let client = this;
    printDebug("Screen changed on " + client.resourceClass, false);
    if (client.wasTiled) {
        untileClient(client);
        tileClient(client);
    }
}

let geometryChange = function(client, _oldgeometry) {
    // if removed from tile
    if (client.wasTiled && client.tile == null) {
        printDebug(client.resourceClass + " was moved out of a tile", false);
        untileClient(client);
        client.wasTiled = false;
        return;
    }
    // if added to tile
    if (client.tile != null && !client.wasTiled) {
        let tile = client.tile;
        // 1 because of self window
        if (windowsOnDesktop(tile, client.desktop).length > 1) {
            // if the tile already has windows, then just swap their positions
            printDebug(client.resourceClass + " was moved back into a tile with windows", false);
            for (let w of windowsOnDesktop(tile, client.desktop)) {
                if (w != client) {
                    putClientInTile(w, client.oldTile);
                }
            }
            setTile(client, tile);
        } else {
            // find a tile with a parent that has windows so we can insert it
            printDebug(client.resourceClass + " was moved back into a tile without windows", false);
            while (tile.parent != undefined && windowsOnDesktop(tile.parent, client.desktop).length == 0) {
                tile = tile.parent;
            }
            putClientInTile(client, tile);
        }
    }
}

function findTileBreadthFirst(client) {
    let rootTile = workspace.tilingForScreen(client.screen).rootTile;
    let targetTile = null;
    let stack = [rootTile];
    // we need to check if any tiles at all have windows so if they dont we can place the client on the root window
    let hasWindows = false;
    mainloop: while (stack.length != 0) {
        let stackNext = [];
        for (const t of stack) {
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
            // tell the user they're wrong if they have invalid tile configuration
            if (!(t.tiles.length == 0 || t.tiles.length == 2)) {
                printDebug("Invalid tile configuration, " + t.tiles.length + " tiles detected", true);
            }
            // check if there is only one window and the tile is binary-splittable
            if (t_windows.length != 0 && t.tiles.length == 2) {
                // if the insertion order is inverted, windows will be pushed to the back instead of the front
                if (invertInsertion) {
                    targetTile = t.tiles[1];
                } else {
                    targetTile = t.tiles[0];
                }
                break mainloop;
            }
            stackNext = stackNext.concat(t.tiles);
        }
        stack = stackNext;
    }
    if (!hasWindows) {
        targetTile = rootTile;
    }
    return targetTile;
}
// use bind and bind this to the screen of the root tile
function buildBottomTileCache(rootTile) {
    printDebug("Building bottom tile cache for root tile " + rootTile, false);
    let bottomTiles = [];
    // finds all the bottom tiles (tiles with no children)
    let stack = [rootTile];
    // this gets to be so small because most code is in the putClientInTile function
    while (stack.length != 0) {
        let stackNext = [];
        for (const t of stack) {
            if (t.tiles.length == 0) {
                bottomTiles.push(t);
            } else {
                stackNext = stackNext.concat(t.tiles);
            }
        }
        stack = stackNext;
    }
    bottomTileCache.set(rootTile, bottomTiles);
}
function findTileBottomUp(client) {
    let rootTile = workspace.tilingForScreen(client.screen).rootTile;
    // use array constructor to avoid reference
    let bottomTiles = Array.from(bottomTileCache.get(rootTile));
    if (invertInsertion) {
        bottomTiles.reverse();
    }
    let tile = null;
    for (const t of bottomTiles) {
        if (windowsOnDesktop(t, client.desktop).length == 0) {
            tile = t;
            break;
        }
    }
    if (tile != null) {
        while (tile.parent != undefined && windowsOnDesktop(tile.parent, client.desktop).length == 0) {
            tile = tile.parent;
        }
    }
    return tile;
}

// add a client to the root tile, splitting tiles if needed
function tileClient(client) {
    // have to put this here so that there won't be a race condition between geometryChange and any function that also calls this
    client.wasTiled = true;
    let targetTile;
    switch (insertMethod) {
        case 0: {
            targetTile = findTileBreadthFirst(client);
            break;
        }
        case 1: {
            let rootTile = workspace.tilingForScreen(client.screen).rootTile;
            if (bottomTileCache.get(rootTile) == undefined) {
                buildBottomTileCache(rootTile); // to set local "this" to the screen
                // for future layout changes
                rootTile.layoutModified.connect(buildBottomTileCache.bind(this, rootTile));
            }
            targetTile = findTileBottomUp(client);
            break;
        }
        default: printDebug("Invalid insertion method", true);
    }
    if (targetTile != null) {
        putClientInTile(client, targetTile);
    } else {
        client.wasTiled = false;
    }
    if (client.hasBeenTiled == undefined) {
        client.frameGeometryChanged.connect(geometryChange);
        client.desktopPresenceChanged.connect(desktopChange);
        client.screenChanged.connect(screenChange.bind(client));
        client.hasBeenTiled = true;
    }
}

let addClient = function(client) {
    if (doTileClient(client)) {
        printDebug("Tiling client " + client.resourceClass + " on screen " + client.screen, false);
        tileClient(client);
    }
    if (borders == 0) {
        client.noBorder = true;
    }
}

let removeClient = function(client) {
    if (client.tile != null) {
        printDebug("Removing client " + client.resourceClass + " from screen " + client.screen, false);
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
        // if tile can be split, put window back in its original place
        if (client.oldTile.parent != undefined && windowsOnDesktop(client.oldTile.parent, client.desktop).length != 0) {
            putClientInTile(client, client.oldTile);
        } else {
            tileClient(client);
        }
    }
};

// special stuff to untile fullscreen clients
let clientFullScreen = function(client, fullscreen, _user) {
    if (!fullscreen && client.wasTiled) {
        if (keepFullscreenAbove) {
            client.keepAbove = false;
        }
        if (keepTiledBelow) {
            client.keepBelow = true;
        }
    }
    if (fullscreen && client.wasTiled) {
        if (keepTiledBelow) {
            client.keepBelow = false;
        }
        if (keepFullscreenAbove) {
            client.keepAbove = true;
        }
    }
}

workspace.clientAdded.connect(addClient);
workspace.clientRemoved.connect(removeClient);
workspace.clientActivated.connect(clientActivated);
workspace.clientMinimized.connect(clientMinimized);
workspace.clientUnminimized.connect(clientUnminimized);
workspace.clientFullScreenSet.connect(clientFullScreen);
