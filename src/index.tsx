import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import Peer, {DataConnection} from 'skyway-js';

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

function connect(own: Peer, toId: string, ownPublicKey: JsonWebKey, ownPrivateKey: JsonWebKey): Promise<DataConnection | undefined> {
    return new Promise<DataConnection | undefined>(solve => {
        // authorizedの時のメッセージには、メンバー情報とメッセージの二種類がある
        type Status = "connecting" | "processing-auth-request" | "authorized";
        if (checkedRemoteIDs.has(toId)) {
            solve(undefined);
            return;
        }
        checkedRemoteIDs.add(toId);
        const other = own.connect(toId);
        other.on('open', () => {
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
                        other.send(await createAuthRequest(other.id, ownPublicKey, ownPrivateKey));
                        return;
                    }
                    case "authorized" : {
                        const [method, ...payload] = data;
                        if (method === "member-peer-ids") {
                            const memberPeerIDs = payload[0] as string[];
                            for (const memberID of memberPeerIDs) connect(own, memberID, ownPublicKey, ownPrivateKey);
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
        other.on("error", e => {
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

function listenConnection(peer: Peer, ownPublicKey: JsonWebKey, ownPrivateKey: JsonWebKey) {
    type Status = "connected" | "wait-auth-request" | "processing-auth-request" | "authorized";
    peer.on('connection', async other => {
        let status: Status = "connected";
        checkedRemoteIDs.add(other.remoteId);
        other.send(await createAuthRequest(other.id, ownPublicKey, ownPrivateKey));
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
        connections.forEach(c => c.open && c.send(text));
    })
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
    const own = new Peer({key: key});
    return new Promise<Peer>(solve => {
        own.on("open", id => {
            solve(own);
        });
    });
}

async function main() {
    const own = await createPeer("77157c8d-8852-4dd0-b465-10f57625ffc7");
    const ownKeyPair = await getOwnkeyPair();
    if (hasToId()) {
        const other = await connect(own, getToId());
        connections.push(other);
    } else {
        setIdLink(own);
    }
    listenConnection(own)
    setMessageInputBox();
}

main();