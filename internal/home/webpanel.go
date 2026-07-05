package home

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/AdguardTeam/golibs/httphdr"
)

var panelPathInvalidDelay = 30 * time.Second

const nginx404Page = "<html>\r\n<head><title>404 Not Found</title></head>\r\n" +
	"<body>\r\n<center><h1>404 Not Found</h1></center>\r\n<hr><center>nginx</center>\r\n" +
	"</body>\r\n</html>\r\n"

type panelRequestPrefixKey struct{}
type panelRequestPathKey struct{}

func currentTLSSettings(tlsMgr *tlsManager) (tlsConf *tlsConfigSettings) {
	if tlsMgr != nil {
		return tlsMgr.extendedTLSConfig()
	}

	config.RLock()
	defer config.RUnlock()

	conf := config.TLS

	return conf.clone()
}

func withPanelRequestContext(ctx context.Context, reqPath string, prefix string) context.Context {
	ctx = context.WithValue(ctx, panelRequestPathKey{}, reqPath)

	return context.WithValue(ctx, panelRequestPrefixKey{}, prefix)
}

func originalPanelRequestPath(r *http.Request) (reqPath string) {
	reqPath, _ = r.Context().Value(panelRequestPathKey{}).(string)
	if reqPath == "" {
		return r.URL.Path
	}

	return reqPath
}

func panelRequestPrefix(r *http.Request) (prefix string) {
	prefix, _ = r.Context().Value(panelRequestPrefixKey{}).(string)
	if prefix == "" {
		return defaultPanelServerURLPath
	}

	return prefix
}

func panelURLForRequest(r *http.Request, target string) (location string) {
	prefix := panelRequestPrefix(r)
	if target == "" || target == "/" {
		if prefix == defaultPanelServerURLPath {
			return "/"
		}

		return prefix + "/"
	}

	if prefix == defaultPanelServerURLPath {
		return target
	}

	return prefix + target
}

func (web *webAPI) wrapPanelHandler(h http.Handler) (wrapped http.Handler) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tlsConf := currentTLSSettings(web.tlsManager)
		panelPath := effectivePanelServerURLPath(tlsConf)
		if panelPath == defaultPanelServerURLPath {
			h.ServeHTTP(w, r)

			return
		}

		reqPath := r.URL.Path
		if shouldServeDoHOnPanelWeb(tlsConf) && matchesCurrentDoHPath(reqPath, tlsConf) {
			h.ServeHTTP(w, r)

			return
		}

		if reqPath == panelPath {
			u := *r.URL
			u.Path = panelPath + "/"
			u.RawPath = u.Path
			http.Redirect(w, r, u.String(), http.StatusPermanentRedirect)

			return
		}

		if !strings.HasPrefix(reqPath, panelPath+"/") {
			delayNotFound(r.Context(), w)

			return
		}

		clone := r.Clone(withPanelRequestContext(r.Context(), reqPath, panelPath))
		u := *r.URL
		u.Path = strings.TrimPrefix(reqPath, panelPath)
		if u.Path == "" {
			u.Path = "/"
		}

		if u.RawPath != "" {
			u.RawPath = strings.TrimPrefix(u.RawPath, panelPath)
			if u.RawPath == "" {
				u.RawPath = "/"
			}
		}

		if shouldServeDoHOnPanelWeb(tlsConf) && matchesCurrentDoHPath(u.Path, tlsConf) {
			delayNotFound(r.Context(), w)

			return
		}

		clone.URL = &u
		h.ServeHTTP(w, clone)
	})
}

func delayNotFound(ctx context.Context, w http.ResponseWriter) {
	timer := time.NewTimer(panelPathInvalidDelay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return
	case <-timer.C:
	}

	h := w.Header()
	h.Set(httphdr.ContentType, "text/html")
	w.WriteHeader(http.StatusNotFound)
	_, _ = w.Write([]byte(nginx404Page))
}

type doHWebBridgeHandler struct{}

func (doHWebBridgeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var tlsMgr *tlsManager
	if globalContext.web != nil {
		tlsMgr = globalContext.web.tlsManager
	}

	tlsConf := currentTLSSettings(tlsMgr)
	if !shouldServeDoHOnPanelWeb(tlsConf) || !matchesCurrentDoHPath(r.URL.Path, tlsConf) {
		http.NotFound(w, r)

		return
	}

	if globalContext.dnsServer == nil {
		http.Error(w, http.StatusText(http.StatusServiceUnavailable), http.StatusServiceUnavailable)

		return
	}

	globalContext.dnsServer.ServeHTTP(w, r)
}

var doHRouteRegistry struct {
	mu     sync.Mutex
	mux    *http.ServeMux
	routes map[string]struct{}
}

func registerDoHBridgeHandlers(routes []string) {
	if globalContext.web == nil || globalContext.web.conf == nil || globalContext.web.conf.mux == nil {
		return
	}

	mux := globalContext.web.conf.mux

	doHRouteRegistry.mu.Lock()
	defer doHRouteRegistry.mu.Unlock()

	if doHRouteRegistry.mux != mux {
		doHRouteRegistry.mux = mux
		doHRouteRegistry.routes = map[string]struct{}{}
	}

	for _, route := range routes {
		if _, ok := doHRouteRegistry.routes[route]; ok {
			continue
		}

		mux.Handle(route, doHWebBridgeHandler{})
		doHRouteRegistry.routes[route] = struct{}{}
	}
}
