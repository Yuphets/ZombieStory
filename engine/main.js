import { GameState, labelize } from "./state.js";
import { StoryEngine } from "./storyEngine.js";
import { SharedWorld } from "../multiplayer/sharedWorld.js";
import { DatabaseClient } from "../multiplayer/databaseClient.js";
import { SketchRenderer } from "../ui/sketchRenderer.js";
import { UI } from "../ui/ui.js";

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load ${path}`);
  }
  return response.json();
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Unable to reach ${path}`);
  }
  return response.json();
}

async function putJson(path, body) {
  const response = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Unable to update ${path}`);
  }
  return response.json();
}

async function deleteJson(path) {
  const response = await fetch(path, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Unable to delete ${path}`);
  }
  return response.json();
}

class GameController {
  async init() {
    const [catalog, scenarios, scenes, events] = await Promise.all([
      loadJson("story/professions.json"),
      loadJson("story/scenarios.json"),
      loadJson("story/scenes.json"),
      loadJson("story/events.json")
    ]);

    this.catalog = catalog;
    this.state = new GameState();
    this.story = new StoryEngine({ scenes, scenarios, events });
    this.world = new SharedWorld();
    await this.world.init();
    this.art = { enabled: false, provider: "fallback" };
    this.sceneImages = new Map();
    this.renderNonce = 0;
    this.db = new DatabaseClient();
    this.account = null;
    this.savedProgress = null;
    this.ui = new UI({
      root: document.querySelector("#app"),
      toast: document.querySelector("#toast"),
      renderer: new SketchRenderer()
    });

    try {
      this.art = await loadJson("/api/art-status");
    } catch {
      this.art = { enabled: false, provider: "fallback" };
    }

    this.ui.renderAccountGate({
      onSignIn: (credentials) => this.signIn(credentials),
      onSignUp: (credentials) => this.signUp(credentials),
      databaseOnline: this.world.usingDatabase,
      artStatus: this.art,
      onSaveArtKey: (apiKey) => this.saveArtKey(apiKey),
      onClearArtKey: () => this.clearArtKey()
    });
  }

  async signIn({ username, password }) {
    try {
      await this.authenticate(() => this.db.signIn(username, password), "Signed in");
    } catch (error) {
      this.ui.toast(error.message);
    }
  }

  async signUp({ username, password }) {
    try {
      await this.authenticate(() => this.db.signUp(username, password), "Account created");
    } catch (error) {
      this.ui.toast(error.message);
    }
  }

  async authenticate(action, successLabel) {
    const result = await action();
    this.account = result.account;
    this.savedProgress = result.progress;
    this.world.avatars = result.avatars || this.world.listAvatars();
    this.ui.toast(`${successLabel} for ${this.account.username}`);

    if (this.savedProgress?.state) {
      this.ui.renderResumePanel({
        account: this.account,
        progress: this.savedProgress,
        onResume: () => this.resumeGame(),
        onNew: () => this.renderCreator(),
        onDelete: () => this.deleteSave(),
        onLogout: () => this.logout()
      });
      return;
    }

    this.renderCreator();
  }

  renderCreator() {
    this.ui.renderAvatarCreator({
      catalog: this.catalog,
      sharedAvatars: this.world.listAvatars(),
      account: this.account,
      databaseOnline: this.world.usingDatabase,
      onStart: (avatarInput) => this.startGame(avatarInput),
      onResetWorld: async () => {
        this.world.resetLocalFallback();
        await this.world.init();
        this.ui.toast(this.world.usingDatabase ? "Shared database refreshed" : "Shared notebook reset");
        this.renderCreator();
      },
      onLogout: () => this.logout()
    });
  }

  async startGame(input) {
    try {
      this.state = new GameState();
      this.state.createAvatar(input, this.catalog);
      const scenario = this.story.pickStartingScenario(this.state.avatar.professionId);
      this.state.applyScenario(scenario);

      if (input.coop) {
        this.state.coop.active = true;
        this.state.coop.partner = this.world.makeCoopPartner(this.state.avatar.id);
      }

      const saveResult = await this.persist({ softFail: true });
      this.ui.toast(saveResult.ok
        ? `${this.state.avatar.name}'s page opens`
        : `${this.state.avatar.name}'s page opens, but the save lagged behind`);
      this.renderScene();
    } catch (error) {
      this.ui.toast(error.message || "The story page jammed while opening.");
    }
  }

  resumeGame() {
    try {
      this.state = GameState.fromSnapshot(this.savedProgress.state);
      this.ui.toast("Save restored");
      this.renderScene();
    } catch (error) {
      this.ui.toast(error.message || "That save could not be restored.");
    }
  }

  async deleteSave() {
    if (!this.account) {
      return;
    }
    await this.db.deleteProgress(this.account.id);
    this.savedProgress = null;
    this.ui.toast("Saved run cleared");
    this.renderCreator();
  }

  logout() {
    this.account = null;
    this.savedProgress = null;
    this.state = new GameState();
    this.ui.renderAccountGate({
      onSignIn: (credentials) => this.signIn(credentials),
      onSignUp: (credentials) => this.signUp(credentials),
      databaseOnline: this.world.usingDatabase,
      artStatus: this.art,
      onSaveArtKey: (apiKey) => this.saveArtKey(apiKey),
      onClearArtKey: () => this.clearArtKey()
    });
  }

  renderScene(overrideScene = null) {
    const nonce = ++this.renderNonce;
    const scene = overrideScene || (this.state.isDead()
      ? this.story.buildDeathScene(this.state)
      : this.story.getScene(this.state.currentSceneId));

    if (scene.ending || this.state.isDead()) {
      this.state.gameOver = true;
      this.persist();
    }

    this.ui.renderGame({
      state: this.state,
      scene,
      sharedAvatars: this.world.listAvatars(),
      onChoice: (choice) => this.choose(choice, scene),
      onNewGame: () => this.renderCreator(),
      account: this.account,
      databaseOnline: this.world.usingDatabase,
      onLogout: () => this.logout(),
      sceneImage: this.sceneImages.get(this.sceneImageKey(scene)) || null,
      artEnabled: this.art.enabled,
      onRegenerateArt: () => this.loadSceneArt(scene, true)
    });

    this.loadSceneArt(scene, false, nonce);
  }

  async choose(choice, scene) {
    if (!this.state.canTake(choice) || this.state.gameOver) {
      this.ui.toast(choice.requires ? this.state.requirementText(choice) : "That page is already written");
      return;
    }

    this.world.recordEncounter(this.state, choice, scene);
    this.story.resolveChoice(choice, this.state);

    if (this.state.coop.active) {
      this.state.coop.actingPlayer = this.state.coop.actingPlayer === "player" ? "partner" : "player";
    }

    const saveResult = await this.persist({ softFail: true });
    if (!saveResult.ok) {
      this.ui.toast("Choice recorded, but the save did not stick yet.");
    }

    if (this.state.isDead()) {
      this.renderScene();
      return;
    }

    const event = this.story.maybeRandomEvent(this.state);
    if (event) {
      this.ui.toast("A random event stains the page");
      this.renderScene(event);
      return;
    }

    const encounter = this.maybeBuildEncounter();
    if (encounter) {
      this.ui.toast("Another survivor enters your story");
      this.renderScene(encounter);
      return;
    }

    this.renderScene();
  }

  maybeBuildEncounter() {
    if (this.state.turn < 4 || Math.random() > 0.26) {
      return null;
    }

    const seenIds = Object.keys(this.state.relationships);
    const others = this.world.getEncounterable(this.state.avatar.id, seenIds);
    if (!others.length) {
      return null;
    }

    const other = others[Math.floor(Math.random() * others.length)];
    return this.world.makeEncounterScene(other, this.state);
  }

  async persist({ softFail = false } = {}) {
    if (!this.state.avatar) {
      return { ok: true };
    }

    try {
      await this.world.upsertAvatar(this.state.publicAvatar());

      if (this.account && this.world.usingDatabase) {
        const saved = await this.db.saveProgress(this.account.id, this.state.snapshot());
        this.savedProgress = saved.progress;
      }
      return { ok: true };
    } catch (error) {
      if (!softFail) {
        throw error;
      }
      return { ok: false, error };
    }
  }

  sceneImageKey(scene) {
    return JSON.stringify({
      sceneId: scene.id,
      art: scene.art,
      narration: scene.text,
      avatarId: this.state.avatar?.id,
      location: this.state.scenario?.location
    });
  }

  async loadSceneArt(scene, force = false, nonce = this.renderNonce) {
    if (!this.art.enabled || !scene?.id) {
      return;
    }

    const key = this.sceneImageKey(scene);
    if (this.sceneImages.has(key) && !force) {
      return;
    }

    try {
      const result = await postJson("/api/scene-art", {
        sceneId: scene.id,
        art: scene.art,
        label: scene.label,
        narration: scene.text,
        avatar: this.state.avatar,
        scenario: this.state.scenario,
        accountId: this.account?.id || null,
        force
      });

      if (!result.imageUrl) {
        return;
      }

      this.sceneImages.set(key, `${result.imageUrl}?v=${force ? Date.now() : "cached"}`);
      if (nonce === this.renderNonce) {
        this.renderScene(scene);
      }
    } catch (error) {
      this.ui.toast("AI art unavailable, using sketch fallback");
      this.art.enabled = false;
    }
  }

  async saveArtKey(apiKey) {
    try {
      this.art = await putJson("/api/settings/art", { apiKey });
      this.ui.toast(this.art.enabled ? "AI art enabled" : "Art key saved");
      if (!this.account) {
        this.ui.renderAccountGate({
          onSignIn: (credentials) => this.signIn(credentials),
          onSignUp: (credentials) => this.signUp(credentials),
          databaseOnline: this.world.usingDatabase,
          artStatus: this.art,
          onSaveArtKey: (value) => this.saveArtKey(value),
          onClearArtKey: () => this.clearArtKey()
        });
      } else {
        this.renderCreator();
      }
    } catch (error) {
      this.ui.toast(error.message);
    }
  }

  async clearArtKey() {
    try {
      this.art = await deleteJson("/api/settings/art");
      this.sceneImages.clear();
      this.ui.toast("AI art disabled");
      if (!this.account) {
        this.ui.renderAccountGate({
          onSignIn: (credentials) => this.signIn(credentials),
          onSignUp: (credentials) => this.signUp(credentials),
          databaseOnline: this.world.usingDatabase,
          artStatus: this.art,
          onSaveArtKey: (value) => this.saveArtKey(value),
          onClearArtKey: () => this.clearArtKey()
        });
      } else {
        this.renderCreator();
      }
    } catch (error) {
      this.ui.toast(error.message);
    }
  }
}

const controller = new GameController();
controller.init().catch((error) => {
  document.querySelector("#app").innerHTML = `
    <section class="shell">
      <header class="topbar"><div class="brand"><span>LIFE</span> SCRATCH MARKS</div></header>
      <div class="page">
        <article class="panel note-panel">
          <span class="panel-label">LOAD ERROR</span>
          <h2>The story files could not be opened.</h2>
          <p>Run this folder through a local web server so the browser can load JSON modules.</p>
          <p class="small">${error.message}</p>
        </article>
      </div>
    </section>`;
});

export { labelize };
