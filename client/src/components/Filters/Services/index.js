import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Form } from './Form';
import Card from '../../ui/Card';
import { getBlockedServices, getAllBlockedServices, updateBlockedServices } from '../../../actions/services';
import PageTitle from '../../ui/PageTitle';
import { ScheduleForm } from './ScheduleForm';
const getInitialDataForServices = (initial) => initial
    ? initial.reduce((acc, service) => {
        acc[service] = true;
        return acc;
    }, {})
    : initial;
const Services = () => {
    const [t] = useTranslation();
    const dispatch = useDispatch();
    const services = useSelector((state) => state.services);
    useEffect(() => {
        dispatch(getBlockedServices());
        dispatch(getAllBlockedServices());
    }, []);
    const handleSubmit = (values) => {
        if (!values || !values.blocked_services) {
            return;
        }
        const blocked_services = Object.keys(values.blocked_services).filter((service) => values.blocked_services[service]);
        dispatch(updateBlockedServices({
            ids: blocked_services,
            schedule: services.list.schedule,
        }));
    };
    const handleScheduleSubmit = (values) => {
        dispatch(updateBlockedServices({
            ids: services.list.ids,
            schedule: values,
        }));
    };
    const initialValues = getInitialDataForServices(services.list.ids);
    if (!initialValues) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(PageTitle, { title: t('blocked_services'), subtitle: t('blocked_services_desc') }),
        React.createElement(Card, { bodyType: "card-body box-body--settings" },
            React.createElement("div", { className: "form" },
                React.createElement(Form, { initialValues: initialValues, blockedServices: services.allServices, serviceGroups: services.allGroups, processing: services.processing, processingSet: services.processingSet, onSubmit: handleSubmit }))),
        React.createElement(Card, { title: t('schedule_services'), subtitle: t('schedule_services_desc'), bodyType: "card-body box-body--settings" },
            React.createElement(ScheduleForm, { schedule: services.list.schedule, onScheduleSubmit: handleScheduleSubmit }))));
};
export default Services;
