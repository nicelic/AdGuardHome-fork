import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import '../components/App/index.css';
import '../components/ui/ReactTable.css';
import configureStore from '../configureStore';
import reducers from '../reducers/install';
import '../i18n';
import { Setup } from './Setup';
const store = configureStore(reducers, {});
ReactDOM.render(React.createElement(Provider, { store: store },
    React.createElement(Setup, null)), document.getElementById('root'));
