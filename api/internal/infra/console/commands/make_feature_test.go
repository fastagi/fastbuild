package commands

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fastagi/fastbuild/api/internal/infra/pluginregistry"
)

func TestMakeFeatureArguments(t *testing.T) {
	name, err := parseMakeFeatureArgs([]string{"invoice", "--web"})
	require.NoError(t, err)
	assert.Equal(t, "invoice", name)

	for _, test := range []struct {
		args []string
		want string
	}{
		{[]string{"--web"}, "feature name is required"},
		{[]string{"invoice"}, "make:feature invoice --web"},
		{[]string{"BlogPost", "--web"}, "one lowercase word"},
		{[]string{"blog_post", "--web"}, "one lowercase word"},
		{[]string{"class", "--web"}, "reserved"},
		{[]string{"invoice", "--admin"}, "unknown option"},
		{[]string{"invoice", "order", "--web"}, "unexpected argument"},
	} {
		_, err := parseMakeFeatureArgs(test.args)
		require.ErrorContains(t, err, test.want, "%v", test.args)
	}
}

func TestRenderWebFeatureRenamesTheReferenceEverywhere(t *testing.T) {
	files, inserts, err := renderWebFeature("invoice")
	require.NoError(t, err)
	require.NotEmpty(t, files)

	var paths []string
	for _, file := range files {
		paths = append(paths, file.path)
		assert.NotContains(t, strings.ToLower(file.path), "widget")
		assert.NotContains(t, strings.ToLower(string(file.content)), "widget", file.path)
		assert.True(t, strings.HasPrefix(file.path, "apps/web/src/"), file.path)
	}
	// The guard tests in apps/web locate a plugin-style feature by these exact paths.
	for _, required := range []string{
		"apps/web/src/features/invoice/server/invoice-route.ts",
		"apps/web/src/features/invoice/services/invoice-service.ts",
		"apps/web/src/app/api/invoices/route.ts",
		"apps/web/src/app/api/invoices/[id]/route.ts",
		"apps/web/src/app/(protected)/(console)/console/invoices/page.tsx",
		"apps/web/src/i18n/modules/invoice/en-US.ts",
		"apps/web/src/i18n/modules/invoice/zh-Hans.ts",
		"apps/web/src/test/mock-bff-parity/invoice.ts",
	} {
		assert.Contains(t, paths, required)
	}

	require.NotEmpty(t, inserts)
	for _, insert := range inserts {
		_, known := pluginregistry.FindSlot(insert.Slot)
		assert.True(t, known, "wiring names an unknown slot %s", insert.Slot)
		assert.NotContains(t, strings.ToLower(strings.Join(insert.Lines, "\n")), "widget")
	}
}

func TestRenderWebFeatureMatchesTheGeneratedContract(t *testing.T) {
	files, _, err := renderWebFeature("invoice")
	require.NoError(t, err)
	var service, route string
	for _, file := range files {
		switch file.path {
		case "apps/web/src/features/invoice/services/invoice-service.ts":
			service = string(file.content)
		case "apps/web/src/features/invoice/server/invoice-route.ts":
			route = string(file.content)
		}
	}
	// make:module names its operations list<Name>s, get<Name>, create<Name>, update<Name>.
	for _, operation := range []string{"'listInvoices'", "'getInvoice'", "'createInvoice'", "'updateInvoice'"} {
		assert.Contains(t, service, operation)
	}
	// The browser route forwards to the collection path make:module registers, and updates with PUT.
	assert.Contains(t, route, "path: 'invoices'")
	assert.Contains(t, route, "method: 'PUT'")
	assert.Contains(t, route, "export function resolveInvoiceRoute(")
	assert.Contains(t, route, "export function privateInvoiceResponse<")
}

func TestMakeFeatureRequiresTheStarterAndWritesNothingOnCollision(t *testing.T) {
	wd, err := os.Getwd()
	require.NoError(t, err)
	root := t.TempDir()
	api := filepath.Join(root, "api")
	require.NoError(t, os.MkdirAll(filepath.Join(root, "apps", "web"), 0o755))
	require.NoError(t, os.MkdirAll(api, 0o755))
	require.NoError(t, os.Chdir(api))
	defer func() { _ = os.Chdir(wd) }()

	err = NewMakeFeatureCommand().Run([]string{"invoice", "--web"})
	require.ErrorContains(t, err, "make:module invoice --scope=organization")

	module := filepath.Join(api, "internal", "modules", "invoice")
	require.NoError(t, os.MkdirAll(module, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(module, "routes.go"), []byte("package invoice\n"), 0o644))
	existing := filepath.Join(root, "apps", "web", "src", "features", "invoice", "index.ts")
	require.NoError(t, os.MkdirAll(filepath.Dir(existing), 0o755))
	require.NoError(t, os.WriteFile(existing, []byte("// mine\n"), 0o644))

	err = NewMakeFeatureCommand().Run([]string{"invoice", "--web"})
	require.ErrorContains(t, err, "already exists")
	kept, err := os.ReadFile(existing)
	require.NoError(t, err)
	assert.Equal(t, "// mine\n", string(kept))
	assert.NoFileExists(t, filepath.Join(root, "apps", "web", "src", "features", "invoice", "schemas.ts"))
}
