// Package ownedgo reports goroutines started without a stated owner.
package ownedgo

import (
	"go/ast"
	"strings"

	"golang.org/x/tools/go/analysis"
)

// Directive states who stops the goroutine. Write it on the line above the go statement.
const Directive = "archlint:goroutine"

// Analyzer flags go statements that have no //archlint:goroutine comment. A request handler that
// starts a goroutine outlives its request, its transaction, and graceful shutdown; background work
// belongs to a component with a Shutdown, or to the workflow queue.
var Analyzer = &analysis.Analyzer{
	Name: "ownedgo",
	Doc:  "reports go statements without an //archlint:goroutine comment naming what stops them",
	Run:  run,
}

func run(pass *analysis.Pass) (any, error) {
	for _, file := range pass.Files {
		position := pass.Fset.Position(file.Pos())
		if strings.HasSuffix(position.Filename, "_test.go") {
			continue
		}
		owned := map[int]bool{}
		for _, group := range file.Comments {
			for _, comment := range group.List {
				if strings.Contains(comment.Text, Directive) {
					owned[pass.Fset.Position(group.End()).Line] = true
				}
			}
		}
		ast.Inspect(file, func(node ast.Node) bool {
			statement, ok := node.(*ast.GoStmt)
			if !ok {
				return true
			}
			line := pass.Fset.Position(statement.Pos()).Line
			if !owned[line-1] && !owned[line] {
				pass.Reportf(statement.Pos(),
					"goroutine has no owner; add //%s <what stops it> on the line above, or hand the work to a component with Shutdown or to the workflow queue",
					Directive)
			}
			return true
		})
	}
	return nil, nil
}
