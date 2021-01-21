import { ConnectionBundler } from "./ConnectionBundler";
import { GoingConnection, GoingConnectionStatus, State } from "./useStatus";
import { AuthService } from "./AuthService";
import { P2pController } from "./P2pController";

export class DelegateGoingConnection {
  constructor(private p2p: P2pController) {}

  public async connect(
    roomID: string,
    remoteID: string,
    cb: ConnectionBundler
  ) {
    if (this.isConnect(remoteID, cb)) return;
    const connectionID = await cb.connect(remoteID);
    const now = this.p2p.state;
    const next = now.connectionAuthStatus.goingConnections.concat({
      status: "connected",
      connectionID: connectionID,
      roomID: roomID,
      remoteID: remoteID,
      name: "",
      publicKey: "",
    });
    const nextState: State = {
      ...now,
      connectionAuthStatus: {
        ...now.connectionAuthStatus,
        goingConnections: next,
      },
    };
    this.callback(nextState);
  }

  private isConnect(remoteID: string, cb: ConnectionBundler): boolean {
    if (remoteID == cb.peer.id) return true;
    const ah = this.p2p.state.connectionAuthStatus;
    if (ah.validatedConnections.find((c) => c.remoteID == remoteID))
      return true;
    if (ah.comingConnections.find((c) => c.remoteID == remoteID)) return true;
    if (ah.goingConnections.find((c) => c.remoteID == remoteID)) return true;
    return false;
  }

  private callback(state: State) {
    this.p2p.setState(state);
  }

  async onData(
    connectionID: string,
    method: string,
    payload: any[],
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    if (method == "auth-request") {
      await this.onAuthRequest(connectionID, payload, auth, cb);
    } else if (method == "auth-ok") {
      await this.onAuthOk(connectionID, cb, auth);
    }
  }

  private getConnection(connectionID: string): GoingConnection | undefined {
    return this.p2p.state.connectionAuthStatus.goingConnections.find(
      (c) => c.connectionID == connectionID
    );
  }

  private updateStatus(
    connectionID: string,
    attr: {
      roomID?: string;
      remoteID?: string;
      status?: GoingConnectionStatus;
      name?: string;
      publicKey?: string;
    }
  ) {
    const c = this.getConnection(connectionID);
    if (!c) throw "connectionがない";
    const n: GoingConnection = {
      connectionID: connectionID,
      roomID: attr.roomID || c.roomID,
      remoteID: attr.remoteID || c.remoteID,
      status: attr.status || c.status,
      name: attr.name || c.name || "",
      publicKey: attr.publicKey || c.publicKey,
    };

    const nextList = this.p2p.state.connectionAuthStatus.goingConnections
      .filter((c) => c.connectionID != connectionID)
      .concat(n);
    const nextStatus: State = {
      ...this.p2p.state,
      connectionAuthStatus: {
        ...this.p2p.state.connectionAuthStatus,
        goingConnections: nextList,
      },
    };
    this.callback(nextStatus);
  }

  private getRoomID(connectionID: string): string | undefined {
    return this.getConnection(connectionID)?.roomID;
  }

  private async onAuthRequest(
    connectionID: string,
    payload: any[],
    auth: AuthService,
    cb: ConnectionBundler
  ) {
    const connection = this.getConnection(connectionID);
    const status = connection?.status;
    if (status != "connected") {
      console.log(connection);
      throw "not connected";
      return;
    }
    this.updateStatus(connectionID, { status: "processing-auth-request" });
    const otherPublicKeyJson = payload[0];
    const otherSign = payload[1];
    const otherUserName = payload[2];
    const roomID = this.getRoomID(connectionID);

    const ok = await auth.verify(connectionID, otherPublicKeyJson, otherSign);
    if (!ok) {
      throw "auth error";
      cb.close(connectionID);
      return;
    }

    this.updateStatus(connectionID, {
      status: "wait-auth-request",
      name: otherUserName,
    });
    const sign = await auth.signConnection(connectionID);
    const data = [
      "auth-request",
      auth.ownPublicKeyJson,
      sign,
      roomID,
      this.userName(),
    ];
    const json = JSON.stringify(data);
    cb.send(connectionID, json);
  }

  private userName(): string {
    return this.p2p.getUserName();
  }

  private async onAuthOk(
    connectionID: string,
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    const connection = this.getConnection(connectionID);
    const status = connection?.status;
    if (status != "wait-auth-request") return;
    if (!connection) return;

    await this.p2p.validateConnection(
      connectionID,
      connection.remoteID,
      connection.publicKey,
      connection.name,
      auth
    );
    this.p2p.requestJoin(connectionID, connection.roomID, cb);
  }

}
