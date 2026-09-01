/**
 * Help examples shown by the Browser CLI root command.
 */
/** Core Browser CLI examples for lifecycle and inspection commands. */
export const browserCoreExamples = [
  "omnisclaw browser status",
  "omnisclaw browser start",
  "omnisclaw browser start --headless",
  "omnisclaw browser stop",
  "omnisclaw browser tabs",
  "omnisclaw browser open https://example.com",
  "omnisclaw browser focus abcd1234",
  "omnisclaw browser close abcd1234",
  "omnisclaw browser screenshot",
  "omnisclaw browser screenshot --full-page",
  "omnisclaw browser screenshot --ref 12",
  "omnisclaw browser snapshot",
  "omnisclaw browser snapshot --format aria --limit 200",
  "omnisclaw browser snapshot --efficient",
  "omnisclaw browser snapshot --labels",
];

/** Browser CLI examples for interaction/action commands. */
export const browserActionExamples = [
  "omnisclaw browser navigate https://example.com",
  "omnisclaw browser resize 1280 720",
  "omnisclaw browser click 12 --double",
  "omnisclaw browser click-coords 120 340",
  'omnisclaw browser type 23 "hello" --submit',
  "omnisclaw browser press Enter",
  "omnisclaw browser hover 44",
  "omnisclaw browser drag 10 11",
  "omnisclaw browser select 9 OptionA OptionB",
  "omnisclaw browser upload /tmp/openclaw/uploads/file.pdf",
  "omnisclaw browser upload media://inbound/file.pdf",
  'omnisclaw browser fill --fields \'[{"ref":"1","value":"Ada"}]\'',
  "omnisclaw browser dialog --accept",
  'omnisclaw browser wait --text "Done"',
  "omnisclaw browser evaluate --fn '(el) => el.textContent' --ref 7",
  "omnisclaw browser evaluate --fn 'const title = document.title; return title;'",
  "omnisclaw browser console --level error",
  "omnisclaw browser pdf",
  "omnisclaw browser batch --actions-file plan.json",
  'omnisclaw browser batch --actions \'[{"kind":"wait","timeMs":500},{"kind":"click","ref":"12"},{"kind":"type","ref":"23","text":"hello"}]\'',
  "omnisclaw browser batch --actions-file plan.json --continue",
];
