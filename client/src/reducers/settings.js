import { handleActions } from 'redux-actions';
import * as actions from '../actions';
const settings = handleActions({
    [actions.initSettingsRequest.toString()]: (state) => ({
        ...state,
        processing: true,
    }),
    [actions.initSettingsFailure.toString()]: (state) => ({
        ...state,
        processing: false,
    }),
    [actions.initSettingsSuccess.toString()]: (state, { payload }) => {
        const { settingsList } = payload;
        const newState = {
            ...state,
            settingsList,
            processing: false,
        };
        return newState;
    },
    [actions.toggleSettingStatus.toString()]: (state, { payload }) => {
        const { settingsList } = state;
        const { settingKey, value } = payload;
        const setting = settingsList[settingKey];
        const newSetting = value || {
            ...setting,
            enabled: !setting.enabled,
        };
        const newSettingsList = {
            ...settingsList,
            [settingKey]: newSetting,
        };
        return {
            ...state,
            settingsList: newSettingsList,
        };
    },
    [actions.testUpstreamRequest.toString()]: (state) => ({
        ...state,
        processingTestUpstream: true,
    }),
    [actions.testUpstreamFailure.toString()]: (state) => ({
        ...state,
        processingTestUpstream: false,
    }),
    [actions.testUpstreamSuccess.toString()]: (state) => ({
        ...state,
        processingTestUpstream: false,
    }),
}, {
    processing: true,
    processingTestUpstream: false,
    processingDhcpStatus: false,
    settingsList: {},
});
export default settings;
