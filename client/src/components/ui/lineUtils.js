import addDays from 'date-fns/add_days';
import subDays from 'date-fns/sub_days';
import subHours from 'date-fns/sub_hours';
import dateFormat from 'date-fns/format';
import { TIME_UNITS } from '../../helpers/constants';
import { msToDays, msToHours } from '../../helpers/helpers';
export const formatHistoryLabel = (index, interval, timeUnits, now = Date.now()) => {
    if (timeUnits === TIME_UNITS.HOURS) {
        const hoursAgo = msToHours(interval) - index - 1;
        return dateFormat(subHours(now, hoursAgo), 'D MMM HH:00');
    }
    const firstDay = subDays(now, msToDays(interval) - 1);
    return dateFormat(addDays(firstDay, index), 'D MMM YYYY');
};
export const buildChartData = (values, interval, timeUnits, now = Date.now()) => values.map((value, index) => ({
    index,
    value,
    label: formatHistoryLabel(index, interval, timeUnits, now),
}));
