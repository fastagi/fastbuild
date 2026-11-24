package commands

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func writeTree(t *testing.T, root string, files map[string]string) {
	t.Helper()
	for path, content := range files {
		target := filepath.Join(root, filepath.FromSlash(path))
		require.NoError(t, os.MkdirAll(filepath.Dir(target), 0o755))
		require.NoError(t, os.WriteFile(target, []byte(content), 0o644))
	}
}

func TestProjectUpgradeAdaptsReleasesToTheProjectIdentity(t *testing.T) {
	base, target := t.TempDir(), t.TempDir()
	scaffoldImport := "import \"" + scaffoldModulePath + "/internal/infra/config\"\n"
	writeTree(t, base, map[string]string{
		"apps/api/go.mod":                 "module " + scaffoldModulePath + "\n",
		"apps/api/cmd/x/main.go":          "package main\n\n" + scaffoldImport,
		"packages/contracts/openapi.yaml": "openapi: 3.1.0\npaths: {}\n",
		"apps/api/.env.example":           "APP_NAME=FastBuild\nOPTIONAL_STARTERS=\n",
		"registry/index.json":             "{}\n",
	})
	writeTree(t, target, map[string]string{
		"apps/api/go.mod":                 "module " + scaffoldModulePath + "\n\ngo 1.27\n",
		"apps/api/cmd/x/main.go":          "package main\n\n" + scaffoldImport + "\n// Upgraded.\n",
		"packages/contracts/openapi.yaml": "openapi: 3.1.0\npaths: {}\n",
		"apps/api/.env.example":           "APP_NAME=FastBuild\nOPTIONAL_STARTERS=\nNEW_SETTING=1\n",
		"registry/index.json":             "{\"plugins\":[]}\n",
	})

	root := t.TempDir()
	module := "github.com/acme/platform/api"
	marker := ProjectMarker{Name: "Acme", Slug: "acme", Module: module, Repository: "https://github.com/acme/platform",
		Starters: []string{"organization"}, ScaffoldVersion: "v0.25.0"}
	encoded, err := json.Marshal(marker)
	require.NoError(t, err)
	writeTree(t, root, map[string]string{
		"apps/api/go.mod":                 "module " + module + "\n",
		"apps/api/cmd/x/main.go":          "package main\n\nimport \"" + module + "/internal/infra/config\"\n",
		"packages/contracts/openapi.yaml": "openapi: 3.1.0\npaths: {}\n",
		"apps/api/.env.example":           "APP_NAME=Acme\nOPTIONAL_STARTERS=organization\n",
		projectMarkerFile:                 string(encoded),
	})
	t.Chdir(filepath.Join(root, "apps", "api"))

	args := []string{"--to=v0.26.0", "--base-dir=" + base, "--target-dir=" + target}
	out := captureStdout(t, func() error { return NewProjectUpgradeCommand().Run(append(args, "--dry-run", "--format=json")) })
	var report struct {
		Result struct {
			Replaced []string `json:"replaced"`
		} `json:"result"`
	}
	require.NoError(t, json.Unmarshal([]byte(out), &report))
	assert.ElementsMatch(t, []string{"apps/api/go.mod", "apps/api/cmd/x/main.go", "apps/api/.env.example"}, report.Result.Replaced,
		"identity-adapted files the project never changed are replaced, not conflicted")

	captureStdout(t, func() error { return NewProjectUpgradeCommand().Run(args) })
	main, _ := os.ReadFile(filepath.Join(root, "apps/api/cmd/x/main.go"))
	assert.Contains(t, string(main), module+"/internal/infra/config")
	assert.Contains(t, string(main), "// Upgraded.")
	env, _ := os.ReadFile(filepath.Join(root, "apps/api/.env.example"))
	assert.Equal(t, "APP_NAME=Acme\nOPTIONAL_STARTERS=organization\nNEW_SETTING=1\n", string(env))
	assert.NoDirExists(t, filepath.Join(root, "registry"), "the scaffold registry is not copied")
	upgraded, err := readProjectMarker(root)
	require.NoError(t, err)
	assert.Equal(t, "v0.26.0", upgraded.ScaffoldVersion)

	assert.ErrorContains(t, NewProjectUpgradeCommand().Run(args), "already on FastBuild 0.26.0")
}
