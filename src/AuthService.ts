export class AuthService {
  public constructor(
    public ownPublicKeyJson: string,
    private privateKey: CryptoKey
  ) {}

  public async signConnection(connectionID: string): Promise<string> {
    const payload = connectionID + this.ownPublicKeyJson;
    // const encDigest = await window.crypto.subtle.digest(
    //   "SHA-256",
    //   stringToArrayBuffer(payload)
    // );
    const encMessage = await window.crypto.subtle.sign(
      {
        name: "RSASSA-PKCS1-v1_5",
      },
      this.privateKey,
      // encDigest
      stringToArrayBuffer(payload)
    );
    // @ts-ignore
    const sign = bufferToString(encMessage);
    return sign;
  }

  async verify(
    connectionID: string,
    otherPublicKeyJson: string,
    signBase64: string
  ): Promise<boolean> {
    const truthPayload = connectionID + otherPublicKeyJson;
    const sign = base64ToArrayBuffer(signBase64);

    const pjwk = JSON.parse(otherPublicKeyJson) as JsonWebKey;
    const publicKey = await importKey(pjwk);

    const ok = await window.crypto.subtle.verify(
      {
        name: "RSASSA-PKCS1-v1_5",
      },
      publicKey,
      sign,
      stringToArrayBuffer(truthPayload)
    );
    return ok;
  }

  async digest(data: string): Promise<string> {
    return hash(data);
  }
}

function stringToArrayBuffer(src: string): ArrayBuffer {
  const array = new Uint16Array(src.split("").map((c) => c.charCodeAt(0)));
  return array.buffer;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
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

async function hash(payload: string): Promise<string> {
  const payloadAb = stringToArrayBuffer(payload);
  const digest = await window.crypto.subtle.digest("sha-256", payloadAb);
  return bufferToString(digest);
}

function bufferToString(buf: ArrayBuffer) {
  // @ts-ignore
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function getOwnKeyPair(): Promise<[string, CryptoKey, CryptoKey]> {
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
