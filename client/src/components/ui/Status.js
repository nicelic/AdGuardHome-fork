import React from 'react';
import { withTranslation, Trans } from 'react-i18next';
import Card from './Card';
const Status = ({ message, buttonMessage, reloadPage }) => (React.createElement("div", { className: "status" },
    React.createElement(Card, { bodyType: "card-body card-body--status" },
        React.createElement("div", { className: "h4 font-weight-light mb-4" },
            React.createElement(Trans, null, message)),
        buttonMessage && (React.createElement("button", { className: "btn btn-success", onClick: reloadPage },
            React.createElement(Trans, null, buttonMessage))))));
export default withTranslation()(Status);
