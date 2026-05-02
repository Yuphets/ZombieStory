export class StoryEngine {
  constructor({ scenes, scenarios, events }) {
    this.scenes = scenes;
    this.scenarios = scenarios;
    this.events = events;
  }

  pickStartingScenario(professionId) {
    const options = this.scenarios[professionId] || this.scenarios.unemployed;
    return options[Math.floor(Math.random() * options.length)];
  }

  getScene(sceneId) {
    return this.scenes[sceneId] || this.scenes.city_streets;
  }

  resolveChoice(choice, state) {
    state.applyEffects(choice.effects || {});
    state.decayAfterChoice();
    state.history.push({
      turn: state.turn,
      scene: state.currentSceneId,
      choice: choice.text,
      at: new Date().toISOString()
    });
    state.turn += 1;
    state.currentSceneId = choice.next || state.currentSceneId;
  }

  maybeRandomEvent(state) {
    if (state.turn < 3 || state.turn % 2 === 0 || Math.random() > 0.32) {
      return null;
    }

    const event = this.events[Math.floor(Math.random() * this.events.length)];
    state.applyEffects(event.effects || {});
    return {
      id: `event-${event.id}-${Date.now()}`,
      label: event.label,
      art: event.art,
      text: `${event.text}\n\nYou press on because the page has not turned black yet.`,
      choices: [
        {
          text: "Keep moving",
          next: state.currentSceneId,
          effects: {}
        }
      ]
    };
  }

  buildDeathScene(state) {
    return {
      id: "death",
      label: "THE END",
      art: "street",
      text: state.deathReason(),
      ending: `Lost after ${state.turn} turns`
    };
  }
}
