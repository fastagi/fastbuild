package commands

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/fastagi/fastbuild/api/internal/infra/console"
	"github.com/fastagi/fastbuild/api/internal/infra/pluginregistry"
)

// webFeatureTemplates holds a complete, verified Web feature for a resource named "widget". It is
// real source, not a text template: make:feature renames widget, Widget, and WIDGET to the
// requested resource, so the reference can be installed as is and checked by the Web gates.
//
//go:embed all:templates/web-feature
var webFeatureTemplates embed.FS

const (
	webFeatureTemplateRoot = "templates/web-feature"
	webFeatureReference    = "widget"
)

// MakeFeatureCommand generates the Web client of an organization-scoped starter.
type MakeFeatureCommand struct {
	output *console.Output
}

func NewMakeFeatureCommand() *MakeFeatureCommand {
	return &MakeFeatureCommand{output: console.NewOutput()}
}

func (c *MakeFeatureCommand) Name() string { return "make:feature" }
func (c *MakeFeatureCommand) Description() string {
	return "Create the Web feature for a starter generated with make:module --scope=organization"
}
func (c *MakeFeatureCommand) Usage() string { return "make:feature <name> --web" }

var webFeatureNamePattern = regexp.MustCompile(`^[a-z][a-z0-9]*$`)

// reservedWebFeatureNames are JavaScript keywords and names the Web shell already owns.
var reservedWebFeatureNames = []string{
	"api", "auth", "class", "common", "console", "const", "default", "delete", "enum", "errors",
	"export", "function", "global", "import", "metadata", "nav", "new", "null", "package", "public",
	"return", "settings", "site", "static", "switch", "test", "this", "type", "var",
}

func parseMakeFeatureArgs(args []string) (string, error) {
	name, web := "", false
	for _, argument := range args {
		switch {
		case argument == "--web":
			web = true
		case strings.HasPrefix(argument, "-"):
			return "", fmt.Errorf("unknown option %q", argument)
		case name == "":
			name = argument
		default:
			return "", fmt.Errorf("unexpected argument %q", argument)
		}
	}
	if name == "" {
		return "", fmt.Errorf("feature name is required")
	}
	if !web {
		return "", fmt.Errorf("choose a client: make:feature %s --web", name)
	}
	if !webFeatureNamePattern.MatchString(name) {
		return "", fmt.Errorf("feature name %q must be one lowercase word such as project or invoice", name)
	}
	if slices.Contains(reservedWebFeatureNames, name) {
		return "", fmt.Errorf("feature name %q is reserved", name)
	}
	return name, nil
}

// webFeatureRenamer rewrites the reference resource name in every casing the templates use.
func webFeatureRenamer(name string) *strings.Replacer {
	pascal := strings.ToUpper(name[:1]) + name[1:]
	return strings.NewReplacer(
		strings.ToUpper(webFeatureReference), strings.ToUpper(name),
		strings.ToUpper(webFeatureReference[:1])+webFeatureReference[1:], pascal,
		webFeatureReference, name,
	)
}

// renderedWebFeature is one generated file, relative to the project root.
type renderedWebFeature struct {
	path    string
	content []byte
}

// renderWebFeature returns the feature's files and slot inserts for name, without touching disk.
func renderWebFeature(name string) ([]renderedWebFeature, []pluginregistry.Insert, error) {
	rename := webFeatureRenamer(name)
	filesRoot := path.Join(webFeatureTemplateRoot, "files")
	var files []renderedWebFeature
	err := fs.WalkDir(webFeatureTemplates, filesRoot, func(file string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil || entry.IsDir() {
			return walkErr
		}
		raw, readErr := webFeatureTemplates.ReadFile(file)
		if readErr != nil {
			return readErr
		}
		relative := strings.TrimPrefix(file, filesRoot+"/")
		files = append(files, renderedWebFeature{
			path:    rename.Replace(relative),
			content: []byte(rename.Replace(string(raw))),
		})
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	rawWiring, err := webFeatureTemplates.ReadFile(path.Join(webFeatureTemplateRoot, "wiring.json"))
	if err != nil {
		return nil, nil, err
	}
	var inserts []pluginregistry.Insert
	if err := json.Unmarshal([]byte(rename.Replace(string(rawWiring))), &inserts); err != nil {
		return nil, nil, fmt.Errorf("web feature wiring: %w", err)
	}
	return files, inserts, nil
}

func (c *MakeFeatureCommand) Run(args []string) error {
	name, err := parseMakeFeatureArgs(args)
	if err != nil {
		return err
	}
	webRoot := filepath.Join(apiToProjectRoot, "apps", "web")
	if stat, statErr := os.Stat(webRoot); statErr != nil || !stat.IsDir() {
		return fmt.Errorf("this project has no apps/web to add a feature to")
	}
	if _, statErr := os.Stat(filepath.Join("internal", "modules", name, "routes.go")); statErr != nil {
		return fmt.Errorf(
			"starter %q does not exist; run 'fastbuild make:module %s --scope=organization' and 'make sync' first",
			name, name,
		)
	}

	files, inserts, err := renderWebFeature(name)
	if err != nil {
		return err
	}
	// Refuse before writing anything, so a name collision never leaves half a feature.
	for _, file := range files {
		target := filepath.Join(apiToProjectRoot, filepath.FromSlash(file.path))
		if _, statErr := os.Stat(target); statErr == nil {
			return fmt.Errorf("%s already exists", file.path)
		} else if !errors.Is(statErr, os.ErrNotExist) {
			return statErr
		}
	}
	for _, file := range files {
		target := filepath.Join(apiToProjectRoot, filepath.FromSlash(file.path))
		if mkdirErr := os.MkdirAll(filepath.Dir(target), 0o755); mkdirErr != nil {
			return mkdirErr
		}
		if writeErr := os.WriteFile(target, file.content, 0o644); writeErr != nil {
			return writeErr
		}
		c.output.Success("Created: %s", file.path)
	}

	applied, err := pluginregistry.ApplyInserts(apiToProjectRoot, inserts)
	if err != nil {
		return fmt.Errorf("the files were written, but the feature could not be wired at its slots: %w", err)
	}
	var wired []string
	for _, insert := range applied {
		if !slices.Contains(wired, insert.File) {
			wired = append(wired, insert.File)
		}
	}
	for _, file := range wired {
		c.output.Success("Updated: %s", file)
	}

	c.output.Info("Web feature '%s' created. It lists, creates, renames, and deletes %ss of the active organization.", name, name)
	c.output.Info("Next steps:")
	c.output.Info("  1. If the contract changed since the last sync, from the repository root: make sync")
	c.output.Info("  2. Select it: NEXT_PUBLIC_OPTIONAL_FEATURES=organization,%s", name)
	c.output.Info("  3. From the repository root: make verify-changed")
	c.output.Info("The feature mirrors the generated contract (a name field). When you add fields, change the")
	c.output.Info("contract fragment first, then schemas.ts, the mock store, and the workspace component.")
	return nil
}
