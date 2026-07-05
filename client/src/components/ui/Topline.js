import React from 'react';
import './Topline.css';
const Topline = (props) => (React.createElement("div", { className: `alert alert-${props.type} topline` },
    React.createElement("div", { className: "container" }, props.children)));
export default Topline;
