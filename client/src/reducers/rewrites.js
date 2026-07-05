import { handleActions } from 'redux-actions';
import * as actions from '../actions/rewrites';
const rewrites = handleActions({
    [actions.getRewritesListRequest.toString()]: (state) => ({
        ...state,
        processing: true,
    }),
    [actions.getRewritesListFailure.toString()]: (state) => ({
        ...state,
        processing: false,
    }),
    [actions.getRewritesListSuccess.toString()]: (state, { payload }) => {
        const newState = {
            ...state,
            list: payload,
            processing: false,
        };
        return newState;
    },
    [actions.addRewriteRequest.toString()]: (state) => ({
        ...state,
        processingAdd: true,
    }),
    [actions.addRewriteFailure.toString()]: (state) => ({
        ...state,
        processingAdd: false,
    }),
    [actions.addRewriteSuccess.toString()]: (state, { payload }) => {
        const newState = {
            ...state,
            list: [...state.list, payload],
            processingAdd: false,
        };
        return newState;
    },
    [actions.deleteRewriteRequest.toString()]: (state) => ({
        ...state,
        processingDelete: true,
    }),
    [actions.deleteRewriteFailure.toString()]: (state) => ({
        ...state,
        processingDelete: false,
    }),
    [actions.deleteRewriteSuccess.toString()]: (state) => ({
        ...state,
        processingDelete: false,
    }),
    [actions.updateRewriteRequest.toString()]: (state) => ({
        ...state,
        processingUpdate: true,
    }),
    [actions.updateRewriteFailure.toString()]: (state) => ({
        ...state,
        processingUpdate: false,
    }),
    [actions.updateRewriteSuccess.toString()]: (state) => {
        const newState = {
            ...state,
            processingUpdate: false,
        };
        return newState;
    },
    [actions.getRewriteSettingsRequest.toString()]: (state) => ({
        ...state,
        processing: true,
    }),
    [actions.getRewriteSettingsFailure.toString()]: (state) => ({
        ...state,
        processing: false,
    }),
    [actions.getRewriteSettingsSuccess.toString()]: (state, { payload }) => {
        const newState = {
            ...state,
            settings: payload,
            processing: false,
        };
        return newState;
    },
    [actions.updateRewriteSettingsRequest.toString()]: (state) => ({
        ...state,
        processingUpdate: true,
    }),
    [actions.updateRewriteSettingsFailure.toString()]: (state) => ({
        ...state,
        processingUpdate: false,
    }),
    [actions.updateRewriteSettingsSuccess.toString()]: (state, { payload }) => ({
        ...state,
        settings: {
            ...state.settings,
            ...payload,
        },
        processingUpdate: false,
    }),
    [actions.toggleRewritesModal.toString()]: (state, { payload }) => {
        if (payload) {
            const newState = {
                ...state,
                modalType: payload.type || '',
                isModalOpen: !state.isModalOpen,
                currentRewrite: payload.currentRewrite,
            };
            return newState;
        }
        const newState = {
            ...state,
            isModalOpen: !state.isModalOpen,
        };
        return newState;
    },
}, {
    processing: true,
    processingAdd: false,
    processingDelete: false,
    processingUpdate: false,
    isModalOpen: false,
    modalType: '',
    currentRewrite: {},
    list: [],
    settings: { enabled: false },
});
export default rewrites;
