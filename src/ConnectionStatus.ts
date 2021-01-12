import Peer, { DataConnection } from "skyway-js";
import { Subject } from "rxjs";

type ComingConnectionStatus =
    | "connected"
    | "wait-auth-request"
    | "processing-auth-request"
    | "authorized";

type GoingConnectionStatus = "connecting" | "processing-auth-request" | "authorized";

interface GoingConnection {
    status: GoingConnection;
    remoteID: string;
    connectionID: string;
}

interface ComingConnection {
    status: ComingConnectionStatus;
    remoteID: string;
    connectionID: string;
}

interface ValidatedConnection {
    remoteID: string;
    connectionID: string;
    publicKey: string;
    publicKeyHash: string;
}

class ComingConnectionManager {
    private comingConnections: ComingConnection[] = [];
}

class GoingConnectionManager {
    private goingConnections: GoingConnection[] = [];
}

class ValidatedConnectionManager {
    private validatedConnections: ValidatedConnection[] = [];
}

interface OnValidateEvent {
    connectionID: string;
    publicKey: string;
    userName: string;
    introduce: string;
}

export interface User {
    publicKey: string;
    publicKeyDigest: string;
    name: string;
    introduce: string;
    trust: boolean;
    own: boolean;
    block: boolean;
    quite: boolean;
}

export class UsersManager {
    users: User[] = [];

    public readonly doPersistentTrust = new Subject<TrustEvent>();
    public readonly doPersistentBlock = new Subject<BlockEvent>();

    public readonly onUsers = new Subject<User[]>();

    public onTrust(publicKey: string) {

    }
    public onBlock(publicKey: string) {

    }
}

export class P2pManager {

    private comingConnectionManager: ComingConnectionManager;
    private goingConnectionManager: GoingConnectionManager;
    private validatedConnectionManager: ValidatedConnectionManager;

    public readonly onConnectionStatusUpdate = new Subject<ValidatedConnection[]>();
    public readonly onUserProfileUpdate = new Subject<ValidatedConnection[]>();

    public readonly onQuiteEvent = new Subject<string>();

    public readonly onChatEventLog = new Subject<ChatEventLog>();

    public constructor() {
        this.comingConnectionManager = new ComingConnectionManager();
        this.goingConnectionManager = new GoingConnectionManager();
        this.validatedConnectionManager = new ValidatedConnectionManager();

        this.comingConnectionManager
            .onValidate.subscribe((event: OnValidateEvent) => this.onValidateComingConnection(event));
        this.goingConnectionManager
            .onValidate.subscribe((event: OnValidateEvent) => this.onValidateGoingConnection(event));

        this.comingConnectionManager.doConnectionClose(connectionID => this.doConnectionClose.next(connectionID));
        this.goingConnectionManager.doConnectionClose(connectionID => this.doConnectionClose.next(connectionID));
        this.validatedConnectionManager.doConnectionClose(connectionID => this.doConnectionClose.next(connectionID));

        this.comingConnectionManager.doSendMessage((event: OnRequestMessageEvent) => this.doSendMessage(event));
        this.goingConnectionManager.doSendMessage((event: OnRequestMessageEvent) => this.doSendMessage(event));
        this.validatedConnectionManager.doSendMessage((event: OnRequestMessageEvent) => this.doSendMessage(event));

        this.validatedConnectionManager.onQuiteEvent.subscribe( publicKey => this.onQuiteEvent.next(publicKey) );
        this.validatedConnectionManager.onComment.subscribe( comment => this.onComment.next(publicKey) );
        this.validatedConnectionManager.onProfileUpdate.subscribe( profile => this.onProfileUpdate.next(publicKey) );
        this.validatedConnectionManager.onAssets.subscribe( profile => this.onAssets.next(publicKey) );

    }

    public onMessage(connectionID: string, data: any[]) {

        const connectionType = this.findConnectionType(connectionID);

        if (connectionType == "coming") {
            this.comingConnectionManager.onMessage(data);
        } else if (connectionType == "going") {
            this.goingConnectionManager.onMessage(data);
        } else if (connectionType == "validated") {
            this.validatedConnectionManager.onMessage(data);
        }

    }

    public connect(remoteID: string) {

    }

    public sendComment(remoteIDs: string[], data: string) {

    }
}


export class ConnectionBundle {

    public readonly onConnectSuccess = new Subject<{ connectionID: string, remoteID: string }>();
    public readonly onConnectComing = new Subject<{ connectionID: string, remoteID: string }>();
    public readonly onMessage = new Subject<{ connectionID: string, data: any[] }>();
    public readonly onClose = new Subject<{ connectionID: string }>();

    constructor(private peer: Peer) {
    }

    public connect(remoteID: string) {

    }

    public send(connectionID: string, data: any[]) {

    }

    public close(connectionID: string) {

    }

}