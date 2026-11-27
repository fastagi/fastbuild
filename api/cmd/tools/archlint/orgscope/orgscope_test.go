package orgscope_test

import (
	"path/filepath"
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"

	"github.com/fastagi/fastbuild/api/cmd/tools/archlint/orgscope"
)

func TestOrgScope(t *testing.T) {
	testdata := analysistest.TestData()
	if err := orgscope.Analyzer.Flags.Set("baseline", filepath.Join(testdata, "baseline.txt")); err != nil {
		t.Fatal(err)
	}
	analysistest.Run(t, testdata, orgscope.Analyzer, "sample")
}
