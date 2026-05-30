// Entry point: tab switching + wire up each feature based on server config.
import { $, $$, api, toast } from "./util.js";
import { initLive } from "./live.js";
import { initSpokesperson } from "./spokesperson.js";
import { initStudio } from "./studio.js";

function setupTabs() {
  const tabs = $$(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.disabled) return;
      tabs.forEach((t) => t.classList.remove("active"));
      $$(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(`#panel-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

async function main() {
  setupTabs();

  let config = { features: {}, defaults: {} };
  try {
    config = await api("/api/config");
  } catch (err) {
    toast(`Could not load server config: ${err.message}`);
  }

  const { features, defaults } = config;

  // Disable tabs whose backend keys aren't configured.
  const tabFeature = { live: "liveAvatar", spokesperson: "videoGeneration", studio: "avatarStudio" };
  $$(".tab").forEach((tab) => {
    if (!features[tabFeature[tab.dataset.tab]]) {
      tab.disabled = true;
      tab.title = "Not configured — add the required API key on the server.";
    }
  });

  initLive(features.liveAvatar);
  initSpokesperson(features.videoGeneration, defaults);
  initStudio(features.avatarStudio);
}

main();
