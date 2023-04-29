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

// is x11
function checkIfX11() {
    let re = new RegExp("Operation Mode: (\\w*)");
    // assume that the operation mode is outputted correctly
    let opMode = re.exec(workspace.supportInformation())![1];
    print(opMode);
    switch (opMode) {
        case "XWayland": return false;
        case "Wayland": return false;
        case "X11": return true;
    }
    return false;
}
let isX11: boolean = checkIfX11();

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
    printDebug("Running on " + (isX11 ? "X11" : "Wayland"), false);
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

function printDebug(str: string, isError: boolean) {
    if (isError) {
        print("Autotile ERR: " + str);
    } else if (debug) {
        print("Autotile DBG: " + str);
    }
}

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

// simple structured clone polyfill
function structuredClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

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
