import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Controller, useForm } from 'react-hook-form';
import Card from '../../ui/Card';
import Info from './Info';
import { validateRequiredValue } from '../../../helpers/validators';
import { Input } from '../../ui/Controls/Input';
import { DNS_RECORD_TYPES } from '../../../helpers/constants';
import { Select } from '../../ui/Controls/Select';
const Check = ({ onSubmit }) => {
    const { t } = useTranslation();
    const processingCheck = useSelector((state) => state.filtering.processingCheck);
    const hostname = useSelector((state) => state.filtering.check.hostname);
    const { control, handleSubmit, formState: { isValid }, } = useForm({
        mode: 'onBlur',
        defaultValues: {
            name: '',
            client: '',
            qtype: DNS_RECORD_TYPES[0],
        },
    });
    return (React.createElement(Card, { title: t('check_title'), subtitle: t('check_desc') },
        React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
            React.createElement("div", { className: "row" },
                React.createElement("div", { className: "col-12 col-md-6" },
                    React.createElement(Controller, { name: "name", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", label: t('check_hostname'), "data-testid": "check_domain_name", placeholder: "example.com", error: fieldState.error?.message })) }),
                    React.createElement(Controller, { name: "client", control: control, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "check_client_id", label: t('check_client_id'), placeholder: t('check_enter_client_id'), error: fieldState.error?.message })) }),
                    React.createElement(Controller, { name: "qtype", control: control, render: ({ field }) => (React.createElement(Select, { ...field, label: t('check_dns_record'), "data-testid": "check_dns_record_type" }, DNS_RECORD_TYPES.map((type) => (React.createElement("option", { key: type, value: type }, type))))) }),
                    React.createElement("button", { className: "btn btn-success btn-standard btn-large", type: "submit", "data-testid": "check_domain_submit", disabled: !isValid || processingCheck }, t('check')),
                    hostname && (React.createElement(React.Fragment, null,
                        React.createElement("hr", null),
                        React.createElement(Info, null))))))));
};
export default Check;
