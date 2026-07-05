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
	simpleAllowlistURL        = "/control/simple_allowlist/text"
	simpleBlocklistURL        = "/control/simple_blocklist/text"
	validSimpleAllowlistText  = "aa.cc\n*.aa.cc\n"
	validSimpleBlocklistText  = "block.cc\n*.block.cc\n"
	updatedSimpleListText     = "*.updated.example\nupdated.example\r\n"
	invalidSimpleListText     = "bad*.example"
	invalidSimpleListTextErr  = "line 1: invalid rule \"bad*.example\": wildcard must occupy a whole label\n"
	decodeSimpleListTextError = "json.Decode: json: cannot unmarshal string into Go value of type filtering.simpleListText\n"
)

func TestDNSFilter_HandleSimpleListTextHTTP(t *testing.T) {
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
		name:       "allow_get",
		method:     http.MethodGet,
		url:        simpleAllowlistURL,
		wantBody:   "{\"rules\":\"aa.cc\\n*.aa.cc\\n\"}\n",
		wantRules:  validSimpleAllowlistText,
		wantStatus: http.StatusOK,
	}, {
		name:          "allow_put_valid",
		method:        http.MethodPut,
		url:           simpleAllowlistURL,
		reqData:       map[string]string{"rules": updatedSimpleListText},
		wantRules:     updatedSimpleListText,
		wantStatus:    http.StatusOK,
		wantConfApply: true,
	}, {
		name:       "allow_put_invalid_rule",
		method:     http.MethodPut,
		url:        simpleAllowlistURL,
		reqData:    map[string]string{"rules": invalidSimpleListText},
		wantBody:   invalidSimpleListTextErr,
		wantRules:  validSimpleAllowlistText,
		wantStatus: http.StatusBadRequest,
	}, {
		name:       "allow_put_invalid_json",
		method:     http.MethodPut,
		url:        simpleAllowlistURL,
		reqData:    "invalid_json",
		wantBody:   decodeSimpleListTextError,
		wantRules:  validSimpleAllowlistText,
		wantStatus: http.StatusBadRequest,
	}, {
		name:       "block_get",
		method:     http.MethodGet,
		url:        simpleBlocklistURL,
		wantBody:   "{\"rules\":\"block.cc\\n*.block.cc\\n\"}\n",
		wantRules:  validSimpleBlocklistText,
		wantStatus: http.StatusOK,
	}, {
		name:          "block_put_valid",
		method:        http.MethodPut,
		url:           simpleBlocklistURL,
		reqData:       map[string]string{"rules": updatedSimpleListText},
		wantRules:     updatedSimpleListText,
		wantStatus:    http.StatusOK,
		wantConfApply: true,
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

			conf := &filtering.Config{
				Logger:          testLogger,
				ConfModifier:    confModifier,
				SimpleAllowlist: validSimpleAllowlistText,
				SimpleBlocklist: validSimpleBlocklistText,
				RewritesEnabled: true,
				HTTPReg: &aghtest.Registrar{
					OnRegister: func(method, url string, handler http.HandlerFunc) {
						handlers[handlerKey(method, url)] = handler
					},
				},
			}

			d, err := filtering.New(conf, nil)
			require.NoError(t, err)
			t.Cleanup(d.Close)

			d.RegisterFilteringHandlers()
			require.Contains(t, handlers, handlerKey(http.MethodGet, tc.url))

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

			req := httptest.NewRequest(http.MethodGet, tc.url, nil)
			resp := httptest.NewRecorder()
			handlers[handlerKey(http.MethodGet, tc.url)].ServeHTTP(resp, req)
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
