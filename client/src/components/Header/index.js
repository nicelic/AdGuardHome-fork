import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { shallowEqual, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import Menu from './Menu';
import { Logo } from '../ui/svg/logo';
import './Header.css';
const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { t } = useTranslation();
    const { protectionEnabled, processing, isCoreRunning, processingProfile, name } = useSelector((state) => state.dashboard, shallowEqual);
    const { pathname } = useLocation();
    const toggleMenuOpen = () => {
        setIsMenuOpen((isMenuOpen) => !isMenuOpen);
    };
    const closeMenu = () => {
        setIsMenuOpen(false);
    };
    const badgeClass = classnames('badge dns-status', {
        'badge-success': protectionEnabled,
        'badge-danger': !protectionEnabled,
    });
    return (React.createElement("div", { className: "header" },
        React.createElement("div", { className: "header__container" },
            React.createElement("div", { className: "header__row" },
                React.createElement("div", { className: "header-toggler d-lg-none ml-lg-0 collapsed", onClick: toggleMenuOpen },
                    React.createElement("span", { className: "header-toggler-icon" })),
                React.createElement("div", { className: "header__column" },
                    React.createElement("div", { className: "d-flex align-items-center" },
                        React.createElement(Link, { to: "/", className: "nav-link pl-0 pr-1" },
                            React.createElement(Logo, { className: "header-brand-img" })),
                        !processing && isCoreRunning && (React.createElement("span", { className: badgeClass }, t(protectionEnabled ? 'on' : 'off'))))),
                React.createElement(Menu, { pathname: pathname, isMenuOpen: isMenuOpen, closeMenu: closeMenu }),
                React.createElement("div", { className: "header__column" },
                    React.createElement("div", { className: "header__right" }, !processingProfile && name && (React.createElement("a", { href: "control/logout", className: "btn btn-sm btn-outline-secondary", "data-testid": "sign_out" }, t('sign_out')))))))));
};
export default Header;
