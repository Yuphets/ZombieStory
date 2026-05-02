import { DatabaseClient } from "./databaseClient.js";

const STORAGE_KEY = "scratchMarks.sharedWorld.v1";

const SEED_AVATARS = [
  {
    id: "seed-mara",
    name: "Mara Voss",
    gender: "Female",
    genderId: "female",
    ageBand: "Adult 26-45",
    ageBandId: "adult",
    profession: "Mechanic",
    professionId: "mechanic",
    reputation: 68,
    location: "tow yard",
    status: "alive"
  },
  {
    id: "seed-len",
    name: "Len Park",
    gender: "Non-binary",
    genderId: "non-binary",
    ageBand: "Teen 13-17",
    ageBandId: "teen",
    profession: "High School Student",
    professionId: "high-school-student",
    reputation: 42,
    location: "school roof",
    status: "alive"
  },
  {
    id: "seed-owen",
    name: "Owen Rusk",
    gender: "Male",
    genderId: "male",
    ageBand: "Older Adult 46+",
    ageBandId: "older-adult",
    profession: "Teacher",
    professionId: "teacher",
    reputation: 81,
    location: "old mill",
    status: "alive"
  }
];

export class SharedWorld {
  constructor() {
    this.db = new DatabaseClient();
    this.avatars = [];
    this.usingDatabase = true;
  }

  async init() {
    try {
      this.avatars = await this.db.listAvatars();
      this.usingDatabase = true;
    } catch {
      this.ensureSeedData();
      this.avatars = this.readLocal().avatars;
      this.usingDatabase = false;
    }
  }

  listAvatars() {
    return this.avatars;
  }

  async upsertAvatar(avatar) {
    const record = { ...avatar, updatedAt: new Date().toISOString() };
    this.upsertMemory(record);

    if (this.usingDatabase) {
      await this.db.upsertAvatar(record);
    } else {
      this.writeLocal({ avatars: this.avatars });
    }
  }

  getEncounterable(currentAvatarId, seenIds = []) {
    return this.listAvatars()
      .filter((avatar) => avatar.id !== currentAvatarId)
      .filter((avatar) => avatar.status !== "lost")
      .filter((avatar) => !seenIds.includes(avatar.id));
  }

  makeEncounterScene(other, state) {
    const wary = other.reputation < 40 || state.stats.reputation < 40;
    const opening = wary
      ? `${other.name}, a ${other.ageBand.toLowerCase()} ${other.profession.toLowerCase()}, watches you from behind a cracked bus window. Their weapon is low, but not low enough.`
      : `${other.name}, a ${other.ageBand.toLowerCase()} ${other.profession.toLowerCase()}, steps into view with open hands and tired eyes. Your reputation reached them before you did.`;

    return {
      id: `encounter-${other.id}-${Date.now()}`,
      label: "SHARED WORLD",
      art: "encounter",
      text: `${opening} They know a route through the next block and want to know what kind of survivor you are.`,
      encounterAvatarId: other.id,
      choices: [
        {
          text: `Ally with ${other.name}`,
          next: state.currentSceneId,
          encounterAction: "ally",
          effects: { stats: { morale: 6 }, reputation: 6, inventory: [`ally: ${other.name}`] }
        },
        {
          text: "Trade supplies and information",
          next: state.currentSceneId,
          encounterAction: "trade",
          effects: { stats: { supplies: 5, morale: 2 }, reputation: 2 }
        },
        {
          text: "Ignore them and keep moving",
          next: state.currentSceneId,
          encounterAction: "ignore",
          effects: { stats: { stamina: -2 }, reputation: -1 }
        },
        {
          text: "Compete for the route and the loot",
          next: state.currentSceneId,
          encounterAction: "compete",
          effects: { stats: { supplies: 8, health: -6, morale: -6 }, reputation: -10 }
        }
      ]
    };
  }

  recordEncounter(state, choice, scene) {
    if (!scene.encounterAvatarId) {
      return;
    }

    state.relationships[scene.encounterAvatarId] = choice.encounterAction;
  }

  makeCoopPartner(currentAvatarId) {
    const candidates = this.listAvatars().filter((avatar) => avatar.id !== currentAvatarId);
    return candidates[Math.floor(Math.random() * candidates.length)] || SEED_AVATARS[0];
  }

  resetLocalFallback() {
    localStorage.removeItem(STORAGE_KEY);
    this.ensureSeedData();
    this.avatars = this.readLocal().avatars;
  }

  upsertMemory(record) {
    const index = this.avatars.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      this.avatars[index] = record;
    } else {
      this.avatars.push(record);
    }
  }

  ensureSeedData() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      this.writeLocal({ avatars: SEED_AVATARS });
    }
  }

  readLocal() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { avatars: [] };
    } catch {
      return { avatars: [] };
    }
  }

  writeLocal(value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value, null, 2));
  }
}
