import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import configureStore from './configureStore';
import reducers from './reducers';
import App from './components/App';
import './components/App/index.css';
import './i18n';
import { initialState } from './initialState';
const store = configureStore(reducers, initialState);
ReactDOM.render(React.createElement(Provider, { store: store },
    React.createElement(App, null)), document.getElementById('root'));
