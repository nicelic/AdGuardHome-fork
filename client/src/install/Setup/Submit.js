import React from 'react';
import { Trans } from 'react-i18next';
import Controls from './Controls';
export const Submit = ({ openDashboard, webConfig }) => (React.createElement("div", { className: "setup__step" },
    React.createElement("div", { className: "setup__group" },
        React.createElement("h1", { className: "setup__title" },
            React.createElement(Trans, null, "install_submit_title")),
        React.createElement("p", { className: "setup__desc" },
            React.createElement(Trans, null, "install_submit_desc"))),
    React.createElement(Controls, { openDashboard: openDashboard, ip: webConfig.ip, port: webConfig.port })));
