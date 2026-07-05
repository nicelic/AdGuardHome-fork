import React, { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import apiClient from '../../../api/Api';
import { addErrorToast, addSuccessToast } from '../../../actions/toasts';
import { COMMENT_LINE_DEFAULT_TOKEN } from '../../../helpers/constants';
import { getTextareaCommentsHighlight, syncScroll } from '../../../helpers/highlightTextareaComments';
import Card from '../../ui/Card';
import PageTitle from '../../ui/PageTitle';
import '../../ui/texareaCommentsHighlight.css';

type SimpleDomainListMode = 'allow' | 'block';

type SimpleDomainListProps = {
    mode: SimpleDomainListMode;
};

const SIMPLE_DOMAIN_LIST_CONFIG = {
    allow: {
        titleKey: 'domain_whitelist',
        subtitleKey: 'domain_whitelist_desc',
        saveToastKey: 'simple_domain_list_saved_allow',
        actionHintKey: 'simple_domain_list_hint_allow',
        getRules: () => apiClient.getSimpleAllowlistText(),
        updateRules: (rules: string) => apiClient.updateSimpleAllowlistText({ rules }),
    },
    block: {
        titleKey: 'domain_blacklist',
        subtitleKey: 'domain_blacklist_desc',
        saveToastKey: 'simple_domain_list_saved_block',
        actionHintKey: 'simple_domain_list_hint_block',
        getRules: () => apiClient.getSimpleBlocklistText(),
        updateRules: (rules: string) => apiClient.updateSimpleBlocklistText({ rules }),
    },
} as const;

const SimpleDomainList = ({ mode }: SimpleDomainListProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const highlightRef = useRef<HTMLElement>(null);
    const [rulesText, setRulesText] = useState('');
    const [savedRulesText, setSavedRulesText] = useState('');
    const [processing, setProcessing] = useState(true);
    const [processingSet, setProcessingSet] = useState(false);

    const config = SIMPLE_DOMAIN_LIST_CONFIG[mode];
    const isDirty = rulesText !== savedRulesText;

    useEffect(() => {
        let isMounted = true;

        const loadRules = async () => {
            setProcessing(true);

            try {
                const data = await config.getRules();
                if (!isMounted) {
                    return;
                }

                const nextRules = data?.rules || '';
                setRulesText(nextRules);
                setSavedRulesText(nextRules);
            } catch (error) {
                if (isMounted) {
                    dispatch(addErrorToast({ error }));
                }
            } finally {
                if (isMounted) {
                    setProcessing(false);
                }
            }
        };

        loadRules();

        return () => {
            isMounted = false;
        };
    }, [dispatch, config]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessingSet(true);

        try {
            await config.updateRules(rulesText);
            setSavedRulesText(rulesText);
            dispatch(addSuccessToast(t(config.saveToastKey)));
        } catch (error) {
            dispatch(addErrorToast({ error }));
        } finally {
            setProcessingSet(false);
        }
    };

    return (
        <>
            <PageTitle title={t(config.titleKey)} subtitle={t(config.subtitleKey)} />

            <Card
                id={`${mode}-domain-list`}
                subtitle={t('simple_domain_list_text_desc')}
                bodyType="card-body box-body--settings">
                <form onSubmit={handleSubmit}>
                    <div className="text-edit-container mb-4">
                        <textarea
                            data-testid={`${mode}_domain_list_textarea`}
                            className="form-control font-monospace text-input"
                            value={rulesText}
                            onChange={(event) => setRulesText(event.currentTarget.value)}
                            onScroll={(event) => syncScroll(event, highlightRef)}
                            placeholder={t('simple_domain_list_placeholder')}
                            disabled={processing || processingSet}
                        />
                        {getTextareaCommentsHighlight(highlightRef, rulesText, [COMMENT_LINE_DEFAULT_TOKEN])}
                    </div>

                    <div className="mb-4">
                        <div className="form__desc form__desc--top">
                            <Trans>simple_domain_list_examples_title</Trans>
                        </div>
                        <div className="font-monospace mb-2">aa.cc</div>
                        <div className="font-monospace mb-2">*.aa.cc</div>
                        <div className="font-monospace mb-2">*.a.aa.cc</div>
                        <div className="font-monospace">{COMMENT_LINE_DEFAULT_TOKEN} disabled.example</div>
                    </div>

                    <ul className="mb-4">
                        {[
                            'simple_domain_list_hint_line',
                            'simple_domain_list_hint_wildcard',
                            config.actionHintKey,
                            'simple_domain_list_hint_order',
                            'simple_domain_list_hint_comments',
                        ].map((key) => (
                            <li key={key}>
                                <Trans>{key}</Trans>
                            </li>
                        ))}
                    </ul>

                    <div className="card-actions">
                        <button
                            data-testid={`${mode}_domain_list_save`}
                            className="btn btn-success btn-standard"
                            type="submit"
                            disabled={!isDirty || processing || processingSet}>
                            <Trans>save_btn</Trans>
                        </button>
                    </div>
                </form>
            </Card>
        </>
    );
};

export default SimpleDomainList;
