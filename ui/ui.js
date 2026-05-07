import { GameState, labelize } from "../engine/state.js";

export class UI {
  constructor({ root, toast, renderer }) {
    this.root = root;
    this.toastEl = toast;
    this.renderer = renderer;
  }

  renderAccountGate({ onSignIn, onSignUp, databaseOnline, artStatus, onSaveArtKey, onClearArtKey }) {
    this.root.innerHTML = shell(`
      <div class="page account-page">
        <section class="panel account-hero">
          <span class="panel-label">NOTEBOOK</span>
          <div class="account-hero-copy">
            <p class="eyebrow">Shared apocalypse journal</p>
            <h1>Open Your Notebook</h1>
            <p class="account-lead">Create or load a survivor account, keep your progress between sessions, and let other players drift through your world as remembered strangers.</p>
            <div class="account-marks">
              <span class="mark-card">Persistent save slots</span>
              <span class="mark-card">Shared survivor encounters</span>
              <span class="mark-card">Branching story history</span>
            </div>
            <div class="account-quote">
              <p>"Write your name down somewhere safe. The world keeps erasing people."</p>
            </div>
          </div>
        </section>
        <section class="panel account-card">
          <span class="panel-label">ACCOUNT</span>
          <div class="auth-switch" role="tablist" aria-label="Account access">
            <button class="plain-button compact active" type="button" data-auth-mode="sign-in">Sign In</button>
            <button class="plain-button compact" type="button" data-auth-mode="sign-up">Sign Up</button>
          </div>
          <form id="account-form" class="account-form" data-mode="sign-in">
            <div class="account-status-row">
              <span class="status-chip">${databaseOnline ? "Shared DB online" : "Offline fallback"}</span>
              <span class="status-chip">${artStatus?.enabled ? "AI art ready" : "Sketch fallback"}</span>
            </div>
            <h2 id="auth-title">Sign In</h2>
            <p id="auth-copy">Enter your notebook name and password to continue the story.</p>
            <div class="field">
              <label for="username">Player Name</label>
              <input id="username" name="username" maxlength="32" autocomplete="username" placeholder="Example: Alex">
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" minlength="6" maxlength="72" autocomplete="current-password" placeholder="At least 6 characters">
            </div>
            <div class="field" id="confirm-field" hidden>
              <label for="confirm-password">Confirm Password</label>
              <input id="confirm-password" name="confirmPassword" type="password" minlength="6" maxlength="72" autocomplete="new-password" placeholder="Repeat your password">
            </div>
            <button class="primary-button wide-button" type="submit">Enter The Story</button>
            <p class="small">${databaseOnline ? "Progress is saved to the shared database after each choice. On Vercel, this can run on Neon through the DATABASE_URL environment variable." : "The database API is unavailable, so only local fallback mode is available right now."}</p>
          </form>
          <div class="account-art-setup">
            <h3>AI Art Setup</h3>
            <p class="small">Paste an OpenAI API key to turn scene panels into lifelike monochrome concept art with realistic people, shadows, and lighting. For Vercel, setting OPENAI_API_KEY in project environment variables is the cleanest global setup.</p>
            <div class="field">
              <label for="art-api-key">OpenAI API Key</label>
              <input id="art-api-key" type="password" autocomplete="off" placeholder="sk-...">
            </div>
            <div class="form-actions flush">
              <button class="plain-button" type="button" id="save-art-key">Save Art Key</button>
              <button class="plain-button" type="button" id="clear-art-key">Disable AI Art</button>
            </div>
            <p class="small">${artStatus?.enabled ? `AI art is enabled through ${artStatus?.source === "environment" ? "the environment configuration" : "stored project settings"}.` : artStatus?.configured ? "A key is configured but AI art is not active yet." : "No art key is configured yet."}</p>
          </div>
        </section>
      </div>
    `, { account: null, databaseOnline });

    let mode = "sign-in";
    const form = this.root.querySelector("#account-form");
    const title = this.root.querySelector("#auth-title");
    const copy = this.root.querySelector("#auth-copy");
    const confirmField = this.root.querySelector("#confirm-field");
    const submitButton = form.querySelector(".primary-button");

    const syncMode = (nextMode) => {
      mode = nextMode;
      form.dataset.mode = mode;
      title.textContent = mode === "sign-in" ? "Sign In" : "Sign Up";
      copy.textContent = mode === "sign-in"
        ? "Enter your notebook name and password to continue the story."
        : "Create a notebook account so your survivor, choices, and progress can come back later.";
      submitButton.textContent = mode === "sign-in" ? "Enter The Story" : "Create Account";
      confirmField.hidden = mode !== "sign-up";
      this.root.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.classList.toggle("active", button.dataset.authMode === mode);
      });
      this.root.querySelector("#password").setAttribute("autocomplete", mode === "sign-in" ? "current-password" : "new-password");
    };

    this.root.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => syncMode(button.dataset.authMode));
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const username = String(data.get("username") || "").trim();
      const password = String(data.get("password") || "");
      const confirmPassword = String(data.get("confirmPassword") || "");

      if (!username || !password) {
        this.toast("Notebook name and password are required.");
        return;
      }

      if (mode === "sign-up" && password.length < 6) {
        this.toast("Use at least 6 characters for the password.");
        return;
      }

      if (mode === "sign-up" && password !== confirmPassword) {
        this.toast("The passwords do not match.");
        return;
      }

      if (mode === "sign-in") {
        onSignIn({ username, password });
      } else {
        onSignUp({ username, password });
      }
    });
    syncMode(mode);
    this.root.querySelector("#save-art-key").addEventListener("click", () => {
      const value = this.root.querySelector("#art-api-key").value;
      onSaveArtKey(value);
    });
    this.root.querySelector("#clear-art-key").addEventListener("click", onClearArtKey);
  }

  renderResumePanel({ account, progress, onResume, onNew, onDelete, onLogout }) {
    const state = progress.state;
    this.root.innerHTML = shell(`
      <div class="page account-page">
        <section class="panel account-card">
          <span class="panel-label">SAVED RUN</span>
          <div class="account-form">
            <h1>Welcome Back, ${escapeHtml(account.username)}</h1>
            <p>${escapeHtml(state.avatar?.name || "Your survivor")} is on turn ${state.turn || 0}, near ${escapeHtml(state.scenario?.location || "unknown ground")}.</p>
            <div class="save-summary">
              <span>Health ${state.stats?.health ?? 0}</span>
              <span>Morale ${state.stats?.morale ?? 0}</span>
              <span>Supplies ${state.stats?.supplies ?? 0}</span>
              <span>Saved ${new Date(progress.savedAt).toLocaleString()}</span>
            </div>
            <div class="form-actions flush">
              <button class="primary-button" type="button" id="resume-run">Resume</button>
              <button class="plain-button" type="button" id="new-run">New Survivor</button>
              <button class="plain-button" type="button" id="delete-run">Delete Save</button>
            </div>
          </div>
        </section>
      </div>
    `, { account, databaseOnline: true });

    this.root.querySelector("#resume-run").addEventListener("click", onResume);
    this.root.querySelector("#new-run").addEventListener("click", onNew);
    this.root.querySelector("#delete-run").addEventListener("click", onDelete);
    this.root.querySelector("[data-logout]")?.addEventListener("click", onLogout);
  }

  renderAvatarCreator({ catalog, sharedAvatars, account, databaseOnline, onStart, onResetWorld, onLogout }) {
    this.root.innerHTML = shell(`
      <div class="page avatar-page">
        <section class="panel">
          <span class="panel-label">AVATAR</span>
          <form id="avatar-form">
            <div class="form-grid">
              <div class="field full">
                <label for="name">Name</label>
                <input id="name" name="name" maxlength="32" autocomplete="off" placeholder="Write a name in the margin">
              </div>
              <div class="field">
                <label for="genderId">Gender</label>
                <select id="genderId" name="genderId">
                  ${catalog.genders.map(option).join("")}
                </select>
              </div>
              <div class="field">
                <label for="ageBandId">Age</label>
                <select id="ageBandId" name="ageBandId">
                  ${catalog.ageBands.map(option).join("")}
                </select>
              </div>
              <div class="field full">
                <label for="professionId">Profession</label>
                <select id="professionId" name="professionId">
                  ${catalog.professions.map(option).join("")}
                </select>
              </div>
              <div class="field full">
                <label for="coop">Co-op Mode</label>
                <select id="coop" name="coop">
                  <option value="false">Solo notebook</option>
                  <option value="true">Turn-based shared session</option>
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button class="primary-button" type="submit">Begin Survival</button>
              <button class="plain-button" type="button" id="reset-world">Reset Shared Notebook</button>
            </div>
          </form>
        </section>
        <aside class="side-stack">
          <section class="panel note-panel">
            <span class="panel-label">DOSSIER</span>
            <h2 id="preview-title">Military</h2>
            <div id="preview-copy" class="preview-copy"></div>
          </section>
          <section class="panel note-panel">
            <span class="panel-label">SHARED WORLD</span>
            <h3>Avatars in the margins</h3>
            <div class="shared-list">
              ${sharedAvatars.map((avatar) => sharedAvatar(avatar)).join("")}
            </div>
            <p class="small">${databaseOnline ? "Shared avatars are synced through the shared database layer." : "Local fallback is active because the database API is unavailable."}</p>
          </section>
        </aside>
      </div>
    `, { account, databaseOnline });

    const form = this.root.querySelector("#avatar-form");
    const professionSelect = this.root.querySelector("#professionId");
    const ageSelect = this.root.querySelector("#ageBandId");
    const previewTitle = this.root.querySelector("#preview-title");
    const previewCopy = this.root.querySelector("#preview-copy");

    const updatePreview = () => {
      const profession = catalog.professions.find((item) => item.id === professionSelect.value);
      const age = catalog.ageBands.find((item) => item.id === ageSelect.value);
      previewTitle.textContent = profession.label;
      previewCopy.innerHTML = `
        <p>${profession.summary}</p>
        <p><strong>Profession bonuses:</strong> ${bonusText(profession.bonuses)}</p>
        <p><strong>Age modifier:</strong> ${bonusText(age.bonuses)}</p>
        <p><strong>Starting kit:</strong> ${profession.inventory.join(", ")}</p>
      `;
    };

    professionSelect.addEventListener("change", updatePreview);
    ageSelect.addEventListener("change", updatePreview);
    updatePreview();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      onStart({
        name: data.get("name"),
        genderId: data.get("genderId"),
        ageBandId: data.get("ageBandId"),
        professionId: data.get("professionId"),
        coop: data.get("coop") === "true"
      });
    });

    this.root.querySelector("#reset-world").addEventListener("click", onResetWorld);
    this.root.querySelector("[data-logout]")?.addEventListener("click", onLogout);
  }

  renderGame({ state, scene, sharedAvatars, onChoice, onNewGame, account, databaseOnline, onLogout, sceneImage, artEnabled, onRegenerateArt }) {
    const isEnding = Boolean(scene.ending) || state.gameOver;
    this.root.innerHTML = shell(`
      <div class="page">
        <section>
          ${state.coop.active ? coopBanner(state) : ""}
          <article class="panel">
            <span class="panel-label">${escapeHtml(scene.label || "PANEL")}</span>
            <div class="scene-frame">
              ${sceneImage ? `<img class="scene-image" src="${escapeHtml(sceneImage)}" alt="Lifelike scene art for ${escapeHtml(scene.label || "scene")}">` : ""}
              <canvas class="scene-art ${sceneImage ? "is-hidden" : ""}" width="900" height="390" aria-label="Sketch illustration for ${escapeHtml(scene.label || "scene")}"></canvas>
              <div class="scene-toolbar">
                <span class="scene-toolbar-pill">${artEnabled ? (sceneImage ? "AI art" : "Generating art when available") : "Sketch fallback"}</span>
                ${artEnabled ? `<button class="plain-button compact" type="button" id="regenerate-art">Refresh Art</button>` : ""}
              </div>
            </div>
            <div class="narration">
              ${formatText(scene.text)}
              ${isEnding ? `<p class="ending">${escapeHtml(scene.ending || "The End")}</p>` : ""}
            </div>
          </article>
          <div class="choices">
            ${isEnding
              ? `<button class="primary-button" id="new-game">Start Another Notebook</button>`
              : scene.choices.map((choice, index) => choiceButton(choice, index, state)).join("")}
          </div>
        </section>
        <aside class="side-stack">
          <section class="panel note-panel">
            <span class="panel-label">SURVIVOR</span>
            <h2>${escapeHtml(state.avatar.name)}</h2>
            <p>${escapeHtml(state.avatar.ageBand)} ${escapeHtml(state.avatar.gender.toLowerCase())} ${escapeHtml(state.avatar.profession.toLowerCase())}</p>
            <p class="small">Started at ${escapeHtml(state.scenario.title)}: ${escapeHtml(state.scenario.location)}.</p>
          </section>
          <section class="panel note-panel">
            <span class="panel-label">VITALS</span>
            <div class="stats-grid">${GameState.coreStats.map((stat) => statRow(stat, state.stats[stat])).join("")}</div>
          </section>
          <section class="panel note-panel">
            <span class="panel-label">SKILLS</span>
            <div class="skill-grid">${GameState.skills.map((skill) => skillRow(skill, state.skills[skill])).join("")}</div>
          </section>
          <section class="panel note-panel">
            <span class="panel-label">INVENTORY</span>
            <div class="inventory-list">
              ${state.inventory.length ? state.inventory.map((item) => `<div class="inventory-item">${escapeHtml(item)}</div>`).join("") : `<div class="small">Empty pockets, loud stomach.</div>`}
            </div>
          </section>
          <section class="panel note-panel">
            <span class="panel-label">MARGINS</span>
            <div class="shared-list">
              ${sharedAvatars.filter((avatar) => avatar.id !== state.avatar.id).slice(0, 4).map(sharedAvatar).join("")}
            </div>
          </section>
        </aside>
      </div>
      <div class="ledger">
        <span class="pill">Turn ${state.turn}</span>
        <span class="pill ${state.stats.reputation >= 65 ? "rep-good" : state.stats.reputation < 40 ? "rep-bad" : ""}">Reputation ${state.stats.reputation}</span>
        <span class="pill">Location ${escapeHtml(state.scenario.location)}</span>
        <span class="pill">${databaseOnline ? "Saved to database" : "Local fallback"}</span>
        ${state.coop.active ? `<span class="pill">Co-op active</span>` : ""}
      </div>
    `, { account, databaseOnline });

    const canvas = this.root.querySelector("canvas");
    if (canvas) {
      requestAnimationFrame(() => this.renderer.draw(canvas, scene, state));
    }

    this.root.querySelector("#regenerate-art")?.addEventListener("click", onRegenerateArt);

    if (isEnding) {
      this.root.querySelector("#new-game").addEventListener("click", onNewGame);
      this.root.querySelector("[data-logout]")?.addEventListener("click", onLogout);
      return;
    }

    this.root.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => onChoice(scene.choices[Number(button.dataset.choice)]));
    });
    this.root.querySelector("[data-logout]")?.addEventListener("click", onLogout);
  }

  toast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add("show");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove("show"), 1900);
  }
}

function shell(content, session = {}) {
  return `
    <div class="shell">
      <header class="topbar">
        <div class="brand"><span>LIFE</span> SCRATCH MARKS</div>
        <div class="top-actions">
          ${session.account ? `<span class="pill">Player ${escapeHtml(session.account.username)}</span>` : ""}
          <span class="pill">${session.databaseOnline ? "DB online" : "offline mode"}</span>
          ${session.account ? `<button class="plain-button compact" type="button" data-logout>Log Out</button>` : ""}
        </div>
      </header>
      ${content}
    </div>
  `;
}

function option(item) {
  return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`;
}

function bonusText(bonuses) {
  return Object.entries(bonuses)
    .map(([key, value]) => `${value > 0 ? "+" : ""}${value} ${labelize(key)}`)
    .join(", ");
}

function statRow(stat, value) {
  return `
    <div class="stat-row">
      <span>${labelize(stat)}</span>
      <span class="bar ${value <= 25 ? "low" : ""}"><span style="width:${Math.min(value, 100)}%"></span></span>
      <span>${value}</span>
    </div>
  `;
}

function skillRow(skill, value) {
  return `
    <div class="skill-row">
      <span>${labelize(skill)}</span>
      <span class="bar"><span style="width:${value}%"></span></span>
      <span>${value}</span>
    </div>
  `;
}

function choiceButton(choice, index, state) {
  const disabled = !state.canTake(choice);
  return `
    <button class="choice-card" type="button" data-choice="${index}" ${disabled ? "disabled" : ""}>
      <span class="choice-letter">${String.fromCharCode(65 + index)}</span>
      <span>
        ${escapeHtml(choice.text)}
        ${disabled ? `<span class="choice-meta">${escapeHtml(state.requirementText(choice))}</span>` : effectPreview(choice)}
      </span>
    </button>
  `;
}

function effectPreview(choice) {
  const effects = choice.effects || {};
  const chunks = [];
  if (effects.reputation) {
    chunks.push(`${effects.reputation > 0 ? "+" : ""}${effects.reputation} reputation`);
  }
  if (effects.stats) {
    for (const [key, value] of Object.entries(effects.stats)) {
      if (["health", "stamina", "morale", "hunger", "supplies"].includes(key) && value !== 0) {
        chunks.push(`${value > 0 ? "+" : ""}${value} ${labelize(key).toLowerCase()}`);
      }
    }
  }
  return chunks.length ? `<span class="choice-meta">${escapeHtml(chunks.slice(0, 3).join(", "))}</span>` : "";
}

function sharedAvatar(avatar) {
  return `
    <div class="shared-item">
      <span>${escapeHtml(avatar.name)}</span>
      <span>${escapeHtml(avatar.profession)}</span>
      <span class="${avatar.reputation >= 65 ? "rep-good" : avatar.reputation < 40 ? "rep-bad" : ""} pill">${avatar.reputation}</span>
    </div>
  `;
}

function coopBanner(state) {
  const partner = state.coop.partner;
  return `
    <div class="coop-banner">
      <div class="coop-seat ${state.coop.actingPlayer === "player" ? "active" : ""}">
        <strong>${escapeHtml(state.avatar.name)}</strong><br>
        Choosing ${state.coop.actingPlayer === "player" ? "now" : "next"}
      </div>
      <div class="coop-seat ${state.coop.actingPlayer === "partner" ? "active" : ""}">
        <strong>${escapeHtml(partner.name)}</strong><br>
        ${escapeHtml(partner.profession)} partner
      </div>
    </div>
  `;
}

function formatText(text) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>`)
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
