import React from 'react';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
const Tab = ({ activeTabLabel, label, title, onClick }) => {
    const [t] = useTranslation();
    const handleClick = () => onClick(label);
    const tabClass = classnames({
        tab__control: true,
        'tab__control--active': activeTabLabel === label,
    });
    return (React.createElement("div", { className: tabClass, onClick: handleClick },
        React.createElement("svg", { className: "tab__icon" },
            React.createElement("use", { xlinkHref: `#${label.toLowerCase()}` })),
        t(title || label)));
};
export default Tab;
