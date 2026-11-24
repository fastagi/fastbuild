package commands

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseAgentSyncOptions(t *testing.T) {
	tests := []struct {
		name      string
		args      []string
		want      agentSyncOptions
		wantError string
	}{
		{
			name: "defaults",
			args: nil,
			want: agentSyncOptions{},
		},
		{
			name: "check and force",
			args: []string{"--check", "--force"},
			want: agentSyncOptions{check: true, force: true},
		},
		{
			name: "global env flags ignored",
			args: []string{"--env=test", "--env-file", ".env.test", "--check"},
			want: agentSyncOptions{check: true},
		},
		{
			name:      "unknown flag rejected",
			args:      []string{"--bogus"},
			wantError: `unknown agent:sync option "--bogus"`,
		},
		{
			name:      "missing env value",
			args:      []string{"--env"},
			wantError: "--env requires a value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseAgentSyncOptions(tt.args)
			if tt.wantError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func setupAgentSyncFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()

	configYAML := `schema_version: 1
instructions: AGENTS.md
skill_roots:
  - .agents/skills/core
  - .agents/skills/scaffold
  - api/.agents/skills
  - apps/admin/.agents/skills
targets:
  claude:
    enabled: true
    output: .claude/CLAUDE.md
  cursor:
    enabled: true
    output: .cursor/rules/fastbuild.mdc
  codex:
    enabled: true
    output: .codex/instructions.md
`
	require.NoError(t, os.MkdirAll(filepath.Join(root, ".agents", "skills", "core", "tdd-regression"), 0o755))
	require.NoError(t, os.MkdirAll(filepath.Join(root, ".agents", "skills", "core", "evals"), 0o755))
	require.NoError(t, os.MkdirAll(filepath.Join(root, "api", ".agents", "skills", "go-wire"), 0o755))
	// Note: .agents/skills/scaffold and apps/admin/.agents/skills are intentionally absent.

	require.NoError(t, os.WriteFile(filepath.Join(root, ".agents", "config.yaml"), []byte(configYAML), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(root, "AGENTS.md"), []byte("# AGENTS\n"), 0o644))
	require.NoError(t, os.WriteFile(
		filepath.Join(root, ".agents", "skills", "core", "tdd-regression", "SKILL.md"),
		[]byte("---\nname: tdd-regression\ndescription: Add a red/green regression guard.\n---\n# TDD\n"),
		0o644,
	))
	require.NoError(t, os.WriteFile(
		filepath.Join(root, "api", ".agents", "skills", "go-wire", "SKILL.md"),
		[]byte("---\nname: go-wire\ndescription: Wire dependency injection helpers.\n---\n# Wire\n"),
		0o644,
	))

	return root
}

func TestAgentSyncDeterministicRenderAndMissingRoots(t *testing.T) {
	root := setupAgentSyncFixture(t)

	cfg, err := loadAgentConfig(root)
	require.NoError(t, err)

	first, err := renderAgentSyncFiles(root, cfg)
	require.NoError(t, err)
	second, err := renderAgentSyncFiles(root, cfg)
	require.NoError(t, err)

	require.Len(t, first, 3)
	assert.Equal(t, first, second)

	// Targets are sorted: claude, codex, cursor.
	assert.Equal(t, ".claude/CLAUDE.md", first[0].RelPath)
	assert.Equal(t, ".codex/instructions.md", first[1].RelPath)
	assert.Equal(t, ".cursor/rules/fastbuild.mdc", first[2].RelPath)

	claudeContent := string(first[0].Content)
	assert.True(t, strings.HasPrefix(claudeContent, agentSyncHeader+"\n"))
	assert.Contains(t, claudeContent, "`AGENTS.md`")
	assert.Contains(t, claudeContent, "fastbuild context --changed")
	assert.Contains(t, claudeContent, "`go-wire` (`api/.agents/skills/go-wire/SKILL.md`): Wire dependency injection helpers.")
	assert.Contains(t, claudeContent, "`tdd-regression` (`.agents/skills/core/tdd-regression/SKILL.md`): Add a red/green regression guard.")
	// Non-skill directory without SKILL.md is skipped.
	assert.NotContains(t, claudeContent, "evals")
	// Missing optional roots are silently skipped.
	assert.NotContains(t, claudeContent, ".agents/skills/scaffold")
	assert.NotContains(t, claudeContent, "apps/admin/.agents/skills")

	cursorContent := string(first[2].Content)
	assert.True(t, strings.HasPrefix(cursorContent, "---\n"))
	assert.Contains(t, cursorContent, "alwaysApply: true\n")
	assert.True(t, isManagedAgentFile(first[2].Content))
}

func TestAgentSyncCheckWriteAndSiblingPreservation(t *testing.T) {
	root := setupAgentSyncFixture(t)

	// Place a sibling file inside .claude/ that must never be touched.
	siblingPath := filepath.Join(root, ".claude", "launch.json")
	require.NoError(t, os.MkdirAll(filepath.Dir(siblingPath), 0o755))
	require.NoError(t, os.WriteFile(siblingPath, []byte(`{"version":"1"}`), 0o644))

	var out bytes.Buffer
	cmd := &AgentSyncCommand{
		writer:   &out,
		findRoot: func() (string, error) { return root, nil },
	}

	// --check before sync fails and does not create files.
	err := cmd.Run([]string{"--check"})
	require.Error(t, err)
	assert.True(t, cmd.SuppressCompletionOutput())
	assert.Contains(t, err.Error(), "missing: .claude/CLAUDE.md")
	assert.Contains(t, err.Error(), "missing: .codex/instructions.md")
	assert.Contains(t, err.Error(), "missing: .cursor/rules/fastbuild.mdc")
	assert.False(t, fileExists(filepath.Join(root, ".claude", "CLAUDE.md")))

	// Normal sync creates all 3 files.
	out.Reset()
	require.NoError(t, cmd.Run(nil))
	assert.False(t, cmd.SuppressCompletionOutput())
	assert.Contains(t, out.String(), "3 created, 0 updated, 0 unchanged")

	// Sibling file in .claude/ is completely untouched.
	siblingBytes, err := os.ReadFile(siblingPath)
	require.NoError(t, err)
	assert.Equal(t, `{"version":"1"}`, string(siblingBytes))

	// --check now passes.
	out.Reset()
	require.NoError(t, cmd.Run([]string{"--check"}))
	assert.Contains(t, out.String(), "check passed (3 files up to date)")

	// Introduce drift into a managed file -> --check detects it without modifying it.
	codexPath := filepath.Join(root, ".codex", "instructions.md")
	driftedContent := agentSyncHeader + "\n\nstale content\n"
	require.NoError(t, os.WriteFile(codexPath, []byte(driftedContent), 0o644))

	err = cmd.Run([]string{"--check"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "drifted: .codex/instructions.md")

	stillDrifted, err := os.ReadFile(codexPath)
	require.NoError(t, err)
	assert.Equal(t, driftedContent, string(stillDrifted))

	// Re-sync updates only the drifted managed file.
	out.Reset()
	require.NoError(t, cmd.Run(nil))
	assert.Contains(t, out.String(), "0 created, 1 updated, 2 unchanged")
}

func TestAgentSyncRefusesUnmanagedFileWithoutForce(t *testing.T) {
	root := setupAgentSyncFixture(t)

	claudePath := filepath.Join(root, ".claude", "CLAUDE.md")
	require.NoError(t, os.MkdirAll(filepath.Dir(claudePath), 0o755))
	manualContent := "# Custom hand-written CLAUDE.md\n"
	require.NoError(t, os.WriteFile(claudePath, []byte(manualContent), 0o644))

	var out bytes.Buffer
	cmd := &AgentSyncCommand{
		writer:   &out,
		findRoot: func() (string, error) { return root, nil },
	}

	err := cmd.Run(nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "refusing to overwrite unmanaged file .claude/CLAUDE.md")

	// Unmanaged file must remain intact.
	afterRefusal, err := os.ReadFile(claudePath)
	require.NoError(t, err)
	assert.Equal(t, manualContent, string(afterRefusal))

	// With --force, it overwrites cleanly.
	out.Reset()
	require.NoError(t, cmd.Run([]string{"--force"}))
	afterForce, err := os.ReadFile(claudePath)
	require.NoError(t, err)
	assert.True(t, isManagedAgentFile(afterForce))
}
