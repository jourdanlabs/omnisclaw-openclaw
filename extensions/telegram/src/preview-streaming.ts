// Telegram plugin module implements preview streaming behavior.
import {
  resolveChannelPreviewStreamMode,
  type StreamingMode,
} from "openclaw/plugin-sdk/channel-outbound";

export function resolveTelegramPreviewStreamMode(
  params: {
    streaming?: unknown;
  } = {},
): StreamingMode {
  // OMNIS CLAW: draft previews off by default (JL `b4422fbff6`).
  // Operators who want 2.0's progress draft set `streaming.mode: "progress"`.
  return resolveChannelPreviewStreamMode(params, "off");
}
