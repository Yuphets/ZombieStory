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
    this.db = new DatabaseClient();
    this.account = null;
    this.savedProgress = null;
    this.ui = new UI({
      root: document.querySelector("#app"),
      toast: document.querySelector("#toast"),
      renderer: new SketchRenderer()
    });

    this.ui.renderAccountGate({
      onLogin: (username) => this.login(username),
      databaseOnline: this.world.usingDatabase
    });
  }

  async login(username) {
    try {
      const result = await this.db.login(username);
      this.account = result.account;
      this.savedProgress = result.progress;
      this.world.avatars = result.avatars || this.world.listAvatars();
      this.ui.toast(`Signed in as ${this.account.username}`);

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
    } catch (error) {
      this.ui.toast(error.message);
    }
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
    this.state = new GameState();
    this.state.createAvatar(input, this.catalog);
    const scenario = this.story.pickStartingScenario(this.state.avatar.professionId);
    this.state.applyScenario(scenario);

    if (input.coop) {
      this.state.coop.active = true;
      this.state.coop.partner = this.world.makeCoopPartner(this.state.avatar.id);
    }

    await this.persist();
    this.ui.toast(`${this.state.avatar.name}'s page opens`);
    this.renderScene();
  }

  resumeGame() {
    this.state = GameState.fromSnapshot(this.savedProgress.state);
    this.ui.toast("Save restored");
    this.renderScene();
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
      onLogin: (username) => this.login(username),
      databaseOnline: this.world.usingDatabase
    });
  }

  renderScene(overrideScene = null) {
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
      onLogout: () => this.logout()
    });
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

    await this.persist();

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

  async persist() {
    if (!this.state.avatar) {
      return;
    }

    await this.world.upsertAvatar(this.state.publicAvatar());

    if (this.account && this.world.usingDatabase) {
      const saved = await this.db.saveProgress(this.account.id, this.state.snapshot());
      this.savedProgress = saved.progress;
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
