import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import Peer, { DataConnection } from "skyway-js";

interface ConnectionUser {
  peerID: string;
  userHash: string;
}

interface User {
  userHash: string;
  name: string;
}

const checkedRemoteIDs: Set<string> = new Set<string>();
const connections: DataConnection[] = [];
const connectionUsers: Map<string, ConnectionUser> = new Map<
  string,
  ConnectionUser
>(); // peerID, ConnectionUser
const users: Map<string, User> = new Map<string, User>(); // hash, user

function hasToId(): boolean {
  const url = new URL(window.location.href);
  return url.searchParams.has("to");
}

function getToId(): string {
  const url = new URL(window.location.href);
  return url.searchParams.get("to")!;
}

function connect(
  own: Peer,
  toId: string,
  ownPublicKeyJson: string,
  ownPrivateKey: CryptoKey,
  myName: string
): Promise<DataConnection | undefined> {
  return new Promise<DataConnection | undefined>((solve) => {
    // authorizedの時のメッセージには、メンバー情報とメッセージの二種類がある
    type Status = "connecting" | "processing-auth-request" | "authorized";
    if (checkedRemoteIDs.has(toId)) {
      solve(undefined);
      return;
    }
    checkedRemoteIDs.add(toId);
    const other = own.connect(toId);
    other.on("open", () => {
      solve(other);
      let status: Status = "connecting";
      other.on("data", async (data: any) => {
        switch (status) {
          case "connecting": {
            const authRequest = parseAuthRequest(data);
            status = "processing-auth-request";
            const ok = await validateAuthRequest(authRequest, other.id);
            if (!ok) {
              console.error("つないだ先のAuth RequestのValidationが失敗");
              solve(undefined);
              other.close();
              return;
            }
            status = "authorized";
            onConnected(other, authRequest);
            other.send(
              await createAuthRequest(
                other.id,
                ownPublicKeyJson,
                ownPrivateKey,
                myName
              )
            );
            return;
          }
          case "authorized": {
            const [method, ...payload] = JSON.parse(data);
            if (method === "member-peer-ids") {
              const memberPeerIDs = payload[0] as string[];
              for (const memberID of memberPeerIDs)
                connect(own, memberID, ownPublicKeyJson, ownPrivateKey, myName);
            } else {
              onMessage(other.remoteId, payload[0]);
            }
            return;
          }
          default: {
            return;
          }
        }
      });
    });
    other.on("error", (e) => {
      console.error(e);
      solve(undefined);
    });
  });
}

function setAlert(data: any) {
  const div = document.createElement("div");
  div.textContent = data;
  document.body.append(div);
}

function stringToArrayBuffer(src: string): ArrayBuffer {
  const array = new Uint16Array(src.split("").map((c) => c.charCodeAt(0)));
  return array.buffer;
}

async function createAuthRequest(
  connectionID: string,
  ownPublicKeyJson: string,
  ownPrivateKey: CryptoKey,
  myName: string
): Promise<string> {
  const payload = connectionID + ownPublicKeyJson;
  // const encDigest = await window.crypto.subtle.digest(
  //   "SHA-256",
  //   stringToArrayBuffer(payload)
  // );
  const encMessage = await window.crypto.subtle.sign(
    {
      name: "RSASSA-PKCS1-v1_5",
    },
    ownPrivateKey,
    // encDigest
    stringToArrayBuffer(payload)
  );
  // @ts-ignore
  const sign = bufferToString(encMessage);
  return JSON.stringify([connectionID, ownPublicKeyJson, sign, myName]);
}

interface AuthRequest {
  connectionID: string;
  otherPublicKey: string;
  sign: ArrayBuffer;
  name: string;
}

function parseAuthRequest(data: any): AuthRequest {
  const list = JSON.parse(data as string) as [string, string, string, string];
  const [connectionID, otherPublicKey, signBase64, name] = list;
  const sign = base64ToArrayBuffer(signBase64);
  return {
    connectionID: connectionID,
    otherPublicKey: otherPublicKey,
    sign: sign,
    name: name,
  };
}

function bufferToString(buf: ArrayBuffer) {
  // @ts-ignore
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function validateAuthRequest(
  authRequest: AuthRequest,
  id: string
): Promise<boolean> {
  if (id != authRequest.connectionID) return false;
  const truthPayload = authRequest.connectionID + authRequest.otherPublicKey;
  const pjwk = JSON.parse(authRequest.otherPublicKey) as JsonWebKey;
  const publicKey = await importKey(pjwk);

  const ok = await window.crypto.subtle.verify(
    {
      name: "RSASSA-PKCS1-v1_5",
    },
    publicKey,
    authRequest.sign,
    stringToArrayBuffer(truthPayload)
  );

  return ok;
}

function createMembersMessage(): string {
  return JSON.stringify([
    "member-peer-ids",
    connections.map((c) => c.remoteId),
  ]);
}

async function hash(payload: string): Promise<string> {
  const payloadAb = stringToArrayBuffer(payload);
  const digest = await window.crypto.subtle.digest("sha-256", payloadAb);
  return bufferToString(digest);
}

async function setSelfConnection(
  publicKeyJson: string,
  ownPeerID: string,
  name: string
) {
  const userHash = await hash(publicKeyJson);
  const user: User = { userHash: userHash, name: name };
  users.set(userHash, user);
  const connectionUser: ConnectionUser = {
    peerID: ownPeerID,
    userHash: userHash,
  };
  connectionUsers.set(ownPeerID, connectionUser);
}

async function onConnected(other: DataConnection, authRequest: AuthRequest) {
  connections.push(other);
  const userHash = await hash(authRequest.otherPublicKey);
  const user: User = { userHash: userHash, name: authRequest.name };
  users.set(userHash, user);
  const connectionUser: ConnectionUser = {
    peerID: other.remoteId,
    userHash: userHash,
  };
  connectionUsers.set(other.remoteId, connectionUser);
}

function onMessage(remoteId: string, message: string) {
  const div = document.createElement("div");
  const dl = document.createElement("dl");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  const hash = connectionUsers.get(remoteId)?.userHash || "";
  const hashSlice = hash.slice(0, 5) || "";
  const name = users.get(hash)?.name || "";
  const nameLabel = `${name}#${hashSlice}`;
  dt.textContent = nameLabel;
  dd.textContent = message;

  dl.append(dt);
  dl.append(dd);
  div.append(dl);
  document.body.append(div);
}

function listenConnection(
  peer: Peer,
  ownPublicKeyJson: string,
  ownPrivateKey: CryptoKey,
  myName: string
) {
  type Status =
    | "connected"
    | "wait-auth-request"
    | "processing-auth-request"
    | "authorized";
  peer.on("connection", async (other) => {
    let status: Status = "connected";
    other.on("open", async () => {
      checkedRemoteIDs.add(other.remoteId);
      other.send(
        await createAuthRequest(
          other.id,
          ownPublicKeyJson,
          ownPrivateKey,
          myName
        )
      );
      status = "wait-auth-request";
      other.on("data", async (data: any) => {
        switch (status) {
          case "wait-auth-request": {
            status = "processing-auth-request";
            const authRequest = parseAuthRequest(data);
            const ok = await validateAuthRequest(authRequest, other.id);
            if (!ok) {
              console.error("つないできた端末のAuth RequestのValidationが失敗");
              other.close();
              return;
            } else {
              status = "authorized";
              other.send(createMembersMessage());
              onConnected(other, authRequest);
            }
            return;
          }
          case "authorized": {
            onMessage(other.remoteId, JSON.parse(data)[1]);
            return;
          }
          default: {
            return;
          }
        }
      });
    });
  });
}

function setMessageInputBox(ownPeerID: string) {
  const textBox = document.createElement("input");
  textBox.style.display = "block";
  document.body.append(textBox);
  const button = document.createElement("button");
  button.addEventListener("click", () => {
    const text = textBox.value;
    connections.forEach(
      (c) => c.open && c.send(JSON.stringify(["message", text]))
    );
    textBox.textContent = "";
    onMessage(ownPeerID, text);
  });
  button.textContent = "送信";
  document.body.append(button);
}

function setIdLink(own: Peer) {
  const div = document.createElement("div");
  const url = new URL(document.location.href);
  url.searchParams.set("to", own.id);
  div.textContent = url.toString();
  document.body.append(div);
}

function createPeer(key: string): Promise<Peer> {
  const own = new Peer({ key: key });
  return new Promise<Peer>((solve) => {
    own.on("open", (id) => {
      solve(own);
    });
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importKey(keyJson: JsonWebKey): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    "jwk",
    keyJson,
    {
      //these are the algorithm options
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
    },
    true, //whether the key is extractable (i.e. can be used in exportKey)
    keyJson.key_ops as ["encrypt"] | ["decrypt"]
  );
}

async function keysFromJson(
  publicKeyJson: string,
  privateKeyJson: string
): Promise<[string, CryptoKey, CryptoKey]> {
  const publicKeyJwk = JSON.parse(publicKeyJson) as JsonWebKey;
  const publicKey = await importKey(publicKeyJwk);
  const privateKeyJwk = JSON.parse(privateKeyJson) as JsonWebKey;
  const privateKey = await importKey(privateKeyJwk);
  return [publicKeyJson, publicKey, privateKey];
}

async function keyToJson(key: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey(
    "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
    key //can be a publicKey or privateKey, as long as extractable was true
  );
  return JSON.stringify(jwk);
}

async function generateKeys(): Promise<[string, string, CryptoKey, CryptoKey]> {
  let keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048, //can be 1024, 2048, or 4096
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
    },
    true, //whether the key is extractable (i.e. can be used in exportKey)
    ["sign", "verify"] //must be ["encrypt", "decrypt"] or ["wrapKey", "unwrapKey"]
  );

  const publicKeyJson = await keyToJson(keyPair.publicKey);
  const privateKeyJson = await keyToJson(keyPair.privateKey);
  return [publicKeyJson, privateKeyJson, keyPair.publicKey, keyPair.privateKey];
}

async function getOwnKeyPair(): Promise<[string, CryptoKey, CryptoKey]> {
  const publicKeyJson = window.localStorage.getItem("public-key");
  const privateKeyJson = window.localStorage.getItem("private-key");

  if (publicKeyJson && privateKeyJson) {
    return keysFromJson(publicKeyJson, privateKeyJson);
  } else {
    const [
      publicKeyBase64,
      privateKeyBase64,
      publicKey,
      privateKey,
    ] = await generateKeys();
    window.localStorage.setItem("public-key", publicKeyBase64);
    window.localStorage.setItem("private-key", privateKeyBase64);
    return [publicKeyBase64, publicKey, publicKey];
  }
}

function setUserNameButton() {
  const button = document.createElement("button");
  button.textContent = "ユーザー名";
  button.addEventListener("click", () => {
    const userName = window.prompt(
      "ユーザー名",
      window.localStorage.getItem("user-name") || ""
    );
    if (userName) window.localStorage.setItem("user-name", userName);
  });
  document.body.append(button);
}

function showName(name: string) {
  const div = document.createElement("div");
  div.textContent = name;
  document.body.append(div);
}

async function main() {
  const own = await createPeer("77157c8d-8852-4dd0-b465-10f57625ffc7");
  const myName = window.localStorage.getItem("user-name") || "";
  showName(myName);
  setUserNameButton();
  const [publicKeyJson, publicKey, privateKey] = await getOwnKeyPair();
  setSelfConnection(publicKeyJson, own.id, myName);
  if (hasToId()) {
    const other = await connect(
      own,
      getToId(),
      publicKeyJson,
      privateKey,
      myName
    );
    if (!other) {
      console.error("諦め");
      return;
    }
  } else {
    setIdLink(own);
  }
  listenConnection(own, publicKeyJson, privateKey, myName);
  setMessageInputBox(own.id);
}

main();
