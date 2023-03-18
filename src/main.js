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

// TODO: make tiling work when window is removed in certain scenarios
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
        for (w of windowsOnDesktop(sibling, client.oldDesktop)) {
            w.tile = parent;
        }
    }
    client.oldDesktop = client.desktop;
    client.wasTiled = false;
    client.tile = null;
    client.keepBelow = false;
}

let desktopChange = function(client, _desktop) {
    printDebug("Desktop changed on " + client.resourceClass, false);
    untileClient(client);
    tileClient(client, workspace.tilingForScreen(client.screen).rootTile);
}

let geometryChange = function(client, _oldgeometry) {
    printDebug("Geometry changed on " + client.resourceClass, false);
    // if removed from tile
    if (client.wasTiled == true && client.tile == null) {
        untileClient(client);
        return;
    }
    // if added to tile
    if (client.tile != null && client.wasTiled == false) {
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
    let tilesToCheck = [rootTile];
    // we need to check if any tiles at all have windows so if they dont we can place the client on the root window
    let has_windows = false;
    // breadth-first search for open tiles, starting at the root tile and working progressively smaller
    // works kind of i guess? dont try with more than ~5-6 tiles
    mainloop: while (tilesToCheck.length != 0) {
        let tilesToCheckNext = [];
        for (i of tilesToCheck) {
            // have to separate windows by virtual desktop because tiling affects on screen basis
            let i_windows = windowsOnDesktop(i, client.desktop);
            // see has_windows comment
            if (!(has_windows) && i_windows.length != 0) {
                has_windows = true;
            }
            // check if there are no windows or child tiles
            if (i_windows.length == 0 && i.tiles.length == 0) {
                targetTile = i;
                break mainloop;
            }
            // check if there is only one window and the tile is binary-splittable
            if (i_windows.length != 0 && i.tiles.length == 2) {
                targetTile = i.tiles[0];
                break mainloop;
            }
            tilesToCheckNext = tilesToCheckNext.concat(i.tiles);
        }
        tilesToCheck = tilesToCheckNext;
    }
    // if there are no windows on the page, set tile to the root tile
    if (!has_windows) {
        targetTile = rootTile;
    }
    if (targetTile != null) {
        putClientInTile(client, targetTile);
    }
}

let add_client = function(client) {
    printDebug("Adding client " + client.resourceClass, false);
    if (doTileClient(client)) {
        printDebug("Tiling client", false);
        tileClient(client, workspace.tilingForScreen(client.screen).rootTile);
    } else {
        printDebug("Not tiling client", false);
    }
}

let removeClient = function(client) {
    printDebug("Removing client " + client.resourceClass, false);
    if (doTileClient(client)) {
        printDebug("Untiling client", false);
        untileClient(client, client.desktop);
    } else {
        printDebug("Not changing client", false);
    }
}

// keybind for untiling/retiling windows
let retileWindow = function() {
    let client = workspace.activeClient;
    if (client.tile == null) {
        tileClient(client, workspace.tilingForScreen(client.screen).rootTile);
    } else {
        untileClient(client);
    }
}

// maybe someday we will be able to freely tile clients, idk
workspace.clientAdded.connect(add_client);
workspace.clientRemoved.connect(removeClient);
registerShortcut("RetileWindow", "Autotile: Untile/Retile Window", "Meta+Shift+Space", retileWindow);
