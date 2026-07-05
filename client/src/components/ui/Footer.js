import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import cn from 'classnames';
import { REPOSITORY, PRIVACY_POLICY_LINK, THEMES } from '../../helpers/constants';
import { LANGUAGES } from '../../helpers/twosky';
import i18n from '../../i18n';
import Version from './Version';
import './Footer.css';
import './Select.css';
import { setHtmlLangAttr, setUITheme } from '../../helpers/helpers';
import { changeLanguage, changeTheme } from '../../actions';
const linksData = [
    {
        href: REPOSITORY.URL,
        name: 'homepage',
    },
    {
        href: PRIVACY_POLICY_LINK,
        name: 'privacy_policy',
    },
    {
        href: REPOSITORY.ISSUES,
        className: 'btn btn-outline-primary btn-sm footer__link--report',
        name: 'report_an_issue',
    },
];
const Footer = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const currentTheme = useSelector((state) => (state.dashboard ? state.dashboard.theme : THEMES.auto));
    const profileName = useSelector((state) => (state.dashboard ? state.dashboard.name : ''));
    const isLoggedIn = profileName !== '';
    const [currentThemeLocal, setCurrentThemeLocal] = useState(THEMES.auto);
    const getYear = () => {
        const today = new Date();
        return today.getFullYear();
    };
    const onLanguageChange = (language) => {
        i18n.changeLanguage(language);
        setHtmlLangAttr(language);
        if (isLoggedIn) {
            dispatch(changeLanguage(language));
        }
    };
    const onThemeChange = (value) => {
        if (isLoggedIn) {
            dispatch(changeTheme(value));
        }
        else {
            setUITheme(value);
            setCurrentThemeLocal(value);
        }
    };
    const renderCopyright = () => (React.createElement("div", { className: "footer__column" },
        React.createElement("div", { className: "footer__copyright" },
            t('copyright'),
            " \u00A9 ",
            getYear(),
            ' ',
            React.createElement("a", { target: "_blank", rel: "noopener noreferrer", href: "https://link.adtidy.org/forward.html?action=home&from=ui&app=home" }, "AdGuard"))));
    const renderLinks = (linksData) => linksData.map(({ name, href, className = '' }) => (React.createElement("a", { key: name, href: href, className: cn('footer__link', className), target: "_blank", rel: "noopener noreferrer" }, t(name))));
    const renderThemeButtons = () => {
        const currentValue = isLoggedIn ? currentTheme : currentThemeLocal;
        const content = {
            auto: {
                desc: t('theme_auto_desc'),
                icon: '#auto',
                testId: 'theme_auto',
            },
            dark: {
                desc: t('theme_dark_desc'),
                icon: '#dark',
                testId: 'theme_dark',
            },
            light: {
                desc: t('theme_light_desc'),
                icon: '#light',
                testId: 'theme_light',
            },
        };
        return Object.values(THEMES)
            .map((theme) => (React.createElement("button", { key: theme, type: "button", className: "btn btn-sm btn-secondary footer__theme-button", onClick: () => onThemeChange(theme), title: content[theme].desc, "data-testid": content[theme].testId },
            React.createElement("svg", { className: cn('footer__theme-icon', { 'footer__theme-icon--active': currentValue === theme }) },
                React.createElement("use", { xlinkHref: content[theme].icon })))));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("footer", { className: "footer" },
            React.createElement("div", { className: "container" },
                React.createElement("div", { className: "footer__row" },
                    React.createElement("div", { className: "footer__column footer__column--links" }, renderLinks(linksData)),
                    React.createElement("div", { className: "footer__column footer__column--theme" },
                        React.createElement("div", { className: "footer__themes" },
                            React.createElement("div", { className: "btn-group" }, renderThemeButtons()))),
                    React.createElement("div", { className: "footer__column footer__column--language" },
                        React.createElement("select", { className: "form-control select select--language", value: i18n.language, onChange: (e) => onLanguageChange(e.target.value) }, Object.keys(LANGUAGES).map((lang) => (React.createElement("option", { key: lang, value: lang }, LANGUAGES[lang])))))))),
        React.createElement("div", { className: "footer" },
            React.createElement("div", { className: "container" },
                React.createElement("div", { className: "footer__row" },
                    renderCopyright(),
                    React.createElement("div", { className: "footer__column footer__column--language" },
                        React.createElement(Version, null)))))));
};
export default Footer;
