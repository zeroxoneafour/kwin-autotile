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
    client.tilemap!.set(new KWin.TileMapKey, tile);
}

// actually set tile
function setTile(this: any, client: KWin.AbstractClient, key: KWin.TileMapKey) {
    if (client.tilemap == undefined) {
        printDebug("Client tilemap undefiend for client " + client.resourceClass, true);
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
