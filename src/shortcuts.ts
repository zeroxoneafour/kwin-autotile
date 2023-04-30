
// keybind for untiling/retiling windows
let retileWindow = function() {
    let client = workspace.activeClient;
    if (client == null) return;
    if (client.tile != null) {
        printDebug("Untiling client " + client.resourceClass, false);
        for (const key of clientToKeys(client)) untileClient(client, key);
    } else {
        printDebug("Retiling client " + client.resourceClass, false);
        for (const key of clientToKeys(client)) tileClient(client, key);
    }
}
registerShortcut("AutotileRetileWindow", "Autotile: Untile/Retile Window", "Meta+Shift+Space", retileWindow);

/*
// tile above
function tileAbove(client: KWin.AbstractClient) {
    // only tiled clients are supported with keybinds
    if (client.tile == null) return null;
    let geometry = client.frameGeometry;
    // qt uses top left corner as 0,0
    // 1 unit offsets so it lands inside of another tile
    let coordOffset = 1 + client.tile.padding;
    let x = geometry.x + 1;
    let y = geometry.y - coordOffset;
    let tile: KWin.Tile | null = workspace.tilingForScreen(client.screen).bestTileForPosition(x, y);
    // don't know where this would be the case but whatever
    if (tile == null) {
        return null;
    }
    // find a tile that has a window in it so we can swap or select it
    while (tile != null && windowsOnDesktop(tile, client.desktop).length == 0) {
        tile = tile.parent;
    }
    // make sure the window does not include the client
    if (tile == null || tile.windows.includes(client)) {
        return null;
    } else {
        return tile;
    }
}

// focus tile above selected
let focusAbove = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null) return;
    let tile = tileAbove(client);
    if (tile == null) {
        printDebug("Tile above " + client.resourceClass + " is null", false);
        return;
    }
    let newClient = windowsOnDesktop(tile, client.desktop)[0];
    printDebug("Focusing " + newClient.resourceClass + " from above " + client.resourceClass, false);
    workspace.activeClient = newClient;
}

// swap selected and tile above
let swapAbove = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null) return;
    let tile = tileAbove(client);
    if (tile == null) {
        printDebug("Tile above " + client.resourceClass + " is null", false);
        return;
    }
    printDebug("Swapping windows above " + client.resourceClass, false);
    for (let w of windowsOnDesktop(tile, client.desktop)) {
        setTile(w, client.tile);
    }
    setTile(client, tile);
}

// insert selected into tile above (if possible)
let insertAbove = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null || client.addons == undefined) return;
    let tile = tileAbove(client);
    if (tile == null) {
        printDebug("Tile above " + client.resourceClass + " is null", false);
        return;
    }
    printDebug("Inserting " + client.resourceClass + " above", false);
    let oldTile = client.tile;
    untileClient(client);
    client.addons.wasTiled = true;
    if (windowsOnDesktop(tile, client.desktop).length != 0) {
        if (invertInsertion) {
            tile = tile.tiles[1];
        } else {
            tile = tile.tiles[0];
        }
    }
    // if tile has no children then don't tile
    if (tile == undefined) {
        printDebug("Could not insert " + client.resourceClass, false);
        // now inserts client back into its old tile instead of retiling
        putClientInTile(client, oldTile);
    }
    putClientInTile(client, tile);
}

registerShortcut("AutotileFocusAbove", "Autotile: Focus Above", "Meta+K", focusAbove);
registerShortcut("AutotileSwapAbove", "Autotile: Swap Above", "Ctrl+Meta+K", swapAbove);
registerShortcut("AutotileInsertAbove", "Autotile: Insert Above", "Meta+Shift+K", insertAbove);

// tile below
function tileBelow(client: KWin.AbstractClient) {
    // only tiled clients are supported with keybinds
    if (client.tile == null) return null;
    let geometry = client.frameGeometry;
    // qt uses top left corner as 0,0
    // 1 unit offsets so it lands inside of another tile
    let coordOffset = 1 + geometry.height + client.tile.padding;
    let x = geometry.x + 1;
    let y = geometry.y + coordOffset;
    let tile: KWin.Tile | null = workspace.tilingForScreen(client.screen).bestTileForPosition(x, y);
    // don't know where this would be the case but whatever
    if (tile == null) {
        return null;
    }
    // find a tile that has a window in it so we can swap or select it
    while (tile != null && windowsOnDesktop(tile, client.desktop).length == 0) {
        tile = tile.parent;
    }
    // make sure the window does not include the client
    if (tile == null || tile.windows.includes(client)) {
        return null;
    } else {
        return tile;
    }
}

// focus tile below selected
let focusBelow = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null) return;
    let tile = tileBelow(client);
    if (tile == null) {
        printDebug("Tile below " + client.resourceClass + " is null", false);
        return;
    }
    let newClient = windowsOnDesktop(tile, client.desktop)[0];
    printDebug("Focusing " + newClient.resourceClass + " from below " + client.resourceClass, false);
    workspace.activeClient = newClient;
}

// swap selected and tile below
let swapBelow = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null) return;
    let tile = tileBelow(client);
    if (tile == null) {
        printDebug("Tile below " + client.resourceClass + " is null", false);
        return;
    }
    printDebug("Swapping windows below " + client.resourceClass, false);
    for (let w of windowsOnDesktop(tile, client.desktop)) {
        setTile(w, client.tile);
    }
    setTile(client, tile);
}

// insert selected into tile below (if possible)
let insertBelow = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null || client.addons == undefined) return;
    let tile = tileBelow(client);
    if (tile == null) {
        printDebug("Tile below " + client.resourceClass + " is null", false);
        return;
    }
    printDebug("Inserting " + client.resourceClass + " below", false);
    let oldTile = client.tile;
    untileClient(client);
    client.addons.wasTiled = true;
    if (windowsOnDesktop(tile, client.desktop).length != 0) {
        if (invertInsertion) {
            tile = tile.tiles[1];
        } else {
            tile = tile.tiles[0];
        }
    }
    // if tile has no children then don't tile
    if (tile == undefined) {
        printDebug("Could not insert " + client.resourceClass, false);
        // now inserts client back into its old tile instead of retiling
        putClientInTile(client, oldTile);
    }
    putClientInTile(client, tile);
}

registerShortcut("AutotileFocusBelow", "Autotile: Focus Below", "Meta+J", focusBelow);
registerShortcut("AutotileSwapBelow", "Autotile: Swap Below", "Ctrl+Meta+J", swapBelow);
registerShortcut("AutotileInsertBelow", "Autotile: Insert Below", "Meta+Shift+J", insertBelow);

// tile left
function tileLeft(client: KWin.AbstractClient) {
    // only tiled clients are supported with keybinds
    if (client.tile == null) return null;
    let geometry = client.frameGeometry;
    // qt uses top left corner as 0,0
    // 1 unit offsets so it lands inside of another tile
    let coordOffset = 1 + client.tile.padding;
    let x = geometry.x - coordOffset;
    let y = geometry.y + 1;
    let tile: KWin.Tile | null = workspace.tilingForScreen(client.screen).bestTileForPosition(x, y);
    // don't know where this would be the case but whatever
    if (tile == null) {
        return null;
    }
    // find a tile that has a window in it so we can swap or select it
    while (tile != null && windowsOnDesktop(tile, client.desktop).length == 0) {
        tile = tile.parent;
    }
    // make sure the window does not include the client
    if (tile == null || tile.windows.includes(client)) {
        return null;
    } else {
        return tile;
    }
}

// focus tile left selected
let focusLeft = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null) return;
    let tile = tileLeft(client);
    if (tile == null) {
        printDebug("Tile left " + client.resourceClass + " is null", false);
        return;
    }
    let newClient = windowsOnDesktop(tile, client.desktop)[0];
    printDebug("Focusing " + newClient.resourceClass + " from left " + client.resourceClass, false);
    workspace.activeClient = newClient;
}

// swap selected and tile left
let swapLeft = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null) return;
    let tile = tileLeft(client);
    if (tile == null) {
        printDebug("Tile left " + client.resourceClass + " is null", false);
        return;
    }
    printDebug("Swapping windows left " + client.resourceClass, false);
    for (let w of windowsOnDesktop(tile, client.desktop)) {
        setTile(w, client.tile);
    }
    setTile(client, tile);
}

// insert selected into tile left (if possible)
let insertLeft = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null || client.addons == undefined) return;
    let tile = tileLeft(client);
    if (tile == null) {
        printDebug("Tile left " + client.resourceClass + " is null", false);
        return;
    }
    printDebug("Inserting " + client.resourceClass + " left", false);
    let oldTile = client.tile;
    untileClient(client);
    client.addons.wasTiled = true;
    if (windowsOnDesktop(tile, client.desktop).length != 0) {
        if (invertInsertion) {
            tile = tile.tiles[1];
        } else {
            tile = tile.tiles[0];
        }
    }
    // if tile has no children then don't tile
    if (tile == undefined) {
        printDebug("Could not insert " + client.resourceClass, false);
        // now inserts client back into its old tile instead of retiling
        putClientInTile(client, oldTile);
    }
    putClientInTile(client, tile);
}

registerShortcut("AutotileFocusLeft", "Autotile: Focus Left", "Meta+H", focusLeft);
registerShortcut("AutotileSwapLeft", "Autotile: Swap Left", "Ctrl+Meta+H", swapLeft);
registerShortcut("AutotileInsertLeft", "Autotile: Insert Left", "Meta+Shift+H", insertLeft);

// tile right
function tileRight(client: KWin.AbstractClient) {
    // only tiled clients are supported with keybinds
    if (client.tile == null) return null;
    let geometry = client.frameGeometry;
    // qt uses top left corner as 0,0
    // 1 unit offsets so it lands inside of another tile
    let coordOffset = 1 + geometry.width + client.tile.padding;
    let x = geometry.x + coordOffset;
    let y = geometry.y + 1;
    let tile: KWin.Tile | null = workspace.tilingForScreen(client.screen).bestTileForPosition(x, y);
    // don't know where this would be the case but whatever
    if (tile == null) {
        return null;
    }
    // find a tile that has a window in it so we can swap or select it
    while (tile != null && windowsOnDesktop(tile, client.desktop).length == 0) {
        tile = tile.parent;
    }
    // make sure the window does not include the client
    if (tile == null || tile.windows.includes(client)) {
        return null;
    } else {
        return tile;
    }
}

// focus tile right selected
let focusRight = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null) return;
    let tile = tileRight(client);
    if (tile == null) {
        printDebug("Tile right " + client.resourceClass + " is null", false);
        return;
    }
    let newClient = windowsOnDesktop(tile, client.desktop)[0];
    printDebug("Focusing " + newClient.resourceClass + " from right " + client.resourceClass, false);
    workspace.activeClient = newClient;
}

// swap selected and tile right
let swapRight = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null) return;
    let tile = tileRight(client);
    if (tile == null) {
        printDebug("Tile right " + client.resourceClass + " is null", false);
        return;
    }
    printDebug("Swapping windows right " + client.resourceClass, false);
    for (let w of windowsOnDesktop(tile, client.desktop)) {
        setTile(w, client.tile);
    }
    setTile(client, tile);
}

// insert selected into tile right (if possible)
let insertRight = function() {
    let client = workspace.activeClient;
    if (client == null || client.tile == null || client.addons == undefined) return;
    let tile = tileRight(client);
    if (tile == null) {
        printDebug("Tile right " + client.resourceClass + " is null", false);
        return;
    }
    printDebug("Inserting " + client.resourceClass + " right", false);
    let oldTile = client.tile;
    untileClient(client);
    client.addons.wasTiled = true;
    if (windowsOnDesktop(tile, client.desktop).length != 0) {
        if (invertInsertion) {
            tile = tile.tiles[1];
        } else {
            tile = tile.tiles[0];
        }
    }
    // if tile has no children then don't tile
    if (tile == undefined) {
        printDebug("Could not insert " + client.resourceClass, false);
        // now inserts client back into its old tile instead of retiling
        putClientInTile(client, oldTile);
    }
    putClientInTile(client, tile);
}

registerShortcut("AutotileFocusRight", "Autotile: Focus Right", "Meta+L", focusRight);
registerShortcut("AutotileSwapRight", "Autotile: Swap Right", "Ctrl+Meta+L", swapRight);
registerShortcut("AutotileInsertRight", "Autotile: Insert Right", "Meta+Shift+L", insertRight);
*/
