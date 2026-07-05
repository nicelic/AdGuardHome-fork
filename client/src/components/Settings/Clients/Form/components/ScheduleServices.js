import React from 'react';
import { Trans } from 'react-i18next';
import { useFormContext } from 'react-hook-form';
import { ScheduleForm } from '../../../../Filters/Services/ScheduleForm';
export const ScheduleServices = () => {
    const { watch, setValue } = useFormContext();
    const blockedServicesSchedule = watch('blocked_services_schedule');
    const handleScheduleSubmit = (values) => {
        setValue('blocked_services_schedule', values);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "form__desc mb-4" },
            React.createElement(Trans, null, "schedule_services_desc_client")),
        React.createElement(ScheduleForm, { schedule: blockedServicesSchedule, onScheduleSubmit: handleScheduleSubmit, clientForm: true })));
};
