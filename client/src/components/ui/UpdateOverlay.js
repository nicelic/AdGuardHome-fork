import React from 'react';
import { Trans } from 'react-i18next';
import classnames from 'classnames';
import { useSelector } from 'react-redux';
import './Overlay.css';
const UpdateOverlay = () => {
    const processingUpdate = useSelector((state) => state.dashboard.processingUpdate);
    const overlayClass = classnames('overlay', {
        'overlay--visible': processingUpdate,
    });
    return (React.createElement("div", { className: overlayClass },
        React.createElement("div", { className: "overlay__loading" }),
        React.createElement(Trans, null, "processing_update")));
};
export default UpdateOverlay;
