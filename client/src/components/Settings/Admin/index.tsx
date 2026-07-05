import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import apiClient from '../../../api/Api';
import { addErrorToast } from '../../../actions/toasts';
import { RootState } from '../../../initialState';
import { HTML_PAGES } from '../../../helpers/constants';
import { getCurrentPanelBasePath, getPanelPagePath } from '../../../helpers/helpers';
import { validatePasswordLength, validateRequiredValue } from '../../../helpers/validators';
import Card from '../../ui/Card';
import PageTitle from '../../ui/PageTitle';
import { Input } from '../../ui/Controls/Input';

type AdminFormValues = {
    current_name: string;
    current_password: string;
    new_name: string;
    new_password: string;
    confirm_new_password: string;
};

const Admin = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const currentName = useSelector((state: RootState) => state.dashboard.name);
    const [processing, setProcessing] = useState(false);

    const {
        handleSubmit,
        control,
        watch,
        formState: { isValid },
    } = useForm<AdminFormValues>({
        mode: 'onChange',
        defaultValues: {
            current_name: '',
            current_password: '',
            new_name: '',
            new_password: '',
            confirm_new_password: '',
        },
    });

    const newPassword = watch('new_password');

    const validateConfirmPassword = (value: string) => {
        if (value !== newPassword) {
            return t('form_error_password');
        }

        return undefined;
    };

    const onSubmit = async (values: AdminFormValues) => {
        setProcessing(true);

        try {
            await apiClient.updateAdminCredentials({
                current_name: values.current_name,
                current_password: values.current_password,
                new_name: values.new_name,
                new_password: values.new_password,
            });

            window.location.replace(
                `${window.location.origin}${getPanelPagePath(
                    HTML_PAGES.LOGIN,
                    getCurrentPanelBasePath(window.location.pathname),
                )}`,
            );
        } catch (error) {
            dispatch(addErrorToast({ error }));
        } finally {
            setProcessing(false);
        }
    };

    const submitClassName = processing ? 'btn btn-success btn-loading' : 'btn btn-success';

    return (
        <>
            <PageTitle title={t('admin_settings')} subtitle={t('admin_settings_description')} />

            <div className="content">
                <div className="row">
                    <div className="col-md-12">
                        <Card
                            title={t('admin_settings')}
                            subtitle={t('admin_settings_plaintext_notice')}
                            bodyType="card-body box-body--settings">
                            {currentName && (
                                <div className="form__desc mb-4">
                                    {t('admin_current_account', { name: currentName })}
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                                <div className="form__label--bold form__label--top form__label--bot">
                                    {t('admin_current_credentials')}
                                </div>

                                <Controller
                                    name="current_name"
                                    control={control}
                                    rules={{ validate: validateRequiredValue }}
                                    render={({ field, fieldState }) => (
                                        <Input
                                            {...field}
                                            type="text"
                                            label={t('admin_current_username')}
                                            error={fieldState.error?.message}
                                            autoComplete="off"
                                            autoCapitalize="none"
                                            spellCheck={false}
                                            trimOnBlur
                                            disabled={processing}
                                        />
                                    )}
                                />

                                <Controller
                                    name="current_password"
                                    control={control}
                                    rules={{ validate: validateRequiredValue }}
                                    render={({ field, fieldState }) => (
                                        <Input
                                            {...field}
                                            type="text"
                                            label={t('admin_current_password')}
                                            error={fieldState.error?.message}
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={processing}
                                        />
                                    )}
                                />

                                <div className="form__label--bold form__label--top form__label--bot mt-5">
                                    {t('admin_new_credentials')}
                                </div>

                                <Controller
                                    name="new_name"
                                    control={control}
                                    rules={{ validate: validateRequiredValue }}
                                    render={({ field, fieldState }) => (
                                        <Input
                                            {...field}
                                            type="text"
                                            label={t('admin_new_username')}
                                            error={fieldState.error?.message}
                                            autoComplete="off"
                                            autoCapitalize="none"
                                            spellCheck={false}
                                            trimOnBlur
                                            disabled={processing}
                                        />
                                    )}
                                />

                                <Controller
                                    name="new_password"
                                    control={control}
                                    rules={{
                                        validate: {
                                            required: validateRequiredValue,
                                            passwordLength: validatePasswordLength,
                                        },
                                    }}
                                    render={({ field, fieldState }) => (
                                        <Input
                                            {...field}
                                            type="text"
                                            label={t('admin_new_password')}
                                            error={fieldState.error?.message}
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={processing}
                                        />
                                    )}
                                />

                                <Controller
                                    name="confirm_new_password"
                                    control={control}
                                    rules={{
                                        validate: {
                                            required: validateRequiredValue,
                                            confirmPassword: validateConfirmPassword,
                                        },
                                    }}
                                    render={({ field, fieldState }) => (
                                        <Input
                                            {...field}
                                            type="text"
                                            label={t('admin_confirm_new_password')}
                                            error={fieldState.error?.message}
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={processing}
                                        />
                                    )}
                                />

                                <div className="btn-list mt-4">
                                    <button
                                        type="submit"
                                        className={submitClassName}
                                        disabled={processing || !isValid}>
                                        {t('save_btn')}
                                    </button>
                                </div>
                            </form>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Admin;
