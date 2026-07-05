import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
const middlewares = [thunk];
export default function configureStore(reducer, initialState) {
    const store = createStore(reducer, initialState, compose(applyMiddleware(...middlewares)));
    return store;
}
