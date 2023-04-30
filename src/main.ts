// global variables yay
let clientList: Map<KWin.TileMapKey, Array<KWin.AbstractClient>>;
let bottomTileCache: Map<KWin.Tile, Array<KWin.Tile>> = new Map();

// set tile for key
function setTileForKey(this: any, client: KWin.AbstractClient, tile: KWin.Tile, key: KWin.TileMapKey) {
    if (client.tilemap == undefined) {
        client.tilemap = new Map;
        client.frameGeometryChanged.connect(geometryChange);
        client.desktopPresenceChanged.connect(desktopChange);
        client.screenChanged.connect(screenChange.bind(this, client));
    }
    client.wasTiled = true;
    // it is not possibly undefined
    client.tilemap!.set(key, tile);
}

// actually set tile
function setTile(this: any, client: KWin.AbstractClient, key: KWin.TileMapKey) {
    if (client.tilemap == undefined) {
        printDebug("Client tilemap undefinend for client " + client.resourceClass, true);
        return;
    }
    let tile = client.tilemap.get(key);
    if (tile == undefined) {
        return;
    }
    client.tile = tile;
    // if x11 then we need to set the window size manually (inconsistent behavior, possible kde bug?)
    if (isX11) {
        let geometry = calculatePaddedGeometry(tile.absoluteGeometry, tile.padding);
        client.frameGeometry = geometry;
    }
    if (keepTiledBelow) {
        client.keepBelow = true;
    }
    if (borders == 1 || borders == 2) {
        client.noBorder = true;
    }
}

function buildClientList(key: KWin.TileMapKey) {
    let clients = new Array<KWin.AbstractClient>;
    let allClients = workspace.clientList();
    for (const a of allClients) {
        if ((a.desktop == -1 || a.desktop == key.desktop) && (a.activities.includes(key.activity)) && (a.screen == key.screen)) {
            clients.push(a);
        }
    }
    clientList.set(key, clients);
}

function reloadTiling(key: KWin.TileMapKey) {
    // should set by default to the current screen, activity, and desktop
    if (rebuildOnSwitch || !clientList.has(key)) {
        buildClientList(key);
    }
    // not possibly undefined
    let clients = clientList.get(key)!;
    for (let client of clients) {
        setTile(client, key);
    }
}

// sets tile and moves things around a bit if needed
function putClientInTile(client: KWin.AbstractClient, tile: KWin.Tile, key: KWin.TileMapKey) {
    // case for non-root tiles
    if (tile.parent != null) {
        let parent = tile.parent;
        let sibling: KWin.Tile;
        if (tile == parent.tiles[0]) {
            sibling = parent.tiles[1];
        } else {
            sibling = parent.tiles[0];
        }
        for (let w of windowsOnKey(parent, key)) {
            setTileForKey(w, sibling, key);
        }
    }
    setTileForKey(client, tile, key);
}

function untileClientFromKey(client: KWin.AbstractClient, key: KWin.TileMapKey) {
    if (client.tilemap == undefined || !client.wasTiled) {
        return;
    }
    let oldTile = client.tilemap.get(key);
    if (!oldTile) {
        return;
    }
    // if root tile then make sure the loop doesnt fail
    if (oldTile.parent != null) {
        let parent = oldTile.parent;
        let sibling: KWin.Tile;
        // get the parent and merge its child tile's window back into the parent to fill empty space
        if (oldTile == parent.tiles[0]) {
            sibling = parent.tiles[1];
        } else {
            sibling = parent.tiles[0];
        }
        // only use windows on our virtual desktop
        let windows = windowsOnKey(sibling, key);
        if (windows.length != 0) {
            for (let w of windows) {
                setTileForKey(w, parent, key);
            }
        } else {
            // get the shallowest no split window and bring it up to fill the gap
            let stack = [sibling];
            mainloop: while (stack.length > 0) {
                let stackNext: Array<KWin.Tile> = [];
                // indent over 9000
                for (const t of stack) {
                    // try to find binary-split window
                    if (t.tiles.length == 2) {
                        let t0: KWin.Tile;
                        if (invertInsertion) {
                            t0 = t.tiles[1];
                        } else {
                            t0 = t.tiles[0];
                        }
                        let t1: KWin.Tile;
                        if (invertInsertion) {
                            t1 = t.tiles[0];
                        } else {
                            t1 = t.tiles[1];
                        }
                        let t0_windows = windowsOnKey(t0, key);
                        let t1_windows = windowsOnKey(t1, key);
                        if (t0_windows.length != 0 && t1_windows.length != 0) {
                            // move windows from one tile to fill in gap
                            for (let w of t0_windows) {
                                setTileForKey(w, oldTile, key);
                            }
                            // move windows in other tile to fill in gap created from moving original windows
                            for (let w of t1_windows) {
                                setTileForKey(w, t, key);
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
    reloadTiling(key);
}

function untileClient(client: KWin.AbstractClient, key: KWin.TileMapKey) {
    untileClientFromKey(client, key);
    client.wasTiled = false;
    client.tile = null;
    if (keepTiledBelow) {
        client.keepBelow = false;
    }
    if (borders == 1 || borders == 2) {
        client.noBorder = false;
    }
}

function untileClientFull(client: KWin.AbstractClient) {
    if (!client.tilemap) return;
    for (const key of client.tilemap.keys()) {
        untileClientFromKey(client, key);

    }
    client.wasTiled = false;
    client.tile = null;
    if (keepTiledBelow) {
        client.keepBelow = false;
    }
    if (borders == 1 || borders == 2) {
        client.noBorder = false;
    }
}

function findTileBreadthFirst(key: KWin.TileMapKey): KWin.Tile | null {
    let rootTile = workspace.tilingForScreen(key.screen).rootTile;
    let targetTile: KWin.Tile | null = null;
    let stack: Array<KWin.Tile> = [rootTile];
    // we need to check if any tiles at all have windows so if they dont we can place the client on the root window
    let hasWindows = false;
    mainloop: while (stack.length != 0) {
        let stackNext: Array<KWin.Tile> = [];
        for (const t of stack) {
            // have to separate windows by virtual desktop because tiling affects on screen basis
            let t_windows = windowsOnKey(t, key);
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
function buildBottomTileCache(rootTile: KWin.Tile) {
    printDebug("Building bottom tile cache for root tile " + rootTile, false);
    let bottomTiles: Array<KWin.Tile> = [];
    // finds all the bottom tiles (tiles with no children)
    let stack = [rootTile];
    // this gets to be so small because most code is in the putClientInTile function
    while (stack.length != 0) {
        let stackNext: Array<KWin.Tile> = [];
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

// destroy the bottom tile cache, it will be rebuilt when new clients are added
function destroyBottomTileCache(this: any, rootTile: KWin.Tile) {
    bottomTileCache.set(rootTile, []);
}

// find tile from the bottom up with bottomTileCache
function findTileBottomUp(key: KWin.TileMapKey): KWin.Tile | null {
    let rootTile = workspace.tilingForScreen(key.screen).rootTile;
    // use array constructor to avoid reference
    let bottomTiles: Array<KWin.Tile>;
    let b = bottomTileCache.get(rootTile);
    if (b != undefined) {
        bottomTiles = Array.from(b);
    } else {
        printDebug("No bottom tiles for screen " + key.screen, true);
        return null;
    }
    if (invertInsertion) {
        bottomTiles.reverse();
    }
    let tile: KWin.Tile | null = null;
    for (const t of bottomTiles) {
        if (windowsOnKey(t, key).length == 0) {
            tile = t;
            break;
        }
    }
    if (tile != null) {
        while (tile.parent != undefined && windowsOnKey(tile.parent, key).length == 0) {
            tile = tile.parent;
        }
    }
    return tile;
}

function tileClient(this: any, client: KWin.AbstractClient, key: KWin.TileMapKey) {
    // have to put this here so that there won't be a race condition between geometryChange and any function that also calls this
    if (client.wasTiled != undefined) {
        client.wasTiled = true;
    }
    let targetTile;
    switch (insertMethod) {
        case 0: {
            targetTile = findTileBreadthFirst(key);
            break;
        }
        case 1: {
            let rootTile = workspace.tilingForScreen(client.screen).rootTile;
            if (bottomTileCache.get(rootTile) == undefined) {
                buildBottomTileCache(rootTile); // to set local "this" to the screen
                // for future layout changes
                rootTile.layoutModified.connect(destroyBottomTileCache.bind(this, rootTile));
            // ! here because undefined is checked above, typescript compiler cannot handle this for some reason
            } else if (bottomTileCache.get(rootTile)!.length == 0) {
                buildBottomTileCache(rootTile);
            }
            targetTile = findTileBottomUp(key);
            break;
        }
        default: printDebug("Invalid insertion method", true);
    }

    if (targetTile != null) {
        putClientInTile(client, targetTile, key);
    } else {
        if (client.wasTiled != undefined) client.wasTiled = false;
    }
}

let desktopChange = function(client: KWin.AbstractClient, desktop: number) {
    printDebug("Desktop changed on " + client.resourceClass + " from desktop " + desktop, false);
    if (!client.tilemap) return;
    for (const key of clientToKeys(client)) {
        tileClient(client, key);
        reloadTiling(key);
    }
}

let screenChange = function(this: any, client: KWin.AbstractClient) {
    printDebug("Screen changed on " + client.resourceClass, false);
    if (!client.tilemap) return;
    for (const key of clientToKeys(client)) {
        tileClient(client, key);
        reloadTiling(key);
    }
}

let geometryChange = function(client: KWin.AbstractClient, _oldgeometry: Qt.QRect) {
    // if removed from tile
    if (client.tilemap && client.wasTiled && client.tile == null) {
        printDebug(client.resourceClass + " was moved out of a tile", false);
        for (const key of clientToKeys(client)) {
            untileClient(client, key);
            reloadTiling(key);
        }
        client.wasTiled = false;
        return;
    }
    // if added to tile
    // client.wasTiled should be undef if not tiled before
    if (!client.wasTiled && client.tile != null) {
        let tile = client.tile;
        let key = new KWin.TileMapKey; // windows should only be moved into tiles on selected screens
        // 1 because of self window
        if (windowsOnKey(tile, key).length > 1) {
            // if the tile already has windows, then just swap their positions
            printDebug(client.resourceClass + " was moved back into a tile with windows", false);
            for (let w of windowsOnKey(tile, key)) {
                if (w != client && client.tilemap && client.tilemap.get(key)) {
                    putClientInTile(w, client.tilemap.get(key)!, key);
                }
            }
            setTileForKey(client, tile, key);
        } else {
            // find a tile with a parent that has windows so we can insert it
            printDebug(client.resourceClass + " was moved back into a tile without windows", false);
            while (tile.parent != null && windowsOnKey(tile.parent, key).length == 0) {
                tile = tile.parent;
            }
            putClientInTile(client, tile, key);
        }
        reloadTiling(key);
    }
}

let addClient = function(client: KWin.AbstractClient) {
    if (doTileClient(client)) {
        printDebug("Tiling client " + client.resourceClass + " on screen " + client.screen, false);
        for (const key of clientToKeys(client)) {
            tileClient(client, key);
        }
    }
    if (borders == 0) {
        client.noBorder = true;
    }
}

let removeClient = function(client: KWin.AbstractClient) {
    if (client.tile != null) {
        printDebug("Removing client " + client.resourceClass + " from screen " + client.screen, false);
        untileClientFull(client);
    }
}

// border stuff (github issue #1)
let clientActivated = function(client: KWin.AbstractClient) {
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
let clientMinimized = function(client: KWin.AbstractClient) {
    if (client.wasTiled) {
        printDebug("Client " + client.resourceClass + " minimized", false);
        for (const key of clientToKeys(client)) {
            untileClientFromKey(client, key);
        }
        client.wasTiled = true;
    }
};
let clientUnminimized = function(client: KWin.AbstractClient) {
    if (client.wasTiled && client.tilemap) {
        printDebug("Client " + client.resourceClass + " unminimized", false);
        // if tile can be split, put window back in its original place
        for (const key of clientToKeys(client)) {
            let oldTile = client.tilemap.get(key);
            if (oldTile == undefined) return;
            if (oldTile.parent != null && windowsOnKey(oldTile.parent, key).length != 0) {
                putClientInTile(client, oldTile, key);
            } else {
                tileClient(client, key);
            }
        }
    }
};

// special stuff to untile fullscreen clients
let clientFullScreen = function(client: KWin.AbstractClient, fullscreen: boolean, _user: any) {
    if (!client.tilemap) return;
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
