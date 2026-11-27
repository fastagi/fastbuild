package ownedgo_test

import (
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"

	"github.com/fastagi/fastbuild/api/cmd/tools/archlint/ownedgo"
)

func TestOwnedGo(t *testing.T) {
	analysistest.Run(t, analysistest.TestData(), ownedgo.Analyzer, "sample")
}
