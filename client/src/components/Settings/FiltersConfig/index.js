import React, { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { toNumber } from '../../../helpers/form';
import { DAY, FILTERS_INTERVALS_HOURS, FILTERS_RELATIVE_LINK } from '../../../helpers/constants';
import { Checkbox } from '../../ui/Controls/Checkbox';
import { Select } from '../../ui/Controls/Select';
const THREE_DAYS_INTERVAL = DAY * 3;
const SEVEN_DAYS_INTERVAL = DAY * 7;
const getTitleForInterval = (interval) => {
    if (interval === 0) {
        return i18next.t('disabled');
    }
    if (interval === THREE_DAYS_INTERVAL || interval === SEVEN_DAYS_INTERVAL) {
        return i18next.t('interval_days', { count: interval / DAY });
    }
    return i18next.t('interval_hours', { count: interval });
};
export const FiltersConfig = ({ initialValues, setFiltersConfig, processing }) => {
    const { t } = useTranslation();
    const prevFormValuesRef = useRef(initialValues);
    const { watch, control } = useForm({
        mode: 'onBlur',
        defaultValues: initialValues,
    });
    const formValues = watch();
    useEffect(() => {
        const prevFormValues = prevFormValuesRef.current;
        if (JSON.stringify(prevFormValues) !== JSON.stringify(formValues)) {
            setFiltersConfig(formValues);
            prevFormValuesRef.current = formValues;
        }
    }, [formValues]);
    const components = {
        a: React.createElement("a", { href: FILTERS_RELATIVE_LINK, rel: "noopener noreferrer" }),
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-12" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "enabled", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "filters_enabled", title: t('block_domain_use_filters_and_hosts'), disabled: processing })) }),
                    React.createElement("p", null,
                        React.createElement(Trans, { components: components }, "filters_block_toggle_hint")))),
            React.createElement("div", { className: "col-12 col-md-5" },
                React.createElement("div", { className: "form__group form__group--inner mb-5" },
                    React.createElement("label", { className: "form__label" },
                        React.createElement(Trans, null, "filters_interval")),
                    React.createElement(Controller, { name: "interval", control: control, render: ({ field }) => (React.createElement(Select, { ...field, "data-testid": "filters_interval", disabled: processing, onChange: (e) => {
                                const { value } = e.target;
                                field.onChange(toNumber(value));
                            } }, FILTERS_INTERVALS_HOURS.map((interval) => (React.createElement("option", { value: interval, key: interval }, getTitleForInterval(interval)))))) }))))));
};
