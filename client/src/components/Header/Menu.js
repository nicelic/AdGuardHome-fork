import React, { Component } from 'react';
import { NavLink } from 'react-router-dom';
import enhanceWithClickOutside from 'react-click-outside';
import classnames from 'classnames';
import { Trans, withTranslation } from 'react-i18next';
import { SETTINGS_URLS, FILTERS_URLS, MENU_URLS } from '../../helpers/constants';
import Dropdown from '../ui/Dropdown';
const MENU_ITEMS = [
    {
        route: MENU_URLS.root,
        exact: true,
        icon: 'dashboard',
        text: 'dashboard',
        order: 0,
    },
    // Settings dropdown should have visual order 1
    // Filters dropdown should have visual order 2
    {
        route: MENU_URLS.logs,
        icon: 'log',
        text: 'query_log',
        order: 3,
    },
    {
        route: MENU_URLS.guide,
        icon: 'setup',
        text: 'setup_guide',
        order: 4,
    },
];
const SETTINGS_ITEMS = [
    {
        route: SETTINGS_URLS.settings,
        text: 'general_settings',
    },
    {
        route: SETTINGS_URLS.dns,
        text: 'dns_settings',
    },
    {
        route: SETTINGS_URLS.encryption,
        text: 'encryption_settings',
    },
    {
        route: SETTINGS_URLS.clients,
        text: 'client_settings',
    },
    {
        route: SETTINGS_URLS.dhcp,
        text: 'dhcp_settings',
    },
    {
        route: SETTINGS_URLS.admin,
        text: 'admin_settings',
    },
];
const FILTERS_ITEMS = [
    {
        route: FILTERS_URLS.dns_blocklists,
        text: 'dns_blocklists',
    },
    {
        route: FILTERS_URLS.dns_allowlists,
        text: 'dns_allowlists',
    },
    {
        route: FILTERS_URLS.dns_rewrites,
        text: 'dns_rewrites',
    },
    {
        route: FILTERS_URLS.blocked_services,
        text: 'blocked_services',
    },
    {
        route: FILTERS_URLS.custom_rules,
        text: 'custom_filtering_rules',
    },
];
class Menu extends Component {
    handleClickOutside = () => {
        this.props.closeMenu();
    };
    closeMenu = () => {
        this.props.closeMenu();
    };
    getActiveClassForDropdown = (URLS) => {
        const isActivePage = Object.values(URLS)
            .some((item) => item === this.props.pathname);
        return isActivePage ? 'active' : '';
    };
    getNavLink = ({ route, exact, text, order, className, icon }) => (React.createElement(NavLink, { to: route, key: route, exact: exact || false, className: `order-${order} ${className}`, onClick: this.closeMenu },
        icon && (React.createElement("svg", { className: "nav-icon" },
            React.createElement("use", { xlinkHref: `#${icon}` }))),
        React.createElement(Trans, null, text)));
    getDropdown = ({ label, order, URLS, icon, ITEMS }) => (React.createElement(Dropdown, { label: this.props.t(label), baseClassName: "dropdown", controlClassName: `nav-link ${this.getActiveClassForDropdown(URLS)}`, icon: icon }, ITEMS.map((item) => this.getNavLink({
        ...item,
        order,
        className: 'dropdown-item',
    }))));
    render() {
        const menuClass = classnames({
            'header__column mobile-menu': true,
            'mobile-menu--active': this.props.isMenuOpen,
        });
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: menuClass },
                React.createElement("ul", { className: "nav nav-tabs border-0 flex-column flex-lg-row flex-nowrap" },
                    MENU_ITEMS.map((item) => (React.createElement("li", { className: `nav-item order-${item.order}`, key: item.text, onClick: this.closeMenu }, this.getNavLink({
                        ...item,
                        className: 'nav-link',
                    })))),
                    React.createElement("li", { className: "nav-item order-1" }, this.getDropdown({
                        order: 1,
                        label: 'settings',
                        icon: 'settings',
                        URLS: SETTINGS_URLS,
                        ITEMS: SETTINGS_ITEMS,
                    })),
                    React.createElement("li", { className: "nav-item order-2" }, this.getDropdown({
                        order: 2,
                        label: 'filters',
                        icon: 'filters',
                        URLS: FILTERS_URLS,
                        ITEMS: FILTERS_ITEMS,
                    }))))));
    }
}
export default withTranslation()(enhanceWithClickOutside(Menu));
