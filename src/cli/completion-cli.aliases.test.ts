import { afterAll, describe, expect, it } from "vitest";
import { getCompletionScript } from "./completion-cli.js";
import {
  createAliasedCompletionProgram,
  itWithFish,
  itWithPowerShell,
  PowerShellCompletionRunner,
  runGeneratedBashCompletion,
  runGeneratedFishCompletion,
} from "./completion-cli.test-support.js";

const powerShellCompletion = new PowerShellCompletionRunner();

afterAll(async () => {
  await powerShellCompletion.close();
});

// Aliases are typeable commands, so every shell must preserve their nested command paths.
describe("completion-cli command aliases", () => {
  itWithFish.each([
    ["a canonical root command", "omnisclaw --profile work inf", "infer"],
    ["an aliased root command", "omnisclaw --profile work cap", "capability"],
    ["an inline profile and alias", "omnisclaw --profile=work cap", "capability"],
    ["an alias-shaped profile value", "omnisclaw --profile capability cap", "capability"],
    [
      "a repeated profile and alias",
      "omnisclaw --profile first --profile second cap",
      "capability",
    ],
  ])("completes real Fish root aliases after %s", (_name, commandLine, expected) => {
    expect(runGeneratedFishCompletion(createAliasedCompletionProgram(), commandLine)).toContain(
      expected,
    );
  });

  it("completes root and nested aliases in zsh lists and dispatch", () => {
    const script = getCompletionScript("zsh", createAliasedCompletionProgram());

    expect(script).toContain("'capability[Run inference]'");
    expect(script).toContain("(infer|capability) _omnisclaw_infer ;;");
    expect(script).toContain("'create[Add a job]'");
    expect(script).toContain("(add|create) _omnisclaw_cron_add ;;");
  });

  it("completes root and nested aliases in bash command paths", () => {
    const script = getCompletionScript("bash", createAliasedCompletionProgram());

    expect(script).toContain('opts="infer capability cron --profile"');
    expect(script).toContain('"infer"|"capability")');
    expect(script).toContain('"cron")');
    expect(script).toContain('opts="add create"');
    expect(script).toContain('"cron add"|"cron create")');
    expect(script).toContain('opts="--at"');
  });

  it.skipIf(process.platform === "win32")("offers options after a nested alias in bash", () => {
    expect(
      runGeneratedBashCompletion(createAliasedCompletionProgram(), [
        "openclaw",
        "--profile",
        "work",
        "cron",
        "create",
        "--a",
      ]),
    ).toEqual(["--at"]);
  });

  it("completes aliases and their subtrees in fish", () => {
    const script = getCompletionScript("fish", createAliasedCompletionProgram());

    expect(script).toContain(
      'complete -c omnisclaw -n "__omnisclaw_command_path_matches -- --profile" -a "capability" -d \'Run inference\'',
    );
    expect(script).toContain(
      'complete -c omnisclaw -n "__omnisclaw_command_path_matches capability -- --profile" -a "embed" -d \'Embed text\'',
    );
    expect(script).toContain(
      'complete -c omnisclaw -n "__omnisclaw_command_path_matches cron -- --profile" -a "create" -d \'Add a job\'',
    );
    expect(script).toContain(
      "complete -c omnisclaw -n \"__omnisclaw_command_path_matches cron create -- --profile --at\" -l at -r -d 'Schedule time'",
    );
  });

  itWithFish.each([
    ["an aliased nested command", "omnisclaw cron create -"],
    ["a canonical nested command", "omnisclaw cron add -"],
    ["a global profile", "omnisclaw --profile work cron create -"],
    ["an inline global profile", "omnisclaw --profile=work cron create -"],
    ["repeated global profiles", "omnisclaw --profile first --profile second cron create -"],
    ["an inherited global profile", "omnisclaw cron --profile work create -"],
    ["a parent long option", "omnisclaw cron --timezone UTC create -"],
    ["a parent short option", "omnisclaw cron -z UTC create -"],
    ["an inline parent option", "omnisclaw cron --timezone=UTC create -"],
    ["a parent boolean option", "omnisclaw cron --verbose create -"],
  ])("keeps real Fish alias completions scoped after %s", (_name, commandLine) => {
    const program = createAliasedCompletionProgram();
    const cron = program.commands.find((command) => command.name() === "cron");
    if (!cron) {
      throw new Error("Cron command is unavailable");
    }
    cron.option("-z, --timezone <zone>", "Time zone").option("--verbose", "Verbose output");

    expect(runGeneratedFishCompletion(program, commandLine)).toEqual(["--at"]);
  });

  itWithFish.each([
    ["an aliased positional argument", "omnisclaw cron create meeting -"],
    ["a canonical positional argument", "omnisclaw cron add meeting -"],
    ["a profiled positional argument", "omnisclaw --profile work cron create meeting -"],
    ["a parent option and positional argument", "omnisclaw cron -z UTC create meeting -"],
  ])("keeps real Fish alias options after %s", (_name, commandLine) => {
    const program = createAliasedCompletionProgram();
    const cron = program.commands.find((command) => command.name() === "cron");
    const add = cron?.commands.find((command) => command.name() === "add");
    if (!cron || !add) {
      throw new Error("Cron add command is unavailable");
    }
    cron.option("-z, --timezone <zone>", "Time zone");
    add.argument("[label...]", "Job label");

    expect(runGeneratedFishCompletion(program, commandLine)).toEqual(["--at"]);
  });

  it("completes aliases and alias command paths in PowerShell", () => {
    const script = getCompletionScript("powershell", createAliasedCompletionProgram());

    expect(script).toContain("$completions = @('infer','capability','cron','--profile')");
    expect(script).toContain("if ($commandPath -eq 'capability') {");
    expect(script).toContain("if ($commandPath -eq 'cron create') {");
  });

  it("tracks PowerShell command paths past inherited value-taking flags", () => {
    const script = getCompletionScript("powershell", createAliasedCompletionProgram());

    expect(script).toContain("$valueOptions = @('--profile')");
    expect(script).toContain("switch ($candidatePath)");
    expect(script).toContain("'cron create'");
    expect(script).toContain("'--profile','--at'");
  });

  itWithPowerShell.each([
    ["a global option", "omnisclaw --profile work cron create --a"],
    ["an inline global option", "omnisclaw --profile=work cron create --a"],
    ["repeated global options", "omnisclaw --profile first --profile second cron create --a"],
    ["an inherited option after the parent", "omnisclaw cron --profile work create --a"],
    ["the canonical nested command", "omnisclaw --profile work cron add --a"],
  ])("completes real PowerShell nested aliases after %s", async (_name, commandLine) => {
    expect(
      await powerShellCompletion.complete(createAliasedCompletionProgram(), commandLine),
    ).toEqual(["--at"]);
  });
});
