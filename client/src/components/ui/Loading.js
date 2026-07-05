import React from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import './Loading.css';
const Loading = ({ className, text }) => {
    const { t } = useTranslation();
    return React.createElement("div", { className: classNames('loading', className) }, t(text));
};
export default Loading;
