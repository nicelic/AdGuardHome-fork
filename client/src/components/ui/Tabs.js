import React from 'react';
import classnames from 'classnames';
import Tab from './Tab';
import './Tabs.css';
const Tabs = (props) => {
    const { tabs, controlClass, activeTabLabel, setActiveTabLabel, children: activeTab } = props;
    const onClickTabControl = (tabLabel) => setActiveTabLabel(tabLabel);
    const getControlClass = classnames({
        tabs__controls: true,
        [`tabs__controls--${controlClass}`]: controlClass,
    });
    return (React.createElement("div", { className: "tabs" },
        React.createElement("div", { className: getControlClass }, Object.values(tabs).map((props) => {
            // eslint-disable-next-line react/prop-types
            const { title, label = title } = props;
            return (React.createElement(Tab, { key: label, label: label, title: title, activeTabLabel: activeTabLabel, onClick: onClickTabControl }));
        })),
        React.createElement("div", { className: "tabs__content" }, activeTab)));
};
export default Tabs;
