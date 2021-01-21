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
  public constructor(public peer: Peer) {
    peer.on("connection", (con) => {
      this.map.set(con.id, con);
      con.on("open", () => {
        this.onOpen.next({
          connectionID: con.id,
          remoteID: con.remoteId,
        });
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
      con.on("error", (e) => {
        console.error(e);
      });
    });
    peer.on("error", (e) => {
      console.error(e);
    });
  }

  private map = new Map<string, DataConnection>();

  public onOpen = new Subject<OnOpenEvent>();
  public onData = new Subject<OnDataEvent>();
  public onClose = new Subject<OnCloseEvent>();

  public connect(remoteID: string): Promise<string> {
    return new Promise<string>((solve) => {
      const other = this.peer.connect(remoteID);
      this.map.set(other.id, other);
      other.on("open", () => {
        console.log(["connect", other.id, remoteID]);
        solve(other.id);
      });
      other.on("data", (data) => {
        this.onData.next({
          data: data,
          connectionID: other.id,
        });
      });
      other.on("close", () => {
        this.map.delete(other.id);
        this.onClose.next({
          connectionID: other.id,
        });
      });
      other.on("error", (e) => {
        console.error(e);
      });
    });
  }
  public send(connectionID: string, data: any) {
    console.log([!!this.map.get(connectionID), data]);
    this.map.get(connectionID)?.send(data);
  }
  public close(connectionID: string) {
    // イベント投げること
    this.map.get(connectionID)?.close();
  }
}
