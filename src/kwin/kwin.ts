declare namespace KWin {
    class Toplevel {
        readonly popupWindow: boolean
        readonly frameGeometry: Qt.QRect
        readonly desktop: number
        frameGeometryChanged: Signal<(client: Toplevel, oldGeometry: Qt.QRect) => void>
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
    }
    class Tile {
        tiles: Array<Tile>
        windows: Array<AbstractClient>
        // undef for root tile
        parent: Tile | undefined
    }
    class RootTile extends Tile {
        parent: undefined
        layoutModified: Signal<() => void>
    }
    class TileManager {
        rootTile: RootTile
    }
    class WorkspaceWrapper {
        readonly activeScreen: number
        tilingForScreen(desktop: number): KWin.TileManager
        // signals
        clientAdded: Signal<(client: KWin.AbstractClient) => void>
        clientRemoved: Signal<(client: KWin.AbstractClient) => void>
        clientActivated: Signal<(client: KWin.AbstractClient) => void>
        clientMinimized: Signal<(client: KWin.AbstractClient) => void>
        clientUnminimized: Signal<(client: KWin.AbstractClient) => void>
        // idk what user does
        clientFullScreenSet: Signal<(client: KWin.AbstractClient, fullscreen: boolean, user: any) => void>
    }
}
