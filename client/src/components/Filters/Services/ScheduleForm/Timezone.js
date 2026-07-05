import React from 'react';
import ct from 'countries-and-timezones';
import { useTranslation } from 'react-i18next';
import { LOCAL_TIMEZONE_VALUE } from '../../../../helpers/constants';
export const Timezone = ({ timezone, setTimezone }) => {
    const [t] = useTranslation();
    const onTimeZoneChange = (event) => {
        setTimezone(event.target.value);
    };
    const timezones = ct.getAllTimezones();
    return (React.createElement("div", { className: "schedule__timezone" },
        React.createElement("label", { className: "form__label form__label--with-desc mb-2" }, t('schedule_timezone')),
        React.createElement("select", { className: "form-control custom-select", value: timezone, onChange: onTimeZoneChange },
            React.createElement("option", { value: LOCAL_TIMEZONE_VALUE }, t('schedule_timezone')),
            Object.keys(timezones).map((zone) => (React.createElement("option", { key: zone, value: zone },
                zone,
                " (GMT",
                timezones[zone].utcOffsetStr,
                ")"))))));
};
