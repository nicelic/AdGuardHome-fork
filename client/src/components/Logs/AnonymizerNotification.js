import React from 'react';
import { Trans } from 'react-i18next';
import { HashLink as Link } from 'react-router-hash-link';
const AnonymizerNotification = () => (React.createElement("div", { className: "alert alert-primary mt-6" },
    React.createElement(Trans, { components: [
            React.createElement("strong", { key: "0" }, "text"),
            React.createElement(Link, { to: "/settings#logs-config", key: "1" }, "link"),
        ] }, "anonymizer_notification")));
export default AnonymizerNotification;
