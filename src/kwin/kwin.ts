namespace KWin {
    export class AbstractClientAddons {
        // custom stuff, not in base kwin scripts
        oldTile: KWin.Tile
        wasTiled: boolean
        oldDesktop: number
        constructor(tile: KWin.Tile, desktop: number) {
            this.oldTile = tile;
            this.wasTiled = true;
            this.oldDesktop = desktop;
        }
    }
}

declare namespace KWin {
    class Toplevel {
        readonly popupWindow: boolean
        readonly frameGeometry: Qt.QRect
        readonly desktop: number
        frameGeometryChanged: Signal<(client: AbstractClient, oldGeometry: Qt.QRect) => void>
        screenChanged: Signal<() => void>
    }
    class AbstractClient extends Toplevel {
        readonly resizeable: boolean
        readonly moveable: boolean
        readonly transient: boolean
        readonly specialWindow: boolean
        tile: Tile | null
        keepAbove: boolean
        keepBelow: boolean
        noBorder: boolean
        fullScreen: boolean
        resourceClass: Qt.QByteArray
        screen: number
        // custom tiling stuff that isnt in base kwin but we need it
        addons: AbstractClientAddons | undefined
        //signals
        desktopPresenceChanged: Signal<(client: AbstractClient, desktop: number) => void>
    }
    class Tile {
        tiles: Array<Tile>
        windows: Array<AbstractClient>
        // null for root tile
        parent: Tile | null
        padding: number
    }
    class RootTile extends Tile {
        parent: null
        layoutModified: Signal<() => void>
    }
    class TileManager {
        rootTile: RootTile
        bestTileForPosition(x: number, y: number): Tile
    }

    class WorkspaceWrapper {
        activeClient: AbstractClient | null
        tilingForScreen(desktop: number): KWin.TileManager
        // doesnt actually exist in api, i made it up
        lastActiveClient: AbstractClient | null | undefined
        // signals
        clientAdded: Signal<(client: KWin.AbstractClient) => void>
        clientRemoved: Signal<(client: KWin.AbstractClient) => void>
        clientActivated: Signal<(client: KWin.AbstractClient) => void>
        clientMinimized: Signal<(client: KWin.AbstractClient) => void>
        clientUnminimized: Signal<(client: KWin.AbstractClient) => void>
        // idk what user does
        clientFullScreenSet: Signal<(client: KWin.AbstractClient, fullscreen: boolean, user: any) => void>
    }
    class Options {
        configChanged: Signal<() => void>
    }
}

