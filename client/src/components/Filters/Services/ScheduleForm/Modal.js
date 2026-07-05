import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactModal from 'react-modal';
import { Timezone } from './Timezone';
import { TimeSelect } from './TimeSelect';
import { TimePeriod } from './TimePeriod';
import { getFullDayName, getShortDayName } from './helpers';
import { LOCAL_TIMEZONE_VALUE } from '../../../../helpers/constants';
export const DAYS_OF_WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const INITIAL_START_TIME_MS = 0;
const INITIAL_END_TIME_MS = 86340000;
export const Modal = ({ isOpen, currentDay, schedule, onClose, onSubmit }) => {
    const [t] = useTranslation();
    const intialTimezone = schedule.time_zone === LOCAL_TIMEZONE_VALUE
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : schedule.time_zone;
    const [timezone, setTimezone] = useState(intialTimezone);
    const [days, setDays] = useState(new Set());
    const [startTime, setStartTime] = useState(INITIAL_START_TIME_MS);
    const [endTime, setEndTime] = useState(INITIAL_END_TIME_MS);
    const [wrongPeriod, setWrongPeriod] = useState(true);
    useEffect(() => {
        if (currentDay) {
            const newDays = new Set([currentDay]);
            setDays(newDays);
            setStartTime(schedule[currentDay].start);
            setEndTime(schedule[currentDay].end);
        }
    }, [currentDay]);
    useEffect(() => {
        if (startTime >= endTime) {
            setWrongPeriod(true);
        }
        else {
            setWrongPeriod(false);
        }
    }, [startTime, endTime]);
    const addDays = (day) => {
        const newDays = new Set(days);
        if (newDays.has(day)) {
            newDays.delete(day);
        }
        else {
            newDays.add(day);
        }
        setDays(newDays);
    };
    const activeDay = (day) => {
        return days.has(day);
    };
    const onFormSubmit = (e) => {
        e.preventDefault();
        const newSchedule = schedule;
        Array.from(days).forEach((day) => {
            newSchedule[day] = {
                start: startTime,
                end: endTime,
            };
        });
        if (timezone !== intialTimezone) {
            newSchedule.time_zone = timezone;
        }
        onSubmit(newSchedule);
    };
    return (React.createElement(ReactModal, { className: "Modal__Bootstrap modal-dialog modal-dialog-centered modal-dialog--schedule", closeTimeoutMS: 0, isOpen: isOpen, onRequestClose: onClose },
        React.createElement("div", { className: "modal-content" },
            React.createElement("div", { className: "modal-header" },
                React.createElement("h4", { className: "modal-title" }, currentDay ? t('schedule_edit') : t('schedule_new')),
                React.createElement("button", { type: "button", className: "close", onClick: onClose },
                    React.createElement("span", { className: "sr-only" }, "Close"))),
            React.createElement("form", { onSubmit: onFormSubmit },
                React.createElement("div", { className: "modal-body" },
                    React.createElement(Timezone, { timezone: timezone, setTimezone: setTimezone }),
                    React.createElement("div", { className: "schedule__days" }, DAYS_OF_WEEK.map((day) => (React.createElement("button", { type: "button", key: day, className: "btn schedule__button-day", "data-active": activeDay(day), onClick: () => addDays(day) }, getShortDayName(t, day))))),
                    React.createElement("div", { className: "schedule__time-wrap" },
                        React.createElement("div", { className: "schedule__time-row" },
                            React.createElement(TimeSelect, { value: startTime, onChange: (v) => setStartTime(v) }),
                            React.createElement(TimeSelect, { value: endTime, onChange: (v) => setEndTime(v) })),
                        wrongPeriod && React.createElement("div", { className: "schedule__error" }, t('schedule_invalid_select'))),
                    React.createElement("div", { className: "schedule__info" },
                        React.createElement("div", { className: "schedule__info-title" }, t('schedule_modal_time_off')),
                        React.createElement("div", { className: "schedule__info-row" },
                            React.createElement("svg", { className: "icons schedule__info-icon" },
                                React.createElement("use", { xlinkHref: "#calendar" })),
                            days.size ? (Array.from(days)
                                .map((day) => getFullDayName(t, day))
                                .join(', ')) : (React.createElement("span", null, "\u2014"))),
                        React.createElement("div", { className: "schedule__info-row" },
                            React.createElement("svg", { className: "icons schedule__info-icon" },
                                React.createElement("use", { xlinkHref: "#watch" })),
                            wrongPeriod ? (React.createElement("span", null, "\u2014")) : (React.createElement(TimePeriod, { startTimeMs: startTime, endTimeMs: endTime })))),
                    React.createElement("div", { className: "schedule__notice" }, t('schedule_modal_description'))),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement("div", { className: "btn-list" },
                        React.createElement("button", { type: "button", className: "btn btn-success btn-standard", disabled: days.size === 0 || wrongPeriod, onClick: onFormSubmit }, currentDay ? t('schedule_save') : t('schedule_add'))))))));
};
