import { handleActions } from 'redux-actions';
import * as actions from '../actions/filtering';
const filtering = handleActions({
    [actions.setRulesRequest.toString()]: (state) => ({
        ...state,
        processingRules: true,
    }),
    [actions.setRulesFailure.toString()]: (state) => ({
        ...state,
        processingRules: false,
    }),
    [actions.setRulesSuccess.toString()]: (state) => ({
        ...state,
        processingRules: false,
    }),
    [actions.handleRulesChange.toString()]: (state, { payload }) => {
        const { userRules } = payload;
        return { ...state, userRules };
    },
    [actions.getFilteringStatusRequest.toString()]: (state) => ({
        ...state,
        processingFilters: true,
        check: {},
    }),
    [actions.getFilteringStatusFailure.toString()]: (state) => ({
        ...state,
        processingFilters: false,
    }),
    [actions.getFilteringStatusSuccess.toString()]: (state, { payload }) => ({
        ...state,
        ...payload,
        processingFilters: false,
    }),
    [actions.addFilterRequest.toString()]: (state) => ({
        ...state,
        processingAddFilter: true,
        isFilterAdded: false,
    }),
    [actions.addFilterFailure.toString()]: (state) => ({
        ...state,
        processingAddFilter: false,
        isFilterAdded: false,
    }),
    [actions.addFilterSuccess.toString()]: (state) => ({
        ...state,
        processingAddFilter: false,
        isFilterAdded: true,
    }),
    [actions.toggleFilteringModal.toString()]: (state, { payload }) => {
        if (payload) {
            const newState = {
                ...state,
                isModalOpen: !state.isModalOpen,
                isFilterAdded: false,
                modalType: payload.type || '',
                modalFilterUrl: payload.url || '',
            };
            return newState;
        }
        const newState = {
            ...state,
            isModalOpen: !state.isModalOpen,
            isFilterAdded: false,
            modalType: '',
        };
        return newState;
    },
    [actions.toggleFilterRequest.toString()]: (state) => ({
        ...state,
        processingConfigFilter: true,
    }),
    [actions.toggleFilterFailure.toString()]: (state) => ({
        ...state,
        processingConfigFilter: false,
    }),
    [actions.toggleFilterSuccess.toString()]: (state) => ({
        ...state,
        processingConfigFilter: false,
    }),
    [actions.editFilterRequest.toString()]: (state) => ({
        ...state,
        processingConfigFilter: true,
    }),
    [actions.editFilterFailure.toString()]: (state) => ({
        ...state,
        processingConfigFilter: false,
    }),
    [actions.editFilterSuccess.toString()]: (state) => ({
        ...state,
        processingConfigFilter: false,
    }),
    [actions.refreshFiltersRequest.toString()]: (state) => ({
        ...state,
        processingRefreshFilters: true,
    }),
    [actions.refreshFiltersFailure.toString()]: (state) => ({
        ...state,
        processingRefreshFilters: false,
    }),
    [actions.refreshFiltersSuccess.toString()]: (state) => ({
        ...state,
        processingRefreshFilters: false,
    }),
    [actions.removeFilterRequest.toString()]: (state) => ({
        ...state,
        processingRemoveFilter: true,
    }),
    [actions.removeFilterFailure.toString()]: (state) => ({
        ...state,
        processingRemoveFilter: false,
    }),
    [actions.removeFilterSuccess.toString()]: (state) => ({
        ...state,
        processingRemoveFilter: false,
    }),
    [actions.setFiltersConfigRequest.toString()]: (state) => ({
        ...state,
        processingSetConfig: true,
    }),
    [actions.setFiltersConfigFailure.toString()]: (state) => ({
        ...state,
        processingSetConfig: false,
    }),
    [actions.setFiltersConfigSuccess.toString()]: (state, { payload }) => ({
        ...state,
        ...payload,
        processingSetConfig: false,
    }),
    [actions.checkHostRequest.toString()]: (state) => ({
        ...state,
        processingCheck: true,
    }),
    [actions.checkHostFailure.toString()]: (state) => ({
        ...state,
        processingCheck: false,
    }),
    [actions.checkHostSuccess.toString()]: (state, { payload }) => ({
        ...state,
        check: payload,
        processingCheck: false,
    }),
}, {
    isModalOpen: false,
    processingFilters: false,
    processingRules: false,
    processingAddFilter: false,
    processingRefreshFilters: false,
    processingConfigFilter: false,
    processingRemoveFilter: false,
    processingSetConfig: false,
    processingCheck: false,
    isFilterAdded: false,
    filters: [],
    whitelistFilters: [],
    userRules: '',
    interval: 24,
    enabled: true,
    modalType: '',
    modalFilterUrl: '',
    check: {},
});
export default filtering;
