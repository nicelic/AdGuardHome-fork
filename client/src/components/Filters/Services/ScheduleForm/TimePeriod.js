import React from 'react';
import { getTimeFromMs } from './helpers';
export const TimePeriod = ({ startTimeMs, endTimeMs }) => {
    const startTime = getTimeFromMs(startTimeMs);
    const endTime = getTimeFromMs(endTimeMs);
    return (React.createElement("div", { className: "schedule__time" },
        React.createElement("time", null,
            startTime.hours,
            ":",
            startTime.minutes),
        "\u00A0\u2013\u00A0",
        React.createElement("time", null,
            endTime.hours,
            ":",
            endTime.minutes)));
};
