import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import debounce from 'lodash/debounce';
import * as actionCreators from '../../actions/install';
import { getWebAddress } from '../../helpers/helpers';
import { INSTALL_TOTAL_STEPS, ALL_INTERFACES_IP, DEBOUNCE_TIMEOUT } from '../../helpers/constants';
import Loading from '../../components/ui/Loading';
import Greeting from './Greeting';
import { Settings } from './Settings';
import { Devices } from './Devices';
import { Submit } from './Submit';
import { Progress } from './Progress';
import { Auth } from './Auth';
import Toasts from '../../components/Toasts';
import Footer from '../../components/ui/Footer';
import Icons from '../../components/ui/Icons';
import { Logo } from '../../components/ui/svg/logo';
import './Setup.css';
import '../../components/ui/Tabler.css';
export const Setup = () => {
    const dispatch = useDispatch();
    const install = useSelector((state) => state.install);
    const { processingDefault, step, web, dns, staticIp, interfaces } = install;
    useEffect(() => {
        dispatch(actionCreators.getDefaultAddresses());
    }, []);
    const handleFormSubmit = (values) => {
        const config = { ...values };
        delete config.staticIp;
        if (web.port && dns.port) {
            dispatch(actionCreators.setAllSettings({
                web,
                dns,
                ...config,
            }));
        }
    };
    const checkConfig = debounce((values) => {
        const { web, dns } = values;
        if (values && web.port && dns.port) {
            dispatch(actionCreators.checkConfig({ web, dns, set_static_ip: false }));
        }
    }, DEBOUNCE_TIMEOUT);
    const handleFix = (web, dns, set_static_ip) => {
        dispatch(actionCreators.checkConfig({ web, dns, set_static_ip }));
    };
    const openDashboard = (ip, port) => {
        let address = getWebAddress(ip, port);
        if (ip === ALL_INTERFACES_IP) {
            address = getWebAddress(window.location.hostname, port);
        }
        window.location.replace(address);
    };
    const handleNextStep = () => {
        if (step < INSTALL_TOTAL_STEPS) {
            dispatch(actionCreators.nextStep());
        }
    };
    const renderPage = (step, config, interfaces) => {
        switch (step) {
            case 1:
                return React.createElement(Greeting, null);
            case 2:
                return (React.createElement(Settings, { config: config, initialValues: config, interfaces: interfaces, handleSubmit: handleNextStep, validateForm: checkConfig, handleFix: handleFix }));
            case 3:
                return React.createElement(Auth, { onAuthSubmit: handleFormSubmit });
            case 4:
                return React.createElement(Devices, { interfaces: interfaces, dnsConfig: dns });
            case 5:
                return React.createElement(Submit, { openDashboard: openDashboard, webConfig: web });
            default:
                return false;
        }
    };
    if (processingDefault) {
        return React.createElement(Loading, null);
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "setup" },
            React.createElement("div", { className: "setup__container" },
                React.createElement(Logo, { className: "setup__logo" }),
                renderPage(step, { web, dns, staticIp }, interfaces),
                React.createElement(Progress, { step: step }))),
        React.createElement(Footer, null),
        React.createElement(Toasts, null),
        React.createElement(Icons, null)));
};
