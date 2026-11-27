// Command archlint runs FastBuild's architecture analyzers:
//
//	go run ./cmd/tools/archlint ./internal/modules/...
//
// orgscope: queries on organization-owned models must be confined to one organization.
// ownedgo:  every goroutine names what stops it.
package main

import (
	"golang.org/x/tools/go/analysis/multichecker"

	"github.com/fastagi/fastbuild/api/cmd/tools/archlint/orgscope"
	"github.com/fastagi/fastbuild/api/cmd/tools/archlint/ownedgo"
)

func main() {
	multichecker.Main(orgscope.Analyzer, ownedgo.Analyzer)
}
