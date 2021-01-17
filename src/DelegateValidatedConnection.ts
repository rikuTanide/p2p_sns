import { P2pController } from "./P2pController";
import { ConnectionBundler } from "./ConnectionBundler";
import { Comment, State } from "./useStatus";

export class DelegateValidatedConnection {
  constructor(private p2p: P2pController) {}

  public async onData(
    connectionID: string,
    method: string,
    payload: any[],
    cb: ConnectionBundler
  ) {
    if (method == "request-join") {
      this.onJoin(connectionID, payload, cb);
    } else if (method == "comment") {
      this.onComment(connectionID, payload, cb);
    }
  }

  private async onJoin(
    connectionID: string,
    payload: any[],
    cb: ConnectionBundler
  ) {
    const roomID = payload[0];
    this.p2p.mergeMember(roomID, connectionID);
    const memberIDs = this.p2p.state.members
      .filter((m) => m.roomID == roomID)
      .map((c) => this.getRemoteID(c.connectionID))
      .filter((c) => !!c)
      .concat(cb.peer.id) as string[];
    const data = ["join-ok", roomID, memberIDs];
    const json = JSON.stringify(data);
    cb.send(connectionID, json);
  }

  private getRemoteID(connectionID: string): string | undefined {
    return this.p2p.state.connectionAuthStatus.validatedConnections.find(
      (v) => v.connectionID == connectionID
    )?.remoteID;
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
    this.p2p.state = state;
    this.p2p.callback(state);
  }

  private getPublicKeyDigest(connectionID: string): string | undefined {
    return this.p2p.state.connectionAuthStatus.validatedConnections.find(
      (c) => c.connectionID == connectionID
    )?.publicKeyDigest;
  }
}
