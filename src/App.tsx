import React, { ChangeEvent } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useSns } from "./useStatus";
import { ConnectionBundler } from "./ConnectionBundler";
import { P2pController } from "./P2pController";
import { AuthService } from "./AuthService";
import { HistoryService } from "./HistoryService";

export const App: React.FunctionComponent<{
  cb: ConnectionBundler;
  p2pController: P2pController;
  auth: AuthService;
  history: HistoryService;
}> = (props) => {
  const [state, handler, texts] = useSns(
    props.cb,
    props.p2pController,
    props.auth,
    props.history
  );

  const roomID = state.roomID;
  const text = texts.find((t) => t.roomID == roomID)?.text || "";

  function onTextChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    handler.onTextInput(roomID, value);
  }

  function onSubmit() {
    handler.onSubmit(roomID);
  }

  const comments = state.comments.filter((c) => c.roomID == roomID);

  const ownDigest = state.users.find((u) => u.own)?.publicKeyDigest;
  function isOwn(digest: string): boolean {
    return ownDigest == digest;
  }

  return (
    <div>
      <input type="text" value={text} onChange={onTextChange} />
      <button onClick={onSubmit}>送信</button>

      {comments.map((c, i) => (
        <div key={i}>
          <div>
            {c.publicKeyDigest}
            {isOwn(c.publicKeyDigest) ? "☑" : ""}
          </div>
          {c.text}
        </div>
      ))}
      <div style={{ border: "solid 1px black" }}>
        <div>{props.cb.peer.id}</div>
        <hr />
        {state.connectionAuthStatus.validatedConnections.map((u) => (
          <div key={u.remoteID}>{u.remoteID}</div>
        ))}
      </div>
    </div>
  );
};

export default App;
