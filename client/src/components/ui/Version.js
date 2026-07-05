import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { getVersion } from '../../actions';
import './Version.css';
const Version = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const dashboard = useSelector((state) => state.dashboard, shallowEqual);
    const install = useSelector((state) => state.install, shallowEqual);
    if (!dashboard && !install) {
        return null;
    }
    const version = dashboard?.dnsVersion || install?.dnsVersion;
    const onClick = () => {
        dispatch(getVersion(true));
    };
    return (React.createElement("div", { className: "version" },
        React.createElement("div", { className: "version__text" },
            version && (React.createElement(React.Fragment, null,
                React.createElement(Trans, null, "version"),
                ":\u00A0",
                React.createElement("span", { className: "version__value", title: version }, version))),
            dashboard?.checkUpdateFlag && (React.createElement("button", { type: "button", className: "btn btn-icon btn-icon-sm btn-outline-primary btn-sm ml-2", onClick: onClick, disabled: dashboard?.processingVersion, title: t('check_updates_now') },
                React.createElement("svg", { className: "icons icon12" },
                    React.createElement("use", { xlinkHref: "#refresh" })))))));
};
export default Version;
