import React, { Fragment } from 'react';
import { withTranslation, Trans } from 'react-i18next';
import format from 'date-fns/format';
import { EMPTY_DATE } from '../../../helpers/constants';
const CertificateStatus = ({ validChain, validCert, subject, issuer, notAfter, dnsNames }) => (React.createElement(Fragment, null,
    React.createElement("div", { className: "form__label form__label--bold" },
        React.createElement(Trans, null, "encryption_status"),
        ":"),
    React.createElement("ul", { className: "encryption__list" },
        React.createElement("li", { className: validChain ? 'text-success' : 'text-danger' }, validChain ? React.createElement(Trans, null, "encryption_chain_valid") : React.createElement(Trans, null, "encryption_chain_invalid")),
        validCert && (React.createElement(Fragment, null,
            subject && (React.createElement("li", null,
                React.createElement(Trans, null, "encryption_subject"),
                ":\u00A0",
                subject)),
            issuer && (React.createElement("li", null,
                React.createElement(Trans, null, "encryption_issuer"),
                ":\u00A0",
                issuer)),
            notAfter && notAfter !== EMPTY_DATE && (React.createElement("li", null,
                React.createElement(Trans, null, "encryption_expire"),
                ":\u00A0",
                format(notAfter, 'YYYY-MM-DD HH:mm:ss'))),
            dnsNames && (React.createElement("li", null,
                React.createElement(Trans, null, "encryption_hostnames"),
                ":\u00A0",
                dnsNames.join(', '))))))));
export default withTranslation()(CertificateStatus);
