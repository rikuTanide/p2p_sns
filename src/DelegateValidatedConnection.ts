import { P2pController } from "./P2pController";
import { ConnectionBundler } from "./ConnectionBundler";
import { Comment, State, ValidatedConnection } from "./useStatus";
import { HistoryService } from "./HistoryService";

export class DelegateValidatedConnection {
  constructor(private p2p: P2pController) {}

  public async onData(
    connectionID: string,
    method: string,
    payload: any[],
    cb: ConnectionBundler,
    history: HistoryService
  ) {
    if (method == "request-join") {
      this.onJoin(connectionID, payload, cb, history);
    } else if (method == "comment") {
      this.onComment(connectionID, payload, cb);
    } else if (method == "join-ok") {
      this.onJoinOk(connectionID, payload, cb, history);
    } else if (method == "profile") {
      this.onProfile(connectionID, payload);
    }
  }

  private async onJoinOk(
    connectionID: string,
    payload: any[],
    cb: ConnectionBundler,
    history: HistoryService
  ) {
    const roomID = payload[0];
    this.mergeMember(roomID, connectionID, cb, history);
    const memberRemoteIDs = payload[1] as string[];

    for (const memberRemoteID of memberRemoteIDs) {
      // 繋がらない場合があるからawaitしない
      this.p2p.connect(roomID, memberRemoteID, cb);
    }
  }

  private async onJoin(
    connectionID: string,
    payload: any[],
    cb: ConnectionBundler,
    history: HistoryService
  ) {
    const roomID = payload[0];
    this.mergeMember(roomID, connectionID, cb, history);
    const memberIDs = this.p2p.state.members
      .filter((m) => m.roomID == roomID)
      .map((c) => this.getRemoteID(c.connectionID))
      .filter((c) => !!c)
      .concat(cb.peer.id) as string[];
    const data = ["join-ok", roomID, memberIDs];
    const json = JSON.stringify(data);
    cb.send(connectionID, json);
  }

  private getConnection(connectionID: string): ValidatedConnection | undefined {
    return this.p2p.state.connectionAuthStatus.validatedConnections.find(
      (v) => v.connectionID == connectionID
    );
  }

  private getRemoteID(connectionID: string): string | undefined {
    return this.getConnection(connectionID)?.remoteID;
  }

  private onComment(
    connectionID: string,
    payload: any[],
    cb: ConnectionBundler
  ) {
    const roomID = payload[0];
    const text = payload[1];
    const digest = this.getPublicKeyDigest(connectionID);
    if (!digest) return;
    const nextComment: Comment = {
      publicKeyDigest: digest,
      roomID: roomID,
      text: text,
    };
    const nextComments: Comment[] = [nextComment, ...this.p2p.state.comments];
    const state: State = {
      ...this.p2p.state,
      comments: nextComments,
    };
    this.callback(state);
  }

  private callback(state: State) {
    this.p2p.setState(state);
  }

  private getPublicKeyDigest(connectionID: string): string | undefined {
    return this.p2p.state.connectionAuthStatus.validatedConnections.find(
      (c) => c.connectionID == connectionID
    )?.publicKeyDigest;
  }

  public mergeMember(
    roomID: string,
    connectionID: string,
    cb: ConnectionBundler,
    history: HistoryService
  ) {
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
    this.updateUrl(roomID, cb, history);
  }

  public updateUrl(
    roomID: string,
    cb: ConnectionBundler,
    history: HistoryService
  ) {
    const remoteIDs = this.getRoomMemberRemoteIDs(roomID, cb);
    history.setPeers(roomID, remoteIDs);
  }

  private getRoomMemberRemoteIDs(
    roomID: string,
    cb: ConnectionBundler
  ): string[] {
    const findPeerID = (connectionID: string): string | undefined =>
      this.p2p.state.connectionAuthStatus.validatedConnections.find(
        (c) => c.connectionID == connectionID
      )?.remoteID;

    return this.p2p.state.members
      .filter((m) => m.roomID)
      .map((c) => findPeerID(c.connectionID))
      .concat(cb.peer.id)
      .filter((rid) => !!rid) as string[];
  }

  private onProfile(connectionID: string, payload: any[]) {
    const name = payload[0];
    const introduce = payload[1];
    const digest = this.p2p.state.connectionAuthStatus.validatedConnections.find(
      (u) => u.connectionID == connectionID
    )?.publicKeyDigest;
    const nextState: State = {
      ...this.p2p.state,
      users: this.p2p.state.users.map((u) =>
        u.publicKeyDigest == digest
          ? { ...u, name: name, introduce: introduce }
          : u
      ),
    };
    this.callback(nextState);
  }
}
