import { createAction } from 'redux-actions';
import i18next from 'i18next';
import apiClient from '../api/Api';
import { addErrorToast, addSuccessToast } from './toasts';

export const handleRewriteRulesChange = createAction('HANDLE_REWRITE_RULES_CHANGE');

export const getRewriteTextRequest = createAction('GET_REWRITE_TEXT_REQUEST');
export const getRewriteTextFailure = createAction('GET_REWRITE_TEXT_FAILURE');
export const getRewriteTextSuccess = createAction('GET_REWRITE_TEXT_SUCCESS');

export const getRewriteText = () => async (dispatch: any) => {
    dispatch(getRewriteTextRequest());
    try {
        const data = await apiClient.getRewriteText();
        dispatch(getRewriteTextSuccess(data));
    } catch (error) {
        dispatch(addErrorToast({ error }));
        dispatch(getRewriteTextFailure());
    }
};

export const updateRewriteTextRequest = createAction('UPDATE_REWRITE_TEXT_REQUEST');
export const updateRewriteTextFailure = createAction('UPDATE_REWRITE_TEXT_FAILURE');
export const updateRewriteTextSuccess = createAction('UPDATE_REWRITE_TEXT_SUCCESS');

export const updateRewriteText = (rules: string) => async (dispatch: any) => {
    dispatch(updateRewriteTextRequest());
    try {
        await apiClient.updateRewriteText({ rules });
        dispatch(updateRewriteTextSuccess({ rules }));
        dispatch(addSuccessToast(i18next.t('rewrite_text_saved')));
    } catch (error) {
        dispatch(addErrorToast({ error }));
        dispatch(updateRewriteTextFailure());
    }
};

export const getRewriteSettingsRequest = createAction('GET_REWRITE_SETTINGS_REQUEST');
export const getRewriteSettingsFailure = createAction('GET_REWRITE_SETTINGS_FAILURE');
export const getRewriteSettingsSuccess = createAction('GET_REWRITE_SETTINGS_SUCCESS');

export const getRewriteSettings = () => async (dispatch: any) => {
    dispatch(getRewriteSettingsRequest());
    try {
        const data = await apiClient.getRewriteSettings();
        dispatch(getRewriteSettingsSuccess(data));
    } catch (error) {
        dispatch(addErrorToast({ error }));
        dispatch(getRewriteSettingsFailure());
    }
};

export const updateRewriteSettingsRequest = createAction('UPDATE_REWRITE_SETTINGS_REQUEST');
export const updateRewriteSettingsFailure = createAction('UPDATE_REWRITE_SETTINGS_FAILURE');
export const updateRewriteSettingsSuccess = createAction('UPDATE_REWRITE_SETTINGS_SUCCESS');

export const updateRewriteSettings = (config: any) => async (dispatch: any) => {
    dispatch(updateRewriteSettingsRequest());
    try {
        await apiClient.updateRewriteSettings(config);
        dispatch(updateRewriteSettingsSuccess(config));
        dispatch(addSuccessToast(i18next.t('rewrite_settings_updated')));
    } catch (error) {
        dispatch(addErrorToast({ error }));
        dispatch(updateRewriteSettingsFailure());
    }
};
