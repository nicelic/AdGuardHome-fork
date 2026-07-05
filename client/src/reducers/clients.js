import { handleActions } from 'redux-actions';
import * as actions from '../actions/clients';
const clients = handleActions({
    [actions.addClientRequest.toString()]: (state) => ({
        ...state,
        processingAdding: true,
    }),
    [actions.addClientFailure.toString()]: (state) => ({
        ...state,
        processingAdding: false,
    }),
    [actions.addClientSuccess.toString()]: (state) => {
        const newState = {
            ...state,
            processingAdding: false,
        };
        return newState;
    },
    [actions.deleteClientRequest.toString()]: (state) => ({
        ...state,
        processingDeleting: true,
    }),
    [actions.deleteClientFailure.toString()]: (state) => ({
        ...state,
        processingDeleting: false,
    }),
    [actions.deleteClientSuccess.toString()]: (state) => {
        const newState = {
            ...state,
            processingDeleting: false,
        };
        return newState;
    },
    [actions.updateClientRequest.toString()]: (state) => ({
        ...state,
        processingUpdating: true,
    }),
    [actions.updateClientFailure.toString()]: (state) => ({
        ...state,
        processingUpdating: false,
    }),
    [actions.updateClientSuccess.toString()]: (state) => {
        const newState = {
            ...state,
            processingUpdating: false,
        };
        return newState;
    },
    [actions.toggleClientModal.toString()]: (state, { payload }) => {
        if (payload) {
            const newState = {
                ...state,
                modalType: payload.type || '',
                modalClientName: payload.name || '',
                isModalOpen: !state.isModalOpen,
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
    processingAdding: false,
    processingDeleting: false,
    processingUpdating: false,
    isModalOpen: false,
    modalClientName: '',
    modalType: '',
});
export default clients;
