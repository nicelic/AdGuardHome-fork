import React from 'react';
import { Trans } from 'react-i18next';
import { INSTALL_TOTAL_STEPS } from '../../helpers/constants';
const getProgressPercent = (step) => (step / INSTALL_TOTAL_STEPS) * 100;
export const Progress = ({ step }) => (React.createElement("div", { className: "setup__progress" },
    React.createElement(Trans, null, "install_step"),
    " ",
    step,
    "/",
    INSTALL_TOTAL_STEPS,
    React.createElement("div", { className: "setup__progress-wrap" },
        React.createElement("div", { className: "setup__progress-inner", style: { width: `${getProgressPercent(step)}%` } }))));
