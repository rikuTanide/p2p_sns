import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import Peer from "skyway-js";
import { AuthService, getOwnKeyPair } from "./AuthService";
import App from "./App";
import { defaultState, State } from "./ConnectionStatus";
import { HistoryService } from "./HistoryService";
import { ConnectionBundler } from "./ConnectionBundler";
import { P2pController } from "./P2pController";
import { createHashHistory } from "history";

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

async function main() {
  const peer = await createPeer("77157c8d-8852-4dd0-b465-10f57625ffc7");
  const [publicKeyJson, publicKey, privateKey] = await getOwnKeyPair();
  const history = createHashHistory();
  const historyService = new HistoryService(history);

  if (!historyService.getRoomID()) {
    const roomID = createRoom();
    historyService.setRoom(roomID, peer.id);
  }

  const initialState: State = {
    ...defaultState,
    roomID: historyService.getRoomID()!,
  };

  const cb = new ConnectionBundler(peer);
  const p2pController = new P2pController(initialState);
  const auth = new AuthService(publicKeyJson, privateKey);

  ReactDOM.render(
    <React.StrictMode>
      <App cb={cb} p2pController={p2pController} auth={auth} />
    </React.StrictMode>,
    document.getElementById("root")
  );
}

main();
