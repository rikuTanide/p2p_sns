import { HashHistory } from "history";
import {Observable, Subject} from "rxjs";

export class HistoryService {

  private subject: Subject<string> = new Subject<string>();

  constructor(private history: HashHistory) {}

  public onUrlChange() : Observable<string> {
    return this.subject;
  }

  public getRoomID(): string | null {
    return new URLSearchParams(this.history.location.search).get("room");
  }

  public setRoom(roomID: string, peerID: string) {
    const p = new URLSearchParams();
    p.set("room", roomID);
    p.set("peer", peerID);
    this.history.push("?" + p.toString());
    this.subject.next(window.location.href);
  }

  public getPeers(): string[] {
    return new URLSearchParams(this.history.location.search).getAll("peer");
  }

  public setPeers(roomID: string, remoteIDs: string[]) {
    const params = new URLSearchParams();
    params.set("room", roomID);
    for (const remoteID of remoteIDs) {
      params.append("peer", remoteID);
    }
    this.history.push("?" + params.toString());
    this.subject.next(window.location.href);
  }
}
