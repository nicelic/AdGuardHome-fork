import React from 'react';
import { useSelector } from 'react-redux';
import { formatDateTime, formatTime } from '../../../helpers/helpers';
import { DEFAULT_SHORT_DATE_FORMAT_OPTIONS, DEFAULT_TIME_FORMAT } from '../../../helpers/constants';
const DateCell = ({ time }) => {
    const isDetailed = useSelector((state) => state.queryLogs.isDetailed);
    if (!time) {
        return React.createElement(React.Fragment, null, "\u2013");
    }
    const formattedTime = formatTime(time, DEFAULT_TIME_FORMAT);
    const formattedDate = formatDateTime(time, DEFAULT_SHORT_DATE_FORMAT_OPTIONS);
    return (React.createElement("div", { className: "logs__cell logs__cell logs__cell--date text-truncate", role: "gridcell" },
        React.createElement("div", { className: "logs__time", title: formattedTime }, formattedTime),
        isDetailed && (React.createElement("div", { className: "detailed-info d-none d-sm-block text-truncate", title: formattedDate }, formattedDate))));
};
export default DateCell;
