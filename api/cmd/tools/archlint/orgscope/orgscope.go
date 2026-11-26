// Package orgscope reports GORM queries on organization-owned persistent objects that are not
// confined to one organization.
package orgscope

import (
	"bufio"
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"os"
	"strings"
	"sync"

	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/passes/inspect"
	"golang.org/x/tools/go/ast/inspector"
)

// Directive exempts one function. Write it in the function's doc comment with the reason, for
// example a retention job that deliberately crosses organizations.
const Directive = "archlint:cross-organization"

const scopeColumn = "organization_id"

// Analyzer flags a read, update, or delete of a struct that has an OrganizationID field when the
// query does not mention organization_id. Inserts are exempt: the row carries its own owner.
var Analyzer = &analysis.Analyzer{
	Name:     "orgscope",
	Doc:      "reports GORM queries on organization-owned models without an organization_id predicate",
	Requires: []*analysis.Analyzer{inspect.Analyzer},
	Run:      run,
}

var (
	baselinePath string
	baselineOnce sync.Once
	baselineKeys map[string]bool
	baselineErr  error
)

func init() {
	Analyzer.Flags.StringVar(&baselinePath, "baseline", "",
		"file of function keys, one per line, whose queries predate this rule and are not reported")
}

// loadBaseline reads the baseline once. Lines are function keys as printed in a diagnostic; blank
// lines and lines starting with # are ignored.
func loadBaseline() (map[string]bool, error) {
	baselineOnce.Do(func() {
		baselineKeys = map[string]bool{}
		if baselinePath == "" {
			return
		}
		file, err := os.Open(baselinePath)
		if err != nil {
			baselineErr = fmt.Errorf("orgscope baseline: %w", err)
			return
		}
		defer file.Close()
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" && !strings.HasPrefix(line, "#") {
				baselineKeys[line] = true
			}
		}
		baselineErr = scanner.Err()
	})
	return baselineKeys, baselineErr
}

// functionKey names a function independently of line numbers and of the Go module path:
// internal/modules/webhook.(repository).Claim
func functionKey(pass *analysis.Pass, function *ast.FuncDecl) string {
	path := pass.Pkg.Path()
	if index := strings.Index(path, "/internal/"); index >= 0 {
		path = path[index+1:]
	}
	name := function.Name.Name
	if function.Recv != nil && len(function.Recv.List) == 1 {
		receiver := function.Recv.List[0].Type
		if star, ok := receiver.(*ast.StarExpr); ok {
			receiver = star.X
		}
		if identifier, ok := receiver.(*ast.Ident); ok {
			name = "(" + identifier.Name + ")." + name
		}
	}
	return path + "." + name
}

// queryMethods are the gorm.DB methods that name the model a statement reads or changes.
var queryMethods = map[string]bool{
	"Model": true, "First": true, "Take": true, "Last": true, "Find": true, "FirstOrCreate": true,
	"FirstOrInit": true, "Save": true, "Delete": true, "Scan": true,
}

func run(pass *analysis.Pass) (any, error) {
	baseline, err := loadBaseline()
	if err != nil {
		return nil, err
	}
	walker, ok := pass.ResultOf[inspect.Analyzer].(*inspector.Inspector)
	if !ok {
		return nil, fmt.Errorf("orgscope: the inspect analyzer returned no inspector")
	}
	walker.WithStack([]ast.Node{(*ast.CallExpr)(nil)}, func(node ast.Node, push bool, stack []ast.Node) bool {
		if !push {
			return true
		}
		call, isCall := node.(*ast.CallExpr)
		if !isCall {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok || !queryMethods[selector.Sel.Name] || !isGormDB(pass, selector) {
			return true
		}
		model := organizationOwnedArgument(pass, call)
		if model == "" {
			return true
		}
		function := enclosingFunction(stack)
		if function == nil || exempt(pass, function) {
			return true
		}
		if mentionsScope(outermostChain(call, stack), function, pass, 0) {
			return true
		}
		key := functionKey(pass, function)
		if baseline[key] {
			return true
		}
		pass.Reportf(call.Pos(),
			"%s on organization-owned %s has no %s predicate; add one to this query, or mark the function //%s <reason> [%s]",
			selector.Sel.Name, model, scopeColumn, Directive, key)
		return true
	})
	return nil, nil
}

func isGormDB(pass *analysis.Pass, selector *ast.SelectorExpr) bool {
	receiver := pass.TypesInfo.TypeOf(selector.X)
	if receiver == nil {
		return false
	}
	if pointer, ok := receiver.(*types.Pointer); ok {
		receiver = pointer.Elem()
	}
	named, ok := receiver.(*types.Named)
	if !ok || named.Obj().Pkg() == nil {
		return false
	}
	return named.Obj().Pkg().Path() == "gorm.io/gorm" && named.Obj().Name() == "DB"
}

// organizationOwnedArgument returns the name of the first argument type that has an
// OrganizationID field, looking through pointers and slices.
func organizationOwnedArgument(pass *analysis.Pass, call *ast.CallExpr) string {
	for _, argument := range call.Args {
		current := pass.TypesInfo.TypeOf(argument)
		for current != nil {
			switch typed := current.(type) {
			case *types.Pointer:
				current = typed.Elem()
				continue
			case *types.Slice:
				current = typed.Elem()
				continue
			case *types.Array:
				current = typed.Elem()
				continue
			case *types.Named:
				if structure, ok := typed.Underlying().(*types.Struct); ok {
					for index := 0; index < structure.NumFields(); index++ {
						if structure.Field(index).Name() == "OrganizationID" {
							return typed.Obj().Name()
						}
					}
				}
			}
			break
		}
	}
	return ""
}

func enclosingFunction(stack []ast.Node) *ast.FuncDecl {
	for index := len(stack) - 1; index >= 0; index-- {
		if function, ok := stack[index].(*ast.FuncDecl); ok {
			return function
		}
	}
	return nil
}

func exempt(pass *analysis.Pass, function *ast.FuncDecl) bool {
	if strings.HasSuffix(pass.Fset.Position(function.Pos()).Filename, "_test.go") {
		return true
	}
	if function.Doc == nil {
		return false
	}
	for _, comment := range function.Doc.List {
		if strings.Contains(comment.Text, Directive) {
			return true
		}
	}
	return false
}

// outermostChain returns the whole method chain the call belongs to, so a predicate added before
// or after the model call is seen: db.Where(...).Take(&row) and db.Model(&row).Where(...).
func outermostChain(start *ast.CallExpr, stack []ast.Node) ast.Expr {
	index := len(stack) - 1
	var chain ast.Expr = start
	for index >= 2 {
		selector, isSelector := stack[index-1].(*ast.SelectorExpr)
		call, isCall := stack[index-2].(*ast.CallExpr)
		if !isSelector || !isCall || selector.X != chain || call.Fun != selector {
			break
		}
		chain = call
		index -= 2
	}
	return chain
}

// mentionsScope reports whether the expression, or the local value its chain starts from, contains
// a string literal naming the scope column.
func mentionsScope(expression ast.Node, function *ast.FuncDecl, pass *analysis.Pass, depth int) bool {
	if expression == nil || depth > 4 {
		return false
	}
	found := false
	var bases []*ast.Ident
	ast.Inspect(expression, func(node ast.Node) bool {
		switch typed := node.(type) {
		case *ast.BasicLit:
			if typed.Kind == token.STRING && strings.Contains(strings.ToLower(typed.Value), scopeColumn) {
				found = true
			}
		case *ast.Ident:
			bases = append(bases, typed)
		}
		return !found
	})
	if found {
		return true
	}
	// Follow local values such as `query := db.Where("organization_id = ?", id)` or a local
	// `scoped := func() *gorm.DB { ... }` back to where they were built.
	for _, base := range bases {
		object := pass.TypesInfo.ObjectOf(base)
		if object == nil || object.Pos() < function.Body.Pos() || object.Pos() > function.Body.End() {
			continue
		}
		for _, definition := range definitions(function, object, pass) {
			if mentionsScope(definition, function, pass, depth+1) {
				return true
			}
		}
	}
	return false
}

func definitions(function *ast.FuncDecl, object types.Object, pass *analysis.Pass) []ast.Expr {
	var values []ast.Expr
	ast.Inspect(function.Body, func(node ast.Node) bool {
		switch typed := node.(type) {
		case *ast.AssignStmt:
			for index, target := range typed.Lhs {
				identifier, ok := target.(*ast.Ident)
				if !ok || pass.TypesInfo.ObjectOf(identifier) != object {
					continue
				}
				if len(typed.Rhs) == len(typed.Lhs) {
					values = append(values, typed.Rhs[index])
				} else if len(typed.Rhs) == 1 {
					values = append(values, typed.Rhs[0])
				}
			}
		case *ast.ValueSpec:
			for index, name := range typed.Names {
				if pass.TypesInfo.ObjectOf(name) == object && index < len(typed.Values) {
					values = append(values, typed.Values[index])
				}
			}
		}
		return true
	})
	return values
}
