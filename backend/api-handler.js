const crypto = require("crypto");
const { createStorage } = require("./storage");

const storage = createStorage();

async function handleApiRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "POST" && url.pathname === "/api/accounts") {
    const body = await readBody(req);
    const username = cleanUsername(body.username);
    if (!username) {
      return sendJson(res, 400, { error: "Username is required." });
    }
    return sendJson(res, 200, await storage.login(username));
  }

  if (req.method === "GET" && url.pathname === "/api/avatars") {
    return sendJson(res, 200, { avatars: await storage.listAvatars() });
  }

  if (req.method === "PUT" && url.pathname === "/api/avatars") {
    const avatar = await readBody(req);
    if (!avatar.id) {
      return sendJson(res, 400, { error: "Avatar id is required." });
    }
    return sendJson(res, 200, { avatar: await storage.upsertAvatar(avatar) });
  }

  if (req.method === "GET" && url.pathname === "/api/art-status") {
    return sendJson(res, 200, await storage.getArtStatus());
  }

  if (req.method === "GET" && url.pathname === "/api/settings/art") {
    return sendJson(res, 200, await storage.getArtSettings());
  }

  if (req.method === "PUT" && url.pathname === "/api/settings/art") {
    const body = await readBody(req);
    return sendJson(res, 200, await storage.saveArtKey(cleanApiKey(body.apiKey)));
  }

  if (req.method === "DELETE" && url.pathname === "/api/settings/art") {
    return sendJson(res, 200, await storage.clearArtKey());
  }

  const progressMatch = url.pathname.match(/^\/api\/progress\/([^/]+)$/);
  if (progressMatch && req.method === "GET") {
    return sendJson(res, 200, { progress: await storage.getProgress(decodeURIComponent(progressMatch[1])) });
  }

  if (progressMatch && req.method === "PUT") {
    const body = await readBody(req);
    return sendJson(res, 200, { progress: await storage.saveProgress(decodeURIComponent(progressMatch[1]), body.state) });
  }

  if (progressMatch && req.method === "DELETE") {
    return sendJson(res, 200, await storage.deleteProgress(decodeURIComponent(progressMatch[1])));
  }

  if (req.method === "POST" && url.pathname === "/api/scene-art") {
    const body = await readBody(req);
    const key = makeArtKey(body);
    if (!body.force) {
      const cached = await storage.getSceneArt(key);
      if (cached?.imageBase64) {
        return sendJson(res, 200, {
          imageUrl: `data:image/png;base64,${cached.imageBase64}`,
          cached: true,
          enabled: true
        });
      }
    }

    const apiKey = await storage.getArtKey();
    if (!apiKey) {
      return sendJson(res, 200, { imageUrl: null, cached: false, enabled: false });
    }

    const prompt = buildSceneArtPrompt(body);
    const imageBase64 = await generateSceneImage(apiKey, prompt, body.accountId || "anonymous");
    await storage.saveSceneArt(key, imageBase64, prompt);
    return sendJson(res, 200, {
      imageUrl: `data:image/png;base64,${imageBase64}`,
      cached: false,
      enabled: true
    });
  }

  return sendJson(res, 404, { error: "Endpoint not found." });
}

function makeArtKey(body) {
  const raw = JSON.stringify({
    sceneId: body.sceneId,
    art: body.art,
    narration: body.narration,
    avatar: body.avatar,
    scenario: body.scenario
  });
  return crypto.createHash("sha1").update(raw).digest("hex");
}

function buildSceneArtPrompt(body) {
  const avatar = body.avatar || {};
  const scenario = body.scenario || {};
  const professionText = [avatar.ageBand, avatar.gender, avatar.profession].filter(Boolean).join(" ");
  return [
    "Create a lifelike single-panel illustration for a browser-based zombie survival game.",
    "Visual style: hand-drawn graphite and charcoal concept art, realistic anatomy, expressive faces, cinematic lighting, deep shadows, atmospheric depth, grounded perspective, subtle paper grain, monochrome only, no color.",
    "Do not make it cartoony, crude, or diagram-like. It should feel like polished key art from a serious narrative game.",
    `Scene type: ${body.art || "street"}.`,
    `Scene label: ${body.label || "Survival scene"}.`,
    `Narrative moment: ${body.narration || ""}`,
    `Main survivor: ${professionText || "survivor"}, named ${avatar.name || "the player"}.`,
    `Starting situation or location: ${scenario.location || "unknown location"}.`,
    "Show believable human proportions, clothing, gesture, cast shadows, environmental storytelling, and a tense post-apocalyptic mood.",
    "Frame the image in a wide cinematic composition suitable for a 16:9 story panel.",
    "No text, no captions, no UI, no comic speech bubbles."
  ].join(" ");
}

async function generateSceneImage(apiKey, prompt, user) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-image-1.5",
      prompt,
      size: "1536x1024",
      quality: "high",
      output_format: "png",
      background: "opaque",
      user
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Image generation failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const image = data?.data?.[0]?.b64_json;
  if (!image) {
    throw new Error("Image generation returned no image data.");
  }
  return image;
}

function cleanUsername(username) {
  return String(username || "").trim().replace(/\s+/g, " ").slice(0, 32);
}

function cleanApiKey(apiKey) {
  return String(apiKey || "").trim().slice(0, 200);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 3_000_000) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

module.exports = {
  handleApiRequest
};
