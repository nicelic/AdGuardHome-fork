import React, { Component } from 'react';
import classnames from 'classnames';
import { withTranslation } from 'react-i18next';
import enhanceWithClickOutside from 'react-click-outside';
import './Dropdown.css';
class Dropdown extends Component {
    state = {
        isOpen: false,
    };
    toggleDropdown = () => {
        this.setState((prevState) => ({ isOpen: !prevState.isOpen }));
    };
    hideDropdown = () => {
        this.setState({ isOpen: false });
    };
    handleClickOutside = () => {
        if (this.state.isOpen) {
            this.hideDropdown();
        }
    };
    render() {
        const { label, controlClassName, menuClassName = 'dropdown-menu dropdown-menu-arrow', baseClassName = 'dropdown', icon, children, } = this.props;
        const { isOpen } = this.state;
        const dropdownClass = classnames({
            [baseClassName]: true,
            show: isOpen,
        });
        const dropdownMenuClass = classnames({
            [menuClassName]: true,
            show: isOpen,
        });
        const ariaSettings = isOpen ? 'true' : 'false';
        return (React.createElement("div", { className: dropdownClass },
            React.createElement("a", { className: controlClassName, "aria-expanded": ariaSettings, onClick: this.toggleDropdown },
                icon && (React.createElement("svg", { className: "nav-icon" },
                    React.createElement("use", { xlinkHref: `#${icon}` }))),
                label),
            React.createElement("div", { className: dropdownMenuClass, onClick: this.hideDropdown }, children)));
    }
}
export default withTranslation()(enhanceWithClickOutside(Dropdown));
