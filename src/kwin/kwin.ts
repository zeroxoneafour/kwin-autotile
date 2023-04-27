namespace KWin {
    export class TileMapKey {
        // custom stuff, not in base kwin scripts
        screen: number;
        activity: string;
        desktop: number;
        constructor(screen?: number, activity?: string, desktop?: number) {
            if (screen)
                this.screen = screen;
            else
                this.screen = workspace.activeScreen;
            if (activity)
                this.activity = activity;
            else
                this.activity = workspace.currentActivity;
            if (desktop)
                this.desktop = desktop;
            else
                this.desktop = workspace.currentDesktop;
        }
    }
}

declare namespace KWin {
    class Toplevel {
        readonly popupWindow: boolean;
        readonly frameGeometry: Qt.QRect;
        readonly desktop: number;
        frameGeometryChanged: Signal<(client: AbstractClient, oldGeometry: Qt.QRect) => void>;
        screenChanged: Signal<() => void>;
    }
    class AbstractClient extends Toplevel {
        readonly resizeable: boolean;
        readonly moveable: boolean;
        readonly transient: boolean;
        readonly specialWindow: boolean;
        tile: Tile | null;
        keepAbove: boolean;
        keepBelow: boolean;
        noBorder: boolean;
        fullScreen: boolean;
        activities: string[];
        resourceClass: Qt.QByteArray;
        // frameGeometry is read/write for abstractclient
        frameGeometry: Qt.QRect;
        screen: number;
        // custom tiling stuff that isnt in base kwin but we need it
        tilemap: Map<TileMapKey, Tile | null> | undefined;
        wasTiled: boolean | undefined;
        //signals
        desktopPresenceChanged: Signal<(client: AbstractClient, desktop: number) => void>;
    }
    class Tile {
        tiles: Array<Tile>;
        windows: Array<AbstractClient>;
        absoluteGeometry: Qt.QRect;
        // null for root tile
        parent: Tile | null;
        padding: number;
    }
    class RootTile extends Tile {
        parent: null;
        layoutModified: Signal<() => void>;
    }
    class TileManager {
        rootTile: RootTile;
        bestTileForPosition(x: number, y: number): Tile;
    }

    class WorkspaceWrapper {
        activeClient: AbstractClient | null;
        activeScreen: number;
        currentActivity: string;
        currentDesktop: number;
        tilingForScreen(desktop: number): KWin.TileManager;
        supportInformation(): string;
        // doesnt actually exist in api, i made it up
        lastActiveClient: AbstractClient | null | undefined;
        // signals
        clientAdded: Signal<(client: KWin.AbstractClient) => void>;
        clientRemoved: Signal<(client: KWin.AbstractClient) => void>;
        clientActivated: Signal<(client: KWin.AbstractClient) => void>;
        clientMinimized: Signal<(client: KWin.AbstractClient) => void>;
        clientUnminimized: Signal<(client: KWin.AbstractClient) => void>;
        // idk what user does
        clientFullScreenSet: Signal<(client: KWin.AbstractClient, fullscreen: boolean, user: any) => void>;
    }
    class Options {
        configChanged: Signal<() => void>;
    }
}

