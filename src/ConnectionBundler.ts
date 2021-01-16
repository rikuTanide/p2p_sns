import { Subject } from "rxjs";
import Peer from "skyway-js";

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
  public constructor(private peer: Peer) {}

  public onOpen = new Subject<OnOpenEvent>();
  public onData = new Subject<OnDataEvent>();
  public onClose = new Subject<OnCloseEvent>();

  public connect(remoteID: string) {}
  public send(connectionID: string, data: any) {}
  public close(connectionID: string) {
    // イベント投げること
  }
}
