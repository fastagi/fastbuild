package commands

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

const (
	contextReportKind          = "fastbuild.context"
	contextReportSchemaVersion = 1
	contextMaxAgentFiles       = 10
	contextMaxAgentVerify      = 10
	contextMaxAgentLines       = 40
)

type contextFormat string

const (
	contextFormatAgent contextFormat = "agent"
	contextFormatJSON  contextFormat = "json"
)

type contextOptions struct {
	changed bool
	format  contextFormat
	base    string
}

type contextReport struct {
	Kind            string   `json:"kind"`
	SchemaVersion   int      `json:"schema_version"`
	Branch          string   `json:"branch"`
	Base            string   `json:"base,omitempty"`
	ChangedFiles    []string `json:"changed_files"`
	ImpactedUnits   []string `json:"impacted_units"`
	ReadFirst       []string `json:"read_first"`
	ActiveContracts []string `json:"active_contracts"`
	VerifyCommands  []string `json:"verify_commands"`
}

type contextGitRunner interface {
	Run(dir string, args ...string) (string, error)
}

type execContextGitRunner struct{}

func (execContextGitRunner) Run(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	var stderr strings.Builder
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg != "" {
			return "", fmt.Errorf("git %s: %w (%s)", strings.Join(args, " "), err, msg)
		}
		return "", fmt.Errorf("git %s: %w", strings.Join(args, " "), err)
	}
	return string(out), nil
}

// ContextCommand summarizes changed files, impacted units, active contracts, and verification commands.
type ContextCommand struct {
	writer   io.Writer
	findRoot func() (string, error)
	git      contextGitRunner
}

func NewContextCommand() *ContextCommand {
	return &ContextCommand{
		writer:   os.Stdout,
		findRoot: findProjectRoot,
		git:      execContextGitRunner{},
	}
}

func (c *ContextCommand) Name() string { return "context" }
func (c *ContextCommand) Description() string {
	return "Summarize changed files, impacted units, contracts, and verification commands"
}
func (c *ContextCommand) Usage() string {
	return "context [--changed] [--format=agent|json] [--base=<ref>]"
}

func (c *ContextCommand) SuppressCompletionOutput() bool {
	return true
}

func (c *ContextCommand) Run(args []string) error {
	options, err := parseContextOptions(args)
	if err != nil {
		return err
	}

	rootFinder := c.findRoot
	if rootFinder == nil {
		rootFinder = findProjectRoot
	}
	root, err := rootFinder()
	if err != nil {
		return err
	}

	gitRunner := c.git
	if gitRunner == nil {
		gitRunner = execContextGitRunner{}
	}

	branch, changedFiles, err := collectGitContext(gitRunner, root, options.base)
	if err != nil {
		return err
	}

	report := buildContextReport(branch, options.base, changedFiles)

	writer := c.writer
	if writer == nil {
		writer = os.Stdout
	}
	if options.format == contextFormatJSON {
		return writeContextReportJSON(writer, report)
	}
	_, err = io.WriteString(writer, formatContextAgent(report))
	return err
}

func parseContextOptions(args []string) (contextOptions, error) {
	options := contextOptions{
		changed: true,
		format:  contextFormatAgent,
	}
	formatSet := false
	baseSet := false

	setFormat := func(raw string) error {
		if formatSet {
			return fmt.Errorf("--format may be provided only once")
		}
		formatSet = true
		switch contextFormat(raw) {
		case contextFormatAgent, contextFormatJSON:
			options.format = contextFormat(raw)
			return nil
		default:
			return fmt.Errorf("--format must be agent or json")
		}
	}

	setBase := func(raw string) error {
		if baseSet {
			return fmt.Errorf("--base may be provided only once")
		}
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			return fmt.Errorf("--base requires a non-empty ref")
		}
		baseSet = true
		options.base = trimmed
		return nil
	}

	for index := 0; index < len(args); index++ {
		argument := args[index]
		switch {
		case argument == "--changed":
			options.changed = true
		case argument == "--format":
			index++
			if index >= len(args) {
				return contextOptions{}, fmt.Errorf("--format requires a value")
			}
			if err := setFormat(args[index]); err != nil {
				return contextOptions{}, err
			}
		case strings.HasPrefix(argument, "--format="):
			if err := setFormat(strings.TrimPrefix(argument, "--format=")); err != nil {
				return contextOptions{}, err
			}
		case argument == "--base":
			index++
			if index >= len(args) {
				return contextOptions{}, fmt.Errorf("--base requires a value")
			}
			if err := setBase(args[index]); err != nil {
				return contextOptions{}, err
			}
		case strings.HasPrefix(argument, "--base="):
			if err := setBase(strings.TrimPrefix(argument, "--base=")); err != nil {
				return contextOptions{}, err
			}
		case argument == "--env" || argument == "--env-file":
			index++
			if index >= len(args) {
				return contextOptions{}, fmt.Errorf("%s requires a value", argument)
			}
		case strings.HasPrefix(argument, "--env=") || strings.HasPrefix(argument, "--env-file="):
			// Global options are resolved by cmd/fastbuild before command dispatch.
		default:
			return contextOptions{}, fmt.Errorf("unknown context option %q", argument)
		}
	}

	return options, nil
}

func collectGitContext(runner contextGitRunner, root, base string) (string, []string, error) {
	branchOut, err := runner.Run(root, "rev-parse", "--abbrev-ref", "HEAD")
	branch := strings.TrimSpace(branchOut)
	if err != nil || branch == "" {
		branch = "HEAD"
	}

	statusOut, err := runner.Run(root, "status", "--porcelain=v1", "-uall")
	if err != nil {
		return "", nil, err
	}

	seen := make(map[string]struct{})
	files := make([]string, 0)
	addFile := func(raw string) {
		normalized := normalizeGitPath(raw)
		if normalized == "" {
			return
		}
		if _, exists := seen[normalized]; exists {
			return
		}
		seen[normalized] = struct{}{}
		files = append(files, normalized)
	}

	for _, path := range parsePorcelainStatus(statusOut) {
		addFile(path)
	}

	if base != "" {
		diffOut, diffErr := runner.Run(root, "diff", "--name-only", base+"...HEAD")
		if diffErr != nil {
			return "", nil, diffErr
		}
		for _, line := range strings.Split(strings.ReplaceAll(diffOut, "\r\n", "\n"), "\n") {
			if trimmed := strings.TrimSpace(line); trimmed != "" {
				addFile(trimmed)
			}
		}
	}

	sort.Strings(files)
	return branch, files, nil
}

func parsePorcelainStatus(output string) []string {
	lines := strings.Split(strings.ReplaceAll(output, "\r\n", "\n"), "\n")
	paths := make([]string, 0, len(lines))
	for _, line := range lines {
		if len(line) < 4 {
			continue
		}
		pathPart := strings.TrimSpace(line[3:])
		if pathPart == "" {
			continue
		}
		// Rename/copy lines use "old -> new"; track destination path.
		if idx := strings.LastIndex(pathPart, " -> "); idx >= 0 {
			pathPart = pathPart[idx+4:]
		}
		paths = append(paths, pathPart)
	}
	return paths
}

func normalizeGitPath(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) >= 2 && trimmed[0] == '"' && trimmed[len(trimmed)-1] == '"' {
		if unquoted, err := strconv.Unquote(trimmed); err == nil {
			trimmed = unquoted
		}
	}
	return filepath.ToSlash(filepath.Clean(filepath.FromSlash(trimmed)))
}

var canonicalUnitOrder = []string{
	"api",
	"apps/web",
	"apps/admin",
	"packages/contracts",
	"tools",
	".agents",
	"root",
}

var contractDocByToken = map[string]string{
	"user":          "packages/contracts/AUTHENTICATION.md",
	"users":         "packages/contracts/AUTHENTICATION.md",
	"auth":          "packages/contracts/AUTHENTICATION.md",
	"apikey":        "packages/contracts/API_KEYS.md",
	"apikeys":       "packages/contracts/API_KEYS.md",
	"api-keys":      "packages/contracts/API_KEYS.md",
	"api_keys":      "packages/contracts/API_KEYS.md",
	"asset":         "packages/contracts/ASSETS.md",
	"assets":        "packages/contracts/ASSETS.md",
	"audit":         "packages/contracts/AUDIT.md",
	"notification":  "packages/contracts/NOTIFICATIONS.md",
	"notifications": "packages/contracts/NOTIFICATIONS.md",
	"operator":      "packages/contracts/OPERATORS.md",
	"operators":     "packages/contracts/OPERATORS.md",
	"organization":  "packages/contracts/ORGANIZATIONS.md",
	"organizations": "packages/contracts/ORGANIZATIONS.md",
	"permission":    "packages/contracts/PERMISSIONS.md",
	"permissions":   "packages/contracts/PERMISSIONS.md",
	"setting":       "packages/contracts/SETTINGS.md",
	"settings":      "packages/contracts/SETTINGS.md",
	"usage":         "packages/contracts/USAGE.md",
	"webhook":       "packages/contracts/WEBHOOKS.md",
	"webhooks":      "packages/contracts/WEBHOOKS.md",
}

func buildContextReport(branch, base string, changedFiles []string) contextReport {
	files := make([]string, len(changedFiles))
	copy(files, changedFiles)

	unitSet := make(map[string]struct{})
	apiModules := make(map[string]struct{})
	apiBroadChange := false
	apiRouteChange := false
	contractSet := make(map[string]struct{})

	for _, file := range files {
		switch {
		case strings.HasPrefix(file, "api/"):
			unitSet["api"] = struct{}{}
			if strings.HasPrefix(file, "api/internal/modules/") {
				rest := strings.TrimPrefix(file, "api/internal/modules/")
				if mod, _, ok := strings.Cut(rest, "/"); ok && mod != "" {
					apiModules[mod] = struct{}{}
					if doc, matched := contractDocByToken[strings.ToLower(mod)]; matched {
						contractSet[doc] = struct{}{}
					}
				} else {
					apiBroadChange = true
				}
			} else if strings.HasPrefix(file, "api/internal/infra/") ||
				strings.HasPrefix(file, "api/cmd/") ||
				strings.HasPrefix(file, "api/internal/wiring/") ||
				strings.HasPrefix(file, "api/internal/bootstrap/") ||
				file == "api/go.mod" || file == "api/go.sum" {
				apiBroadChange = true
			} else {
				apiBroadChange = true
			}
			if strings.HasSuffix(file, "/routes.go") || file == "api/routes.go" || strings.HasPrefix(file, "api/internal/bootstrap/") {
				apiRouteChange = true
			}

		case strings.HasPrefix(file, "apps/web/"):
			unitSet["apps/web"] = struct{}{}
			addContractsFromPathTokens(file, contractSet)

		case strings.HasPrefix(file, "apps/admin/"):
			unitSet["apps/admin"] = struct{}{}
			addContractsFromPathTokens(file, contractSet)

		case strings.HasPrefix(file, "packages/contracts/"):
			unitSet["packages/contracts"] = struct{}{}
			if file == "packages/contracts/openapi.yaml" {
				contractSet["packages/contracts/OPENAPI.md"] = struct{}{}
			} else if strings.HasSuffix(file, ".md") && file != "packages/contracts/README.md" && !strings.Contains(strings.TrimPrefix(file, "packages/contracts/"), "/") {
				contractSet[file] = struct{}{}
			}

		case strings.HasPrefix(file, "tools/"):
			unitSet["tools"] = struct{}{}

		case strings.HasPrefix(file, ".agents/") ||
			file == "AGENTS.md" ||
			file == "CONTEXT.md" ||
			strings.HasPrefix(file, "docs/"):
			unitSet[".agents"] = struct{}{}

		case file == "Makefile" ||
			strings.HasPrefix(file, ".github/") ||
			strings.HasPrefix(file, "compose.") ||
			strings.HasPrefix(file, "docker-compose"):
			unitSet["root"] = struct{}{}
		}
	}

	impactedUnits := make([]string, 0, len(unitSet))
	for _, unit := range canonicalUnitOrder {
		if _, ok := unitSet[unit]; ok {
			impactedUnits = append(impactedUnits, unit)
		}
	}

	readFirst := make([]string, 0, len(impactedUnits))
	readSeen := make(map[string]struct{})
	addReadFirst := func(doc string) {
		if _, exists := readSeen[doc]; exists {
			return
		}
		readSeen[doc] = struct{}{}
		readFirst = append(readFirst, doc)
	}
	for _, unit := range impactedUnits {
		switch unit {
		case "api":
			addReadFirst("api/AGENTS.md")
		case "apps/web":
			addReadFirst("apps/web/AGENTS.md")
		case "apps/admin":
			addReadFirst("apps/admin/AGENTS.md")
		case "packages/contracts":
			addReadFirst("packages/contracts/README.md")
		case ".agents", "root":
			addReadFirst("AGENTS.md")
		}
	}

	activeContracts := make([]string, 0, len(contractSet))
	for doc := range contractSet {
		activeContracts = append(activeContracts, doc)
	}
	sort.Strings(activeContracts)

	verifyCommands := buildVerifyCommands(impactedUnits, apiModules, apiBroadChange, apiRouteChange)

	return contextReport{
		Kind:            contextReportKind,
		SchemaVersion:   contextReportSchemaVersion,
		Branch:          branch,
		Base:            base,
		ChangedFiles:    files,
		ImpactedUnits:   impactedUnits,
		ReadFirst:       readFirst,
		ActiveContracts: activeContracts,
		VerifyCommands:  verifyCommands,
	}
}

func addContractsFromPathTokens(path string, contracts map[string]struct{}) {
	for _, segment := range strings.Split(path, "/") {
		token := strings.ToLower(strings.TrimSuffix(segment, filepath.Ext(segment)))
		if doc, ok := contractDocByToken[token]; ok {
			contracts[doc] = struct{}{}
		}
	}
}

func buildVerifyCommands(impactedUnits []string, apiModules map[string]struct{}, apiBroadChange, apiRouteChange bool) []string {
	commands := make([]string, 0)
	seen := make(map[string]struct{})
	addCmd := func(cmd string) {
		if _, exists := seen[cmd]; exists {
			return
		}
		seen[cmd] = struct{}{}
		commands = append(commands, cmd)
	}

	hasRoot := false
	for _, unit := range impactedUnits {
		switch unit {
		case "api":
			if apiBroadChange || len(apiModules) == 0 {
				addCmd("cd api && go test ./...")
			} else {
				sortedMods := make([]string, 0, len(apiModules))
				for mod := range apiModules {
					sortedMods = append(sortedMods, mod)
				}
				sort.Strings(sortedMods)
				for _, mod := range sortedMods {
					addCmd(fmt.Sprintf("cd api && go test ./internal/modules/%s/...", mod))
				}
			}
			if apiRouteChange {
				addCmd("cd api && make route-catalog-check")
			}
		case "apps/web":
			addCmd("cd apps/web && corepack pnpm type-check && corepack pnpm lint")
		case "apps/admin":
			addCmd("cd apps/admin && corepack pnpm type-check && corepack pnpm lint")
		case "packages/contracts":
			addCmd("make contract-check")
		case ".agents", "tools":
			addCmd("make agent-check-changed")
		case "root":
			hasRoot = true
		}
	}

	if hasRoot || len(impactedUnits) >= 3 {
		addCmd("make check # before release")
	}

	return commands
}

func writeContextReportJSON(writer io.Writer, report contextReport) error {
	if writer == nil {
		return fmt.Errorf("context report writer is required")
	}
	encoder := json.NewEncoder(writer)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(report); err != nil {
		return fmt.Errorf("encode context report: %w", err)
	}
	return nil
}

func formatContextAgent(report contextReport) string {
	lines := make([]string, 0, contextMaxAgentLines)

	header := fmt.Sprintf("FastBuild Context (branch: %s)", report.Branch)
	if report.Base != "" {
		header = fmt.Sprintf("FastBuild Context (branch: %s, base: %s)", report.Branch, report.Base)
	}
	lines = append(lines, header)
	lines = append(lines, "Units: "+joinOrNone(report.ImpactedUnits))
	lines = append(lines, "Read first: "+joinOrNone(report.ReadFirst))
	lines = append(lines, "Contracts: "+joinOrNone(report.ActiveContracts))

	if len(report.ChangedFiles) == 0 {
		lines = append(lines, "Files (0): none")
	} else {
		lines = append(lines, fmt.Sprintf("Files (%d):", len(report.ChangedFiles)))
		limit := len(report.ChangedFiles)
		if limit > contextMaxAgentFiles {
			limit = contextMaxAgentFiles
		}
		for i := 0; i < limit; i++ {
			lines = append(lines, "  - "+report.ChangedFiles[i])
		}
		if len(report.ChangedFiles) > contextMaxAgentFiles {
			lines = append(lines, fmt.Sprintf("  (+%d more)", len(report.ChangedFiles)-contextMaxAgentFiles))
		}
	}

	if len(report.VerifyCommands) == 0 {
		lines = append(lines, "Verify: none")
	} else {
		lines = append(lines, "Verify:")
		limit := len(report.VerifyCommands)
		if limit > contextMaxAgentVerify {
			limit = contextMaxAgentVerify
		}
		for i := 0; i < limit; i++ {
			lines = append(lines, "  - "+report.VerifyCommands[i])
		}
		if len(report.VerifyCommands) > contextMaxAgentVerify {
			lines = append(lines, fmt.Sprintf("  (+%d more)", len(report.VerifyCommands)-contextMaxAgentVerify))
		}
	}

	if len(lines) > contextMaxAgentLines {
		lines = append(lines[:contextMaxAgentLines-1], "  (truncated)")
	}

	return strings.Join(lines, "\n") + "\n"
}

func joinOrNone(items []string) string {
	if len(items) == 0 {
		return "none"
	}
	return strings.Join(items, ", ")
}
