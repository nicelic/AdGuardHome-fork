package filtering_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nicelic/AdGuardHome-fork/internal/aghtest"
	"github.com/nicelic/AdGuardHome-fork/internal/filtering"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	rewriteTextURL         = "/control/rewrite/text"
	rewriteSettingsURL     = "/control/rewrite/settings"
	rewriteSettingsPutURL  = "/control/rewrite/settings/update"
	validRewriteText       = "[example.org *.example.org]:[1.1.1.1][2001:db8::1][alias.example]\n# [disabled.example]:[2.2.2.2][][]\n"
	updatedRewriteText     = "[updated.example]:[5.5.5.5][][]\n"
	updatedRewriteTextCRLF = "[updated.example]:[5.5.5.5][][]\r\n"
	invalidRewriteText     = "[broken.example]:[][][]"
	invalidRewriteTextErr  = "line 1: invalid rule \"[broken.example]:[][][]\": right groups must contain at least one value\n"
	decodeRewriteTextError = "json.Decode: json: cannot unmarshal string into Go value of type filtering.rewriteText\n"
)

func handlerKey(method, path string) string {
	return method + " " + path
}

func TestDNSFilter_HandleRewriteTextHTTP(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name          string
		method        string
		url           string
		reqData       any
		wantBody      string
		wantRules     string
		wantStatus    int
		wantConfApply bool
	}{{
		name:       "get",
		method:     http.MethodGet,
		url:        rewriteTextURL,
		wantBody:   "{\"rules\":\"[example.org *.example.org]:[1.1.1.1][2001:db8::1][alias.example]\\n# [disabled.example]:[2.2.2.2][][]\\n\"}\n",
		wantRules:  validRewriteText,
		wantStatus: http.StatusOK,
	}, {
		name:          "put_valid",
		method:        http.MethodPut,
		url:           rewriteTextURL,
		reqData:       map[string]string{"rules": updatedRewriteText},
		wantRules:     updatedRewriteText,
		wantStatus:    http.StatusOK,
		wantConfApply: true,
	}, {
		name:          "put_valid_preserves_raw_line_endings",
		method:        http.MethodPut,
		url:           rewriteTextURL,
		reqData:       map[string]string{"rules": updatedRewriteTextCRLF},
		wantRules:     updatedRewriteTextCRLF,
		wantStatus:    http.StatusOK,
		wantConfApply: true,
	}, {
		name:       "put_invalid_rule",
		method:     http.MethodPut,
		url:        rewriteTextURL,
		reqData:    map[string]string{"rules": invalidRewriteText},
		wantBody:   invalidRewriteTextErr,
		wantRules:  validRewriteText,
		wantStatus: http.StatusBadRequest,
	}, {
		name:       "put_invalid_json",
		method:     http.MethodPut,
		url:        rewriteTextURL,
		reqData:    "invalid_json",
		wantBody:   decodeRewriteTextError,
		wantRules:  validRewriteText,
		wantStatus: http.StatusBadRequest,
	}}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			confUpdated := false
			handlers := make(map[string]http.Handler)
			confModifier := &aghtest.ConfigModifier{
				OnApply: func(_ context.Context) {
					confUpdated = true
				},
			}

			d, err := filtering.New(&filtering.Config{
				Logger:       testLogger,
				ConfModifier: confModifier,
				HTTPReg: &aghtest.Registrar{
					OnRegister: func(method, url string, handler http.HandlerFunc) {
						handlers[handlerKey(method, url)] = handler
					},
				},
				Rewrites:        validRewriteText,
				RewritesEnabled: true,
			}, nil)
			require.NoError(t, err)
			t.Cleanup(d.Close)

			d.RegisterFilteringHandlers()
			require.Contains(t, handlers, handlerKey(http.MethodGet, rewriteTextURL))

			var body io.Reader
			if tc.reqData != nil {
				data, marshalErr := json.Marshal(tc.reqData)
				require.NoError(t, marshalErr)
				body = bytes.NewReader(data)
			}

			r := httptest.NewRequest(tc.method, tc.url, body)
			w := httptest.NewRecorder()
			handlers[handlerKey(tc.method, tc.url)].ServeHTTP(w, r)

			require.Equal(t, tc.wantStatus, w.Code)
			assert.Equal(t, tc.wantBody, w.Body.String())
			assert.Equal(t, tc.wantConfApply, confUpdated)

			req := httptest.NewRequest(http.MethodGet, rewriteTextURL, nil)
			resp := httptest.NewRecorder()
			handlers[handlerKey(http.MethodGet, rewriteTextURL)].ServeHTTP(resp, req)
			require.Equal(t, http.StatusOK, resp.Code)

			var payload struct {
				Rules string `json:"rules"`
			}
			err = json.NewDecoder(resp.Body).Decode(&payload)
			require.NoError(t, err)
			assert.Equal(t, tc.wantRules, payload.Rules)
		})
	}
}

func TestDNSFilter_HandleRewriteSettings(t *testing.T) {
	t.Parallel()

	handlers := make(map[string]http.Handler)
	confUpdated := false
	confModifier := &aghtest.ConfigModifier{
		OnApply: func(_ context.Context) {
			confUpdated = true
		},
	}

	d, err := filtering.New(&filtering.Config{
		Logger:          testLogger,
		ConfModifier:    confModifier,
		RewritesEnabled: false,
		HTTPReg: &aghtest.Registrar{
			OnRegister: func(method, url string, handler http.HandlerFunc) {
				handlers[handlerKey(method, url)] = handler
			},
		},
	}, nil)
	require.NoError(t, err)
	t.Cleanup(d.Close)

	d.RegisterFilteringHandlers()

	t.Run("get", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, rewriteSettingsURL, nil)
		w := httptest.NewRecorder()
		handlers[handlerKey(http.MethodGet, rewriteSettingsURL)].ServeHTTP(w, r)

		require.Equal(t, http.StatusOK, w.Code)
		assert.JSONEq(t, `{"enabled":false}`, w.Body.String())
	})

	t.Run("put", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodPut, rewriteSettingsPutURL, bytes.NewReader([]byte(`{"enabled":true}`)))
		w := httptest.NewRecorder()
		handlers[handlerKey(http.MethodPut, rewriteSettingsPutURL)].ServeHTTP(w, r)

		require.Equal(t, http.StatusOK, w.Code)
		assert.True(t, confUpdated)

		r = httptest.NewRequest(http.MethodGet, rewriteSettingsURL, nil)
		w = httptest.NewRecorder()
		handlers[handlerKey(http.MethodGet, rewriteSettingsURL)].ServeHTTP(w, r)

		require.Equal(t, http.StatusOK, w.Code)
		assert.JSONEq(t, `{"enabled":true}`, w.Body.String())
	})
}
