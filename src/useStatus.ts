// import { ConnectionBundle } from "./ConnectionBundle";
import { useEffect, useState } from "react";
import { ConnectionBundler } from "./ConnectionBundler";
import { P2pController } from "./P2pController";
import { AuthService } from "./AuthService";
import { HistoryService } from "./HistoryService";

export interface State {
  roomID: string;
  connectionAuthStatus: ConnectionAuthStatus;
  users: User[];
  members: Member[];
  comments: Comment[];
  url: string;
}

export interface Member {
  roomID: string;
  connectionID: string;
}

export interface Comment {
  roomID: string;
  publicKeyDigest: string;
  text: string;
}

export interface User {
  publicKey: string;
  publicKeyDigest: string;
  name: string;
  introduce: string;
  trust: boolean;
  own: boolean;
  visible: boolean;
}
export type ComingConnectionStatus =
  | "connected"
  | "wait-auth-request"
  | "processing-auth-request"
  | "authorized";

export type GoingConnectionStatus =
  | "connected"
  | "processing-auth-request"
  | "wait-auth-request";

export interface GoingConnection {
  status: GoingConnectionStatus;
  remoteID: string;
  roomID: string;
  connectionID: string;
  publicKey: string;
  name: string;
  introduce: string;
}

export interface ComingConnection {
  status: ComingConnectionStatus;
  remoteID: string;
  connectionID: string;
}

export interface ValidatedConnection {
  remoteID: string;
  connectionID: string;
  publicKey: string;
  publicKeyDigest: string;
}
export interface ConnectionAuthStatus {
  comingConnections: ComingConnection[];
  goingConnections: GoingConnection[];
  validatedConnections: ValidatedConnection[];
}

const skyWayKey = "77157c8d-8852-4dd0-b465-10f57625ffc7";

export interface InputText {
  roomID: string;
  text: string;
}

export type OnInput = (roomID: string, text: string) => void;
export type OnSubmit = (roomID: string) => void;
export type SetVisibility = (publicKeyDigest: string, visible: boolean) => void;
export type SetTrust = (publicKeyDigest: string, trust: boolean) => void;

interface Handlers {
  onTextInput: OnInput;
  onSubmit: OnSubmit;
  setVisibility: SetVisibility;
  setTrust: SetTrust;
}

export function useSns(
  cb: ConnectionBundler,
  p2pController: P2pController,
  auth: AuthService,
  history: HistoryService
): [State, Handlers, InputText[]] {
  const [state, setState] = useState<State>(p2pController.state);
  const [texts, setTexts] = useState<InputText[]>([]);

  useEffect(() => {
    const os = p2pController.subject.subscribe((s) => setState(s));
    const oos = cb.onOpen.subscribe((o) => {
      console.log(["open", o]);
      p2pController.onOpen(o.connectionID, o.remoteID, cb, auth);
    });
    const ods = cb.onData.subscribe((d) => {
      console.log(["data", d]);
      p2pController.onData(d.connectionID, d.data, cb, auth, history);
    });
    const ocs = cb.onClose.subscribe((c) => {
      console.log("close", c);
      p2pController.onClose(c.connectionID, cb, history);
    });

    return () => {
      os.unsubscribe();
      oos.unsubscribe();
      ods.unsubscribe();
      ocs.unsubscribe();
    };
  });
  function onSubmit(roomID: string) {
    const text = texts.find((t) => t.roomID == roomID)?.text;
    if (!text) return;
    p2pController.send(roomID, text, cb);
    onTextInput(roomID, "");
  }

  function onTextInput(roomID: string, text: string) {
    const nextTexts = texts
      .filter((t) => t.roomID != roomID)
      .concat({ roomID: roomID, text: text });
    setTexts(nextTexts);
  }

  function setVisibility(publicKeyDigest: string, visible: boolean) {
    // p2pController.setVisibility(publicKeyDigest, visible);
  }

  function setTrust(publicKeyDigest: string, trust: boolean) {
    // p2pController.setTrust(publicKeyDigest,trust);
  }

  const handlers: Handlers = {
    onSubmit: onSubmit,
    onTextInput: onTextInput,
    setTrust: setTrust,
    setVisibility: setVisibility,
  };
  return [state, handlers, texts];
}
