import React from 'react';
import Tooltip from '../../ui/Tooltip';
export const SearchField = ({ handleChange, onClear, value, tooltip, className, ...rest }) => {
    const handleInputChange = (e) => {
        handleChange(e.target.value);
    };
    const handleBlur = (e) => {
        e.target.value = e.target.value.trim();
        handleChange(e.target.value);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "input-group-search input-group-search__icon--magnifier" },
            React.createElement("svg", { className: "icons icon--24 icon--gray" },
                React.createElement("use", { xlinkHref: "#magnifier" }))),
        React.createElement("input", { className: className, value: value, onChange: handleInputChange, onBlur: handleBlur, ...rest }),
        typeof value === 'string' && value.length > 0 && (React.createElement("div", { className: "input-group-search input-group-search__icon--cross", onClick: onClear },
            React.createElement("svg", { className: "icons icon--20 icon--gray" },
                React.createElement("use", { xlinkHref: "#cross" })))),
        tooltip && (React.createElement("span", { className: "input-group-search input-group-search__icon--tooltip" },
            React.createElement(Tooltip, { content: tooltip, className: "tooltip-container" },
                React.createElement("svg", { className: "icons icon--20 icon--gray" },
                    React.createElement("use", { xlinkHref: "#question" })))))));
};
