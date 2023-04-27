// gets windows on desktop because tiles share windows across several desktops
function windowsOnDesktop(tile: KWin.Tile, key: KWin.TileMapKey): Array<KWin.AbstractClient> {
    let ret: Array<KWin.AbstractClient> = [];
    for (const w of tile.windows) {
        if ((w.desktop == key.desktop || w.desktop == -1) && w.activities.includes(key.activity) && w.screen == key.screen) {
            ret.push(w);
        }
    }
    return ret;
}

function calculatePaddedGeometry(rect: Qt.QRect, padding: number): Qt.QRect {
    let ret = structuredClone(rect);
    print(ret);
    ret.x += padding;
    ret.y += padding;
    ret.width -= (padding*2);
    ret.height -= (padding*2);
    return ret;
}
