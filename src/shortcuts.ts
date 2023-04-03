// keybind for untiling/retiling windows
let retileWindow = function() {
    let client = workspace.activeClient;
    if (client == null) return;
    if (client.tile != null) {
        printDebug("Untiling client " + client.resourceClass, false);
        untileClient(client);
    } else {
        printDebug("Retiling client " + client.resourceClass, false);
        tileClient(client);
    }
}
registerShortcut("AutotileRetileWindow", "Autotile: Untile/Retile Window", "Meta+Shift+Space", retileWindow);

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
    if (client == null || client.tile == null) return;
    let tile = tileAbove(client);
    if (tile == null) {
        printDebug("Tile above " + client.resourceClass + " is null", false);
        return;
    }
    printDebug("Inserting " + client.resourceClass + " above", false);
    let oldTile = client.tile;
    untileClient(client);
    client.addons!.wasTiled = true;
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
