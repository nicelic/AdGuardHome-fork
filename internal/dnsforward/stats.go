package dnsforward

import (
	"context"
	"log/slog"
	"net"
	"time"

	"github.com/nicelic/AdGuardHome-fork/internal/aghnet"
	"github.com/nicelic/AdGuardHome-fork/internal/filtering"
	"github.com/nicelic/AdGuardHome-fork/internal/querylog"
	"github.com/nicelic/AdGuardHome-fork/internal/stats"
	"github.com/AdguardTeam/dnsproxy/proxy"
	"github.com/miekg/dns"
)

// processQueryLogsAndStats writes stats data and logs.  l and dctx must not be
// nil.
func (s *Server) processQueryLogsAndStats(
	ctx context.Context,
	l *slog.Logger,
	dctx *dnsContext,
) (rc resultCode) {
	l.DebugContext(ctx, "started processing querylog and stats")
	defer l.DebugContext(ctx, "finished processing querylog and stats")

	pctx := dctx.proxyCtx
	q := pctx.Req.Question[0]
	host := aghnet.NormalizeDomain(q.Name)
	processingTime := time.Since(dctx.startTime)

	ip := pctx.Addr.Addr().AsSlice()
	s.anonymizer.Load()(ip)
	ipStr := net.IP(ip).String()

	l.DebugContext(ctx, "client ip for stats and querylog", "ip", ipStr)

	ids := []string{ipStr}
	if dctx.clientID != "" {
		// Use the ClientID first because it has a higher priority.  Filters
		// have the same priority, see applyAdditionalFiltering.
		ids = []string{dctx.clientID, ipStr}
	}

	qt, cl := q.Qtype, q.Qclass

	// Synchronize access to s.queryLog and s.stats so they won't be suddenly
	// uninitialized while in use.  This can happen after proxy server has been
	// stopped, but its workers haven't yet exited.
	s.serverLock.RLock()
	defer s.serverLock.RUnlock()

	if s.shouldLog(host, qt, cl, ids) {
		s.logQuery(dctx, ip, processingTime)
	} else {
		l.DebugContext(
			ctx,
			"not adding to querylog",
			"dns_class", dns.Class(cl),
			"ip", ipStr,
		)
	}

	if s.shouldCountStat(host, qt, cl, ids) {
		s.updateStats(dctx, ipStr, processingTime)
	} else {
		l.DebugContext(
			ctx,
			"not counting in stats",
			"dns_class", dns.Class(cl),
			"ip", ipStr,
		)
	}

	return resultCodeSuccess
}

// shouldLog returns true if the query with the given data should be logged in
// the query log.  s.serverLock is expected to be locked.
func (s *Server) shouldLog(host string, qt, cl uint16, ids []string) (ok bool) {
	if qt == dns.TypeANY && s.conf.RefuseAny {
		return false
	}

	// TODO(s.chzhen):  Use dnsforward.dnsContext when it will start containing
	// persistent client.
	return s.queryLog != nil && s.queryLog.ShouldLog(host, qt, cl, ids)
}

// shouldCountStat returns true if the query with the given data should be
// counted in the statistics.  s.serverLock is expected to be locked.
func (s *Server) shouldCountStat(host string, qt, cl uint16, ids []string) (ok bool) {
	// TODO(s.chzhen):  Use dnsforward.dnsContext when it will start containing
	// persistent client.
	return s.stats != nil && s.stats.ShouldCount(host, qt, cl, ids)
}

// logQuery pushes the request details into the query log.
func (s *Server) logQuery(dctx *dnsContext, ip net.IP, processingTime time.Duration) {
	pctx := dctx.proxyCtx

	clientProto, clientTransport := queryLogClientInfo(pctx)
	p := &querylog.AddParams{
		Question:          pctx.Req,
		ReqECS:            pctx.ReqECS,
		Answer:            pctx.Res,
		OrigAnswer:        dctx.origResp,
		Result:            dctx.result,
		ClientID:          dctx.clientID,
		ClientIP:          ip,
		Elapsed:           processingTime,
		AuthenticatedData: dctx.responseAD,
		ClientProto:       clientProto,
		ClientTransport:   clientTransport,
	}

	if pctx.Upstream != nil {
		p.Upstream = pctx.Upstream.Address()
	}

	if qs := pctx.QueryStatistics(); qs != nil {
		ms := qs.Main()
		if len(ms) == 1 && ms[0].IsCached {
			p.Upstream = ms[0].Address
			p.Cached = true
		}
	}

	s.queryLog.Add(p)
}

// queryLogClientInfo returns the client protocol and transport used for a query
// log entry.  pctx must not be nil.
func queryLogClientInfo(
	pctx *proxy.DNSContext,
) (clientProto querylog.ClientProto, clientTransport querylog.ClientTransport) {
	switch pctx.Proto {
	case proxy.ProtoHTTPS:
		return querylog.ClientProtoDoH, queryLogDoHTransport(pctx)
	case proxy.ProtoQUIC:
		return querylog.ClientProtoDoQ, querylog.ClientTransportUDP
	case proxy.ProtoTLS:
		return querylog.ClientProtoDoT, querylog.ClientTransportTCP
	case proxy.ProtoDNSCrypt:
		return querylog.ClientProtoDNSCrypt, queryLogDNSCryptTransport(pctx)
	case proxy.ProtoTCP:
		return querylog.ClientProtoPlain, querylog.ClientTransportTCP
	case proxy.ProtoUDP:
		return querylog.ClientProtoPlain, querylog.ClientTransportUDP
	default:
		return querylog.ClientProtoPlain, querylog.ClientTransportUnknown
	}
}

// queryLogDoHTransport returns the transport used by a DoH request.
func queryLogDoHTransport(pctx *proxy.DNSContext) (transport querylog.ClientTransport) {
	if pctx.HTTPRequest != nil && pctx.HTTPRequest.ProtoMajor == 3 {
		return querylog.ClientTransportUDP
	}

	return querylog.ClientTransportTCP
}

// queryLogDNSCryptTransport returns the transport used by a DNSCrypt request.
func queryLogDNSCryptTransport(pctx *proxy.DNSContext) (transport querylog.ClientTransport) {
	if pctx.DNSCryptResponseWriter == nil {
		return querylog.ClientTransportUnknown
	}

	switch pctx.DNSCryptResponseWriter.RemoteAddr().(type) {
	case *net.TCPAddr:
		return querylog.ClientTransportTCP
	case *net.UDPAddr:
		return querylog.ClientTransportUDP
	default:
		return querylog.ClientTransportUnknown
	}
}

// updateStats writes the request data into statistics.
func (s *Server) updateStats(dctx *dnsContext, clientIP string, processingTime time.Duration) {
	pctx := dctx.proxyCtx

	var upstreamStats []*proxy.UpstreamStatistics
	qs := pctx.QueryStatistics()
	if qs != nil {
		upstreamStats = append(upstreamStats, qs.Main()...)
		upstreamStats = append(upstreamStats, qs.Fallback()...)
	}

	e := &stats.Entry{
		UpstreamStats:  upstreamStats,
		Domain:         aghnet.NormalizeDomain(pctx.Req.Question[0].Name),
		Result:         stats.RNotFiltered,
		ProcessingTime: processingTime,
	}

	if clientID := dctx.clientID; clientID != "" {
		e.Client = clientID
	} else {
		e.Client = clientIP
	}

	switch dctx.result.Reason {
	case filtering.FilteredSafeBrowsing:
		e.Result = stats.RSafeBrowsing
	case filtering.FilteredParental:
		e.Result = stats.RParental
	case filtering.FilteredSafeSearch:
		e.Result = stats.RSafeSearch
	case
		filtering.FilteredBlockList,
		filtering.FilteredInvalid,
		filtering.FilteredBlockedService:
		e.Result = stats.RFiltered
	}

	s.stats.Update(e)
}
