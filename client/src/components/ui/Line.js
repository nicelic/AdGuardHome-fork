import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useSelector } from 'react-redux';
import './Line.css';
import { buildChartData } from './lineUtils';
const gradientId = (color) => `line-gradient-${color.replace('#', '')}`;
const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) {
        return null;
    }
    const point = payload[0].payload;
    return (React.createElement("div", { className: "line__tooltip" },
        React.createElement("strong", { className: "line__tooltip-value" }, point.value),
        React.createElement("small", { className: "line__tooltip-label" }, point.label)));
};
const Line = ({ data, color = 'black' }) => {
    const interval = useSelector((state) => state.stats.interval);
    const timeUnits = useSelector((state) => state.stats.timeUnits);
    const chartData = buildChartData(data, interval, timeUnits);
    return (React.createElement(ResponsiveContainer, { width: "100%", height: "100%", minHeight: 16 },
        React.createElement(AreaChart, { data: chartData, margin: { top: 8, right: 8, bottom: 12, left: 8 } },
            React.createElement("defs", null,
                React.createElement("linearGradient", { id: gradientId(color), x1: "0", y1: "0", x2: "0", y2: "1" },
                    React.createElement("stop", { offset: "0%", stopColor: color, stopOpacity: 0.82 }),
                    React.createElement("stop", { offset: "64%", stopColor: color, stopOpacity: 0.6 }),
                    React.createElement("stop", { offset: "92%", stopColor: color, stopOpacity: 0.16 }),
                    React.createElement("stop", { offset: "100%", stopColor: color, stopOpacity: 0 }))),
            React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null), cursor: { stroke: color, strokeWidth: 1 } }),
            React.createElement(Area, { type: "monotone", dataKey: "value", strokeWidth: 1, stroke: color, fill: `url(#${gradientId(color)})`, isAnimationActive: false, activeDot: { r: 4, fill: color } }))));
};
export default Line;
