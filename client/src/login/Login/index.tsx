import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import * as actionCreators from '../../actions/login';

import { Logo } from '../../components/ui/svg/logo';
import Toasts from '../../components/Toasts';
import Footer from '../../components/ui/Footer';
import Icons from '../../components/ui/Icons';
import Form, { LoginFormValues } from './Form';

import './Login.css';
import '../../components/ui/Tabler.css';
import { LoginState } from '../../initialState';

export const Login = () => {
    const dispatch = useDispatch();
    const { processingLogin } = useSelector((state: LoginState) => state.login);

    const handleSubmit = ({ username: name, password }: LoginFormValues) => {
        dispatch(actionCreators.processLogin({ name, password }));
    };

    return (
        <div className="login">
            <div className="login__form">
                <div className="text-center mb-6">
                    <Logo className="h-6 login__logo" />
                </div>

                <Form onSubmit={handleSubmit} processing={processingLogin} />
            </div>

            <Footer />
            <Toasts />
            <Icons />
        </div>
    );
};
