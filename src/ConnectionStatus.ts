import Peer, { DataConnection } from "skyway-js";

export interface User {

}

export interface Connection {

}

export class P2pStatusNotifier {

    public onUsers(own: User, users: User[]) {

    }

    public onConnection(ownConnection: Connection,  connections: Connection[]) {

    }

}

export class P2pManager {
    public constructor(private notifier: P2pStatusNotifier) {
    }

    public sendMessage() {

    }

    public sendProfile() {

    }

}

export class ConnectionBundle {
    constructor(private peer: Peer) {
    }

    public connect() {

    }

    private onConnect() {

    }

    private onMessage() {

    }

}