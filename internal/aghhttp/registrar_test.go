package aghhttp

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDefaultRegistrar_Register_samePathDifferentMethods(t *testing.T) {
	mux := http.NewServeMux()
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "root")
	}))

	r := NewDefaultRegistrar(mux, func(_ string, h http.HandlerFunc) (wrapped http.Handler) {
		return h
	})

	r.Register(http.MethodGet, "/control/rewrite/text", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "get")
	})
	r.Register(http.MethodPut, "/control/rewrite/text", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "put")
	})

	t.Run("get", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/control/rewrite/text", nil)
		res := httptest.NewRecorder()

		mux.ServeHTTP(res, req)

		require.Equal(t, http.StatusOK, res.Code)
		require.Equal(t, "get", res.Body.String())
	})

	t.Run("put", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/control/rewrite/text", nil)
		res := httptest.NewRecorder()

		mux.ServeHTTP(res, req)

		require.Equal(t, http.StatusOK, res.Code)
		require.Equal(t, "put", res.Body.String())
	})

	t.Run("post_method_not_allowed", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/control/rewrite/text", nil)
		res := httptest.NewRecorder()

		mux.ServeHTTP(res, req)

		require.Equal(t, http.StatusMethodNotAllowed, res.Code)
		require.Equal(t, "GET, PUT", res.Header().Get("Allow"))
		require.Equal(t, "Method Not Allowed\n", res.Body.String())
	})
}
