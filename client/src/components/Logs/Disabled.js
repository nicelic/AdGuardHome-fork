import React, { Fragment } from 'react';
import { Trans } from 'react-i18next';
import { HashLink as Link } from 'react-router-hash-link';
import Card from '../ui/Card';
const Disabled = () => (React.createElement(Fragment, null,
    React.createElement("div", { className: "page-header" },
        React.createElement("h1", { className: "page-title page-title--large" },
            React.createElement(Trans, null, "query_log"))),
    React.createElement(Card, null,
        React.createElement("div", { className: "lead text-center py-6" },
            React.createElement(Trans, { components: [
                    React.createElement(Link, { to: "/settings#logs-config", key: "0" }, "link"),
                ] }, "query_log_disabled")))));
export default Disabled;
