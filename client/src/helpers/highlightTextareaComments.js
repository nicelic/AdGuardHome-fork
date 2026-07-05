import React from 'react';
import classnames from 'classnames';
import { COMMENT_LINE_DEFAULT_TOKEN } from './constants';
const renderHighlightedLine = (line, idx, commentLineTokens = [COMMENT_LINE_DEFAULT_TOKEN]) => {
    const isComment = commentLineTokens.some((token) => line.trim().startsWith(token));
    const lineClassName = classnames({
        'text-gray': isComment,
        'text-transparent': !isComment,
    });
    return (React.createElement("div", { className: lineClassName, key: idx }, line || '\n'));
};
export const getTextareaCommentsHighlight = (ref, lines, commentLineTokens, className = '') => {
    const renderLine = (line, idx) => renderHighlightedLine(line, idx, commentLineTokens);
    return (React.createElement("code", { className: classnames('text-output font-monospace', className), ref: ref }, lines?.split('\n').map(renderLine)));
};
export const syncScroll = (e, ref) => {
    // eslint-disable-next-line no-param-reassign
    ref.current.scrollTop = e.target.scrollTop;
};
