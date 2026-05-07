export class DatabaseClient {
  constructor() {
    this.apiAvailable = true;
  }

  async signIn(username, password) {
    return this.request("/api?action=sign-in", {
      method: "POST",
      body: { username, password }
    });
  }

  async signUp(username, password) {
    return this.request("/api?action=sign-up", {
      method: "POST",
      body: { username, password }
    });
  }

  async listAvatars() {
    const result = await this.request("/api?action=avatars");
    return result.avatars || [];
  }

  async upsertAvatar(avatar) {
    return this.request("/api?action=avatars", {
      method: "PUT",
      body: avatar
    });
  }

  async getProgress(accountId) {
    const result = await this.request(`/api?action=progress&accountId=${encodeURIComponent(accountId)}`);
    return result.progress;
  }

  async saveProgress(accountId, state) {
    return this.request(`/api?action=progress&accountId=${encodeURIComponent(accountId)}`, {
      method: "PUT",
      body: { state }
    });
  }

  async deleteProgress(accountId) {
    return this.request(`/api?action=progress&accountId=${encodeURIComponent(accountId)}`, {
      method: "DELETE"
    });
  }

  async request(path, options = {}) {
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || `Database request failed: ${response.status}`);
    }

    return response.json();
  }
}
