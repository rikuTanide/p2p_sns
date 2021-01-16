export class PersistentService {
  public getKeyPair(): [string | null, string | null] {
    const publicKeyJson = window.localStorage.getItem("public-key");
    const privateKeyJson = window.localStorage.getItem("private-key");
    return [publicKeyJson, privateKeyJson];
  }

  public setKeyPair(publicKeyBase64: string, privateKeyBase64: string) {
    window.localStorage.setItem("public-key", publicKeyBase64);
    window.localStorage.setItem("private-key", privateKeyBase64);
  }

  public getName(): string | null {
    return window.localStorage.getItem("name");
  }

  private setName(name: string) {
    window.localStorage.setItem("name", name);
  }
}
