import React, { useEffect, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import cn from 'classnames';

import Card from '../../ui/Card';
import PageTitle from '../../ui/PageTitle';
import { COMMENT_LINE_DEFAULT_TOKEN } from '../../../helpers/constants';
import { getTextareaCommentsHighlight, syncScroll } from '../../../helpers/highlightTextareaComments';
import { RewritesData } from '../../../initialState';
import '../../ui/texareaCommentsHighlight.css';

type RewritesProps = {
    getRewriteText: () => (dispatch: any) => void;
    handleRewriteRulesChange: (...args: unknown[]) => unknown;
    updateRewriteText: (rules: string) => unknown;
    updateRewriteSettings: (...args: unknown[]) => unknown;
    getRewriteSettings: () => (dispatch: any) => void;
    rewrites: RewritesData;
};

const Rewrites = ({
    getRewriteText,
    handleRewriteRulesChange,
    updateRewriteText,
    updateRewriteSettings,
    getRewriteSettings,
    rewrites,
}: RewritesProps) => {
    const { t } = useTranslation();
    const highlightRef = useRef<HTMLElement>(null);

    useEffect(() => {
        getRewriteText();
        getRewriteSettings();
    }, []);

    const {
        rulesText,
        savedRulesText,
        processing,
        processingSet,
        processingSettings,
        settings,
    } = rewrites;

    const isEnabledSettings = settings.enabled;
    const isDirty = rulesText !== savedRulesText;

    return (
        <>
            <PageTitle title={t('dns_rewrites')} subtitle={t('rewrite_desc')} />

            <div className={cn(isEnabledSettings ? 'text-success' : 'text-warning', 'mb-2')}>
                {isEnabledSettings ? t('rewrites_enabled_table_header') : t('rewrites_disabled_table_header')}
            </div>

            <Card
                id="rewrites"
                subtitle={t('rewrite_text_desc')}
                bodyType="card-body box-body--settings">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        updateRewriteText(rulesText);
                    }}>
                    <div className="text-edit-container mb-4">
                        <textarea
                            data-testid="rewrite_rules_textarea"
                            className="form-control font-monospace text-input"
                            value={rulesText}
                            onChange={(event) => handleRewriteRulesChange({ rulesText: event.currentTarget.value })}
                            onScroll={(event) => syncScroll(event, highlightRef)}
                            placeholder={t('rewrite_text_placeholder')}
                            disabled={processing || processingSet}
                        />
                        {getTextareaCommentsHighlight(highlightRef, rulesText, [COMMENT_LINE_DEFAULT_TOKEN])}
                    </div>

                    <div className="mb-4">
                        <div className="form__desc form__desc--top">
                            <Trans>rewrite_text_examples_title</Trans>
                        </div>
                        <div className="font-monospace mb-2">[example.org *.example.org,foo.bar]:[1.1.1.1, 1.1.1.2][2400:3200::1][alias1.example alias2.example]</div>
                        <div className="font-monospace">{COMMENT_LINE_DEFAULT_TOKEN} [disabled.example]:[192.168.1.10][][]</div>
                    </div>

                    <ul className="mb-4">
                        {[
                            'rewrite_text_hint_match',
                            'rewrite_text_hint_order',
                            'rewrite_text_hint_disable',
                            'rewrite_text_hint_groups',
                        ].map((key) => (
                            <li key={key}>
                                <Trans>{key}</Trans>
                            </li>
                        ))}
                    </ul>

                    <div className="card-actions">
                        <button
                            data-testid="rewrite_rules_save"
                            className="btn btn-success btn-standard mr-2"
                            type="submit"
                            disabled={!isDirty || processing || processingSet}>
                            <Trans>save_btn</Trans>
                        </button>

                        <button
                            data-testid="toggle-rewrite-settings"
                            type="button"
                            className="btn btn-primary btn-standard"
                            onClick={() => updateRewriteSettings({ enabled: !isEnabledSettings })}
                            disabled={processingSettings}>
                            <Trans>{isEnabledSettings ? 'disable_rewrites' : 'enable_rewrites'}</Trans>
                        </button>
                    </div>
                </form>
            </Card>
        </>
    );
};

export default Rewrites;
