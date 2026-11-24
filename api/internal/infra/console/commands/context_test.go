package commands

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubContextGitRunner struct {
	responses map[string]string
	errors    map[string]error
}

func (s stubContextGitRunner) Run(_ string, args ...string) (string, error) {
	key := strings.Join(args, " ")
	if err, ok := s.errors[key]; ok {
		return "", err
	}
	return s.responses[key], nil
}

func TestParseContextOptions(t *testing.T) {
	tests := []struct {
		name      string
		args      []string
		want      contextOptions
		wantError string
	}{
		{
			name: "defaults",
			args: nil,
			want: contextOptions{changed: true, format: contextFormatAgent},
		},
		{
			name: "changed with json equals",
			args: []string{"--changed", "--format=json", "--base=main"},
			want: contextOptions{changed: true, format: contextFormatJSON, base: "main"},
		},
		{
			name: "space separated format and base",
			args: []string{"--format", "agent", "--base", "origin/main"},
			want: contextOptions{changed: true, format: contextFormatAgent, base: "origin/main"},
		},
		{
			name: "global env flags accepted",
			args: []string{"--env=dev", "--env-file", ".env", "--changed"},
			want: contextOptions{changed: true, format: contextFormatAgent},
		},
		{
			name:      "invalid format",
			args:      []string{"--format=yaml"},
			wantError: "--format must be agent or json",
		},
		{
			name:      "duplicate format",
			args:      []string{"--format=agent", "--format=json"},
			wantError: "--format may be provided only once",
		},
		{
			name:      "empty base",
			args:      []string{"--base="},
			wantError: "--base requires a non-empty ref",
		},
		{
			name:      "unknown option",
			args:      []string{"--unknown"},
			wantError: `unknown context option "--unknown"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseContextOptions(tt.args)
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

func TestContextCommandCleanWorkingTree(t *testing.T) {
	var out bytes.Buffer
	cmd := &ContextCommand{
		writer:   &out,
		findRoot: func() (string, error) { return t.TempDir(), nil },
		git: stubContextGitRunner{
			responses: map[string]string{
				"rev-parse --abbrev-ref HEAD": "main\n",
				"status --porcelain=v1 -uall": "",
			},
		},
	}

	assert.True(t, cmd.SuppressCompletionOutput())

	require.NoError(t, cmd.Run([]string{"--changed", "--format=agent"}))
	assert.Contains(t, out.String(), "FastBuild Context (branch: main)")
	assert.Contains(t, out.String(), "Units: none")
	assert.Contains(t, out.String(), "Files (0): none")
	assert.Contains(t, out.String(), "Verify: none")

	out.Reset()
	require.NoError(t, cmd.Run([]string{"--changed", "--format=json"}))
	var report contextReport
	require.NoError(t, json.Unmarshal(out.Bytes(), &report))
	assert.Equal(t, "fastbuild.context", report.Kind)
	assert.Equal(t, 1, report.SchemaVersion)
	assert.Equal(t, "main", report.Branch)
	assert.Empty(t, report.ChangedFiles)
	assert.Empty(t, report.ImpactedUnits)
	assert.Empty(t, report.ReadFirst)
	assert.Empty(t, report.ActiveContracts)
	assert.Empty(t, report.VerifyCommands)
}

func TestContextCommandSingleAPIModuleAndRoutes(t *testing.T) {
	var out bytes.Buffer
	cmd := &ContextCommand{
		writer:   &out,
		findRoot: func() (string, error) { return t.TempDir(), nil },
		git: stubContextGitRunner{
			responses: map[string]string{
				"rev-parse --abbrev-ref HEAD": "feat/user-profile\n",
				"status --porcelain=v1 -uall": " M api/internal/modules/user/handler.go\n?? api/internal/modules/user/routes.go\n",
			},
		},
	}

	require.NoError(t, cmd.Run([]string{"--changed", "--format=json"}))

	var report contextReport
	require.NoError(t, json.Unmarshal(out.Bytes(), &report))
	assert.Equal(t, []string{"api"}, report.ImpactedUnits)
	assert.Equal(t, []string{"api/AGENTS.md"}, report.ReadFirst)
	assert.Equal(t, []string{"packages/contracts/AUTHENTICATION.md"}, report.ActiveContracts)
	assert.Equal(t, []string{
		"cd api && go test ./internal/modules/user/...",
		"cd api && make route-catalog-check",
	}, report.VerifyCommands)
}

func TestContextCommandMultiUnitWithBaseDiffAndRenames(t *testing.T) {
	var out bytes.Buffer
	cmd := &ContextCommand{
		writer:   &out,
		findRoot: func() (string, error) { return t.TempDir(), nil },
		git: stubContextGitRunner{
			responses: map[string]string{
				"rev-parse --abbrev-ref HEAD": "feat/webhooks-ui\n",
				"status --porcelain=v1 -uall": strings.Join([]string{
					"R  apps/web/src/old.ts -> apps/web/src/features/webhooks/page.tsx",
					" M packages/contracts/openapi.yaml",
					"?? .agents/config.yaml",
				}, "\n") + "\n",
				"diff --name-only main...HEAD": "api/internal/modules/webhook/service.go\napps/admin/src/routes/webhooks.tsx\n",
			},
		},
	}

	require.NoError(t, cmd.Run([]string{"--changed", "--base=main", "--format=json"}))

	var report contextReport
	require.NoError(t, json.Unmarshal(out.Bytes(), &report))
	assert.Equal(t, "main", report.Base)
	assert.Equal(t, []string{"api", "apps/web", "apps/admin", "packages/contracts", ".agents"}, report.ImpactedUnits)
	assert.Equal(t, []string{
		"api/AGENTS.md",
		"apps/web/AGENTS.md",
		"apps/admin/AGENTS.md",
		"packages/contracts/README.md",
		"AGENTS.md",
	}, report.ReadFirst)
	assert.Equal(t, []string{
		"packages/contracts/OPENAPI.md",
		"packages/contracts/WEBHOOKS.md",
	}, report.ActiveContracts)
	assert.Contains(t, report.VerifyCommands, "cd api && go test ./internal/modules/webhook/...")
	assert.Contains(t, report.VerifyCommands, "cd apps/web && corepack pnpm type-check && corepack pnpm lint")
	assert.Contains(t, report.VerifyCommands, "cd apps/admin && corepack pnpm type-check && corepack pnpm lint")
	assert.Contains(t, report.VerifyCommands, "make contract-check")
	assert.Contains(t, report.VerifyCommands, "make agent-check-changed")
	assert.Contains(t, report.VerifyCommands, "make check # before release")
}

func TestContextAgentOutputStaysWithin40LinesWith100Files(t *testing.T) {
	var statusLines []string
	for i := 0; i < 100; i++ {
		statusLines = append(statusLines, fmt.Sprintf("?? api/internal/modules/user/file_%03d.go", i))
	}
	statusLines = append(statusLines,
		" M apps/web/src/features/apikey/index.ts",
		" M apps/admin/src/routes/audit.tsx",
		" M packages/contracts/openapi.yaml",
		" M Makefile",
		" M .agents/config.yaml",
	)

	var out bytes.Buffer
	cmd := &ContextCommand{
		writer:   &out,
		findRoot: func() (string, error) { return t.TempDir(), nil },
		git: stubContextGitRunner{
			responses: map[string]string{
				"rev-parse --abbrev-ref HEAD": "feat/large-change\n",
				"status --porcelain=v1 -uall": strings.Join(statusLines, "\n") + "\n",
			},
		},
	}

	require.NoError(t, cmd.Run([]string{"--changed", "--format=agent"}))
	rendered := strings.TrimSuffix(out.String(), "\n")
	lines := strings.Split(rendered, "\n")

	assert.LessOrEqual(t, len(lines), 40, "agent output must stay <= 40 lines, got %d:\n%s", len(lines), rendered)
	assert.Contains(t, rendered, "Files (105):")
	assert.Contains(t, rendered, "(+95 more)")
}
