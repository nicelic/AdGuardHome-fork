import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from 'classnames';
import { Modal } from './Modal';
import { getFullDayName, getShortDayName } from './helpers';
import { LOCAL_TIMEZONE_VALUE } from '../../../../helpers/constants';
import { TimePeriod } from './TimePeriod';
import './styles.css';
export const ScheduleForm = ({ schedule, onScheduleSubmit, clientForm }) => {
    const [t] = useTranslation();
    const [modalOpen, setModalOpen] = useState(false);
    const [currentDay, setCurrentDay] = useState();
    const onModalOpen = () => setModalOpen(true);
    const onModalClose = () => setModalOpen(false);
    const filteredScheduleKeys = schedule ? Object.keys(schedule).filter((v) => v !== 'time_zone') : [];
    const scheduleMap = new Map();
    filteredScheduleKeys.forEach((day) => scheduleMap.set(day, schedule[day]));
    const onSubmit = (values) => {
        onScheduleSubmit(values);
        onModalClose();
    };
    const onDelete = (day) => {
        scheduleMap.delete(day);
        const scheduleWeek = Object.fromEntries(Array.from(scheduleMap.entries()));
        onScheduleSubmit({
            time_zone: schedule.time_zone,
            ...scheduleWeek,
        });
    };
    const onEdit = (day) => {
        setCurrentDay(day);
        onModalOpen();
    };
    const onAdd = () => {
        setCurrentDay(undefined);
        onModalOpen();
    };
    return (React.createElement("div", null,
        React.createElement("div", { className: "schedule__current-timezone" }, t('schedule_current_timezone', { value: schedule?.time_zone || LOCAL_TIMEZONE_VALUE })),
        React.createElement("div", { className: "schedule__rows" }, filteredScheduleKeys.map((day) => {
            const data = schedule[day];
            if (!data) {
                return undefined;
            }
            return (React.createElement("div", { key: day, className: "schedule__row" },
                React.createElement("div", { className: "schedule__day" }, getFullDayName(t, day)),
                React.createElement("div", { className: "schedule__day schedule__day--mobile" }, getShortDayName(t, day)),
                React.createElement(TimePeriod, { startTimeMs: data.start, endTimeMs: data.end }),
                React.createElement("div", { className: "schedule__actions" },
                    React.createElement("button", { type: "button", className: "btn btn-icon btn-outline-primary btn-sm schedule__button", title: t('edit_table_action'), onClick: () => onEdit(day) },
                        React.createElement("svg", { className: "icons icon12" },
                            React.createElement("use", { xlinkHref: "#edit" }))),
                    React.createElement("button", { type: "button", className: "btn btn-icon btn-outline-secondary btn-sm schedule__button", title: t('delete_table_action'), onClick: () => onDelete(day) },
                        React.createElement("svg", { className: "icons" },
                            React.createElement("use", { xlinkHref: "#delete" }))))));
        })),
        React.createElement("button", { type: "button", className: cn('btn', { 'btn-outline-success btn-sm': clientForm }, { 'btn-success btn-standard': !clientForm }), onClick: onAdd }, t('schedule_new')),
        modalOpen && (React.createElement(Modal, { isOpen: modalOpen, onClose: onModalClose, onSubmit: onSubmit, schedule: schedule, currentDay: currentDay }))));
};
