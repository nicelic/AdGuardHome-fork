import React from 'react';
import { Trans } from 'react-i18next';
import classNames from 'classnames';
import { processContent } from '../../../helpers/helpers';
import Tooltip from '../../ui/Tooltip';
import 'react-popper-tooltip/dist/styles.css';
import './IconTooltip.css';
import { SHOW_TOOLTIP_DELAY } from '../../../helpers/constants';
const IconTooltip = ({ className, contentItemClass, columnClass, triggerClass, canShowTooltip = true, xlinkHref, title, placement, tooltipClass, content, trigger, onVisibilityChange, defaultTooltipShown, delayHide, renderContent = content
    ? React.Children.map(processContent(content), (item, idx) => (React.createElement("div", { key: idx, className: contentItemClass },
        React.createElement(Trans, null, item || '—'))))
    : null, }) => {
    const tooltipContent = (React.createElement(React.Fragment, null,
        title && (React.createElement("div", { className: "pb-4 h-25 grid-content font-weight-bold" },
            React.createElement(Trans, null, title))),
        React.createElement("div", { className: classNames(columnClass) }, renderContent)));
    const tooltipClassName = classNames('tooltip-custom__container', tooltipClass, { 'd-none': !canShowTooltip });
    return (React.createElement(Tooltip, { className: tooltipClassName, content: tooltipContent, placement: placement, triggerClass: triggerClass, trigger: trigger, onVisibilityChange: onVisibilityChange, delayShow: trigger === 'click' ? 0 : SHOW_TOOLTIP_DELAY, delayHide: delayHide, defaultTooltipShown: defaultTooltipShown }, xlinkHref && (React.createElement("svg", { className: className },
        React.createElement("use", { xlinkHref: `#${xlinkHref}` })))));
};
export default IconTooltip;
