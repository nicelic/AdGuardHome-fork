import React from 'react';
import './PageTitle.css';
const PageTitle = ({ title, subtitle, children, containerClass }) => (React.createElement("div", { className: "page-header" },
    React.createElement("div", { className: containerClass },
        React.createElement("h1", { className: "page-title pr-2" }, title),
        children),
    subtitle && React.createElement("div", { className: "page-subtitle" }, subtitle)));
export default PageTitle;
