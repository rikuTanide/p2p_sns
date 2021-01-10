import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import Peer, {DataConnection} from 'skyway-js';

const connections: DataConnection[] = [];

function hasToId(): boolean {
    const url = new URL(window.location.href);
    return url.searchParams.has("to");
}

function getToId(): string {
    const url = new URL(window.location.href);
    return url.searchParams.get("to")!;
}

function connect(own: Peer, toId: string): Promise<DataConnection> {
    return new Promise<DataConnection>(solve => {
        const other = own.connect(toId);
        other.on('open', () => {
            solve(other);
        });
    });
}

function setAlert(data: any) {
    const div = document.createElement("div");
    div.textContent = data;
    document.body.append(div);
}

function setOnMessageHandler(other: DataConnection) {
    other.on('data', data => {
        setAlert(data);
    });
}

function listenConnection(peer: Peer) {
    peer.on('connection', other => {
        connections.push(other);
        setOnMessageHandler(other);
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
    if (hasToId()) {
        const other = await connect(own, getToId());
        connections.push(other);
        setOnMessageHandler(other)
    } else {
        setIdLink(own);
    }
    listenConnection(own)
    setMessageInputBox();
}

main();