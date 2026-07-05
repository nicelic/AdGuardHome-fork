import React from 'react';
import { Trans, withTranslation } from 'react-i18next';
import Controls from './Controls';
const Greeting = () => (React.createElement("div", { className: "setup__step" },
    React.createElement("div", { className: "setup__group" },
        React.createElement("h1", { className: "setup__title" },
            React.createElement(Trans, null, "install_welcome_title")),
        React.createElement("p", { className: "setup__desc text-center" },
            React.createElement(Trans, null, "install_welcome_desc"))),
    React.createElement(Controls, null)));
export default withTranslation()(Greeting);
