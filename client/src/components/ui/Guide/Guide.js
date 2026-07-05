import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { useSelector } from 'react-redux';
import { MOBILE_CONFIG_LINKS } from '../../../helpers/constants';
import Tabs from '../Tabs';
import { MobileConfigForm } from './MobileConfigForm';
const renderLi = ({ label, components }) => (React.createElement("li", { key: label },
    React.createElement(Trans, { components: components?.map((props) => {
            if (React.isValidElement(props)) {
                return props;
            }
            const {
            // eslint-disable-next-line react/prop-types
            href, target = '_blank', rel = 'noopener noreferrer', key = '0', } = props;
            return (React.createElement("a", { href: href, target: target, rel: rel, key: key }, "link"));
        }) }, label)));
const getDnsPrivacyList = () => [
    {
        title: 'Android',
        list: [
            {
                label: 'setup_dns_privacy_android_1',
            },
            {
                label: 'setup_dns_privacy_android_2',
                components: [
                    {
                        key: 0,
                        href: 'https://link.adtidy.org/forward.html?action=android&from=ui&app=home',
                    },
                    React.createElement("code", { key: "1" }, "text"),
                ],
            },
            {
                label: 'setup_dns_privacy_android_3',
                components: [
                    {
                        key: 0,
                        href: 'https://getintra.org/',
                    },
                    React.createElement("code", { key: "1" }, "text"),
                ],
            },
        ],
    },
    {
        title: 'iOS',
        list: [
            {
                label: 'setup_dns_privacy_ios_2',
                components: [
                    {
                        key: 0,
                        href: 'https://link.adtidy.org/forward.html?action=ios&from=ui&app=home',
                    },
                    React.createElement("code", { key: "1" }, "text"),
                ],
            },
            {
                label: 'setup_dns_privacy_ios_1',
                components: [
                    {
                        key: 0,
                        href: 'https://itunes.apple.com/app/id1452162351',
                    },
                    React.createElement("code", { key: "1" }, "text"),
                    {
                        key: 2,
                        href: 'https://dnscrypt.info/stamps',
                    },
                ],
            },
        ],
    },
    {
        title: 'setup_dns_privacy_other_title',
        list: [
            {
                label: 'setup_dns_privacy_other_1',
            },
            {
                label: 'setup_dns_privacy_other_2',
                components: [
                    {
                        key: 0,
                        href: 'https://github.com/AdguardTeam/dnsproxy',
                    },
                ],
            },
            {
                href: 'https://github.com/jedisct1/dnscrypt-proxy',
                label: 'setup_dns_privacy_other_3',
                components: [
                    {
                        key: 0,
                        href: 'https://github.com/jedisct1/dnscrypt-proxy',
                    },
                    React.createElement("code", { key: "1" }, "text"),
                ],
            },
            {
                label: 'setup_dns_privacy_other_4',
                components: [
                    {
                        key: 0,
                        href: 'https://support.mozilla.org/kb/firefox-dns-over-https',
                    },
                    React.createElement("code", { key: "1" }, "text"),
                ],
            },
            {
                label: 'setup_dns_privacy_other_5',
                components: [
                    {
                        key: 0,
                        href: 'https://dnscrypt.info/implementations',
                    },
                    {
                        key: 1,
                        href: 'https://dnsprivacy.org/wiki/display/DP/DNS+Privacy+Clients',
                    },
                ],
            },
        ],
    },
];
const renderDnsPrivacyList = ({ title, list }) => (React.createElement("div", { className: "tab__paragraph", key: title },
    React.createElement("strong", null,
        React.createElement(Trans, null, title)),
    React.createElement("ul", null, list.map(({ label, components, renderComponent = renderLi }) => renderComponent({ label, components })))));
const getTabs = ({ tlsAddress, httpsAddress, showDnsPrivacyNotice, serverName, portHttps, t }) => ({
    Router: {
        // eslint-disable-next-line react/display-name
        getTitle: () => (React.createElement("p", null,
            React.createElement(Trans, null, "install_devices_router_desc"))),
        title: 'Router',
        list: [
            'install_devices_router_list_1',
            'install_devices_router_list_2',
            'install_devices_router_list_3',
            // eslint-disable-next-line react/jsx-key
            React.createElement(Trans, { components: [
                    React.createElement("a", { href: "#dhcp", key: "0" }, "link"),
                ] }, "install_devices_router_list_4"),
        ],
    },
    Windows: {
        title: 'Windows',
        list: [
            'install_devices_windows_list_1',
            'install_devices_windows_list_2',
            'install_devices_windows_list_3',
            'install_devices_windows_list_4',
            'install_devices_windows_list_5',
            'install_devices_windows_list_6',
        ],
    },
    macOS: {
        title: 'macOS',
        list: [
            'install_devices_macos_list_1',
            'install_devices_macos_list_2',
            'install_devices_macos_list_3',
            'install_devices_macos_list_4',
        ],
    },
    Android: {
        title: 'Android',
        list: [
            'install_devices_android_list_1',
            'install_devices_android_list_2',
            'install_devices_android_list_3',
            'install_devices_android_list_4',
            'install_devices_android_list_5',
        ],
    },
    iOS: {
        title: 'iOS',
        list: [
            'install_devices_ios_list_1',
            'install_devices_ios_list_2',
            'install_devices_ios_list_3',
            'install_devices_ios_list_4',
        ],
    },
    dns_privacy: {
        title: 'dns_privacy',
        getTitle: function Title() {
            return (React.createElement("div", { title: t('dns_privacy') },
                React.createElement("div", { className: "tab__text" },
                    tlsAddress?.length > 0 && (React.createElement("div", { className: "tab__paragraph" },
                        React.createElement(Trans, { values: { address: tlsAddress[0] }, components: [React.createElement("strong", { key: "0" }, "text"), React.createElement("code", { key: "1" }, "text")] }, "setup_dns_privacy_1"))),
                    httpsAddress?.length > 0 && (React.createElement("div", { className: "tab__paragraph" },
                        React.createElement(Trans, { values: { address: httpsAddress[0] }, components: [React.createElement("strong", { key: "0" }, "text"), React.createElement("code", { key: "1" }, "text")] }, "setup_dns_privacy_2"))),
                    showDnsPrivacyNotice ? (React.createElement("div", { className: "tab__paragraph" },
                        React.createElement(Trans, { components: [
                                React.createElement("a", { href: "https://github.com/AdguardTeam/AdguardHome/wiki/Encryption", target: "_blank", rel: "noopener noreferrer", key: "0" }, "link"),
                                React.createElement("code", { key: "1" }, "text"),
                            ] }, "setup_dns_notice"))) : (React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "tab__paragraph" },
                            React.createElement(Trans, { components: [React.createElement("p", { key: "0" }, "text")] }, "setup_dns_privacy_3")),
                        getDnsPrivacyList().map(renderDnsPrivacyList),
                        React.createElement("div", null,
                            React.createElement("strong", null,
                                React.createElement(Trans, null, "setup_dns_privacy_ioc_mac"))),
                        React.createElement("div", { className: "mb-3" },
                            React.createElement(Trans, { components: { highlight: React.createElement("code", null) } }, "setup_dns_privacy_4")),
                        React.createElement(MobileConfigForm, { initialValues: {
                                host: serverName,
                                clientId: '',
                                protocol: MOBILE_CONFIG_LINKS.DOH,
                                port: portHttps,
                            } }))))));
        },
    },
});
const renderContent = ({ title, list, getTitle }) => (React.createElement("div", { title: i18next.t(title) },
    React.createElement("div", { className: "tab__title" }, i18next.t(title)),
    React.createElement("div", { className: "tab__text" },
        getTitle?.(),
        list && (React.createElement("ol", null, list.map((item) => (React.createElement("li", { key: item },
            React.createElement(Trans, null, item)))))))));
export const Guide = ({ dnsAddresses }) => {
    const { t } = useTranslation();
    const serverName = useSelector((state) => state.encryption?.server_name);
    const portHttps = useSelector((state) => state.encryption?.port_https);
    const tlsAddress = dnsAddresses?.filter((item) => item.includes('tls://')) ?? '';
    const httpsAddress = dnsAddresses?.filter((item) => item.includes('https://')) ?? '';
    const showDnsPrivacyNotice = httpsAddress.length < 1 && tlsAddress.length < 1;
    const [activeTabLabel, setActiveTabLabel] = useState('Router');
    const tabs = getTabs({
        tlsAddress,
        httpsAddress,
        showDnsPrivacyNotice,
        serverName,
        portHttps,
        t,
    });
    const activeTab = renderContent(tabs[activeTabLabel]);
    return (React.createElement("div", null,
        React.createElement(Tabs, { tabs: tabs, activeTabLabel: activeTabLabel, setActiveTabLabel: setActiveTabLabel }, activeTab)));
};
Guide.defaultProps = {
    dnsAddresses: [],
};
