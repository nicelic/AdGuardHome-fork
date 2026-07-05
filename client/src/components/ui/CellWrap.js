import React from 'react';
const CellWrap = ({ value }, formatValue, formatTitle = formatValue) => {
    if (!value) {
        return '–';
    }
    const cellValue = typeof formatValue === 'function' ? formatValue(value) : value;
    const cellTitle = typeof formatTitle === 'function' ? formatTitle(value) : value;
    return (React.createElement("div", { className: "logs__row o-hidden" },
        React.createElement("span", { className: "logs__text logs__text--full", title: cellTitle }, cellValue)));
};
export default CellWrap;
