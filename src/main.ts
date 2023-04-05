// config options
let debug: boolean;
let useWhitelist: boolean;
let blacklist: Array<string>;
let tilePopups: boolean;
let borders: number;
let invertInsertion: boolean;
let insertMethod: number;
let keepTiledBelow: boolean;
let keepFullscreenAbove: boolean;

// caches of stuff to make operations faster
let blacklistCache: Set<string>;
let bottomTileCache: Map<KWin.Tile, Array<KWin.Tile>> = new Map();

function printDebug(str: string, isError: boolean) {
    if (isError) {
        print("Autotile ERR: " + str);
    } else if (debug) {
        print("Autotile DBG: " + str);
    }
}

let updateConfig = function() {
    debug = readConfig("Debug", false);
    useWhitelist = readConfig("UseWhitelist", false);
    blacklist = readConfig("Blacklist", "krunner, yakuake, kded, polkit").split(',').map((x: string) => x.trim());
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
function doTileClient(client: KWin.AbstractClient): boolean {
    // if the client is not movable, dont bother
    if (client.fullScreen || !client.moveable || !client.resizeable) {
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
function windowsOnDesktop(tile: KWin.Tile, desktop: number): Array<KWin.AbstractClient> {
    let ret: Array<KWin.AbstractClient> = [];
    for (const w of tile.windows) {
        if (w.desktop == desktop || w.desktop == -1) {
            ret.push(w);
        }
    }
    return ret;
}

// forcibly sets tile, for use almost exclusively with putClientInTile
function setTile(this: any, client: KWin.AbstractClient, tile: KWin.Tile) {
    client.tile = tile;
    if (client.addons == undefined) {
        client.addons = new KWin.AbstractClientAddons(client.tile, client.desktop);
        client.frameGeometryChanged.connect(geometryChange);
        client.desktopPresenceChanged.connect(desktopChange);
        client.screenChanged.connect(screenChange.bind(this, client));
    } else {
        client.addons.oldTile = client.tile;
        client.addons.wasTiled = true;
        client.addons.oldDesktop = client.desktop;
    }
    if (keepTiledBelow) {
        client.keepBelow = true;
    }
    if (borders == 1 || borders == 2) {
        client.noBorder = true;
    }
}


// sets tile and moves things around a bit if needed
function putClientInTile(client: KWin.AbstractClient, tile: KWin.Tile) {
    // case for non-root tiles
    if (tile.parent != null) {
        let parent = tile.parent;
        let sibling: KWin.Tile;
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
function untileClient(client: KWin.AbstractClient) {
    if (client.addons == undefined || !client.addons.wasTiled) {
        return;
    }
    // if root tile then make sure the loop doesnt fail
    if (client.addons.oldTile.parent != null) {
        let parent = client.addons.oldTile.parent;
        let sibling: KWin.Tile;
        // get the parent and merge its child tile's window back into the parent to fill empty space
        if (client.addons.oldTile == parent.tiles[0]) {
            sibling = parent.tiles[1];
        } else {
            sibling = parent.tiles[0];
        }
        // only use windows on our virtual desktop
        let windows = windowsOnDesktop(sibling, client.addons.oldDesktop);
        if (windows.length != 0) {
            for (let w of windows) {
                setTile(w, parent);
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
                        let t0_windows = windowsOnDesktop(t0, client.addons.oldDesktop);
                        let t1_windows = windowsOnDesktop(t1, client.addons.oldDesktop);
                        if (t0_windows.length != 0 && t1_windows.length != 0) {
                            // move windows from one tile to fill in gap
                            for (let w of t0_windows) {
                                setTile(w, client.addons.oldTile);
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
    client.addons.oldDesktop = client.desktop;
    client.addons.wasTiled = false;
    client.tile = null;
    if (keepTiledBelow) {
        client.keepBelow = false;
    }
    if (borders == 1 || borders == 2) {
        client.noBorder = false;
    }
}

let desktopChange = function(client: KWin.AbstractClient, desktop: number) {
    printDebug("Desktop changed on " + client.resourceClass + " from desktop " + desktop, false);
    if (client.addons != undefined && client.addons.wasTiled) {
        untileClient(client);
        tileClient(client);
    }
}

let screenChange = function(this: any, client: KWin.AbstractClient) {
    printDebug("Screen changed on " + client.resourceClass, false);
    if (client.addons != undefined && client.addons.wasTiled) {
        untileClient(client);
        tileClient(client);
    }
}

let geometryChange = function(client: KWin.AbstractClient, _oldgeometry: Qt.QRect) {
    // if removed from tile
    if (client.addons != undefined && client.addons.wasTiled && client.tile == null) {
        printDebug(client.resourceClass + " was moved out of a tile", false);
        untileClient(client);
        client.addons.wasTiled = false;
        return;
    }
    // if added to tile
    if ((client.addons == undefined || !client.addons.wasTiled) && client.tile != null) {
        let tile = client.tile;
        // 1 because of self window
        if (windowsOnDesktop(tile, client.desktop).length > 1) {
            // if the tile already has windows, then just swap their positions
            printDebug(client.resourceClass + " was moved back into a tile with windows", false);
            for (let w of windowsOnDesktop(tile, client.desktop)) {
                if (w != client && client.addons != undefined) {
                    putClientInTile(w, client.addons.oldTile);
                }
            }
            setTile(client, tile);
        } else {
            // find a tile with a parent that has windows so we can insert it
            printDebug(client.resourceClass + " was moved back into a tile without windows", false);
            while (tile.parent != null && windowsOnDesktop(tile.parent, client.desktop).length == 0) {
                tile = tile.parent;
            }
            putClientInTile(client, tile);
        }
    }
}

function findTileBreadthFirst(client: KWin.AbstractClient): KWin.Tile | null {
    let rootTile = workspace.tilingForScreen(client.screen).rootTile;
    let targetTile: KWin.Tile | null = null;
    let stack: Array<KWin.Tile> = [rootTile];
    // we need to check if any tiles at all have windows so if they dont we can place the client on the root window
    let hasWindows = false;
    mainloop: while (stack.length != 0) {
        let stackNext: Array<KWin.Tile> = [];
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
function findTileBottomUp(client: KWin.AbstractClient): KWin.Tile | null {
    let rootTile = workspace.tilingForScreen(client.screen).rootTile;
    // use array constructor to avoid reference
    let bottomTiles: Array<KWin.Tile>;
    let b = bottomTileCache.get(rootTile);
    if (b != undefined) {
        bottomTiles = Array.from(b);
    } else {
        printDebug("No bottom tiles for screen " + client.screen, true);
        return null;
    }
    if (invertInsertion) {
        bottomTiles.reverse();
    }
    let tile: KWin.Tile | null = null;
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
function tileClient(this: any, client: KWin.AbstractClient) {
    // have to put this here so that there won't be a race condition between geometryChange and any function that also calls this
    if (client.addons != undefined) {
        client.addons.wasTiled = true;
    }
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
                rootTile.layoutModified.connect(destroyBottomTileCache.bind(this, rootTile));
            // ! here because undefined is checked above, typescript compiler cannot handle this for some reason
            } else if (bottomTileCache.get(rootTile)!.length == 0) {
                buildBottomTileCache(rootTile);
            }
            targetTile = findTileBottomUp(client);
            break;
        }
        default: printDebug("Invalid insertion method", true);
    }

    if (targetTile != null) {
        putClientInTile(client, targetTile);
    } else {
        if (client.addons != undefined) client.addons.wasTiled = false;
    }
}

let addClient = function(client: KWin.AbstractClient) {
    client = client as KWin.AbstractClient;
    if (doTileClient(client)) {
        printDebug("Tiling client " + client.resourceClass + " on screen " + client.screen, false);
        tileClient(client);
    }
    if (borders == 0) {
        client.noBorder = true;
    }
}

let removeClient = function(client: KWin.AbstractClient) {
    if (client.tile != null) {
        printDebug("Removing client " + client.resourceClass + " from screen " + client.screen, false);
        untileClient(client);
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
    if (client.addons != undefined && client.addons.wasTiled) {
        printDebug("Client " + client.resourceClass + " minimized", false);
        untileClient(client);
        client.addons.wasTiled = true;
    }
};
let clientUnminimized = function(client: KWin.AbstractClient) {
    if (client.addons != undefined && client.addons.wasTiled) {
        printDebug("Client " + client.resourceClass + " unminimized", false);
        // if tile can be split, put window back in its original place
        let oldTile = client.addons.oldTile;
        if (oldTile.parent != null && windowsOnDesktop(oldTile.parent, client.desktop).length != 0) {
            putClientInTile(client, client.addons.oldTile);
        } else {
            tileClient(client);
        }
    }
};

// special stuff to untile fullscreen clients
let clientFullScreen = function(client: KWin.AbstractClient, fullscreen: boolean, _user: any) {
    if (client.addons == undefined) return;
    if (!fullscreen && client.addons.wasTiled) {
        if (keepFullscreenAbove) {
            client.keepAbove = false;
        }
        if (keepTiledBelow) {
            client.keepBelow = true;
        }
    }
    if (fullscreen && client.addons.wasTiled) {
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
