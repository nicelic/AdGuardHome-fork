import React from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useFormContext } from 'react-hook-form';
import i18next from 'i18next';
import { captitalizeWords } from '../../../../../helpers/helpers';
import { Checkbox } from '../../../../ui/Controls/Checkbox';
const settingsCheckboxes = [
    {
        name: 'use_global_settings',
        placeholder: i18next.t('client_global_settings'),
    },
    {
        name: 'filtering_enabled',
        placeholder: i18next.t('block_domain_use_filters_and_hosts'),
    },
    {
        name: 'safebrowsing_enabled',
        placeholder: i18next.t('use_adguard_browsing_sec'),
    },
    {
        name: 'parental_enabled',
        placeholder: i18next.t('use_adguard_parental'),
    },
];
const logAndStatsCheckboxes = [
    {
        name: 'ignore_querylog',
        placeholder: i18next.t('ignore_query_log'),
    },
    {
        name: 'ignore_statistics',
        placeholder: i18next.t('ignore_statistics'),
    },
];
export const MainSettings = ({ safeSearchServices }) => {
    const { t } = useTranslation();
    const { watch, control } = useFormContext();
    const useGlobalSettings = watch('use_global_settings');
    return (React.createElement("div", { title: t('main_settings') },
        React.createElement("div", { className: "form__label--bot form__label--bold" }, t('protection_section_label')),
        settingsCheckboxes.map((setting) => (React.createElement("div", { className: "form__group", key: setting.name },
            React.createElement(Controller, { name: setting.name, control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": `clients_${setting.name}`, title: setting.placeholder, disabled: setting.name !== 'use_global_settings' ? useGlobalSettings : false })) })))),
        React.createElement("div", { className: "form__group" },
            React.createElement(Controller, { name: "safe_search.enabled", control: control, render: ({ field }) => (React.createElement(Checkbox, { "data-testid": "clients_safe_search", ...field, title: t('enforce_safe_search'), disabled: useGlobalSettings })) })),
        React.createElement("div", { className: "form__group--inner" }, Object.keys(safeSearchServices).map((searchKey) => (React.createElement("div", { key: searchKey },
            React.createElement(Controller, { name: `safe_search.${searchKey}`, control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": `clients_safe_search_${searchKey}`, title: captitalizeWords(searchKey), disabled: useGlobalSettings })) }))))),
        React.createElement("div", { className: "form__label--bold form__label--top form__label--bot" }, t('log_and_stats_section_label')),
        logAndStatsCheckboxes.map((setting) => (React.createElement("div", { className: "form__group", key: setting.name },
            React.createElement(Controller, { name: setting.name, control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": `clients_${setting.name}`, title: setting.placeholder })) }))))));
};
