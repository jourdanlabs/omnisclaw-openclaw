// OC Path plugin entrypoint registers its OpenClaw integration.
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { registerOcPathCli } from "./cli-registration.js";

export default definePluginEntry({
  id: "oc-path",
  name: "OC Path",
  description: "Adds the omnisclaw path CLI for oc:// workspace file addressing.",
  register(api) {
    registerOcPathCli(api);
  },
});
