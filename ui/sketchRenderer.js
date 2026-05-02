export class SketchRenderer {
  draw(canvas, scene, state) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const rng = seededRandom(`${scene.id}-${state.turn}`);

    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    this.paper(ctx, w, h, rng);
    this.atmosphere(ctx, w, h, rng);
    this.establishPerspective(ctx, w, h, rng);

    const drawers = {
      checkpoint: () => this.checkpoint(ctx, w, h, rng),
      suburb: () => this.suburb(ctx, w, h, rng),
      overpass: () => this.overpass(ctx, w, h, rng),
      school: () => this.school(ctx, w, h, rng),
      mall: () => this.mall(ctx, w, h, rng),
      hospital: () => this.hospital(ctx, w, h, rng),
      station: () => this.station(ctx, w, h, rng),
      roadblock: () => this.roadblock(ctx, w, h, rng),
      garage: () => this.garage(ctx, w, h, rng),
      museum: () => this.museum(ctx, w, h, rng),
      stadium: () => this.stadium(ctx, w, h, rng),
      office: () => this.office(ctx, w, h, rng),
      restaurant: () => this.restaurant(ctx, w, h, rng),
      market: () => this.market(ctx, w, h, rng),
      bridge: () => this.bridge(ctx, w, h, rng),
      industrial: () => this.industrial(ctx, w, h, rng),
      shelter: () => this.shelter(ctx, w, h, rng),
      radio: () => this.radio(ctx, w, h, rng),
      encounter: () => this.encounter(ctx, w, h, rng),
      street: () => this.street(ctx, w, h, rng)
    };

    (drawers[scene.art] || drawers.street)();
    this.foregroundDebris(ctx, w, h, rng);
    this.foregroundFrame(ctx, w, h, rng);
    this.focalHighlight(ctx, w, h);
    this.vignette(ctx, w, h);
    this.panelBorder(ctx, w, h, rng);
  }

  paper(ctx, w, h, rng) {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#f4f4f0");
    gradient.addColorStop(0.46, "#e2e1dc");
    gradient.addColorStop(1, "#f8f8f4");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.11;
    for (let i = 0; i < 420; i += 1) {
      const tone = 70 + Math.floor(rng() * 110);
      ctx.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
      ctx.fillRect(rng() * w, rng() * h, 0.4 + rng() * 1.9, 0.4 + rng() * 1.9);
    }
    ctx.restore();
  }

  atmosphere(ctx, w, h, rng) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "rgba(20,20,20,0.12)");
    sky.addColorStop(0.48, "rgba(20,20,20,0.035)");
    sky.addColorStop(1, "rgba(20,20,20,0.08)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.11;
    for (let i = 0; i < 18; i += 1) {
      this.smudge(ctx, rng() * w, h * (0.12 + rng() * 0.45), w * (0.08 + rng() * 0.18), h * (0.025 + rng() * 0.06), rng);
    }
    ctx.restore();
  }

  establishPerspective(ctx, w, h, rng) {
    const vp = { x: w * 0.54, y: h * 0.45 };
    ctx.save();
    ctx.globalAlpha = 0.13;
    for (let i = 0; i < 9; i += 1) {
      const x = w * (i / 8);
      this.inkLine(ctx, x, h + 10, vp.x + jitter(rng, 6), vp.y + jitter(rng, 5), 0.9, "#1f1f1f", rng, 1);
    }
    ctx.restore();
  }

  street(ctx, w, h, rng) {
    this.cityDepth(ctx, w, h, rng, { left: true, right: true });
    this.perspectiveRoad(ctx, w, h, rng);
    this.foregroundFigure(ctx, w * 0.53, h * 0.58, h * 0.29, rng);
    this.distantFigures(ctx, w, h, rng, 8);
  }

  checkpoint(ctx, w, h, rng) {
    this.cityDepth(ctx, w, h, rng, { left: false, right: true });
    this.perspectiveRoad(ctx, w, h, rng);
    this.tent(ctx, w * 0.09, h * 0.41, w * 0.23, h * 0.17, rng);
    this.barricade(ctx, w * 0.34, h * 0.56, w * 0.44, h * 0.08, rng);
    this.watchTower(ctx, w * 0.72, h * 0.2, w * 0.13, h * 0.34, rng);
    this.foregroundFigure(ctx, w * 0.45, h * 0.56, h * 0.25, rng, true);
    this.distantFigures(ctx, w, h, rng, 9);
  }

  suburb(ctx, w, h, rng) {
    this.perspectiveRoad(ctx, w, h, rng, 0.52);
    for (let i = 0; i < 5; i += 1) {
      const depth = i / 4;
      const scale = 1 - depth * 0.42;
      const x = w * (0.05 + i * 0.19);
      const y = h * (0.38 - depth * 0.06);
      this.house(ctx, x, y, w * 0.16 * scale, h * 0.22 * scale, rng, depth);
    }
    this.car(ctx, w * 0.62, h * 0.61, w * 0.2, h * 0.08, rng, 0);
    this.distantFigures(ctx, w, h, rng, 4);
  }

  overpass(ctx, w, h, rng) {
    this.underpassShadow(ctx, w, h);
    this.bridgeSlab(ctx, -w * 0.04, h * 0.18, w * 1.12, h * 0.2, rng);
    for (let i = 0; i < 7; i += 1) {
      const x = w * (0.05 + i * 0.15);
      this.inkLine(ctx, x, h * 0.38, x - w * 0.07, h, 5, "#202020", rng, 2);
      this.hatchBox(ctx, x - 8, h * 0.38, 18, h * 0.5, rng, 14, "vertical");
    }
    this.foregroundFigure(ctx, w * 0.35, h * 0.65, h * 0.22, rng);
    this.bedroll(ctx, w * 0.58, h * 0.72, w * 0.18, h * 0.05, rng);
  }

  school(ctx, w, h, rng) {
    this.pavedGround(ctx, w, h, rng);
    this.blockBuilding(ctx, w * 0.1, h * 0.18, w * 0.78, h * 0.42, rng, { floors: 2, windows: 9, sign: "LOCKDOWN" });
    this.flagPole(ctx, w * 0.78, h * 0.18, h * 0.42, rng);
    this.foregroundFigure(ctx, w * 0.24, h * 0.66, h * 0.21, rng);
    this.distantFigures(ctx, w, h, rng, 5);
  }

  mall(ctx, w, h, rng) {
    this.interiorFloor(ctx, w, h, rng);
    this.storefront(ctx, w * 0.08, h * 0.18, w * 0.84, h * 0.42, rng, "FOOD COURT");
    this.escalator(ctx, w * 0.12, h * 0.58, w * 0.32, h * 0.16, rng);
    this.counter(ctx, w * 0.55, h * 0.53, w * 0.28, h * 0.1, rng);
    this.distantFigures(ctx, w, h, rng, 7);
  }

  hospital(ctx, w, h, rng) {
    this.interiorFloor(ctx, w, h, rng);
    this.corridor(ctx, w, h, rng, "ER");
    this.gurney(ctx, w * 0.58, h * 0.58, w * 0.28, h * 0.09, rng);
    this.foregroundFigure(ctx, w * 0.3, h * 0.64, h * 0.24, rng);
  }

  station(ctx, w, h, rng) {
    this.pavedGround(ctx, w, h, rng);
    this.blockBuilding(ctx, w * 0.14, h * 0.2, w * 0.72, h * 0.4, rng, { floors: 2, windows: 7, sign: "PRECINCT" });
    this.steps(ctx, w * 0.36, h * 0.58, w * 0.28, h * 0.12, rng);
    this.foregroundFigure(ctx, w * 0.68, h * 0.65, h * 0.22, rng, true);
  }

  roadblock(ctx, w, h, rng) {
    this.cityDepth(ctx, w, h, rng, { left: true, right: true });
    this.perspectiveRoad(ctx, w, h, rng);
    for (let i = 0; i < 7; i += 1) {
      const scale = 1 - i * 0.06;
      this.car(ctx, w * (0.08 + i * 0.12), h * (0.55 + (i % 2) * 0.08 - i * 0.012), w * 0.16 * scale, h * 0.075 * scale, rng, i / 8);
    }
    this.barricade(ctx, w * 0.36, h * 0.48, w * 0.38, h * 0.07, rng);
  }

  garage(ctx, w, h, rng) {
    this.interiorFloor(ctx, w, h, rng);
    this.garageDoors(ctx, w, h, rng);
    this.car(ctx, w * 0.38, h * 0.58, w * 0.32, h * 0.11, rng, 0);
    this.toolWall(ctx, w * 0.12, h * 0.25, w * 0.18, h * 0.26, rng);
    this.foregroundFigure(ctx, w * 0.78, h * 0.66, h * 0.22, rng);
  }

  museum(ctx, w, h, rng) {
    this.interiorFloor(ctx, w, h, rng);
    this.blockBuilding(ctx, w * 0.12, h * 0.12, w * 0.76, h * 0.38, rng, { floors: 1, windows: 6, sign: "MUSEUM" });
    this.skeleton(ctx, w * 0.28, h * 0.62, w * 0.45, h * 0.2, rng);
    this.distantFigures(ctx, w, h, rng, 4);
  }

  stadium(ctx, w, h, rng) {
    this.pavedGround(ctx, w, h, rng);
    this.ellipseStructure(ctx, w * 0.5, h * 0.48, w * 0.42, h * 0.2, rng, "HAVEN");
    this.barricade(ctx, w * 0.18, h * 0.67, w * 0.64, h * 0.06, rng);
    this.distantFigures(ctx, w, h, rng, 10);
  }

  office(ctx, w, h, rng) {
    this.interiorFloor(ctx, w, h, rng);
    this.corridor(ctx, w, h, rng, "START TODAY");
    this.desk(ctx, w * 0.16, h * 0.56, w * 0.28, h * 0.13, rng);
    this.desk(ctx, w * 0.56, h * 0.5, w * 0.22, h * 0.1, rng);
  }

  restaurant(ctx, w, h, rng) {
    this.interiorFloor(ctx, w, h, rng);
    this.storefront(ctx, w * 0.12, h * 0.19, w * 0.76, h * 0.36, rng, "OPEN");
    this.counter(ctx, w * 0.16, h * 0.55, w * 0.58, h * 0.1, rng);
    this.hangingLamp(ctx, w * 0.36, h * 0.15, h * 0.24, rng);
    this.hangingLamp(ctx, w * 0.62, h * 0.15, h * 0.24, rng);
  }

  market(ctx, w, h, rng) {
    this.pavedGround(ctx, w, h, rng);
    for (let i = 0; i < 5; i += 1) {
      const x = w * (0.06 + i * 0.18);
      this.marketStall(ctx, x, h * (0.35 + (i % 2) * 0.035), w * 0.15, h * 0.18, rng);
    }
    this.foregroundFigure(ctx, w * 0.74, h * 0.68, h * 0.22, rng);
  }

  bridge(ctx, w, h, rng) {
    this.water(ctx, w, h, rng);
    this.bridgeDeck(ctx, w, h, rng);
    for (let i = 0; i < 7; i += 1) {
      const x = w * (0.1 + i * 0.13);
      this.inkLine(ctx, x, h * 0.25, x + w * 0.03, h * 0.62, 2.2, "#202020", rng, 1.6);
    }
    this.distantFigures(ctx, w, h, rng, 8);
  }

  industrial(ctx, w, h, rng) {
    this.pavedGround(ctx, w, h, rng);
    this.factoryBlock(ctx, w * 0.12, h * 0.25, w * 0.26, h * 0.34, rng);
    this.factoryBlock(ctx, w * 0.48, h * 0.16, w * 0.34, h * 0.44, rng);
    this.foregroundFigure(ctx, w * 0.42, h * 0.66, h * 0.2, rng);
  }

  shelter(ctx, w, h, rng) {
    this.pavedGround(ctx, w, h, rng);
    this.house(ctx, w * 0.28, h * 0.23, w * 0.38, h * 0.28, rng, 0);
    this.fence(ctx, w * 0.1, h * 0.62, w * 0.78, h * 0.11, rng);
    this.distantFigures(ctx, w, h, rng, 9);
  }

  radio(ctx, w, h, rng) {
    this.interiorFloor(ctx, w, h, rng);
    this.radioSet(ctx, w * 0.35, h * 0.35, w * 0.3, h * 0.2, rng);
    this.castShadow(ctx, w * 0.34, h * 0.57, w * 0.36, h * 0.08, 0.22);
    for (let i = 0; i < 4; i += 1) {
      this.inkLine(ctx, w * 0.5, h * 0.35, w * (0.36 + i * 0.09), h * (0.11 + i * 0.018), 1.6, "#202020", rng, 1.4);
    }
  }

  encounter(ctx, w, h, rng) {
    this.cityDepth(ctx, w, h, rng, { left: true, right: true });
    this.perspectiveRoad(ctx, w, h, rng);
    this.foregroundFigure(ctx, w * 0.5, h * 0.58, h * 0.32, rng, true);
    this.foregroundFigure(ctx, w * 0.27, h * 0.68, h * 0.2, rng);
  }

  cityDepth(ctx, w, h, rng, opts) {
    const vpY = h * 0.46;
    for (let i = 0; i < 5; i += 1) {
      const depth = i / 5;
      const shade = 80 - i * 10;
      if (opts.left) {
        const x = w * (-0.04 + i * 0.055);
        const bw = w * (0.18 - depth * 0.04);
        const bh = h * (0.48 - depth * 0.05);
        this.building(ctx, x, vpY - bh * 0.72, bw, bh, rng, depth, shade);
      }
      if (opts.right) {
        const x = w * (0.88 - i * 0.045);
        const bw = w * (0.18 - depth * 0.04);
        const bh = h * (0.44 - depth * 0.05);
        this.building(ctx, x, vpY - bh * 0.68, bw, bh, rng, depth, shade);
      }
    }
  }

  building(ctx, x, y, w, h, rng, depth = 0, shade = 65) {
    const tone = Math.max(26, shade);
    this.castShadow(ctx, x + w * 0.08, y + h * 0.9, w * 0.95, h * 0.14, 0.1 + (1 - depth) * 0.14);
    this.inkPolygon(ctx, [
      [x, y],
      [x + w, y + h * 0.05],
      [x + w * 0.92, y + h],
      [x + w * 0.04, y + h * 0.96]
    ], `rgba(${tone},${tone},${tone},0.08)`, "#202020", rng, 1.5);

    const rows = 3 + Math.floor((1 - depth) * 3);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const wx = x + w * (0.2 + col * 0.35);
        const wy = y + h * (0.18 + row * 0.15);
        this.tonedRect(ctx, wx, wy, w * 0.15, h * 0.07, rng, 0.08 + depth * 0.04, true);
      }
    }
    this.hatchBox(ctx, x, y, w, h, rng, 12 + depth * 20, "diagonal", 0.1);
  }

  perspectiveRoad(ctx, w, h, rng, horizon = 0.48) {
    const vp = { x: w * 0.54, y: h * horizon };
    this.inkPolygon(ctx, [
      [w * 0.12, h],
      [vp.x - w * 0.08, vp.y],
      [vp.x + w * 0.08, vp.y],
      [w * 0.9, h]
    ], "rgba(20,20,20,0.055)", "#2a2a2a", rng, 1.2);

    this.hatchBox(ctx, w * 0.15, h * 0.62, w * 0.72, h * 0.35, rng, 18, "road", 0.09);
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const y = vp.y + (h - vp.y) * Math.pow(t, 1.35);
      const x = vp.x + (w * 0.02) * (t - 0.5);
      this.inkLine(ctx, x, y, x + w * 0.025 * t, y + h * 0.045 * t, 1.5, "#373737", rng, 1);
    }
  }

  pavedGround(ctx, w, h, rng) {
    this.inkLine(ctx, 0, h * 0.62, w, h * 0.57, 1.5, "#3a3a3a", rng, 1);
    this.hatchBox(ctx, 0, h * 0.58, w, h * 0.42, rng, 22, "road", 0.08);
  }

  interiorFloor(ctx, w, h, rng) {
    const vp = { x: w * 0.5, y: h * 0.38 };
    this.inkPolygon(ctx, [[0, h], [w * 0.22, vp.y], [w * 0.78, vp.y], [w, h]], "rgba(20,20,20,0.06)", "#2a2a2a", rng, 1);
    ctx.save();
    ctx.globalAlpha = 0.13;
    for (let i = 0; i < 9; i += 1) {
      this.inkLine(ctx, w * (i / 8), h, vp.x, vp.y, 0.8, "#202020", rng, 1);
    }
    for (let i = 0; i < 7; i += 1) {
      const y = h * (0.48 + i * 0.075);
      this.inkLine(ctx, w * 0.08, y, w * 0.92, y - i * 3, 0.8, "#202020", rng, 1);
    }
    ctx.restore();
  }

  blockBuilding(ctx, x, y, w, h, rng, config) {
    this.castShadow(ctx, x + w * 0.1, y + h * 0.92, w * 0.9, h * 0.14, 0.16);
    this.inkPolygon(ctx, [[x, y], [x + w, y + h * 0.02], [x + w * 0.97, y + h], [x + w * 0.02, y + h]], "rgba(20,20,20,0.06)", "#202020", rng, 1.7);
    const windows = config.windows || 6;
    const floors = config.floors || 2;
    for (let row = 0; row < floors; row += 1) {
      for (let col = 0; col < windows; col += 1) {
        const ww = w * 0.055;
        const wh = h * 0.13;
        this.tonedRect(ctx, x + w * 0.08 + col * (w * 0.84 / windows), y + h * 0.18 + row * h * 0.28, ww, wh, rng, 0.1, true);
      }
    }
    this.sketchText(ctx, config.sign, x + w * 0.39, y + h * 0.82, Math.max(13, h * 0.08));
    this.hatchBox(ctx, x, y, w, h, rng, 16, "diagonal", 0.09);
  }

  storefront(ctx, x, y, w, h, rng, sign) {
    this.inkPolygon(ctx, [[x, y], [x + w, y], [x + w * 0.96, y + h], [x + w * 0.04, y + h]], "rgba(20,20,20,0.055)", "#202020", rng, 1.8);
    this.tonedRect(ctx, x + w * 0.08, y + h * 0.2, w * 0.28, h * 0.5, rng, 0.12, true);
    this.tonedRect(ctx, x + w * 0.42, y + h * 0.2, w * 0.2, h * 0.5, rng, 0.12, true);
    this.tonedRect(ctx, x + w * 0.68, y + h * 0.2, w * 0.2, h * 0.5, rng, 0.12, true);
    this.sketchText(ctx, sign, x + w * 0.39, y + h * 0.15, Math.max(14, h * 0.09));
    this.hatchBox(ctx, x, y, w, h, rng, 14, "diagonal", 0.08);
  }

  corridor(ctx, w, h, rng, sign) {
    this.inkPolygon(ctx, [[w * 0.18, h * 0.16], [w * 0.82, h * 0.16], [w * 0.74, h * 0.58], [w * 0.26, h * 0.58]], "rgba(20,20,20,0.05)", "#202020", rng, 1.5);
    this.inkLine(ctx, w * 0.26, h * 0.58, 0, h, 1.4, "#202020", rng, 1);
    this.inkLine(ctx, w * 0.74, h * 0.58, w, h, 1.4, "#202020", rng, 1);
    this.tonedRect(ctx, w * 0.43, h * 0.23, w * 0.14, h * 0.22, rng, 0.11, true);
    this.sketchText(ctx, sign, w * 0.45, h * 0.2, 15);
    this.hatchBox(ctx, w * 0.18, h * 0.16, w * 0.64, h * 0.42, rng, 16, "vertical", 0.08);
  }

  house(ctx, x, y, w, h, rng, depth = 0) {
    this.castShadow(ctx, x + w * 0.04, y + h * 0.91, w * 0.9, h * 0.14, 0.12);
    this.inkPolygon(ctx, [[x, y + h * 0.32], [x + w * 0.5, y], [x + w, y + h * 0.32], [x + w * 0.93, y + h], [x + w * 0.07, y + h]], "rgba(20,20,20,0.055)", "#202020", rng, 1.5);
    this.tonedRect(ctx, x + w * 0.16, y + h * 0.48, w * 0.18, h * 0.18, rng, 0.12, true);
    this.tonedRect(ctx, x + w * 0.58, y + h * 0.48, w * 0.18, h * 0.18, rng, 0.12, true);
    this.hatchBox(ctx, x, y + h * 0.28, w, h * 0.72, rng, 12 + depth * 18, "diagonal", 0.08);
  }

  car(ctx, x, y, w, h, rng, depth = 0) {
    this.castShadow(ctx, x + w * 0.04, y + h * 0.76, w * 0.96, h * 0.5, 0.18 - depth * 0.08);
    this.inkPolygon(ctx, [[x, y + h * 0.35], [x + w * 0.18, y], [x + w * 0.68, y + h * 0.03], [x + w, y + h * 0.38], [x + w * 0.95, y + h], [x + w * 0.06, y + h]], "rgba(20,20,20,0.075)", "#202020", rng, 1.5);
    this.tonedRect(ctx, x + w * 0.22, y + h * 0.15, w * 0.18, h * 0.22, rng, 0.13, true);
    this.tonedRect(ctx, x + w * 0.47, y + h * 0.16, w * 0.18, h * 0.22, rng, 0.13, true);
    this.ellipseSketch(ctx, x + w * 0.22, y + h, w * 0.08, h * 0.34, rng, "#181818", true);
    this.ellipseSketch(ctx, x + w * 0.78, y + h, w * 0.08, h * 0.34, rng, "#181818", true);
    this.hatchBox(ctx, x, y, w, h, rng, 10, "diagonal", 0.12);
  }

  foregroundFigure(ctx, x, y, size, rng, armed = false) {
    this.castShadow(ctx, x - size * 0.28, y + size * 0.1, size * 0.58, size * 0.16, 0.22);
    this.ellipseSketch(ctx, x, y - size * 0.86, size * 0.1, size * 0.13, rng, "#161616", true);
    this.inkPolygon(ctx, [[x - size * 0.13, y - size * 0.72], [x + size * 0.14, y - size * 0.7], [x + size * 0.1, y - size * 0.28], [x - size * 0.11, y - size * 0.3]], "rgba(20,20,20,0.13)", "#161616", rng, 1.4);
    this.inkLine(ctx, x - size * 0.08, y - size * 0.3, x - size * 0.18, y + size * 0.08, 2.2, "#161616", rng, 1.4);
    this.inkLine(ctx, x + size * 0.06, y - size * 0.3, x + size * 0.2, y + size * 0.08, 2.2, "#161616", rng, 1.4);
    this.inkLine(ctx, x - size * 0.12, y - size * 0.58, x - size * 0.3, y - size * 0.36, 2.1, "#161616", rng, 1.4);
    this.inkLine(ctx, x + size * 0.12, y - size * 0.56, x + size * 0.32, y - size * 0.39, 2.1, "#161616", rng, 1.4);
    if (armed) {
      this.inkLine(ctx, x + size * 0.26, y - size * 0.47, x + size * 0.46, y - size * 0.58, 2.4, "#111", rng, 1);
    }
    this.hatchBox(ctx, x - size * 0.13, y - size * 0.72, size * 0.27, size * 0.44, rng, 7, "diagonal", 0.14);
  }

  distantFigures(ctx, w, h, rng, count) {
    for (let i = 0; i < count; i += 1) {
      const y = h * (0.48 + rng() * 0.18);
      const size = h * (0.055 + rng() * 0.07);
      const x = w * (0.12 + rng() * 0.76);
      ctx.save();
      ctx.globalAlpha = 0.34 + rng() * 0.26;
      this.inkLine(ctx, x, y - size * 0.55, x, y, 1.4, "#202020", rng, 1);
      this.ellipseSketch(ctx, x, y - size * 0.7, size * 0.08, size * 0.1, rng, "#202020");
      this.inkLine(ctx, x, y, x - size * 0.12, y + size * 0.24, 1.2, "#202020", rng, 1);
      this.inkLine(ctx, x, y, x + size * 0.13, y + size * 0.24, 1.2, "#202020", rng, 1);
      ctx.restore();
    }
  }

  barricade(ctx, x, y, w, h, rng) {
    this.castShadow(ctx, x, y + h * 0.85, w, h * 0.45, 0.18);
    for (let i = 0; i < 6; i += 1) {
      const bx = x + (w / 6) * i;
      this.inkPolygon(ctx, [[bx, y], [bx + w / 7, y + h * 0.08], [bx + w / 8, y + h], [bx - w / 45, y + h * 0.88]], "rgba(20,20,20,0.09)", "#191919", rng, 1.3);
      this.hatchBox(ctx, bx, y, w / 8, h, rng, 6, "diagonal", 0.15);
    }
  }

  watchTower(ctx, x, y, w, h, rng) {
    this.tonedRect(ctx, x, y, w, h * 0.26, rng, 0.09, true);
    this.inkLine(ctx, x + w * 0.12, y + h * 0.26, x - w * 0.08, y + h, 2, "#202020", rng, 1);
    this.inkLine(ctx, x + w * 0.84, y + h * 0.26, x + w * 1.04, y + h, 2, "#202020", rng, 1);
    this.inkLine(ctx, x + w * 0.12, y + h * 0.62, x + w * 0.9, y + h * 0.45, 1.2, "#202020", rng, 1);
  }

  tent(ctx, x, y, w, h, rng) {
    this.castShadow(ctx, x, y + h * 0.92, w, h * 0.18, 0.12);
    this.inkPolygon(ctx, [[x, y + h], [x + w * 0.48, y], [x + w, y + h]], "rgba(20,20,20,0.06)", "#202020", rng, 1.4);
    this.inkLine(ctx, x + w * 0.48, y, x + w * 0.55, y + h, 1.5, "#202020", rng, 1);
    this.hatchBox(ctx, x, y, w, h, rng, 9, "diagonal", 0.11);
  }

  bridgeSlab(ctx, x, y, w, h, rng) {
    this.inkPolygon(ctx, [[x, y], [x + w, y + h * 0.08], [x + w * 0.98, y + h], [x + w * 0.02, y + h * 0.92]], "rgba(20,20,20,0.14)", "#141414", rng, 2);
    this.hatchBox(ctx, x, y, w, h, rng, 13, "diagonal", 0.16);
  }

  underpassShadow(ctx, w, h) {
    const g = ctx.createLinearGradient(0, h * 0.2, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0.24)");
    g.addColorStop(0.46, "rgba(0,0,0,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  bedroll(ctx, x, y, w, h, rng) {
    this.castShadow(ctx, x, y + h * 0.7, w, h, 0.2);
    this.ellipseSketch(ctx, x + w * 0.5, y + h * 0.5, w * 0.48, h * 0.45, rng, "#202020", true);
    this.hatchBox(ctx, x, y, w, h, rng, 5, "diagonal", 0.16);
  }

  flagPole(ctx, x, y, h, rng) {
    this.inkLine(ctx, x, y, x, y + h, 1.5, "#202020", rng, 1);
    this.inkPolygon(ctx, [[x, y + h * 0.02], [x + h * 0.18, y + h * 0.06], [x, y + h * 0.12]], "rgba(20,20,20,0.08)", "#202020", rng, 1);
  }

  escalator(ctx, x, y, w, h, rng) {
    this.inkPolygon(ctx, [[x, y + h], [x + w * 0.9, y], [x + w, y + h * 0.1], [x + w * 0.1, y + h * 1.08]], "rgba(20,20,20,0.07)", "#202020", rng, 1.4);
    for (let i = 0; i < 8; i += 1) {
      this.inkLine(ctx, x + w * (i / 8), y + h * (1 - i / 9), x + w * (i / 8 + 0.12), y + h * (0.88 - i / 9), 0.8, "#202020", rng, 1);
    }
  }

  counter(ctx, x, y, w, h, rng) {
    this.castShadow(ctx, x, y + h * 0.8, w, h * 0.8, 0.14);
    this.inkPolygon(ctx, [[x, y], [x + w, y + h * 0.06], [x + w * 0.96, y + h], [x + w * 0.04, y + h]], "rgba(20,20,20,0.08)", "#202020", rng, 1.4);
    this.hatchBox(ctx, x, y, w, h, rng, 8, "vertical", 0.12);
  }

  gurney(ctx, x, y, w, h, rng) {
    this.castShadow(ctx, x, y + h * 0.8, w, h, 0.18);
    this.tonedRect(ctx, x, y, w, h, rng, 0.12, true);
    this.inkLine(ctx, x + w * 0.1, y + h, x + w * 0.08, y + h * 2.2, 1.2, "#202020", rng, 1);
    this.inkLine(ctx, x + w * 0.88, y + h, x + w * 0.9, y + h * 2.2, 1.2, "#202020", rng, 1);
  }

  steps(ctx, x, y, w, h, rng) {
    for (let i = 0; i < 4; i += 1) {
      this.inkLine(ctx, x - i * 8, y + i * h * 0.22, x + w + i * 8, y + i * h * 0.22, 1.2, "#202020", rng, 1);
    }
  }

  garageDoors(ctx, w, h, rng) {
    for (let i = 0; i < 3; i += 1) {
      const x = w * (0.13 + i * 0.25);
      this.tonedRect(ctx, x, h * 0.18, w * 0.18, h * 0.34, rng, 0.08, true);
      for (let j = 1; j < 5; j += 1) {
        this.inkLine(ctx, x, h * (0.18 + j * 0.06), x + w * 0.18, h * (0.18 + j * 0.06), 0.8, "#202020", rng, 1);
      }
    }
  }

  toolWall(ctx, x, y, w, h, rng) {
    this.tonedRect(ctx, x, y, w, h, rng, 0.07, true);
    for (let i = 0; i < 8; i += 1) {
      const tx = x + w * (0.12 + rng() * 0.76);
      const ty = y + h * (0.12 + rng() * 0.76);
      this.inkLine(ctx, tx, ty, tx + jitter(rng, w * 0.08), ty + h * 0.1, 1, "#202020", rng, 1);
    }
  }

  skeleton(ctx, x, y, w, h, rng) {
    this.inkLine(ctx, x, y, x + w * 0.22, y - h * 0.45, 2, "#202020", rng, 1);
    this.inkLine(ctx, x + w * 0.22, y - h * 0.45, x + w * 0.64, y - h * 0.18, 2, "#202020", rng, 1);
    this.inkLine(ctx, x + w * 0.64, y - h * 0.18, x + w, y - h * 0.5, 2, "#202020", rng, 1);
    for (let i = 0; i < 9; i += 1) {
      const rx = x + w * (0.28 + i * 0.035);
      this.inkLine(ctx, rx, y - h * 0.38 + i * 2, rx - w * 0.04, y - h * 0.14 + i * 1.5, 1, "#202020", rng, 1);
    }
  }

  ellipseStructure(ctx, x, y, rx, ry, rng, sign) {
    this.castShadow(ctx, x - rx * 0.78, y + ry * 0.72, rx * 1.55, ry * 0.3, 0.14);
    this.ellipseSketch(ctx, x, y, rx, ry, rng, "#202020", true);
    this.ellipseSketch(ctx, x, y + ry * 0.08, rx * 0.72, ry * 0.58, rng, "#202020");
    this.sketchText(ctx, sign, x - rx * 0.18, y - ry * 0.18, 18);
    this.hatchEllipse(ctx, x, y, rx, ry, rng, 0.12);
  }

  desk(ctx, x, y, w, h, rng) {
    this.castShadow(ctx, x, y + h * 0.78, w, h, 0.14);
    this.inkPolygon(ctx, [[x, y], [x + w, y + h * 0.08], [x + w * 0.92, y + h], [x + w * 0.08, y + h]], "rgba(20,20,20,0.08)", "#202020", rng, 1.3);
    this.hatchBox(ctx, x, y, w, h, rng, 8, "diagonal", 0.12);
  }

  hangingLamp(ctx, x, y, drop, rng) {
    this.inkLine(ctx, x, 0, x, y, 0.8, "#202020", rng, 1);
    this.inkPolygon(ctx, [[x - drop * 0.08, y], [x + drop * 0.08, y], [x + drop * 0.13, y + drop * 0.08], [x - drop * 0.13, y + drop * 0.08]], "rgba(20,20,20,0.08)", "#202020", rng, 1);
  }

  marketStall(ctx, x, y, w, h, rng) {
    this.inkPolygon(ctx, [[x, y + h * 0.35], [x + w * 0.5, y], [x + w, y + h * 0.35], [x + w * 0.9, y + h * 0.45], [x + w * 0.08, y + h * 0.45]], "rgba(20,20,20,0.08)", "#202020", rng, 1.2);
    this.counter(ctx, x + w * 0.05, y + h * 0.45, w * 0.9, h * 0.28, rng);
  }

  water(ctx, w, h, rng) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 18; i += 1) {
      const y = h * (0.58 + i * 0.025);
      this.inkLine(ctx, w * 0.02, y, w * 0.98, y + jitter(rng, 5), 0.8, "#202020", rng, 1);
    }
    ctx.restore();
  }

  bridgeDeck(ctx, w, h, rng) {
    this.inkPolygon(ctx, [[w * 0.02, h * 0.58], [w * 0.94, h * 0.42], [w, h * 0.5], [w * 0.08, h * 0.72]], "rgba(20,20,20,0.08)", "#202020", rng, 2);
    this.hatchBox(ctx, w * 0.05, h * 0.45, w * 0.9, h * 0.2, rng, 12, "road", 0.12);
  }

  factoryBlock(ctx, x, y, w, h, rng) {
    this.tonedRect(ctx, x, y, w, h, rng, 0.08, true);
    for (let i = 0; i < 3; i += 1) {
      const sx = x + w * (0.25 + i * 0.2);
      this.tonedRect(ctx, sx, y - h * 0.28, w * 0.09, h * 0.28, rng, 0.1, true);
      this.smudge(ctx, sx + w * 0.05, y - h * 0.33, w * 0.12, h * 0.06, rng);
    }
    this.hatchBox(ctx, x, y, w, h, rng, 12, "vertical", 0.11);
  }

  fence(ctx, x, y, w, h, rng) {
    this.inkLine(ctx, x, y, x + w, y - h * 0.08, 1.5, "#202020", rng, 1);
    this.inkLine(ctx, x, y + h, x + w, y + h * 0.92, 1.5, "#202020", rng, 1);
    for (let i = 0; i < 13; i += 1) {
      const fx = x + w * (i / 12);
      this.inkLine(ctx, fx, y - h * 0.02, fx + jitter(rng, 4), y + h, 1, "#202020", rng, 1);
    }
  }

  radioSet(ctx, x, y, w, h, rng) {
    this.tonedRect(ctx, x, y, w, h, rng, 0.12, true);
    this.ellipseSketch(ctx, x + w * 0.28, y + h * 0.56, w * 0.08, h * 0.16, rng, "#181818", true);
    this.ellipseSketch(ctx, x + w * 0.64, y + h * 0.56, w * 0.08, h * 0.16, rng, "#181818", true);
    for (let i = 0; i < 5; i += 1) {
      this.inkLine(ctx, x + w * 0.18, y + h * (0.18 + i * 0.06), x + w * 0.82, y + h * (0.18 + i * 0.06), 0.9, "#202020", rng, 1);
    }
  }

  foregroundDebris(ctx, w, h, rng) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 20; i += 1) {
      const x = rng() * w;
      const y = h * (0.66 + rng() * 0.3);
      this.inkLine(ctx, x, y, x + jitter(rng, 30), y + jitter(rng, 10), 1 + rng() * 0.8, "#191919", rng, 1);
    }
    ctx.restore();
  }

  foregroundFrame(ctx, w, h, rng) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    this.inkPolygon(ctx, [
      [0, h],
      [0, h * 0.54],
      [w * 0.055, h * 0.62],
      [w * 0.035, h]
    ], "rgba(0,0,0,0.16)", "#111", rng, 1.2);
    this.inkPolygon(ctx, [
      [w, h],
      [w, h * 0.5],
      [w * 0.94, h * 0.61],
      [w * 0.965, h]
    ], "rgba(0,0,0,0.14)", "#111", rng, 1.2);
    ctx.restore();
  }

  focalHighlight(ctx, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const glow = ctx.createRadialGradient(w * 0.52, h * 0.48, 0, w * 0.52, h * 0.48, Math.max(w, h) * 0.42);
    glow.addColorStop(0, "rgba(255,255,255,0.16)");
    glow.addColorStop(0.55, "rgba(255,255,255,0.06)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  hatchBox(ctx, x, y, w, h, rng, spacing = 12, mode = "diagonal", alpha = 0.1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const count = Math.ceil((w + h) / spacing);
    for (let i = -count; i < count * 1.6; i += 1) {
      if (mode === "vertical") {
        const xx = x + i * spacing;
        this.inkLine(ctx, xx, y, xx + jitter(rng, 5), y + h, 0.7, "#111", rng, 1);
      } else if (mode === "road") {
        const yy = y + i * spacing;
        this.inkLine(ctx, x, yy, x + w, yy + jitter(rng, 7), 0.7, "#111", rng, 1);
      } else {
        const x1 = x + i * spacing;
        this.inkLine(ctx, x1, y + h, x1 + h * 0.6, y, 0.7, "#111", rng, 1);
      }
    }
    ctx.restore();
  }

  hatchEllipse(ctx, x, y, rx, ry, rng, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = -8; i < 9; i += 1) {
      this.inkLine(ctx, x - rx * 0.7 + i * rx * 0.08, y + ry * 0.55, x - rx * 0.45 + i * rx * 0.08, y - ry * 0.45, 0.7, "#111", rng, 1);
    }
    ctx.restore();
  }

  tonedRect(ctx, x, y, w, h, rng, alpha = 0.08, stroked = false) {
    ctx.save();
    ctx.fillStyle = `rgba(15,15,15,${alpha})`;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    if (stroked) {
      this.inkPolygon(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], "rgba(0,0,0,0)", "#202020", rng, 1);
    }
  }

  inkPolygon(ctx, points, fill, stroke, rng, lineWidth = 1.2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      this.inkLine(ctx, a[0], a[1], b[0], b[1], lineWidth, stroke, rng, 1.5);
    }
  }

  inkLine(ctx, x1, y1, x2, y2, width, color, rng, passes = 2) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (let i = 0; i < passes; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x1 + jitter(rng, 1.6), y1 + jitter(rng, 1.6));
      const cx = (x1 + x2) / 2 + jitter(rng, 5);
      const cy = (y1 + y2) / 2 + jitter(rng, 5);
      ctx.quadraticCurveTo(cx, cy, x2 + jitter(rng, 1.6), y2 + jitter(rng, 1.6));
      ctx.stroke();
    }
    ctx.restore();
  }

  ellipseSketch(ctx, x, y, rx, ry, rng, color, filled = false) {
    ctx.save();
    if (filled) {
      ctx.fillStyle = "rgba(15,15,15,0.09)";
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(x + jitter(rng, 1.4), y + jitter(rng, 1.4), rx + jitter(rng, 1.2), ry + jitter(rng, 1.2), jitter(rng, 0.04), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  castShadow(ctx, x, y, w, h, alpha) {
    ctx.save();
    const gradient = ctx.createRadialGradient(x + w * 0.5, y + h * 0.5, 1, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.6);
    gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.5, Math.abs(w * 0.5), Math.abs(h * 0.5), -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  smudge(ctx, x, y, w, h, rng) {
    ctx.save();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h));
    gradient.addColorStop(0, "rgba(0,0,0,0.18)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x + jitter(rng, 12), y + jitter(rng, 8), w, h, jitter(rng, 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  sketchText(ctx, text, x, y, size) {
    ctx.save();
    ctx.font = `${size}px Permanent Marker, Kalam, cursive`;
    ctx.fillStyle = "#171717";
    ctx.globalAlpha = 0.68;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  vignette(ctx, w, h) {
    const gradient = ctx.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.18, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.7, "rgba(0,0,0,0.04)");
    gradient.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  panelBorder(ctx, w, h, rng) {
    this.inkLine(ctx, 3, 3, w - 3, 3, 2.4, "#111", rng, 2);
    this.inkLine(ctx, w - 3, 3, w - 3, h - 3, 2.4, "#111", rng, 2);
    this.inkLine(ctx, w - 3, h - 3, 3, h - 3, 2.4, "#111", rng, 2);
    this.inkLine(ctx, 3, h - 3, 3, 3, 2.4, "#111", rng, 2);
  }
}

function seededRandom(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(rng, amount) {
  return (rng() - 0.5) * amount;
}
