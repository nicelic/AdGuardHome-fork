import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
const HeaderCell = ({ content, className }, idx) => {
    const { t } = useTranslation();
    return (React.createElement("div", { key: idx, className: classNames('logs__cell--header__item logs__cell logs__text--bold', className), role: "columnheader" }, typeof content === 'string' ? t(content) : content));
};
export default HeaderCell;
