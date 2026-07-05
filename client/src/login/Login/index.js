import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as actionCreators from '../../actions/login';
import { Logo } from '../../components/ui/svg/logo';
import Toasts from '../../components/Toasts';
import Footer from '../../components/ui/Footer';
import Icons from '../../components/ui/Icons';
import Form from './Form';
import './Login.css';
import '../../components/ui/Tabler.css';
export const Login = () => {
    const dispatch = useDispatch();
    const { processingLogin } = useSelector((state) => state.login);
    const handleSubmit = ({ username: name, password }) => {
        dispatch(actionCreators.processLogin({ name, password }));
    };
    return (React.createElement("div", { className: "login" },
        React.createElement("div", { className: "login__form" },
            React.createElement("div", { className: "text-center mb-6" },
                React.createElement(Logo, { className: "h-6 login__logo" })),
            React.createElement(Form, { onSubmit: handleSubmit, processing: processingLogin })),
        React.createElement(Footer, null),
        React.createElement(Toasts, null),
        React.createElement(Icons, null)));
};
