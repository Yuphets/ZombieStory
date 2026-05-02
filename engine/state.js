const CORE_STATS = ["health", "stamina", "morale", "hunger", "supplies"];
const SKILLS = ["combat", "agility", "medical", "crafting", "scavenging", "intimidation", "vehicleUse", "wisdom"];

export class GameState {
  constructor() {
    this.avatar = null;
    this.scenario = null;
    this.currentSceneId = null;
    this.turn = 0;
    this.flags = {};
    this.inventory = [];
    this.relationships = {};
    this.coop = { active: false, partner: null, actingPlayer: "player" };
    this.gameOver = false;
    this.history = [];

    this.stats = {
      health: 100,
      stamina: 100,
      morale: 72,
      hunger: 82,
      supplies: 28,
      reputation: 50
    };

    this.skills = {
      combat: 30,
      agility: 30,
      medical: 22,
      crafting: 22,
      scavenging: 30,
      intimidation: 20,
      vehicleUse: 16,
      wisdom: 25
    };
  }

  static get coreStats() {
    return CORE_STATS;
  }

  static get skills() {
    return SKILLS;
  }

  static fromSnapshot(snapshot) {
    const state = new GameState();
    const safe = snapshot || {};
    state.avatar = safe.avatar || null;
    state.scenario = safe.scenario || null;
    state.currentSceneId = safe.currentSceneId || null;
    state.turn = safe.turn || 0;
    state.flags = safe.flags || {};
    state.inventory = Array.isArray(safe.inventory) ? safe.inventory : [];
    state.relationships = safe.relationships || {};
    state.coop = safe.coop || { active: false, partner: null, actingPlayer: "player" };
    state.gameOver = Boolean(safe.gameOver);
    state.history = Array.isArray(safe.history) ? safe.history : [];
    state.stats = { ...state.stats, ...(safe.stats || {}) };
    state.skills = { ...state.skills, ...(safe.skills || {}) };
    return state;
  }

  createAvatar(input, catalog) {
    const profession = catalog.professions.find((item) => item.id === input.professionId);
    const ageBand = catalog.ageBands.find((item) => item.id === input.ageBandId);
    const gender = catalog.genders.find((item) => item.id === input.genderId);

    this.avatar = {
      id: crypto.randomUUID ? crypto.randomUUID() : `avatar-${Date.now()}`,
      name: input.name.trim() || "Unnamed Survivor",
      genderId: gender.id,
      gender: gender.label,
      ageBandId: ageBand.id,
      ageBand: ageBand.label,
      professionId: profession.id,
      profession: profession.label,
      summary: profession.summary,
      createdAt: new Date().toISOString()
    };

    this.applyBonuses(profession.bonuses);
    this.applyBonuses(ageBand.bonuses);
    this.addInventory(profession.inventory);
  }

  applyScenario(scenario) {
    this.scenario = scenario;
    this.currentSceneId = scenario.scene;
    this.addInventory(scenario.inventory || []);
    this.applyBonuses(scenario.stats || {});
  }

  applyBonuses(bonuses = {}) {
    for (const [key, value] of Object.entries(bonuses)) {
      if (key === "reputation") {
        this.stats.reputation = clamp(this.stats.reputation + value, 0, 100);
      } else if (key in this.stats) {
        this.stats[key] = clamp(this.stats[key] + value, 0, 120);
      } else if (key in this.skills) {
        this.skills[key] = clamp(this.skills[key] + value, 0, 100);
      }
    }
  }

  applyEffects(effects = {}) {
    // Story choices and events use the same effect shape so new content stays easy to author.
    for (const [key, value] of Object.entries(effects.stats || {})) {
      if (key in this.stats) {
        this.stats[key] = clamp(this.stats[key] + value, 0, 120);
      } else if (key in this.skills) {
        this.skills[key] = clamp(this.skills[key] + value, 0, 100);
      }
    }

    for (const [key, value] of Object.entries(effects.skills || {})) {
      if (key in this.skills) {
        this.skills[key] = clamp(this.skills[key] + value, 0, 100);
      }
    }

    if (typeof effects.reputation === "number") {
      this.stats.reputation = clamp(this.stats.reputation + effects.reputation, 0, 100);
    }

    if (effects.inventory) {
      this.addInventory(effects.inventory);
    }

    if (effects.removeInventory) {
      this.inventory = this.inventory.filter((item) => !effects.removeInventory.includes(item));
    }

    if (effects.flag) {
      this.flags[effects.flag] = true;
    }
  }

  addInventory(items = []) {
    for (const item of items) {
      if (!this.inventory.includes(item)) {
        this.inventory.push(item);
      }
    }
  }

  canTake(choice) {
    if (!choice.requires) {
      return true;
    }

    const requirement = choice.requires;
    if (requirement.skill) {
      return (this.skills[requirement.skill] || 0) >= requirement.gte;
    }

    if (requirement.stat) {
      return (this.stats[requirement.stat] || 0) >= requirement.gte;
    }

    if (requirement.item) {
      return this.inventory.includes(requirement.item);
    }

    if (requirement.flag) {
      return Boolean(this.flags[requirement.flag]);
    }

    return true;
  }

  requirementText(choice) {
    if (!choice.requires) {
      return "";
    }

    const requirement = choice.requires;
    if (requirement.skill) {
      return `Requires ${labelize(requirement.skill)} ${requirement.gte}+`;
    }
    if (requirement.stat) {
      return `Requires ${labelize(requirement.stat)} ${requirement.gte}+`;
    }
    if (requirement.item) {
      return `Requires ${requirement.item}`;
    }
    if (requirement.flag) {
      return `Requires ${labelize(requirement.flag)}`;
    }

    return "Requirement not met";
  }

  decayAfterChoice() {
    this.stats.hunger = clamp(this.stats.hunger - 3, 0, 120);
    this.stats.stamina = clamp(this.stats.stamina - 2, 0, 120);

    if (this.stats.hunger <= 15) {
      this.stats.health = clamp(this.stats.health - 4, 0, 120);
      this.stats.morale = clamp(this.stats.morale - 2, 0, 120);
    }

    if (this.stats.stamina <= 10) {
      this.stats.morale = clamp(this.stats.morale - 2, 0, 120);
    }
  }

  isDead() {
    return this.stats.health <= 0 || this.stats.hunger <= 0 || this.stats.morale <= 0;
  }

  deathReason() {
    if (this.stats.health <= 0) {
      return "Your body gives out before your will does. The page ends in a smear of charcoal and rain.";
    }
    if (this.stats.hunger <= 0) {
      return "Starvation makes the world small, then smaller, then gone. The city keeps walking without you.";
    }
    return "The last light inside you gutters out. In this world, surrender is also a wound.";
  }

  publicAvatar() {
    return {
      id: this.avatar.id,
      name: this.avatar.name,
      gender: this.avatar.gender,
      genderId: this.avatar.genderId,
      ageBand: this.avatar.ageBand,
      ageBandId: this.avatar.ageBandId,
      profession: this.avatar.profession,
      professionId: this.avatar.professionId,
      reputation: this.stats.reputation,
      location: this.scenario?.location || "unknown",
      status: this.gameOver ? "lost" : "alive",
      lastSeenTurn: this.turn,
      updatedAt: new Date().toISOString()
    };
  }

  snapshot() {
    return {
      avatar: this.avatar,
      scenario: this.scenario,
      currentSceneId: this.currentSceneId,
      turn: this.turn,
      flags: this.flags,
      inventory: this.inventory,
      relationships: this.relationships,
      coop: this.coop,
      gameOver: this.gameOver,
      history: this.history,
      stats: this.stats,
      skills: this.skills
    };
  }
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function labelize(value) {
  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
