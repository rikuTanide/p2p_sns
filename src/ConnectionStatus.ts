import Peer, { DataConnection } from "skyway-js";
// import { Subject } from "rxjs";
// import { ConnectionBundle } from "./ConnectionBundle";
import {useEffect, useState} from "react";

export interface State {
  connectionAuthStatus: ConnectionAuthStatus;
  users: User[];
  text: string;

}

export interface User {
  publicKey: string;
  publicKeyDigest: string;
  name: string;
  introduce: string;
  trust: boolean;
  own: boolean;
  block: boolean;
  quite: boolean;
}
type ComingConnectionStatus =
    | "connected"
    | "wait-auth-request"
    | "processing-auth-request"
    | "authorized";

type GoingConnectionStatus =
    | "connecting"
    | "processing-auth-request"
    | "authorized";

interface GoingConnection {
  status: GoingConnectionStatus;
  remoteID: string;
  connectionID: string;
}

interface ComingConnection {
  status: ComingConnectionStatus;
  remoteID: string;
  connectionID: string;
}

interface ValidatedConnection {
  remoteID: string;
  connectionID: string;
  publicKey: string;
  publicKeyHash: string;
}
export interface ConnectionAuthStatus {
   comingConnections: ComingConnection[];
   goingConnections: GoingConnection[];
   validatedConnections: ValidatedConnection[];

}

const skyWayKey = "77157c8d-8852-4dd0-b465-10f57625ffc7";

const defaultState: State = {
  connectionAuthStatus: {
    comingConnections:[],
    goingConnections: [],
    validatedConnections: [],
  },
  users: [],
  text: "",
}

interface Handlers {

}

function useSns() {
  const [state, setState] = useState<State>(defaultState);
  useEffect(() => {});
  return state;
}