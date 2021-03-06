import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import Peer from "skyway-js";
import { AuthService, getOwnKeyPair } from "./AuthService";
import App from "./App";
import { State, User } from "./useStatus";
import { HistoryService } from "./HistoryService";
import { ConnectionBundler } from "./ConnectionBundler";
import { P2pController } from "./P2pController";
import { createHashHistory } from "history";
import { PersistentService } from "./PersistentService";

function createPeer(key: string): Promise<Peer> {
  const own = new Peer({ key: key });
  return new Promise<Peer>((solve) => {
    own.on("open", (id) => {
      solve(own);
    });
  });
}

function createRoom(): string {
  return AuthService.random();
}

const defaultState: State = {
  roomID: "",
  connectionAuthStatus: {
    comingConnections: [],
    goingConnections: [],
    validatedConnections: [],
  },
  users: [],
  members: [],
  comments: [],
  url: "",
};

function createRoomInitialize(
  ownUser: User,
  historyService: HistoryService,
  peerID: string
): P2pController {
  const roomID = createRoom();
  historyService.setRoom(roomID, peerID);
  const initialState: State = {
    ...defaultState,
    users: [ownUser],
    connectionAuthStatus: {
      ...defaultState.connectionAuthStatus,
      validatedConnections: [],
    },
    roomID: roomID,
  };
  return new P2pController(initialState);
}

function joinInitialize(
  ownUser: User,
  historyService: HistoryService,
  cb: ConnectionBundler
): P2pController {
  const roomID = historyService.getRoomID()!;
  const peers = historyService.getPeers();
  const initialState: State = {
    ...defaultState,
    users: [ownUser],
    connectionAuthStatus: {
      ...defaultState.connectionAuthStatus,
      validatedConnections: [],
    },
    roomID: roomID,
  };
  const p2p = new P2pController(initialState);
  for (const peer of peers) {
    p2p.connect(roomID, peer, cb);
  }
  return p2p;
}

function createOwnUser(
  publicKey: string,
  publicKeyDigest: string,
  persistentService: PersistentService
): User {
  const [name, introduce] = persistentService.getProfile();
  return {
    own: true,
    trust: true,
    publicKey: publicKey,
    publicKeyDigest: publicKeyDigest,
    name: name || "",
    introduce: introduce || "",
    visible: true,
  };
}

async function main() {
  const peer = await createPeer("77157c8d-8852-4dd0-b465-10f57625ffc7");
  const persistentService = new PersistentService();
  const [publicKeyJson, publicKey, privateKey] = await getOwnKeyPair(
    persistentService
  );
  const history = createHashHistory();
  const historyService = new HistoryService(history);
  const auth = new AuthService(publicKeyJson, privateKey);
  const cb = new ConnectionBundler(peer);
  const ownUser = createOwnUser(
    auth.ownPublicKeyJson,
    await auth.digest(auth.ownPublicKeyJson),
    persistentService
  );

  const p2pController = historyService.getRoomID()
    ? joinInitialize(ownUser, historyService, cb)
    : createRoomInitialize(ownUser, historyService, peer.id);

  window.addEventListener("beforeunload", () => {
    cb.peer.destroy();
  });

  p2pController.onUrlChange(window.location.href);

  historyService.onUrlChange().subscribe((h) => {
    p2pController.onUrlChange(h);
  });

  ReactDOM.render(
    <React.StrictMode>
      <App
        cb={cb}
        p2pController={p2pController}
        auth={auth}
        history={historyService}
        persistent={persistentService}
      />
    </React.StrictMode>,
    document.getElementById("root")
  );
}

main();
