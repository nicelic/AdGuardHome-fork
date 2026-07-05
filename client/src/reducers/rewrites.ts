import { handleActions } from 'redux-actions';

import * as actions from '../actions/rewrites';

const rewrites = handleActions(
    {
        [actions.handleRewriteRulesChange.toString()]: (state: any, { payload }: any) => ({
            ...state,
            ...payload,
        }),

        [actions.getRewriteTextRequest.toString()]: (state: any) => ({
            ...state,
            processing: true,
        }),
        [actions.getRewriteTextFailure.toString()]: (state: any) => ({
            ...state,
            processing: false,
        }),
        [actions.getRewriteTextSuccess.toString()]: (state: any, { payload }: any) => ({
            ...state,
            processing: false,
            rulesText: payload.rules || '',
            savedRulesText: payload.rules || '',
        }),

        [actions.updateRewriteTextRequest.toString()]: (state: any) => ({
            ...state,
            processingSet: true,
        }),
        [actions.updateRewriteTextFailure.toString()]: (state: any) => ({
            ...state,
            processingSet: false,
        }),
        [actions.updateRewriteTextSuccess.toString()]: (state: any, { payload }: any) => ({
            ...state,
            processingSet: false,
            rulesText: payload.rules,
            savedRulesText: payload.rules,
        }),

        [actions.getRewriteSettingsRequest.toString()]: (state: any) => ({
            ...state,
            processingSettings: true,
        }),
        [actions.getRewriteSettingsFailure.toString()]: (state: any) => ({
            ...state,
            processingSettings: false,
        }),
        [actions.getRewriteSettingsSuccess.toString()]: (state: any, { payload }: any) => ({
            ...state,
            processingSettings: false,
            settings: payload,
        }),

        [actions.updateRewriteSettingsRequest.toString()]: (state: any) => ({
            ...state,
            processingSettings: true,
        }),
        [actions.updateRewriteSettingsFailure.toString()]: (state: any) => ({
            ...state,
            processingSettings: false,
        }),
        [actions.updateRewriteSettingsSuccess.toString()]: (state: any, { payload }: any) => ({
            ...state,
            processingSettings: false,
            settings: {
                ...state.settings,
                ...payload,
            },
        }),
    },
    {
        processing: true,
        processingSet: false,
        processingSettings: false,
        rulesText: '',
        savedRulesText: '',
        settings: { enabled: false },
    },
);

export default rewrites;
