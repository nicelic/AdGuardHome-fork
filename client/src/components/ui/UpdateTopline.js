import React from 'react';
import { Trans } from 'react-i18next';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import Topline from './Topline';
import { getUpdate } from '../../actions';
import { MANUAL_UPDATE_LINK } from '../../helpers/constants';
const UpdateTopline = () => {
    const { announcementUrl, newVersion, canAutoUpdate, processingUpdate } = useSelector((state) => state.dashboard, shallowEqual);
    const dispatch = useDispatch();
    const handleUpdate = () => {
        dispatch(getUpdate());
    };
    return (React.createElement(Topline, { type: "info" },
        React.createElement(React.Fragment, null,
            React.createElement(Trans, { values: { version: newVersion }, components: [
                    React.createElement("a", { href: announcementUrl, target: "_blank", rel: "noopener noreferrer", key: "0" }, "Click here"),
                ] }, "update_announcement"),
            "\u00A0",
            canAutoUpdate ? (React.createElement("button", { type: "button", className: "btn btn-sm btn-primary ml-3", onClick: handleUpdate, disabled: processingUpdate },
                React.createElement(Trans, null, "update_now"))) : (React.createElement(Trans, { components: {
                    a: (React.createElement("a", { href: MANUAL_UPDATE_LINK, target: "_blank", rel: "noopener noreferrer", key: "0" }, "Link")),
                } }, "manual_update")))));
};
export default UpdateTopline;
