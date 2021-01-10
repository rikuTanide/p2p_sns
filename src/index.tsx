import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import Peer, { DataConnection } from "skyway-js";

const checkedRemoteIDs: Set<string> = new Set<string>();
const connections: DataConnection[] = [];

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
  ownPublicKey: CryptoKey,
  ownPrivateKey: CryptoKey
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
            connections.push(other);
            onConnected(authRequest);
            other.send(
              await createAuthRequest(other.id, ownPublicKey, ownPrivateKey)
            );
            return;
          }
          case "authorized": {
            const [method, ...payload] = data;
            if (method === "member-peer-ids") {
              const memberPeerIDs = payload[0] as string[];
              for (const memberID of memberPeerIDs)
                connect(own, memberID, ownPublicKey, ownPrivateKey);
            } else {
              onMessage(other.remoteId, data);
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
  ownPrivateKey: CryptoKey
): Promise<string> {
  const payload = connectionID + ownPublicKeyJson;
  // const encDigest = await window.crypto.subtle.digest(
  //   "SHA-256",
  //   stringToArrayBuffer(payload)
  // );
  const encMessage = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    ownPrivateKey,
    // encDigest
    stringToArrayBuffer(payload)
  );
  // @ts-ignore
  const sign = btoa(String.fromCharCode.apply(null, encMessage));
  return JSON.stringify([connectionID, ownPublicKeyJson, sign]);
}

interface AuthRequest {
  connectionID: string;
  otherPublicKey: string;
  sign: ArrayBuffer;
}

function parseAuthRequest(data: any): AuthRequest {
  const list = JSON.parse(data as string) as [string, string, string];
  const [connectionID, otherPublicKey, signBase64] = list;
  const sign = base64ToArrayBuffer(signBase64);
  return {
    connectionID: connectionID,
    otherPublicKey: otherPublicKey,
    sign: sign,
  };
}

function bufferToString(buf: ArrayBuffer) {
  // @ts-ignore
  return String.fromCharCode.apply("", new Uint16Array(buf));
}

async function decrypt(payload: ArrayBuffer, key: CryptoKey): Promise<string> {
  const plain = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    key,
    payload
  );
  return bufferToString(plain);
}

async function validateAuthRequest(
  authRequest: AuthRequest,
  id: string
): Promise<boolean> {
  if (id != authRequest.connectionID) return false;
  const truthPayload = authRequest.connectionID + authRequest.otherPublicKey;
  const pjwk = JSON.parse(authRequest.otherPublicKey) as JsonWebKey;
  const publicKey = await importKey(pjwk);
  const claimPayload = await decrypt(authRequest.sign, publicKey);
  return truthPayload == claimPayload;
}

function listenConnection(
  peer: Peer,
  ownPublicKeyJson: string,
  ownPrivateKey: CryptoKey
) {
  type Status =
    | "connected"
    | "wait-auth-request"
    | "processing-auth-request"
    | "authorized";
  peer.on("connection", async (other) => {
    let status: Status = "connected";
    checkedRemoteIDs.add(other.remoteId);
    other.send(
      await createAuthRequest(other.id, ownPublicKeyJson, ownPrivateKey)
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
            connections.push(other);
            other.send(createMembersMessage());
            onConnected(authRequest);
          }
          return;
        }
        case "authorized": {
          onMessage(other.remoteId, data);
          return;
        }
        default: {
          return;
        }
      }
    });
  });
}

function setMessageInputBox() {
  const textBox = document.createElement("input");
  textBox.style.display = "block";
  document.body.append(textBox);
  const button = document.createElement("button");
  button.addEventListener("click", () => {
    const text = textBox.value;
    connections.forEach((c) => c.open && c.send(text));
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
      name: "RSA-OAEP",
      hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
    },
    false, //whether the key is extractable (i.e. can be used in exportKey)
    ["encrypt"]
  );
}

async function keysFromBase64(
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
      name: "RSA-OAEP",
      modulusLength: 2048, //can be 1024, 2048, or 4096
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
    },
    false, //whether the key is extractable (i.e. can be used in exportKey)
    ["encrypt", "decrypt"] //must be ["encrypt", "decrypt"] or ["wrapKey", "unwrapKey"]
  );

  const publicKeyJson = await keyToJson(keyPair.publicKey);
  const privateKeyJson = await keyToJson(keyPair.privateKey);
  return [publicKeyJson, privateKeyJson, keyPair.publicKey, keyPair.privateKey];
}

async function getOwnKeyPair(): Promise<[string, CryptoKey, CryptoKey]> {
  const publicKeyJson = window.localStorage.getItem("public-key");
  const privateKeyJson = window.localStorage.getItem("private-key");

  if (publicKeyJson && privateKeyJson) {
    return keysFromBase64(publicKeyJson, privateKeyJson);
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

async function main() {
  const own = await createPeer("77157c8d-8852-4dd0-b465-10f57625ffc7");
  const [publicKeyBase64, publicKey, privateKey] = await getOwnKeyPair();
  if (hasToId()) {
    const other = await connect(own, getToId(), publicKey, privateKey);
    if (!other) {
      console.error("諦め");
      return;
    }
    connections.push(other);
  } else {
    setIdLink(own);
  }
  listenConnection(own, publicKeyBase64, privateKey);
  setMessageInputBox();
}

main();
