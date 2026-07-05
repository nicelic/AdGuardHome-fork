import React, { useEffect, useState } from 'react';
import { Trans } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { TOAST_TIMEOUTS } from '../../helpers/constants';
import { removeToast } from '../../actions';
const Toast = ({ id, message, type, options }) => {
    const dispatch = useDispatch();
    const [timerId, setTimerId] = useState(null);
    const clearRemoveToastTimeout = () => clearTimeout(timerId);
    const removeCurrentToast = () => dispatch(removeToast(id));
    const setRemoveToastTimeout = () => {
        const timeout = TOAST_TIMEOUTS[type];
        const timerId = setTimeout(removeCurrentToast, timeout);
        setTimerId(timerId);
    };
    useEffect(() => {
        setRemoveToastTimeout();
    }, []);
    return (React.createElement("div", { className: `toast toast--${type}`, onMouseOver: clearRemoveToastTimeout, onMouseOut: setRemoveToastTimeout },
        React.createElement("p", { className: "toast__content" },
            React.createElement(Trans, { i18nKey: message, ...options })),
        React.createElement("button", { className: "toast__dismiss", onClick: removeCurrentToast },
            React.createElement("svg", { stroke: "#fff", fill: "none", width: "20", height: "20", strokeWidth: "2", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg" },
                React.createElement("path", { d: "m18 6-12 12" }),
                React.createElement("path", { d: "m6 6 12 12" })))));
};
export default Toast;
