package aghhttp

import (
	"net/http"
	"sort"
	"strings"
	"sync"
)

// Registrar registers an HTTP handler for a method and path.
//
// TODO(s.chzhen):  Implement [httputil.Router].
type Registrar interface {
	Register(method, path string, h http.HandlerFunc)
}

// EmptyRegistrar is an implementation of [Registrar] that does nothing.
type EmptyRegistrar struct{}

// type check
var _ Registrar = EmptyRegistrar{}

// Register implements the [Registrar] interface.
func (EmptyRegistrar) Register(_, _ string, _ http.HandlerFunc) {}

// WrapFunc is a wrapper function that builds an HTTP handler for a route.
type WrapFunc func(method string, h http.HandlerFunc) (wrapped http.Handler)

// DefaultRegistrar is an implementation of [Registrar] that registers handlers
// after applying a user-provided wrapper function.
type DefaultRegistrar struct {
	mux    *http.ServeMux
	wrapFn WrapFunc

	mu      sync.RWMutex
	methods map[string]map[string]struct{}
}

// NewDefaultRegistrar returns a new properly initialized *DefaultRegistrar.
// mux and wrap must not be nil.
func NewDefaultRegistrar(mux *http.ServeMux, wrap WrapFunc) (r *DefaultRegistrar) {
	return &DefaultRegistrar{
		mux:     mux,
		wrapFn:  wrap,
		methods: map[string]map[string]struct{}{},
	}
}

// type check
var _ Registrar = (*DefaultRegistrar)(nil)

// Register implements the [Registrar] interface.
func (r *DefaultRegistrar) Register(method, path string, h http.HandlerFunc) {
	wrapped := r.wrapFn(method, h)

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.methods[path]; !ok {
		r.methods[path] = map[string]struct{}{}
		r.mux.Handle(path, r.methodNotAllowed(path))
	}

	r.methods[path][method] = struct{}{}
	r.mux.Handle(method+" "+path, wrapped)
}

// methodNotAllowed returns a handler that keeps path-specific 405 responses on
// a route with multiple method-specific handlers.
func (r *DefaultRegistrar) methodNotAllowed(path string) (h http.Handler) {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		allow := r.allowedMethods(path)
		if len(allow) > 0 {
			w.Header().Set("Allow", strings.Join(allow, ", "))
		}

		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	})
}

// allowedMethods returns the sorted list of registered HTTP methods for path.
func (r *DefaultRegistrar) allowedMethods(path string) (allow []string) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	methods := r.methods[path]
	allow = make([]string, 0, len(methods))
	for method := range methods {
		allow = append(allow, method)
	}

	sort.Strings(allow)

	return allow
}
