import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import '../components/App/index.css';
import '../components/ui/ReactTable.css';
import configureStore from '../configureStore';
import reducers from '../reducers/login';
import '../i18n';
import { Login } from './Login';
const store = configureStore(reducers, {});
ReactDOM.render(React.createElement(Provider, { store: store },
    React.createElement(Login, null)), document.getElementById('root'));
