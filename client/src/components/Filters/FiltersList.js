import React from 'react';
import classNames from 'classnames';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../ui/Controls/Checkbox';
const getIconsData = (homepage, source) => [
    {
        iconName: 'dashboard',
        href: homepage,
        className: 'ml-1',
    },
    {
        iconName: 'info',
        href: source,
    },
];
const renderIcons = (iconsData) => iconsData.map(({ iconName, href, className = '' }) => (React.createElement("a", { key: iconName, href: href, target: "_blank", rel: "noopener noreferrer", className: classNames('d-flex align-items-center', className) },
    React.createElement("svg", { className: "icon icon--15 mr-1 icon--gray" },
        React.createElement("use", { xlinkHref: `#${iconName}` })))));
export const FiltersList = ({ categories, filters, selectedSources }) => {
    const { t } = useTranslation();
    const { control } = useFormContext();
    return (React.createElement(React.Fragment, null, Object.entries(categories).map(([categoryId, category]) => {
        const categoryFilters = Object.entries(filters)
            .filter(([, filter]) => filter.categoryId === categoryId)
            .map(([key, filter]) => ({ ...filter, id: key }));
        return (React.createElement("div", { key: category.name, className: "modal-body__item" },
            React.createElement("h6", { className: "font-weight-bold mb-1" }, t(category.name)),
            React.createElement("p", { className: "mb-3" }, t(category.description)),
            categoryFilters.map((filter) => {
                const { homepage, source, name, id } = filter;
                const isSelected = selectedSources[source];
                const iconsData = getIconsData(homepage, source);
                return (React.createElement("div", { key: name, className: "d-flex align-items-center pb-1" },
                    React.createElement(Controller, { name: id, control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": `filters_${id}`, title: name, disabled: isSelected })) }),
                    renderIcons(iconsData)));
            })));
    })));
};
