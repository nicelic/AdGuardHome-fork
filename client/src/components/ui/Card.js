import React from 'react';
import './Card.css';
const Card = ({ type, id, title, subtitle, refresh, bodyType, children }) => (React.createElement("div", { className: type ? `card ${type}` : 'card', id: id || '' },
    (title || subtitle) && (React.createElement("div", { className: "card-header with-border" },
        React.createElement("div", { className: "card-inner" },
            title && React.createElement("div", { className: "card-title" }, title),
            subtitle && React.createElement("div", { className: "card-subtitle", dangerouslySetInnerHTML: { __html: subtitle } })),
        refresh && React.createElement("div", { className: "card-options" }, refresh))),
    React.createElement("div", { className: bodyType || 'card-body' }, children)));
export default Card;
