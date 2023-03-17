let debug = readConfig("Debug", false);
let useWhitelist = readConfig("UseWhitelist", false);
let blacklist = readConfig("Blacklist", "krunner").split(',').map(x => x.trim());
let tileUtilityWindows = readConfig("TileUtilityWindows", false);

function printDebug(str, isError) {
    if (isError) {
        print("Autotile ERR: " + str);
    } else if (debug) {
        print("Autotile DBG: " + str);
    }
}

printDebug("useWhitelist == " + useWhitelist, false);
printDebug("blacklist == " + blacklist, false);
printDebug("tileUtilityWindows == " + tileUtilityWindows, false);

// whether to ignore a client or not
function doTileClient(client) {
    // if the client is not movable, dont bother
    if (client.transient || !client.moveable || !client.resizeable) {
        return false;
    }
    // check for the client type
    if (!(client.normalWindow || (client.utility && tileUtilityWindows))) {
        return false;
    }
    // check if client is black/whitelisted
    if (blacklist.includes(client.resourceClass.toString())) {
        return useWhitelist;
    } else {
        return !useWhitelist;
    }
}

// add a client to the root tile, splitting tiles if needed
// TODO: fix tiling when moving one root window to another via desktop switching
function tileClient(rootTile, client) {
    client.tile = null;
    let tilesToCheck = [rootTile];
    // we need to check if any tiles at all have windows so if they dont we can place the client on the root window
    let has_windows = false;
    // breadth-first search for open tiles, starting at the root tile and working progressively smaller
    // works kind of i guess? dont try with more than ~5-6 tiles
    while (tilesToCheck.length != 0) {
        let tilesToCheckNext = [];
        for (i of tilesToCheck) {
            let i_windows = [];
            // have to separate windows by virtual desktop because tiling affects on screen basis
            for (w of i.windows) {
                if (w.desktop == client.desktop || w.desktop == -1) {
                    i_windows.push(w);
                }
            }
            // see has_windows comment
            if (!(has_windows) && i_windows.length != 0) {
                has_windows = true;
            }
            // check if there are no windows or child tiles
            if (i_windows.length == 0 && i.tiles.length == 0) {
                client.tile = i;
                break;
            }
            // check if there is only one window and the tile is binary-splittable
            if (i_windows.length == 1 && i.tiles.length == 2) {
                i_windows[0].tile = i.tiles[0];
                client.tile = i.tiles[1];
                break;
            }
            //
            tilesToCheckNext = tilesToCheckNext.concat(i.tiles);
        }
        tilesToCheck = tilesToCheckNext;
    }
    // if there are no windows on the page, set tile to the root tile
    if (!has_windows) {
        client.tile = rootTile;
    }
    // used in other things if the client is moved around
    client.oldTile = client.tile;
    client.oldDesktop = client.desktop;
}


// TODO: make tiling work when window is removed in certain scenarios
function untileClient(client) {
    if (client.oldTile == null) {
        return;
    }
    // if root tile then make sure the loop doesnt fail
    if (client.oldTile.parent == undefined) {
        client.oldDesktop = client.desktop;
        client.tile = null;
    }
    let parent = client.oldTile.parent;
    let main_tile;
    // get the parent and merge its child tile's window back into the parent to fill empty space
    if (client.oldTile == parent.tiles[0]) {
        main_tile = parent.tiles[1];
    } else {
        main_tile = parent.tiles[0];
    }
    // only use windows on our virtual desktop
    for (w of main_tile.windows) {
        if (w.desktop == client.oldDesktop || w.desktop == -1) {
            w.tile = parent;
        }
    }
    // stuff for desktop client switching
    client.oldDesktop = client.desktop;
    client.tile = null;
}

let desktopChange = function(client, _desktop) {
    printDebug("Desktop changed on " + client.resourceClass, false);
    untileClient(client);
    tileClient(workspace.tilingForScreen(client.screen).rootTile, client);
}

let geometryChange = function(client, _oldgeometry) {
    printDebug("Geometry changed on " + client.resourceClass, false);
    if (client.tile == null) {
        untileClient(client);
        return;
    }
    if (client.tile.windows.length == 2) {
        client.tile.windows[0].tile = client.oldTile;
    }
    client.oldTile = client.tile;
}

let add_client = function(client) {
    printDebug("Adding client " + client.resourceClass, false);
    if (doTileClient(client)) {
        printDebug("Tiling client", false);
        client.frameGeometryChanged.connect(geometryChange);
        client.desktopPresenceChanged.connect(desktopChange)
        tileClient(workspace.tilingForScreen(client.screen).rootTile, client);
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

// keybind for retiling windows
let retileWindow = function() {
    let client = workspace.activeClient;
    if (client.tile == null) {
        tileClient(workspace.tilingForScreen(client.screen).rootTile, client);
    } else {
        untileClient(client);
    }
}

// maybe someday we will be able to freely tile clients, idk
workspace.clientAdded.connect(add_client);
workspace.clientRemoved.connect(removeClient);
registerShortcut("RetileWindow", "Autotile: Untile/Retile Window", "Meta+Shift+Space", retileWindow);
