import { ComingConnection, ComingConnectionStatus, State } from "./useStatus";
import { ConnectionBundler } from "./ConnectionBundler";
import { AuthService } from "./AuthService";
import { P2pController } from "./P2pController";

export class DelegateComingConnection {
  constructor(private p2p: P2pController) {}

  private getConnection(connectionID: string): ComingConnection | undefined {
    return this.p2p.state.connectionAuthStatus.comingConnections.find(
      (c) => c.connectionID == connectionID
    );
  }

  private addConnection(connectionID: string, remoteID: string) {
    const nextList = this.p2p.state.connectionAuthStatus.comingConnections.concat(
      {
        connectionID: connectionID,
        remoteID: remoteID,
        status: "connected",
      }
    );
    const nextState: State = {
      ...this.p2p.state,
      connectionAuthStatus: {
        ...this.p2p.state.connectionAuthStatus,
        comingConnections: nextList,
      },
    };
    this.callback(nextState);
  }

  private callback(state: State) {
    this.p2p.setState(state);
  }

  public async onOpen(
    connectionID: string,
    remoteID: string,
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    this.addConnection(connectionID, remoteID);
    const sign = await auth.signConnection(connectionID);
    const data = [
      "auth-request",
      auth.ownPublicKeyJson,
      sign,
      this.userName(),
      this.introduce(),
    ];
    const json = JSON.stringify(data);
    cb.send(connectionID, json);
    if (this.getStatus(connectionID) != "connected") return;
    this.updateConnection(connectionID, { status: "wait-auth-request" });
  }

  public async onData(
    connectionID: string,
    method: string,
    payload: any[],
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    const status = this.getStatus(connectionID);
    if (method == "auth-request") {
      if (status != "wait-auth-request") return;
      await this.onAuthRequest(connectionID, payload, cb, auth);
    }
  }

  private async onAuthRequest(
    connectionID: string,
    payload: any[],
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    const otherPublicKeyJson = payload[0];
    const otherSign = payload[1];
    const otherUserName = payload[2];
    const otherIntroduce = payload[3];

    const ok = await auth.verify(connectionID, otherPublicKeyJson, otherSign);
    if (!ok) {
      cb.close(connectionID);
      return;
    }

    await this.validated(
      connectionID,
      otherPublicKeyJson,
      otherUserName,
      otherIntroduce,
      auth
    );

    const data = ["auth-ok"];
    const json = JSON.stringify(data);
    cb.send(connectionID, json);
  }

  private userName() {
    return this.p2p.getUserName();
  }

  private introduce() {
    return this.p2p.getIntroduce();
  }

  private getStatus(connectionID: string): ComingConnectionStatus | undefined {
    return this.getConnection(connectionID)?.status;
  }

  private updateConnection(
    connectionID: string,
    attr: { status?: ComingConnectionStatus; remoteID?: string }
  ) {
    const c = this.getConnection(connectionID);
    if (!c) throw "connectionがない";
    const n: ComingConnection = {
      connectionID: connectionID,
      remoteID: attr.remoteID || c.remoteID,
      status: attr.status || c.status,
    };

    const nextList = this.p2p.state.connectionAuthStatus.comingConnections
      .filter((c) => c.connectionID != connectionID)
      .concat(n);
    const nextStatus: State = {
      ...this.p2p.state,
      connectionAuthStatus: {
        ...this.p2p.state.connectionAuthStatus,
        comingConnections: nextList,
      },
    };
    this.callback(nextStatus);
  }

  private async validated(
    connectionID: string,
    publicKey: string,
    name: string,
    introduce: string,
    auth: AuthService
  ) {
    const c = this.getConnection(connectionID);
    if (!c) {
      throw "nai";
    }

    await this.p2p.validateConnection(
      connectionID,
      c.remoteID,
      publicKey,
      name,
      introduce,
      auth
    );
  }
}
