import { Subject } from "rxjs";
import Peer, { DataConnection } from "skyway-js";

export interface OnOpenEvent {
  connectionID: string;
  remoteID: string;
}

export interface OnDataEvent {
  connectionID: string;
  data: any;
}

export interface OnCloseEvent {
  connectionID: string;
}

export class ConnectionBundler {
  public constructor(private peer: Peer) {
    peer.on("connection", (con) => {
      this.map.set(con.id, con);
      this.onOpen.next({
        connectionID: con.id,
        remoteID: con.remoteId,
      });

      con.on("data", (data) => {
        this.onData.next({
          connectionID: con.id,
          data: data,
        });
      });

      con.on("close", () => {
        this.map.delete(con.id);
        this.onClose.next({
          connectionID: con.id,
        });
      });
    });
  }

  private map = new Map<string, DataConnection>();

  public onOpen = new Subject<OnOpenEvent>();
  public onData = new Subject<OnDataEvent>();
  public onClose = new Subject<OnCloseEvent>();

  public connect(remoteID: string) {
    const other = this.peer.connect(remoteID);
    this.map.set(remoteID, other);
    other.on("open", () => {
      this.onOpen.next({
        connectionID: other.id,
        remoteID: other.remoteId,
      });
    });
    other.on("close", () => {
      this.map.delete(other.id);
      this.onClose.next({
        connectionID: other.id,
      });
    });
  }
  public send(connectionID: string, data: any) {
    this.map.get(connectionID)?.send(data);
  }
  public close(connectionID: string) {
    // イベント投げること
    this.map.get(connectionID)?.close();
  }
}
