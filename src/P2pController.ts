import {
  ComingConnection,
  ComingConnectionStatus,
  Comment,
  ConnectionAuthStatus,
  GoingConnection,
  GoingConnectionStatus,
  State,
  ValidatedConnection,
} from "./useStatus";
import { ConnectionBundler } from "./ConnectionBundler";
import { PersistentService } from "./PersistentService";
import { AuthService } from "./AuthService";
import { DelegateGoingConnection } from "./DelegateGoingConnection";
import { DelegateComingConnection } from "./DelegateComingConnection";
import { DelegateValidatedConnection } from "./DelegateValidatedConnection";
import { HistoryService } from "./HistoryService";

type SetStateCallback = (state: State) => void;

export class P2pController {
  public state: State;
  public callback: SetStateCallback = (state: State) => {};

  public constructor(state: State) {
    this.state = state;
  }

  public send(roomID: string, text: string, cb: ConnectionBundler) {
    const digest = this.state.users.find((u) => u.own)!.publicKeyDigest;
    if (!digest) return;
    const nextComment: Comment = {
      publicKeyDigest: digest,
      roomID: roomID,
      text: text,
    };
    const nextComments: Comment[] = [nextComment, ...this.state.comments];
    const state: State = {
      ...this.state,
      comments: nextComments,
    };

    this.state = state;
    this.callback(state);

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
    if (connectionType == "") {
      await new DelegateComingConnection(this).onOpen(
        connectionID,
        remoteID,
        cb,
        auth
      );
    }
  }

  public onClose(
    connectionID: string,
    cb: ConnectionBundler,
    history: HistoryService
  ) {
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
    const members = this.state.members.filter(
      (m) => m.connectionID != connectionID
    );
    const nextState: State = {
      ...this.state,
      connectionAuthStatus: next,
      members: members,
    };

    this.state = nextState;
    this.callback(nextState);
    new DelegateValidatedConnection(this).updateUrl(
      this.state.roomID,
      cb,
      history
    );
  }

  public async onData(
    connectionID: string,
    data: any,
    cb: ConnectionBundler,
    auth: AuthService,
    history: HistoryService
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
    } else if (connectionType == "validated") {
      await new DelegateValidatedConnection(this).onData(
        connectionID,
        method,
        payload,
        cb,
        history
      );
    }
  }

  // private
  private roomConnections(roomID: string): ValidatedConnection[] {
    const memberConnectionIDs = this.state.members
      .filter((m) => m.roomID == roomID)
      .map((c) => c.connectionID);
    return this.state.connectionAuthStatus.validatedConnections.filter(
      (c) => memberConnectionIDs.indexOf(c.connectionID) > -1
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

  public requestJoin(
    connectionID: string,
    roomID: string,
    cb: ConnectionBundler
  ) {
    const data = ["request-join", roomID];
    const json = JSON.stringify(data);
    cb.send(connectionID, json);
  }
}
