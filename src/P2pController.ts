import {
  ComingConnection,
  ComingConnectionStatus,
  ConnectionAuthStatus,
  GoingConnection,
  GoingConnectionStatus,
  State,
  ValidatedConnection,
} from "./useStatus";
import { ConnectionBundler } from "./ConnectionBundler";
import { PersistentService } from "./PersistentService";
import { AuthService } from "./AuthService";

type SetStateCallback = (state: State) => void;

export class P2pController {
  public state: State;
  public callback: SetStateCallback = (state: State) => {};

  public constructor(state: State) {
    this.state = state;
  }

  public send(roomID: string, text: string, cb: ConnectionBundler) {
    const memberConnectionIDs = this.roomConnections(roomID).map(
      (c) => c.connectionID
    );
    for (const connectionID of memberConnectionIDs) {
      const data = ["comment", roomID, text];
      const j = JSON.stringify(data);
      cb.send(connectionID, j);
    }
  }

  public setTrust(
    publicKeyDigest: string,
    trust: boolean,
    persistentService: PersistentService
  ) {
    // persistentService.setTrust(publicKeyDigest, trust);
    // const users = this.state.users.map((u): User => u.publicKeyDigest == publicKeyDigest ? {...u, trust: trust} : u);
    // const nextState: State = {...this.state, users : users};
    // this.callback(nextState);
  }

  public setVisibility() {}

  public connect(roomID: string, remoteID: string, cb: ConnectionBundler) {
    new DelegateGoingConnection(this).connect(roomID, remoteID, cb);
  }

  public async onOpen(
    connectionID: string,
    remoteID: string,
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    const connectionType = this.getConnectionType(connectionID);
    if (connectionType == "going") {
      new DelegateGoingConnection(this).onOpen(connectionID, remoteID);
    } else if (connectionType == "") {
      await new DelegateComingConnection(this).onOpen(
        connectionID,
        remoteID,
        cb,
        auth
      );
    }
  }

  public onClose(connectionID: string) {
    const next: ConnectionAuthStatus = {
      comingConnections: this.state.connectionAuthStatus.comingConnections.filter(
        (c) => c.connectionID != connectionID
      ),
      goingConnections: this.state.connectionAuthStatus.goingConnections.filter(
        (c) => c.connectionID != connectionID
      ),
      validatedConnections: this.state.connectionAuthStatus.validatedConnections.filter(
        (c) => c.connectionID != connectionID
      ),
    };

    const nextState: State = {
      ...this.state,
      connectionAuthStatus: next,
    };

    this.callback(nextState);
  }

  public async onData(
    connectionID: string,
    data: any,
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    const [method, ...payload] = JSON.parse(data) as [string, ...any];
    const connectionType = this.getConnectionType(connectionID);
    if (connectionType == "going") {
      await new DelegateGoingConnection(this).onData(
        connectionID,
        method,
        payload,
        cb,
        auth
      );
    } else if (connectionType == "coming") {
      await new DelegateComingConnection(this).onData(
        connectionID,
        method,
        payload,
        cb,
        auth
      );
    }
  }

  // private
  private roomConnections(roomID: string): ValidatedConnection[] {
    const memberConnectionIDs = this.state.members
      .filter((m) => m.roomID == roomID)
      .map((c) => c.connectionID);
    return this.state.connectionAuthStatus.validatedConnections.filter(
      (c) => memberConnectionIDs.indexOf(c.connectionID) > 0
    );
  }

  private getConnectionType(
    connectionID: string
  ): "" | "going" | "coming" | "validated" {
    if (
      this.state.connectionAuthStatus.goingConnections.find(
        (c) => c.connectionID == connectionID
      )
    )
      return "going";
    if (
      this.state.connectionAuthStatus.comingConnections.find(
        (c) => c.connectionID == connectionID
      )
    )
      return "coming";
    if (
      this.state.connectionAuthStatus.validatedConnections.find(
        (c) => c.connectionID == connectionID
      )
    )
      return "validated";
    return "";
  }

  public async validateConnection(
    connectionID: string,
    remoteID: string,
    publicKey: string,
    name: string,
    auth: AuthService
  ) {
    const cas = this.state.connectionAuthStatus;
    const publicKeyDigest = await auth.digest(publicKey);
    const n: ValidatedConnection = {
      connectionID: connectionID,
      remoteID: remoteID,
      publicKey: publicKey,
      publicKeyDigest: publicKeyDigest,
    };
    const nextV = cas.validatedConnections.concat(n);
    const nextState: State = {
      ...this.state,
      connectionAuthStatus: {
        comingConnections: cas.comingConnections.filter(
          (c) => c.connectionID != connectionID
        ),
        goingConnections: cas.goingConnections.filter(
          (c) => c.connectionID != connectionID
        ),
        validatedConnections: nextV,
      },
    };
    this.state = nextState;
    this.callback(nextState);
  }

  public getUserName() {
    return this.state.users.find((o) => o.own)?.name || "";
  }
}

class DelegateGoingConnection {
  constructor(private p2p: P2pController) {}

  public connect(roomID: string, remoteID: string, cb: ConnectionBundler) {
    if (this.isConnect(remoteID)) return;
    const now = this.p2p.state;
    cb.connect(remoteID);
    const next = now.connectionAuthStatus.goingConnections.concat({
      status: "connecting",
      connectionID: "",
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

  private isConnect(remoteID: string): boolean {
    const ah = this.p2p.state.connectionAuthStatus;
    if (ah.validatedConnections.find((c) => c.remoteID == remoteID))
      return true;
    if (ah.comingConnections.find((c) => c.remoteID == remoteID)) return true;
    if (ah.goingConnections.find((c) => c.remoteID == remoteID)) return true;
    return false;
  }

  private callback(state: State) {
    this.p2p.state = state;
    this.p2p.callback(state);
  }

  public onOpen(connectionID: string, remoteID: string) {
    this.updateStatus(connectionID, { remoteID: remoteID });
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
      await this.onAuthOk(connectionID, payload, cb, auth);
    } else if (method == "join-ok") {
      await this.onJoinOk(connectionID, payload, cb, auth);
    }
  }

  private getConnection(connectionID: string): GoingConnection | undefined {
    return this.p2p.state.connectionAuthStatus.goingConnections.find(
      (c) => c.connectionID
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
      name: attr.status || c.status || "",
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
    if (status != "connected") return;
    this.updateStatus(connectionID, { status: "processing-auth-request" });
    const otherPublicKeyJson = payload[0];
    const otherSign = payload[1];
    const otherUserName = payload[2];
    const roomID = this.getRoomID(connectionID);

    const ok = await auth.verify(connectionID, otherPublicKeyJson, otherSign);
    if (!ok) {
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
    payload: any[],
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    const connection = this.getConnection(connectionID);
    const status = connection?.status;
    if (status != "wait-auth-request") return;

    const publicKey = payload[0],
      sign = payload[1],
      name = payload[2];
    const ok = await auth.verify(connectionID, publicKey, sign);
    if (!ok) {
      cb.close(connectionID);
      return;
    }

    this.updateStatus(connectionID, {
      status: "request-join",
      publicKey: publicKey,
      name: name,
    });
    const roomID = this.getRoomID(connectionID);
    const data = ["request-join", roomID];
    const json = JSON.stringify(data);
    cb.send(connectionID, json);
  }

  private async onJoinOk(
    connectionID: string,
    payload: any[],
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    const c = this.getConnection(connectionID);
    if (!c) return;

    const status = c.status;
    if (status != "request-join") return;

    await this.validateConnection(connectionID, auth);

    const roomID = payload[0];
    console.assert(roomID == this.getRoomID(connectionID), "roomIDがおかしい");

    this.mergeMember(c.roomID, c.connectionID);
    const memberRemoteIDs = payload[1] as string[];

    for (const memberRemoteID of memberRemoteIDs) {
      this.p2p.connect(roomID, memberRemoteID, cb);
    }
  }

  private async validateConnection(connectionID: string, auth: AuthService) {
    const c = this.getConnection(connectionID);
    if (!c) {
      throw "nai";
    }

    await this.p2p.validateConnection(
      connectionID,
      c.remoteID,
      c.publicKey,
      c.name,
      auth
    );
  }

  private mergeMember(roomID: string, connectionID: string) {
    const nextList = this.p2p.state.members
      .filter((m) => !(m.roomID == roomID && m.connectionID == connectionID))
      .concat({
        connectionID: connectionID,
        roomID: roomID,
      });
    const nextState: State = {
      ...this.p2p.state,
      members: nextList,
    };

    this.callback(nextState);
  }
}

class DelegateComingConnection {
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
    this.p2p.state = state;
    this.p2p.callback(state);
  }

  public async onOpen(
    connectionID: string,
    remoteID: string,
    cb: ConnectionBundler,
    auth: AuthService
  ) {
    this.addConnection(connectionID, remoteID);
    const sign = await auth.signConnection(connectionID);
    const data = ["auth-request", auth.ownPublicKeyJson, sign, this.userName()];
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
    const otherUserName = payload[3];

    const ok = await auth.verify(connectionID, otherPublicKeyJson, otherSign);
    if (!ok) {
      cb.close(connectionID);
      return;
    }

    await this.validated(connectionID, otherPublicKeyJson, otherUserName, auth);

    const data = ["validated-ok"];
    const json = JSON.stringify(data);
    cb.send(connectionID, json);
  }

  private userName() {
    return this.p2p.getUserName();
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
      auth
    );
  }
}
