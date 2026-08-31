// Handles fast version output before the full CLI graph loads.
import { isRootVersionInvocation } from "./cli/argv.js";
import { resolveCliContainerTarget } from "./cli/container-target.js";

export function tryHandleRootVersionFastPath(
  argv: string[],
  deps: {
    env?: NodeJS.ProcessEnv;
    moduleUrl?: string;
    output?: (message: string) => void;
    exit?: (code?: number) => void;
    onError?: (error: unknown) => void | Promise<void>;
    resolveVersion?: () => Promise<{
      VERSION: string;
      PRODUCT_DISPLAY_NAME?: string;
      resolveCommitHash: (params: { moduleUrl: string }) => string | null;
    }>;
  } = {},
): boolean {
  if (resolveCliContainerTarget(argv, deps.env)) {
    return false;
  }
  if (!isRootVersionInvocation(argv)) {
    return false;
  }
  const output = deps.output ?? ((message: string) => console.log(message));
  const exit = deps.exit ?? ((code?: number) => process.exit(code));
  const onError =
    deps.onError ??
    (async (error: unknown) => {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      const message = `[omnisclaw] Failed to resolve version: ${detail}\n`;
      try {
        const [{ loadCliDotEnv }, { formatConsoleDiagnosticBlock }] = await Promise.all([
          import("./cli/dotenv.js"),
          import("./logging/json-console-line.js"),
        ]);
        loadCliDotEnv({ quiet: true });
        process.stderr.write(formatConsoleDiagnosticBlock({ level: "error", message }));
      } catch {
        process.stderr.write(message);
      } finally {
        exit(1);
      }
    });
  const resolveVersion =
    deps.resolveVersion ??
    (async () => {
      const [{ VERSION, PRODUCT_DISPLAY_NAME }, { resolveCommitHash }] = await Promise.all([
        import("./version.js"),
        import("./infra/git-commit.js"),
      ]);
      return { VERSION, PRODUCT_DISPLAY_NAME, resolveCommitHash };
    });

  resolveVersion()
    .then(({ VERSION, PRODUCT_DISPLAY_NAME = "OMNIS CLAW", resolveCommitHash }) => {
      const commit = resolveCommitHash({ moduleUrl: deps.moduleUrl ?? import.meta.url });
      const name = PRODUCT_DISPLAY_NAME || "OMNIS CLAW";
      output(commit ? `${name} ${VERSION} (${commit})` : `${name} ${VERSION}`);
      exit(0);
    })
    .catch(onError);
  return true;
}
