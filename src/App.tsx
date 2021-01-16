import React, { ChangeEvent } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useSns } from "./useStatus";
import { ConnectionBundler } from "./ConnectionBundler";
import { P2pController } from "./P2pController";
import { AuthService } from "./AuthService";

export const App: React.FunctionComponent<{
  cb: ConnectionBundler;
  p2pController: P2pController;
  auth: AuthService;
}> = (props) => {
  const [state, handler, texts] = useSns(
    props.cb,
    props.p2pController,
    props.auth
  );

  const roomID = state.roomID;
  const text = texts.find((t) => t.roomID == roomID)?.text || "";

  function onTextChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    handler.onTextInput(roomID, value);
  }

  return (
    <div>
      <input type="text" value={text} onChange={onTextChange} />
    </div>
  );
};

export default App;
