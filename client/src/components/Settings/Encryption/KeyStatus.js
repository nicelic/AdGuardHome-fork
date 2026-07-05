import React, { Fragment } from 'react';
import { withTranslation, Trans } from 'react-i18next';
const KeyStatus = ({ validKey, keyType }) => (React.createElement(Fragment, null,
    React.createElement("div", { className: "form__label form__label--bold" },
        React.createElement(Trans, null, "encryption_status"),
        ":"),
    React.createElement("ul", { className: "encryption__list" },
        React.createElement("li", { className: validKey ? 'text-success' : 'text-danger' }, validKey ? (React.createElement(Trans, { values: { type: keyType } }, "encryption_key_valid")) : (React.createElement(Trans, { values: { type: keyType } }, "encryption_key_invalid"))))));
export default withTranslation()(KeyStatus);
