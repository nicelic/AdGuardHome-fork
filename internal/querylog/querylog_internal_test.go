package querylog

import (
	"net"
	"testing"

	"github.com/nicelic/AdGuardHome-fork/internal/filtering"
	"github.com/AdguardTeam/golibs/logutil/slogutil"
	"github.com/miekg/dns"
	"github.com/stretchr/testify/assert"
)

var (
	// testLogger is a common logger for tests.
	testLogger = slogutil.NewDiscardLogger()

	// testAnswerIPv4 is a test DNS answer IPv4 value.
	testAnswerIPv4 = net.IPv4(192, 0, 2, 0)

	// testClientIPv4 is a test client IPv4 value.
	testClientIPv4 = net.IPv4(192, 0, 2, 1)
)

// addTestEntry is a helper that adds an entry to l.
func addTestEntry(l *queryLog, host string, answerStr, client net.IP, reason filtering.Reason) {
	q := dns.Msg{
		Question: []dns.Question{{
			Name:   host + ".",
			Qtype:  dns.TypeA,
			Qclass: dns.ClassINET,
		}},
	}

	a := dns.Msg{
		Question: q.Question,
		Answer: []dns.RR{&dns.A{
			Hdr: dns.RR_Header{
				Name:   q.Question[0].Name,
				Rrtype: dns.TypeA,
				Class:  dns.ClassINET,
			},
			A: answerStr,
		}},
	}

	res := filtering.Result{
		ServiceName: "SomeService",
		Rules: []*filtering.ResultRule{{
			FilterListID: 1,
			Text:         "SomeRule",
		}},
		Reason:     reason,
		IsFiltered: true,
	}

	params := &AddParams{
		Question:   &q,
		Answer:     &a,
		OrigAnswer: &a,
		Result:     &res,
		Upstream:   "upstream",
		ClientIP:   client,
	}

	l.Add(params)
}

func TestAddParams_validate_clientInfo(t *testing.T) {
	base := AddParams{
		Question: &dns.Msg{
			Question: []dns.Question{{
				Name: "example.org.",
			}},
		},
		ClientIP: net.IPv4(127, 0, 0, 1),
	}

	testCases := []struct {
		name string
		in   AddParams
		want string
	}{{
		name: "valid",
		in:   base,
	}, {
		name: "valid_doh_udp",
		in: func() AddParams {
			p := base
			p.ClientProto = ClientProtoDoH
			p.ClientTransport = ClientTransportUDP

			return p
		}(),
	}, {
		name: "invalid_client_proto",
		in: func() AddParams {
			p := base
			p.ClientProto = ClientProto("dog")

			return p
		}(),
		want: `invalid client proto: "dog"`,
	}, {
		name: "invalid_client_transport",
		in: func() AddParams {
			p := base
			p.ClientTransport = ClientTransport("icmp")

			return p
		}(),
		want: `invalid client transport: "icmp"`,
	}}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.in.validate()
			if tc.want == "" {
				assert.NoError(t, err)
			} else {
				assert.EqualError(t, err, tc.want)
			}
		})
	}
}
